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
  permissionsSlice.includes('Location.requestForegroundPermissionsAsync()'),
  'Personal visibility must request foreground location only.',
);
assert(
  permissionsSlice.includes('const current = await getPreciseLocationSample();')
    && permissionsSlice.includes('return current;'),
  'Personal visibility must validate and return one precise foreground sample.',
);
assert(
  !permissionsSlice.includes('requestBackgroundPermissionsAsync')
    && !permissionsSlice.includes('getBackgroundPermissionsAsync')
    && !permissionsSlice.includes('isBackgroundLocationAvailableAsync'),
  'Personal visibility must never request or require background location.',
);
assert(
  !permissionFlow.includes('requestIosBackgroundLocationPreflight')
    && permissionFlow.includes('return requestLiveDrivePermissions();'),
  'Personal visibility wrapper must not enter the iOS Always/background permission path.',
);

const startIndex = liveDrive.indexOf('export async function startLiveDriveSession(');
const visibilityIndex = liveDrive.indexOf('export async function updateLiveDriveVisibility(', startIndex);
const startSlice = liveDrive.slice(startIndex, visibilityIndex);

assert(
  startSlice.includes('initialLocation: Location.LocationObject'),
  'Personal visibility start must reuse the already-validated location sample.',
);
assert(
  startSlice.includes('await stopNativeLocationUpdates().catch(() => undefined);'),
  'Starting personal visibility must stop any legacy personal background task.',
);
assert(
  startSlice.includes('await upsertLiveDrivePresence(')
    && startSlice.includes('initialLocation.coords'),
  'Personal visibility must publish its initial presence before succeeding.',
);
assert(
  !startSlice.includes('startLocationUpdatesAsync'),
  'Personal visibility must never start a background location writer.',
);

const writeIndex = mapScreen.indexOf('const writePresencePayload = useCallback(');
const startSharingIndex = mapScreen.indexOf('const startSharing = useCallback(', writeIndex);
const foregroundPresenceSlice = mapScreen.slice(writeIndex, startSharingIndex);
assert(
  foregroundPresenceSlice.includes('!isAppForegroundRef.current')
    && foregroundPresenceSlice.includes('driverLocation')
    && foregroundPresenceSlice.includes('writePresencePayload(userId, payload)'),
  'Personal presence updates must reuse the existing foreground Mapbox location stream.',
);
assert(
  !foregroundPresenceSlice.includes('watchPositionAsync')
    && !foregroundPresenceSlice.includes('startLocationUpdatesAsync'),
  'Map presence updates must not create a second GPS owner.',
);

const appStateIndex = mapScreen.indexOf('AppState.addEventListener("change"');
const appStateSlice = mapScreen.slice(appStateIndex, appStateIndex + 1800);
assert(
  appStateSlice.includes('nextState === "background"')
    && appStateSlice.includes('void stopSharing(true);'),
  'Leaving NOXA must return personal presence to Ghost and request server cleanup.',
);

const restoreIndex = mapScreen.indexOf('const restoreLiveDriveSession = useCallback(async () => {');
const restoreEnd = mapScreen.indexOf('const loadCurrentProfile = useCallback(', restoreIndex);
const restoreSlice = mapScreen.slice(restoreIndex, restoreEnd);
assert(
  !restoreSlice.includes('hasStartedLocationUpdatesAsync')
    && !restoreSlice.includes('LIVE_DRIVE_TASK_NAME'),
  'Foreground restoration must not depend on the retired personal background task.',
);

const stopIndex = liveDrive.indexOf('export async function stopLiveDriveSession(');
const stopSlice = liveDrive.slice(stopIndex);
assert(
  stopSlice.includes('persistPresenceCleanup(session);')
    && stopSlice.indexOf('persistPresenceCleanup(session);') < stopSlice.indexOf('storeSession(null);'),
  'Ghost must persist cleanup intent before clearing the local personal session.',
);

assert(
  appJson.includes('"locationAlwaysAndWhenInUsePermission": "NOXA uses background location only while an active Group Drive'),
  'Native background-location disclosure must be scoped to Group Drive.',
);
assert(
  visibilitySetup.includes('Go Public')
    && visibilitySetup.includes('returns to Ghost when the app goes to the background'),
  'Visibility onboarding must explain Public and foreground-only personal presence.',
);

assert(
  !liveDriveError.includes('Set NOXA Location to Always')
    && !liveDriveError.includes('Enable background location for NOXA'),
  'Personal visibility recovery copy must not ask for background/Always access.',
);
assert(
  liveDriveError.includes('Enable Precise Location for NOXA in iPhone Settings.')
    && liveDriveError.includes('Allow Location for NOXA in iPhone Settings.'),
  'Personal visibility must retain precise/foreground Settings recovery guidance.',
);

if (!process.exitCode) {
  console.log('Personal foreground presence contract passed.');
}
