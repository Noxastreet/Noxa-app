import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const liveDrive = fs.readFileSync('src/lib/liveDrive.ts', 'utf8');
const liveDriveError = fs.readFileSync('src/lib/liveDriveError.ts', 'utf8');
const permissionFlow = fs.readFileSync('src/lib/liveDrivePermissionFlow.ts', 'utf8');
const mapScreen = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const visibilitySetup = fs.readFileSync('app/visibility-setup.tsx', 'utf8');
const appJson = fs.readFileSync('app.json', 'utf8');

const permissionsIndex = liveDrive.indexOf('export async function requestLiveDrivePermissions()');
const accessIndex = liveDrive.indexOf('export async function hasLiveDriveRuntimeAccess()', permissionsIndex);
const permissionsSlice = liveDrive.slice(permissionsIndex, accessIndex);

assert(permissionsIndex >= 0, 'Personal visibility permission flow must exist.');
assert(
  permissionsSlice.includes('Location.requestForegroundPermissionsAsync()')
    && permissionsSlice.includes('Location.requestBackgroundPermissionsAsync()')
    && permissionsSlice.includes('Location.isBackgroundLocationAvailableAsync()'),
  'Personal visibility must explicitly request the foreground and background location access required for minimized sharing.',
);
assert(
  permissionsSlice.includes('const current = await getPreciseLocationSample();')
    && permissionsSlice.includes('return current;'),
  'Personal visibility must validate and return one precise foreground sample before starting.',
);
assert(
  permissionFlow.includes('return requestLiveDrivePermissions();'),
  'Personal visibility wrapper must delegate to the canonical Live Drive permission flow.',
);

const backgroundStartIndex = liveDrive.indexOf('export async function startLiveDriveBackgroundUpdates()');
const backgroundStopIndex = liveDrive.indexOf('export async function stopLiveDriveBackgroundUpdates()', backgroundStartIndex);
const backgroundSlice = liveDrive.slice(backgroundStartIndex, backgroundStopIndex);
assert(
  backgroundSlice.includes('Location.startLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME')
    && backgroundSlice.includes('Location.ActivityType.AutomotiveNavigation')
    && backgroundSlice.includes('Location.hasStartedLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME)'),
  'Minimized personal visibility must reuse the existing dedicated Live Drive background task.',
);

const startIndex = liveDrive.indexOf('export async function startLiveDriveSession(');
const visibilityIndex = liveDrive.indexOf('export async function updateLiveDriveVisibility(', startIndex);
const startSlice = liveDrive.slice(startIndex, visibilityIndex);
assert(
  startSlice.includes('initialLocation: Location.LocationObject')
    && startSlice.includes('await upsertLiveDrivePresence(')
    && startSlice.includes('initialLocation.coords'),
  'Personal visibility start must publish the already-validated location sample before succeeding.',
);
assert(
  !startSlice.includes('startLocationUpdatesAsync'),
  'Starting visibility in the foreground must not create a second GPS writer.',
);

const writeIndex = mapScreen.indexOf('const writePresencePayload = useCallback(');
const startSharingIndex = mapScreen.indexOf('const startSharing = useCallback(', writeIndex);
const foregroundPresenceSlice = mapScreen.slice(writeIndex, startSharingIndex);
assert(
  foregroundPresenceSlice.includes('!isAppForegroundRef.current')
    && foregroundPresenceSlice.includes('driverLocation')
    && foregroundPresenceSlice.includes('writePresencePayload(userId, payload)'),
  'Foreground personal presence must reuse the existing Mapbox location stream.',
);
assert(
  !foregroundPresenceSlice.includes('watchPositionAsync')
    && !foregroundPresenceSlice.includes('startLocationUpdatesAsync'),
  'Foreground map presence must not create a second GPS owner.',
);

const appStateIndex = mapScreen.indexOf('AppState.addEventListener("change"');
const appStateSlice = mapScreen.slice(appStateIndex, appStateIndex + 2600);
assert(
  appStateSlice.includes('nextState === "inactive" || nextState === "background"')
    && appStateSlice.includes('startLiveDriveBackgroundUpdates()')
    && appStateSlice.includes('nextState === "active"')
    && appStateSlice.includes('stopLiveDriveBackgroundUpdates()'),
  'App lifecycle must hand location ownership from Mapbox to the existing background task while minimized, then back on foreground.',
);
assert(
  !appStateSlice.includes('if (nextState === "background") {\\n        void stopSharing(true);'),
  'Simply minimizing NOXA must not unconditionally switch personal visibility to Ghost.',
);

assert(
  mapScreen.includes('isLiveDriveSessionOwnedByCurrentProcess()')
    && /storedSession[\s\S]{0,240}!isLiveDriveSessionOwnedByCurrentProcess\(\)[\s\S]{0,260}stopSharing\(true\)/.test(mapScreen),
  'A cold process launch must fail safe to Ghost instead of silently restoring an old personal session.',
);
assert(
  mapScreen.includes('const ACTIVE_DRIVER_WINDOW_MS = 2 * 60 * 1000')
    && mapScreen.includes('.gte("updated_at", since)'),
  'Force-quit safety must also hide stale personal presence through the bounded active-driver freshness window.',
);

const stopIndex = liveDrive.indexOf('export async function stopLiveDriveSession(');
const stopSlice = liveDrive.slice(stopIndex);
assert(
  stopSlice.includes('persistPresenceCleanup(session);')
    && stopSlice.indexOf('persistPresenceCleanup(session);') < stopSlice.indexOf('storeSession(null);'),
  'Ghost must persist cleanup intent before clearing the local personal session.',
);

assert(
  appJson.includes('Live Drive visibility or an active Group Drive'),
  'Native background-location disclosure must cover both explicit personal Live Drive visibility and active Group Drive sharing.',
);
assert(
  visibilitySetup.includes('minimize NOXA')
    && visibilitySetup.includes('keeps updating in the background'),
  'Visibility onboarding must explain that minimized NOXA keeps the selected audience active.',
);

assert(
  liveDriveError.includes('Set NOXA Location to Always')
    && liveDriveError.includes('Allow background location for NOXA'),
  'Personal visibility recovery must explain the background-location requirement.',
);

if (!process.exitCode) {
  console.log('Personal minimized/background presence contract passed.');
}
