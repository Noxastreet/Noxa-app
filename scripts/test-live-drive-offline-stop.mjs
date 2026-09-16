import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const storage = new Map();
const storageOperations = [];
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => { storageOperations.push(['set', key]); storage.set(key, String(value)); },
  removeItem: (key) => { storageOperations.push(['remove', key]); storage.delete(key); },
  clear: () => storage.clear(),
  key: (index) => Array.from(storage.keys())[index] ?? null,
  get length() { return storage.size; },
};

const scheduledTimers = [];
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, delay = 0) => {
  const token = { callback, delay };
  scheduledTimers.push(token);
  return token;
};

let taskStarted = true;
let taskStopped = false;
let networkOffline = true;
let authUserId = 'user-a';
let authChange = null;
const deleteCalls = [];

const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
localStorage.setItem('noxa.live-drive-session.v1', JSON.stringify({
  userId: 'user-a',
  visibilityMode: 'friends',
  expiresAt,
}));
storageOperations.length = 0;

const Location = {
  PermissionStatus: { GRANTED: 'granted' },
  Accuracy: { High: 4 },
  ActivityType: { AutomotiveNavigation: 1 },
  isBackgroundLocationAvailableAsync: async () => true,
  requestForegroundPermissionsAsync: async () => ({ status: 'granted', android: { accuracy: 'fine' } }),
  requestBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
  getForegroundPermissionsAsync: async () => ({ status: 'granted', android: { accuracy: 'fine' } }),
  getBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
  hasServicesEnabledAsync: async () => true,
  hasStartedLocationUpdatesAsync: async () => taskStarted,
  startLocationUpdatesAsync: async () => { taskStarted = true; taskStopped = false; },
  stopLocationUpdatesAsync: async () => { taskStarted = false; taskStopped = true; },
  getCurrentPositionAsync: async () => ({
    coords: { latitude: 38.01, longitude: 23.72, heading: 90, accuracy: 5, altitude: null, altitudeAccuracy: null, speed: 10 },
    timestamp: Date.now(),
  }),
};

const TaskManager = {
  isTaskDefined: () => false,
  defineTask: () => undefined,
  isAvailableAsync: async () => true,
};

function deleteBuilder() {
  const filters = [];
  const builder = {
    eq(column, value) {
      filters.push([column, value]);
      return builder;
    },
    then(resolve) {
      deleteCalls.push(filters.slice());
      return Promise.resolve(
        networkOffline ? { error: { message: 'Network request failed' } } : { error: null },
      ).then(resolve);
    },
  };
  return builder;
}

const supabase = {
  from(table) {
    assert.equal(table, 'driver_locations');
    return {
      delete: () => deleteBuilder(),
      upsert: async () => ({ error: null }),
    };
  },
  auth: {
    getSession: async () => ({
      data: { session: authUserId ? { user: { id: authUserId } } : null },
      error: null,
    }),
    onAuthStateChange: (callback) => {
      authChange = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    },
  },
};

function compile(file, dependencies) {
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

try {
  const liveDrive = compile('src/lib/liveDrive.ts', {
    'expo-location': Location,
    'expo-task-manager': TaskManager,
    '@/src/lib/supabase': { supabase },
  });

  await liveDrive.stopLiveDriveSession(true);

  assert.equal(taskStarted, false, 'Ghost must stop native GPS even while offline');
  assert.equal(taskStopped, true, 'Ghost must call native stop while offline');
  assert.equal(localStorage.getItem('noxa.live-drive-session.v1'), null, 'Ghost must clear the active local session');
  assert.ok(localStorage.getItem('noxa.live-drive-pending-cleanup.v1'), 'Failed server delete must remain pending');
  const pendingSetIndex = storageOperations.findIndex(([op, key]) =>
    op === 'set' && key === 'noxa.live-drive-pending-cleanup.v1');
  const sessionRemoveIndex = storageOperations.findIndex(([op, key]) =>
    op === 'remove' && key === 'noxa.live-drive-session.v1');
  assert.ok(
    pendingSetIndex >= 0 && sessionRemoveIndex >= 0 && pendingSetIndex < sessionRemoveIndex,
    'Ghost must persist scoped cleanup intent before clearing the local session',
  );
  assert.deepEqual(deleteCalls.at(-1), [
    ['user_id', 'user-a'],
    ['share_expires_at', expiresAt],
  ], 'cleanup must be scoped to the stopped Live Drive session');
  assert.equal(scheduledTimers.length, 1, 'offline cleanup must schedule a bounded retry');

  networkOffline = false;
  const retry = scheduledTimers.shift();
  retry.callback();
  for (let index = 0; index < 3; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  assert.equal(localStorage.getItem('noxa.live-drive-pending-cleanup.v1'), null, 'successful retry must clear pending cleanup');
  assert.deepEqual(deleteCalls.at(-1), [
    ['user_id', 'user-a'],
    ['share_expires_at', expiresAt],
  ], 'retry must never broaden deletion beyond the stopped session');

  localStorage.setItem('noxa.live-drive-pending-cleanup.v1', JSON.stringify({
    userId: 'user-a',
    shareExpiresAt: expiresAt,
  }));
  authUserId = 'user-b';
  authChange?.('SIGNED_IN', { user: { id: 'user-b' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(localStorage.getItem('noxa.live-drive-pending-cleanup.v1'), 'another account must not consume user A cleanup');

  console.log('Live Drive offline-stop deterministic smoke: PASS');
} finally {
  globalThis.setTimeout = originalSetTimeout;
}
