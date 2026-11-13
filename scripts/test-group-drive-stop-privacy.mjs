import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function compile(file, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  }, module, module.exports);
  return module.exports;
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
let task;
let running = false;
let serverRow = false;
let authGate = null;
let publishGate = null;
let gpsGate = null;
let nativeStartGate = null;
const calls = [];
const sample = { coords: { latitude: 38, longitude: 23, accuracy: 5, heading: 90 }, timestamp: Date.now() };
const authResult = () => ({ data: { session: { user: { id: 'user-a' } } }, error: null });
const location = {
  PermissionStatus: { GRANTED: 'granted' }, Accuracy: { High: 4 },
  ActivityType: { AutomotiveNavigation: 1 },
  getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  getBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
  getCurrentPositionAsync: async () => gpsGate ? gpsGate.promise : sample,
  hasStartedLocationUpdatesAsync: async () => running,
  stopLocationUpdatesAsync: async () => { running = false; },
  startLocationUpdatesAsync: async () => {
    if (nativeStartGate) await nativeStartGate.promise;
    running = true;
  },
};
const supabase = {
  auth: {
    getSession: () => authGate ? authGate.promise : Promise.resolve(authResult()),
    getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }),
    onAuthStateChange: () => ({}),
  },
  rpc: async (name) => {
    calls.push(name);
    if (name === 'noxa_upsert_drive_location') {
      if (publishGate) await publishGate.promise;
      serverRow = true;
    }
    if (name === 'noxa_clear_my_drive_location') serverRow = false;
    return { data: name === 'noxa_clear_my_drive_location' ? true : 'row', error: null };
  },
};
const native = compile('src/features/group-drive/runtime/nativeLocation.ts', {
  'expo-location': location,
  'expo-task-manager': { isTaskDefined: () => false, defineTask: (_name, handler) => { task = handler; } },
  '@/src/lib/supabase': { supabase },
  './realtime': { loadActiveDriveRealtimeSnapshot: async () => ({ activeExpiresAt: new Date(Date.now() + 3600000).toISOString() }) },
});
const pending = compile('src/features/group-drive/runtime/pendingServerAction.ts', { '@/src/lib/supabase': { supabase } });
const control = compile('src/features/group-drive/runtime/locationSharingControl.ts', {
  '@/src/lib/supabase': { supabase }, './nativeLocation': native, './pendingServerAction': pending,
});
const start = () => native.startGroupDriveLocationSession(native.acceptGroupDriveLocationDisclosure('drive-a'));
const callback = () => task({ data: { locations: [sample] }, error: null });

await start();
calls.length = 0;
authGate = deferred();
const oldAuthGate = authGate;
const delayedAuth = callback();
await tick();
const stoppedDuringAuth = control.stopGroupDriveLocationSharing('drive-a');
authGate = null;
await tick();
oldAuthGate.resolve(authResult());
await Promise.all([delayedAuth, stoppedDuringAuth]);
assert.equal(serverRow, false, 'Stop must prevent a callback paused in auth from republishing');
assert.equal(calls.filter((name) => name === 'noxa_upsert_drive_location').length, 0);
assert.equal(running, false);

await start();
calls.length = 0;
publishGate = deferred();
const oldPublishGate = publishGate;
const issuedWrite = callback();
await tick();
assert.equal(calls.at(-1), 'noxa_upsert_drive_location');
let stopCompleted = false;
const stoppedDuringWrite = control.stopGroupDriveLocationSharing('drive-a').then(() => { stopCompleted = true; });
await tick();
assert.equal(stopCompleted, false, 'Stop must drain an already-issued request before final cleanup');
assert.equal(running, false, 'Native collection must stop before draining the network request');
publishGate = null;
oldPublishGate.resolve();
await Promise.all([issuedWrite, stoppedDuringWrite]);
assert.equal(serverRow, false, 'The final server operation must clear any late location write');
assert.equal(calls.at(-1), 'noxa_clear_my_drive_location');
assert.equal(native.getGroupDriveLocationSession(), null);

gpsGate = deferred();
const oldGpsGate = gpsGate;
const cancelledStart = assert.rejects(start(), /cancelled/);
await tick();
await control.stopGroupDriveLocationSharing('drive-a');
gpsGate = null;
oldGpsGate.resolve(sample);
await cancelledStart;
assert.equal(serverRow, false, 'Stop during GPS startup must prevent the initial publish');
assert.equal(running, false);

nativeStartGate = deferred();
const oldNativeGate = nativeStartGate;
const cancelledNativeStart = assert.rejects(start(), /cancelled/);
await tick();
await control.stopGroupDriveLocationSharing('drive-a');
nativeStartGate = null;
oldNativeGate.resolve();
await cancelledNativeStart;
assert.equal(running, false, 'A delayed native start completing after Stop must be stopped again');
assert.equal(serverRow, false);

const state = compile('src/features/group-drive/runtime/locationState.ts');
const now = Date.now();
const row = (userId, age) => ({
  id: `opaque-${userId}`, driveSessionId: 'drive-a', userId,
  latitude: 38, longitude: 23, heading: null, status: 'moving',
  updatedAt: new Date(now - age).toISOString(),
});
const cached = state.reduceGroupDriveLocationState(state.emptyGroupDriveLocationSnapshot('drive-a'), {
  type: 'snapshot', rows: [row('user-a', 300000), row('user-b', 1000), row('user-c', 120001)],
});
let visible = state.retainVisibleGroupDriveLocations(cached, new Set(['user-a', 'user-b', 'user-c']), 'user-a', now);
assert.deepEqual(state.groupDriveLocations(visible).map((item) => item.userId), ['user-a', 'user-b']);
visible = state.retainVisibleGroupDriveLocations(visible, new Set(['user-a']), 'user-a', now);
assert.deepEqual(state.groupDriveLocations(visible).map((item) => item.userId), ['user-a'], 'Revoked participant coordinates must leave the cache');
visible = state.retainVisibleGroupDriveLocations(cached, new Set(['user-a', 'user-b', 'user-c']), 'user-a', now + 120000);
assert.deepEqual(state.groupDriveLocations(visible).map((item) => item.userId), ['user-a'], 'Freshness must expire without a DELETE event');
console.log('Group Drive Stop/privacy regressions: PASS (auth race, issued-write race, GPS/native startup cancellation, stale/revoked cache)');
