import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();

function compile(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected test dependency: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

const state = compile('src/features/group-drive/runtime/locationState.ts');
const simulationModule = compile('src/features/group-drive/runtime/simulation.ts', {
  './locationState': state,
});

const row = (id, userId, driveSessionId = 'drive-a') => ({
  id,
  driveSessionId,
  userId,
  latitude: 34.7,
  longitude: 33.0,
  heading: null,
  status: 'moving',
  updatedAt: '2026-08-20T12:00:00.000Z',
});

let snapshot = state.emptyGroupDriveLocationSnapshot('drive-a');
snapshot = state.reduceGroupDriveLocationState(snapshot, {
  type: 'snapshot', rows: [row('opaque-a', 'user-a'), row('opaque-b', 'user-b')],
});
assert.equal(state.groupDriveLocations(snapshot).length, 2);
assert.equal(snapshot.opaqueIdByUserId['user-a'], 'opaque-a');

const unchanged = state.reduceGroupDriveLocationState(snapshot, {
  type: 'upsert', row: row('foreign', 'user-c', 'drive-b'),
});
assert.equal(unchanged, snapshot, 'cross-drive rows must be ignored');

snapshot = state.reduceGroupDriveLocationState(snapshot, {
  type: 'upsert', row: row('opaque-a2', 'user-a'),
});
assert.equal(snapshot.byOpaqueId['opaque-a'], undefined);
assert.equal(snapshot.opaqueIdByUserId['user-a'], 'opaque-a2');
snapshot = state.reduceGroupDriveLocationState(snapshot, { type: 'delete', opaqueId: 'opaque-a2' });
assert.equal(snapshot.opaqueIdByUserId['user-a'], undefined);

const simulation = simulationModule.createGroupDriveSimulation('drive-a', [
  { userId: 'user-a', path: [{ latitude: 1, longitude: 1 }, { latitude: 2, longitude: 2 }] },
  { userId: 'user-b', path: [{ latitude: 3, longitude: 3 }] },
]);
simulation.tick(new Date('2026-08-20T12:00:00.000Z'));
assert.equal(simulation.snapshot.byOpaqueId['sim-user-a'].status, 'moving');
assert.equal(simulation.snapshot.byOpaqueId['sim-user-b'].status, 'arrived');
simulation.tick(new Date('2026-08-20T12:00:15.000Z'));
assert.equal(simulation.snapshot.byOpaqueId['sim-user-a'].status, 'arrived');
simulation.remove('user-b');
simulation.tick(new Date('2026-08-20T12:00:30.000Z'));
assert.equal(simulation.snapshot.opaqueIdByUserId['user-b'], undefined, 'removed users stay removed');
simulation.reset();
assert.equal(state.groupDriveLocations(simulation.snapshot).length, 0);

let releaseReconcile;
const reconcileGate = new Promise((resolve) => { releaseReconcile = resolve; });
const databaseRows = [
  [row('opaque-live', 'user-a')],
  [row('opaque-live', 'user-a')],
];
let snapshotIndex = -1;
let activeSnapshotIndex = 0;
const handlers = {};
let subscriptionStatus;

function resultFor(table, index) {
  const value = table === 'drive_sessions'
    ? { data: { status: 'active', active_expires_at: '2026-08-20T20:00:00.000Z' }, error: null }
    : table === 'drive_participants'
      ? { data: [{ user_id: 'user-a', status: 'active' }], error: null }
      : { data: databaseRows[index].map((item) => ({
          id: item.id,
          drive_session_id: item.driveSessionId,
          user_id: item.userId,
          latitude: item.latitude,
          longitude: item.longitude,
          heading: item.heading,
          status: item.status,
          updated_at: item.updatedAt,
        })), error: null };
  return index === 1 ? reconcileGate.then(() => value) : Promise.resolve(value);
}

const channel = {
  on(_type, config, callback) { handlers[config.event] = callback; return this; },
  subscribe(callback) { subscriptionStatus = callback; return this; },
};
const supabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from(table) {
    if (table === 'drive_sessions') activeSnapshotIndex = ++snapshotIndex;
    const index = activeSnapshotIndex;
    return {
      select() { return this; },
      eq() { return this; },
      maybeSingle() { return resultFor(table, index); },
      then(resolve, reject) { return resultFor(table, index).then(resolve, reject); },
    };
  },
  channel: () => channel,
  removeChannel: async () => 'ok',
};
const realtime = compile('src/features/group-drive/runtime/realtime.ts', {
  '@/src/lib/supabase': { supabase },
  './locationState': state,
});
const published = [];
const teardown = await realtime.subscribeToActiveDriveRealtime('drive-a', {
  onSnapshot: (value) => published.push(value),
});
subscriptionStatus('SUBSCRIBED');
await Promise.resolve();
handlers.UPDATE({ new: {
  id: 'opaque-live', drive_session_id: 'drive-a', user_id: 'user-a',
  latitude: 35.5, longitude: 33, heading: null, status: 'moving',
  updated_at: '2026-08-20T12:00:15.000Z',
} });
releaseReconcile();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(
  published.at(-1).locations.byOpaqueId['opaque-live'].latitude,
  35.5,
  'in-flight Realtime events must be applied after a late snapshot response',
);
await teardown();

console.log('Group Drive Phase 3A simulation/state smoke: PASS (11 checks)');
