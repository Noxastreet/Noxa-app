import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const liveDrive = fs.readFileSync('src/lib/liveDrive.ts', 'utf8');
const visibilitySetup = fs.readFileSync('app/visibility-setup.tsx', 'utf8');
const mapScreen = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');

const helperIndex = liveDrive.indexOf('async function upsertLiveDrivePresence(');
assert(helperIndex >= 0, 'Live Drive must have one shared presence upsert helper.');
assert(
  liveDrive.indexOf(".from('driver_locations').upsert(", helperIndex) > helperIndex,
  'Presence writer must UPSERT driver_locations so a missing row can self-heal.',
);
assert(
  liveDrive.indexOf("{ onConflict: 'user_id' }", helperIndex) > helperIndex,
  'Presence upsert must conflict on user_id.',
);
assert(
  liveDrive.indexOf('user_id: session.userId', helperIndex) > helperIndex,
  'Presence upsert must explicitly bind the row to the active Live Drive user.',
);
assert(
  liveDrive.indexOf('Date.parse(session.expiresAt) - LIVE_DRIVE_DURATION_MS') >= 0,
  'Each Live Drive session must derive one stable share start from its four-hour expiry.',
);
assert(
  liveDrive.indexOf('share_started_at: shareStartedAt') >= 0,
  'Presence upserts must refresh share_started_at so an expired prior row cannot block restart.',
);
assert(
  !liveDrive.includes(".from('driver_locations')\n        .update("),
  'Background Live Drive must not rely on UPDATE-only writes.',
);

const preciseHelperIndex = liveDrive.indexOf('async function getPreciseLocationSample()');
const permissionsIndex = liveDrive.indexOf('export async function requestLiveDrivePermissions()');
assert(preciseHelperIndex >= 0, 'Live Drive must have one precise-location acquisition helper.');
assert(
  liveDrive.indexOf('Location.getLastKnownPositionAsync({', preciseHelperIndex) > preciseHelperIndex &&
    liveDrive.indexOf('maxAge: PRECISE_LOCATION_MAX_AGE_MS', preciseHelperIndex) > preciseHelperIndex &&
    liveDrive.indexOf('requiredAccuracy: PRECISE_LOCATION_MAX_ACCURACY_METERS', preciseHelperIndex) > preciseHelperIndex,
  'Live Drive must prefer a recent accurate iOS location sample before blocking on a new GPS fix.',
);
assert(
  liveDrive.indexOf('Location.getCurrentPositionAsync({', preciseHelperIndex) > preciseHelperIndex,
  'Live Drive precise-location helper must fall back to one high-accuracy GPS request.',
);
assert(permissionsIndex >= 0, 'requestLiveDrivePermissions must exist.');
assert(
  liveDrive.indexOf('const current = await getPreciseLocationSample();', permissionsIndex) > permissionsIndex &&
    liveDrive.indexOf('return current;', permissionsIndex) > permissionsIndex,
  'Live Drive permissions must return the one validated precise sample.',
);

const startIndex = liveDrive.indexOf('export async function startLiveDriveSession(');
const updateVisibilityIndex = liveDrive.indexOf(
  'export async function updateLiveDriveVisibility(',
  startIndex,
);
const startSlice = liveDrive.slice(startIndex, updateVisibilityIndex);
const initialPresenceIndex = liveDrive.indexOf(
  'const didPublishInitialPresence = await upsertLiveDrivePresence(',
  startIndex,
);
const nativeStartIndex = liveDrive.indexOf(
  'await Location.startLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME, {',
  startIndex,
);
assert(startIndex >= 0, 'startLiveDriveSession must exist.');
assert(
  startSlice.includes('initialLocation: Location.LocationObject'),
  'startLiveDriveSession must receive the validated startup location.',
);
assert(
  !startSlice.includes('Location.getCurrentPositionAsync('),
  'startLiveDriveSession must not request a second GPS fix after permissions already validated one.',
);
assert(
  initialPresenceIndex > startIndex &&
    liveDrive.indexOf('initialLocation.coords', initialPresenceIndex) > initialPresenceIndex,
  'Starting Live Drive must publish the validated startup sample before succeeding.',
);
assert(
  nativeStartIndex > initialPresenceIndex,
  'Initial presence must exist before the background writer becomes the continuing source.',
);
const rollbackDeleteIndex = liveDrive.indexOf(
  'await deleteLiveDrivePresence(userId, session.expiresAt);',
  nativeStartIndex,
);
const rollbackQueueIndex = liveDrive.indexOf(
  'queuePresenceCleanup(session);',
  rollbackDeleteIndex,
);
assert(
  rollbackDeleteIndex > nativeStartIndex && rollbackQueueIndex > rollbackDeleteIndex,
  'Failed Live Drive startup must delete its scoped presence or queue retryable cleanup.',
);

const taskIndex = liveDrive.indexOf('TaskManager.defineTask<LiveDriveTaskData>(');
assert(
  liveDrive.indexOf('await upsertLiveDrivePresence(session, latestLocation.coords)', taskIndex) >
    taskIndex,
  'Background Live Drive updates must use the self-healing presence upsert.',
);

const mapStartIndex = mapScreen.indexOf('const startSharing = useCallback(');
const mapStartEndIndex = mapScreen.indexOf('const applyAudienceChange = useCallback(', mapStartIndex);
const mapStartSlice = mapScreen.slice(mapStartIndex, mapStartEndIndex);
assert(
  mapStartSlice.includes('const initialLocation = await requestLiveDrivePermissions();'),
  'Map Live Drive start must capture the validated location returned by permissions.',
);
assert(
  mapStartSlice.includes('initialLocation,') &&
    mapStartSlice.includes('upsertPresence(userId, initialLocation.coords);'),
  'Map Live Drive start must reuse the same validated sample for session and UI presence.',
);
assert(
  !mapStartSlice.includes('Location.getCurrentPositionAsync('),
  'Map Live Drive start must not request a redundant third GPS fix.',
);

const setupIndex = visibilitySetup.indexOf('const goGlobal = useCallback(async () => {');
const setupStartIndex = visibilitySetup.indexOf(
  "await startLiveDriveSession(userId, 'global', initialLocation);",
  setupIndex,
);
const setupCompleteIndex = visibilitySetup.indexOf("completeSetup('global');", setupIndex);
assert(
  visibilitySetup.indexOf(
    'const initialLocation = await requestLiveDrivePermissions();',
    setupIndex,
  ) > setupIndex &&
    setupStartIndex > setupIndex &&
    setupCompleteIndex > setupStartIndex,
  'Visibility setup must reuse the validated location and only complete Global after session start succeeds.',
);

if (!process.exitCode) {
  console.log('Live Drive initial-presence contract passed.');
}
