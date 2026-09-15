import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const liveDrive = fs.readFileSync('src/lib/liveDrive.ts', 'utf8');
const visibilitySetup = fs.readFileSync('app/visibility-setup.tsx', 'utf8');

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

const startIndex = liveDrive.indexOf('export async function startLiveDriveSession(');
const initialLocationIndex = liveDrive.indexOf(
  'const initialLocation = await Location.getCurrentPositionAsync({',
  startIndex,
);
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
  initialLocationIndex > startIndex,
  'Starting Live Drive must obtain an initial high-accuracy location.',
);
assert(
  initialPresenceIndex > initialLocationIndex,
  'Starting Live Drive must publish the initial location before succeeding.',
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

const setupIndex = visibilitySetup.indexOf('const goGlobal = useCallback(async () => {');
const setupStartIndex = visibilitySetup.indexOf(
  "await startLiveDriveSession(userId, 'global');",
  setupIndex,
);
const setupCompleteIndex = visibilitySetup.indexOf("completeSetup('global');", setupIndex);
assert(
  setupStartIndex > setupIndex && setupCompleteIndex > setupStartIndex,
  'Visibility setup must only complete Global after startLiveDriveSession succeeds.',
);

if (!process.exitCode) {
  console.log('Live Drive initial-presence contract passed.');
}
