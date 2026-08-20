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

console.log('Group Drive Phase 3A simulation/state smoke: PASS (10 checks)');
