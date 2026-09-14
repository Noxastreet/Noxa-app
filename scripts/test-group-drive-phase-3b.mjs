import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
  key: (index) => Array.from(storage.keys())[index] ?? null,
  get length() { return storage.size; },
};

let taskHandler = null;
let taskStarted = false;
let taskStopped = false;
let foregroundStatus = 'granted';
let backgroundStatus = 'granted';
let androidAccuracy = 'fine';
let rpcError = null;
let rpcCalls = [];
let authUserId = 'user-a';
let authChange = null;

const currentLocation = {
  coords: {
    latitude: 38.01,
    longitude: 23.72,
    heading: 90,
    accuracy: 5,
    altitude: null,
    altitudeAccuracy: null,
    speed: 12,
  },
  timestamp: Date.now(),
};

const foregroundPermission = () => ({
  status: foregroundStatus,
  android: { accuracy: androidAccuracy },
});

const Location = {
  PermissionStatus: { GRANTED: 'granted' },
  Accuracy: { High: 4 },
  ActivityType: { AutomotiveNavigation: 1 },
  isBackgroundLocationAvailableAsync: async () => true,
  requestForegroundPermissionsAsync: async () => foregroundPermission(),
  requestBackgroundPermissionsAsync: async () => ({ status: backgroundStatus }),
  getForegroundPermissionsAsync: async () => foregroundPermission(),
  getBackgroundPermissionsAsync: async () => ({ status: backgroundStatus }),
  hasStartedLocationUpdatesAsync: async () => taskStarted,
  startLocationUpdatesAsync: async () => { taskStarted = true; taskStopped = false; },
  stopLocationUpdatesAsync: async () => { taskStarted = false; taskStopped = true; },
  getCurrentPositionAsync: async () => currentLocation,
};

const TaskManager = {
  isTaskDefined: () => false,
  defineTask: (_name, handler) => { taskHandler = handler; },
  isAvailableAsync: async () => true,
};

const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: authUserId ? { user: { id: authUserId } } : null },
      error: null,
    }),
    getUser: async () => ({
      data: { user: authUserId ? { id: authUserId } : null },
      error: null,
    }),
    onAuthStateChange: (callback) => {
      authChange = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    },
  },
  rpc: async (name, args) => {
    rpcCalls.push({ name, args });
    if (rpcError) return { data: null, error: rpcError };
    return {
      data: name === 'noxa_clear_my_drive_location' ? true : 'opaque-location-id',
      error: null,
    };
  },
};

const realtime = {
  loadActiveDriveRealtimeSnapshot: async (driveSessionId) => ({
    sessionStatus: 'active',
    activeExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    participants: [{ userId: authUserId, status: 'active' }],
    locations: { driveSessionId, byOpaqueId: {}, opaqueIdByUserId: {} },
  }),
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

const native = compile('src/features/group-drive/runtime/nativeLocation.ts', {
  'expo-location': Location,
  'expo-task-manager': TaskManager,
  '@/src/lib/supabase': { supabase },
  './realtime': realtime,
});

assert.equal(typeof taskHandler, 'function', 'background task must be defined at module load');

const consent = native.acceptGroupDriveLocationDisclosure('drive-a');
assert.equal(consent.driveSessionId, 'drive-a');
assert.equal(consent.scope, 'group-drive-precise-location-v1');

foregroundStatus = 'denied';
await assert.rejects(
  native.requestGroupDriveLocationPermissions(),
  /Precise location is required for Group Drive/,
  'foreground refusal must fail closed',
);
assert.equal(taskStarted, false, 'permission refusal must not start native location');
foregroundStatus = 'granted';

androidAccuracy = 'coarse';
await assert.rejects(
  native.requestGroupDriveLocationPermissions(),
  /Precise location is required for Group Drive/,
  'Android coarse location must fail closed',
);
androidAccuracy = 'fine';

currentLocation.coords.accuracy = 5000;
await assert.rejects(
  native.requestGroupDriveLocationPermissions(),
  /Precise location is unavailable/,
  'kilometer-scale location uncertainty must fail closed on Expo 54',
);
currentLocation.coords.accuracy = 5;
backgroundStatus = 'granted';

await assert.rejects(
  native.startGroupDriveLocationSession({
    driveSessionId: 'drive-a',
    acceptedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    scope: 'group-drive-precise-location-v1',
  }),
  /Confirm Group Drive location sharing/,
  'stale disclosure must not start sharing',
);
assert.equal(taskStarted, false);

await native.requestGroupDriveLocationPermissions();
const session = await native.startGroupDriveLocationSession(consent);
assert.equal(session.driveSessionId, 'drive-a');
assert.equal(session.userId, 'user-a');
assert.equal(taskStarted, true, 'valid scoped consent must start the dedicated task');
assert.equal(rpcCalls.at(-1).name, 'noxa_upsert_drive_location');
assert.deepEqual(rpcCalls.at(-1).args, {
  target_drive_session_id: 'drive-a',
  location_latitude: 38.01,
  location_longitude: 23.72,
  location_heading: 90,
  location_status: 'moving',
});
assert.equal(native.getGroupDriveLocationSession()?.driveSessionId, 'drive-a');

rpcError = { message: 'Network request failed' };
await taskHandler({
  data: { locations: [{ ...currentLocation, coords: { ...currentLocation.coords, longitude: 23.73 } }] },
  error: null,
});
assert.equal(taskStarted, true, 'transient publish failure must keep the writer alive for retry');
assert.equal(native.getGroupDriveLocationSession()?.driveSessionId, 'drive-a');

currentLocation.coords.accuracy = 5000;
await taskHandler({ data: { locations: [currentLocation] }, error: null });
assert.equal(taskStarted, true, 'failed privacy cleanup must keep the writer alive so cleanup can retry');
assert.equal(native.getGroupDriveLocationSession()?.driveSessionId, 'drive-a');
assert.equal(rpcCalls.at(-1).name, 'noxa_clear_my_drive_location');

rpcError = null;
await taskHandler({ data: { locations: [currentLocation] }, error: null });
assert.equal(taskStarted, false, 'successful imprecision cleanup must stop Group Drive publishing');
assert.equal(taskStopped, true);
assert.equal(native.getGroupDriveLocationSession(), null, 'precision loss must clear local Group Drive state');
assert.equal(rpcCalls.at(-1).name, 'noxa_clear_my_drive_location');
currentLocation.coords.accuracy = 5;

const secondConsent = native.acceptGroupDriveLocationDisclosure('drive-a');
await native.startGroupDriveLocationSession(secondConsent);
assert.equal(taskStarted, true);
rpcError = { message: 'Only an active Group Drive participant can publish location' };
await taskHandler({ data: { locations: [currentLocation] }, error: null });
assert.equal(taskStarted, false, 'authorization revocation must stop native location');
assert.equal(native.getGroupDriveLocationSession(), null, 'authorization revocation must clear local runtime state');

rpcError = null;
taskStopped = false;
const thirdConsent = native.acceptGroupDriveLocationDisclosure('drive-a');
await native.startGroupDriveLocationSession(thirdConsent);
assert.equal(taskStarted, true);
authChange?.('SIGNED_OUT');
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(taskStarted, false, 'sign-out must stop the Group Drive writer');
assert.equal(native.getGroupDriveLocationSession(), null, 'sign-out must clear local Group Drive session');

console.log('Group Drive Phase 3B deterministic native runtime smoke: PASS');
