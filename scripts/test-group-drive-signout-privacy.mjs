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
let clearError = null;
let userId = 'user-a';
const calls = [];
const sample = { coords: { latitude: 38, longitude: 23, accuracy: 5, heading: 90 }, timestamp: Date.now() };
const authResult = () => ({ data: { session: { user: { id: userId } } }, error: null });
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
    getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    onAuthStateChange: () => ({}),
  },
  rpc: async (name) => {
    calls.push(name);
    if (name === 'noxa_upsert_drive_location') {
      if (publishGate) await publishGate.promise;
      serverRow = true;
    }
    if (name === 'noxa_clear_my_drive_location') {
      if (clearError) return { data: null, error: clearError };
      serverRow = false;
    }
    return { data: name === 'noxa_clear_my_drive_location' ? true : 'row', error: null };
  },
};
const native = compile('src/features/group-drive/runtime/nativeLocation.ts', {
  'expo-location': location,
  'expo-task-manager': { isTaskDefined: () => false, defineTask: (_name, handler) => { task = handler; } },
  '@/src/lib/supabase': { supabase },
  './realtime': { loadActiveDriveRealtimeSnapshot: async () => ({ activeExpiresAt: new Date(Date.now() + 3600000).toISOString() }) },
});
const start = () => native.startGroupDriveLocationSession(native.acceptGroupDriveLocationDisclosure('drive-a'));
const callback = () => task({ data: { locations: [sample] }, error: null });

// Sign-out must invalidate a start that is still awaiting GPS.
gpsGate = deferred();
const oldGps = gpsGate;
const starting = assert.rejects(start(), /cancelled/);
await tick();
await native.clearGroupDriveLocationBeforeSignOut();
gpsGate = null;
oldGps.resolve(sample);
await starting;
assert.equal(running, false);
assert.equal(serverRow, false, 'Sign-out during GPS startup must prevent a later publish');

// An issued write must finish before the final server deletion.
await start();
calls.length = 0;
publishGate = deferred();
const oldWrite = publishGate;
const writing = callback();
await tick();
let finished = false;
const signingOut = native.clearGroupDriveLocationBeforeSignOut().then(() => { finished = true; });
await tick();
assert.equal(finished, false, 'Sign-out must drain the in-flight write');
assert.equal(running, false, 'Native collection stops before awaiting network');
await assert.rejects(start(), /sign out is still finishing/);
publishGate = null;
oldWrite.resolve();
await Promise.all([writing, signingOut]);
assert.equal(serverRow, false);
assert.equal(calls.at(-1), 'noxa_clear_my_drive_location');
assert.equal(native.getGroupDriveLocationSession(), null);

// Cleanup failure must preserve a retry without restoring publish consent.
await start();
clearError = { message: 'Network request failed' };
await assert.rejects(native.clearGroupDriveLocationBeforeSignOut(), /could not be cleared/);
assert.equal(running, false);
assert.equal(native.getGroupDriveLocationSession(), null);
const cleanupKey = 'noxa.group-drive-signout-cleanup.v1:user-a';
assert.ok(storage.has(cleanupKey));
calls.length = 0;
await callback();
assert.equal(calls.length, 0, 'Late native callbacks must not resume after a failed logout');
await assert.rejects(start(), /cleanup/);
// Another account must neither clear nor consume A's retry record.
userId = 'user-b';
clearError = null;
await native.clearGroupDriveLocationBeforeSignOut();
assert.equal(calls.length, 0);
assert.ok(storage.has(cleanupKey));
userId = 'user-a';
// Reload the module to model an app restart: only persisted retry state remains.
const restarted = compile('src/features/group-drive/runtime/nativeLocation.ts', {
  'expo-location': location,
  'expo-task-manager': { isTaskDefined: () => true },
  '@/src/lib/supabase': { supabase },
  './realtime': {},
});
await restarted.clearGroupDriveLocationBeforeSignOut();
assert.equal(serverRow, false);
assert.equal(storage.has(cleanupKey), false);

// Pending auth callbacks cannot restore the row after logout.
await start();
authGate = deferred();
const oldAuth = authGate;
const delayedAuth = callback();
await tick();
const logoutDuringAuth = native.clearGroupDriveLocationBeforeSignOut();
authGate = null;
oldAuth.resolve(authResult());
await Promise.all([delayedAuth, logoutDuringAuth]);
assert.equal(serverRow, false);

// A native start which resolves after logout is cancelled again.
nativeStartGate = deferred();
const oldNative = nativeStartGate;
const delayedStart = assert.rejects(start(), /cancelled/);
await tick();
await native.clearGroupDriveLocationBeforeSignOut();
nativeStartGate = null;
oldNative.resolve();
await delayedStart;
assert.equal(running, false);
assert.equal(serverRow, false);
console.log('Group Drive sign-out regressions: PASS (startup, issued write, retry isolation, delayed auth/native start)');
