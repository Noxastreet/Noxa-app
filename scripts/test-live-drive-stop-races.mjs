import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

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
let writeGate = null;
let rpcGate = null;
let rpcError = null;
let authUserId = 'user-a';
const rpcCalls = [];
const authResult = () => ({ data: { session: { user: { id: authUserId } } }, error: null });
const sample = { coords: { latitude: 38, longitude: 23, accuracy: 5, heading: 90 }, timestamp: Date.now() };
const Location = {
  PermissionStatus: { GRANTED: 'granted' }, Accuracy: { High: 4 },
  ActivityType: { AutomotiveNavigation: 1 },
  getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  getBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
  hasStartedLocationUpdatesAsync: async () => running,
  stopLocationUpdatesAsync: async () => { running = false; },
};
const supabase = {
  rpc: async (name, args) => {
    rpcCalls.push({ name, args });
    if (rpcGate) await rpcGate.promise;
    return { data: rpcError ? null : true, error: rpcError };
  },
  auth: {
    getSession: () => authGate ? authGate.promise : Promise.resolve(authResult()),
    onAuthStateChange: () => ({}),
  },
  from: () => ({
    upsert: async () => {
      if (writeGate) await writeGate.promise;
      serverRow = true;
      return { error: null };
    },
    delete: () => {
      const builder = {
        eq: () => builder,
        then: (resolve) => { serverRow = false; return Promise.resolve({ error: null }).then(resolve); },
      };
      return builder;
    },
  }),
};
const output = ts.transpileModule(fs.readFileSync('src/lib/liveDrive.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
const deps = {
  'expo-location': Location,
  'expo-task-manager': { isTaskDefined: () => false, defineTask: (_name, handler) => { task = handler; } },
  '@/src/lib/supabase': { supabase },
};
new Function('require', 'module', 'exports', output)((id) => {
  if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`);
  return deps[id];
}, module, module.exports);
const live = module.exports;
const callback = () => task({ data: { locations: [sample] }, error: null });

await live.startLiveDriveSession('user-a', 'friends', sample);
running = true;
authGate = deferred();
const oldAuth = authGate;
const delayedAuth = callback();
await tick();
await live.stopLiveDriveSession(true);
authGate = null;
oldAuth.resolve(authResult());
await delayedAuth;
assert.equal(serverRow, false, 'A callback paused in auth must not republish after Ghost');
assert.equal(running, false);

await live.startLiveDriveSession('user-a', 'friends', sample);
running = true;
writeGate = deferred();
const oldWrite = writeGate;
const delayedWrite = callback();
await tick();
let stopComplete = false;
const stopping = live.stopLiveDriveSession(true).then(() => { stopComplete = true; });
await tick();
assert.equal(stopComplete, false, 'Ghost must drain an issued presence write');
assert.equal(running, false, 'Collection must stop before the network wait');
writeGate = null;
oldWrite.resolve();
await Promise.all([delayedWrite, stopping]);
assert.equal(serverRow, false, 'Final cleanup must remove a late background presence write');
assert.equal(live.getLiveDriveSession(), null);
console.log('Personal Live Drive Stop races: PASS (delayed auth, issued write, native collection stop)');

// Foreground RPC sends participate in the very same Stop barrier.
await live.startLiveDriveSession('user-a', 'friends', sample);
rpcGate = deferred();
const heldRpc = rpcGate;
const publishing = live.broadcastLiveDriverLocation('user-a', sample.coords);
await tick();
assert.equal(rpcCalls.length, 1);
assert.deepEqual(rpcCalls[0], { name: 'noxa_broadcast_my_driver_location', args: {
  expected_user_id: 'user-a', sample_latitude: 38, sample_longitude: 23,
} });
assert.equal(await live.broadcastLiveDriverLocation('user-a', sample.coords), false,
  'Slow network must drop intermediate samples rather than build a GPS backlog');
let rpcStopComplete = false;
const stopDuringRpc = live.stopLiveDriveSession(true).then(() => { rpcStopComplete = true; });
await tick();
assert.equal(rpcStopComplete, false, 'Ghost/sign-out waits for the issued RPC before final cleanup');
assert.equal(await live.broadcastLiveDriverLocation('user-a', sample.coords), false);
rpcGate = null; heldRpc.resolve();
await Promise.all([publishing, stopDuringRpc]);
assert.equal(serverRow, false);

await live.startLiveDriveSession('user-a', 'friends', sample);
rpcCalls.length = 0;
authGate = deferred();
const heldAuth = authGate;
const queuedBroadcast = live.broadcastLiveDriverLocation('user-a', sample.coords);
await tick();
const stopDuringRpcAuth = live.stopLiveDriveSession(true);
authGate = null; heldAuth.resolve(authResult());
await Promise.all([queuedBroadcast, stopDuringRpcAuth]);
assert.equal(rpcCalls.length, 0, 'Stop while auth is pending must prevent an RPC from being issued');

await live.startLiveDriveSession('user-a', 'friends', sample);
authUserId = 'user-b';
assert.equal(await live.broadcastLiveDriverLocation('user-a', sample.coords), false);
assert.equal(rpcCalls.length, 0, 'Coordinates from A must not be published under B');
authUserId = 'user-a';
rpcError = { message: 'function not found / network unavailable' };
assert.equal(await live.broadcastLiveDriverLocation('user-a', sample.coords), false,
  'Missing RPC/network must fail closed, without raw WebSocket fallback');
rpcError = null;
assert.equal(await live.broadcastLiveDriverLocation('user-a', sample.coords), true, 'A later valid sample can recover');
await live.stopLiveDriveSession(true);
console.log('Foreground Live Drive RPC privacy: PASS (Stop drain, delayed auth, account isolation, bounded in-flight work, failure/recovery)');
