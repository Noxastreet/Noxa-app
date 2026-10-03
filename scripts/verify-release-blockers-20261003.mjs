import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const home = read('app/(tabs)/index.tsx');
const profile = read('app/(tabs)/profile.tsx');
const eventEditor = read('app/event-editor.tsx');
const eventDetail = read('src/features/crews-events/CanonicalEventDetailScreen.tsx');
const mapRuntime = read('src/features/mapbox/MapboxLiveMap.tsx');
const mapCompat = read('src/features/mapbox/MapboxLiveMapCompat.tsx');
const liveDrive = read('src/lib/liveDrive.ts');
const permissionSheet = read('src/features/map/LiveDrivePermissionRecoverySheet.tsx');
const pushBridge = read('src/features/notifications/PushNotificationBridge.tsx');
const onboarding = read('src/lib/onboarding.ts');
const eventChatMigration = read(
  'supabase/migrations/20261003084115_add_event_chat_push_notifications.sql',
);

assert(
  /avatar_url: driver\.avatar_url/.test(mapCompat)
    && /driverDistancePill/.test(mapRuntime)
    && /driverDistanceText/.test(mapRuntime),
  'Driver markers must keep profile photos with a compact distance pill.',
);

assert(
  /COURSE_BEARING_ENTER_SPEED_MPS = 1\.5/.test(mapRuntime)
    && /COURSE_BEARING_EXIT_SPEED_MPS = 0\.8/.test(mapRuntime)
    && /puckBearing=\{isRouteMode && useCourseBearing \? "course" : "heading"\}/.test(mapRuntime),
  'The user arrow must use stable adaptive heading/course bearing.',
);

assert(
  /lineColor:\s*colors\.routeActive/.test(mapRuntime)
    && /routeActive:\s*'#FF1744'/.test(read('src/theme/colors.ts')),
  'Navigation route must use the bright NOXA red treatment.',
);

assert(
  /function DriveTogetherNavigationChrome/.test(home)
    && /Recenter Drive Together navigation/.test(home)
    && /setIsDriveTogetherFollowing\(true\)/.test(home)
    && /panelVisible && !following/.test(home)
    && /Boolean\(driveTogetherNavigation\)/.test(home),
  'Drive Together must keep one map with navigation chrome and Recenter recovery.',
);

assert(
  /accessStillValid = await hasLiveDriveRuntimeAccess\(\)/.test(home)
    && /visibility setting is preserved/.test(home)
    && /setTimeout\(\(\) => \{[\s\S]{0,900}startLiveDriveBackgroundUpdates\(\)[\s\S]{0,240}setSharingError\(null\)/.test(home)
    && /restoreLiveDriveSession[\s\S]{0,1400}setSharingError\(null\)/.test(home),
  'A transient Android background-start failure must not immediately force Ghost.',
);

assert(
  /LIVE_DRIVE_GPS_FIX_TIMEOUT_MS = 6_000/.test(liveDrive)
    && /getCurrentPositionWithTimeout/.test(liveDrive)
    && /Promise\.race/.test(liveDrive),
  'Live Drive startup GPS acquisition must remain time-bounded.',
);

assert(
  /Platform\.OS === 'android'/.test(permissionSheet)
    && /Allow all the time/.test(permissionSheet)
    && /Always/.test(permissionSheet)
    && /return to NOXA/.test(permissionSheet),
  'Background-location recovery must explain Android and iOS settings paths.',
);

assert(
  /Platform\.OS === "android" && pickerTarget/.test(eventEditor)
    && /commitPickerValue\(pickerTarget, selected\)/.test(eventEditor)
    && /event\.type === "dismissed"/.test(eventEditor),
  'Android Event time/date picker must commit the native selection directly and handle dismiss.',
);

assert(
  /onboarding_completed_at/.test(onboarding)
    && /select\('id'\)/.test(onboarding)
    && /Onboarding completion was not persisted/.test(onboarding)
    && /catch \{[\s\S]{0,220}return false;/.test(onboarding),
  'Onboarding completion must be explicit server state and verify the row was persisted.',
);

assert(
  /zIndex: 40/.test(home)
    && /zIndex: 60/.test(home)
    && /zIndex: 70/.test(home),
  'Map chrome must stay above map markers and Drive Together overlays.',
);

assert(
  !/mapRouteLine|mapRouteTrack|mapRouteStart|mapRouteEnd/.test(eventDetail),
  'NOXA Map Preview must not render the decorative horizontal route line.',
);

assert(
  !/function NoxaContext\(/.test(profile)
    && !/<NoxaContext/.test(profile)
    && !/YOUR NOXA/.test(profile),
  'Profile must not duplicate Garage, Crews and Events under YOUR NOXA.',
);

assert(
  /event_chat_message/.test(eventChatMigration)
    && /event_attendees\.user_id <> new\.sender_id/.test(eventChatMigration)
    && /'event_chat_id', new\.event_id/.test(eventChatMigration)
    && /pathname: '\/event-chat'/.test(pushBridge),
  'Event Chat push must exclude the sender and deep-link to the exact chat.',
);

if (!process.exitCode) {
  console.log('Final release-blocker regression contract passed.');
}
