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
const authResult = () => ({ data: { session: { user: { id: 'user-a' } } }, error: null });
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
