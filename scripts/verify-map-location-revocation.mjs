import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const map = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const liveDrive = fs.readFileSync('src/lib/liveDrive.ts', 'utf8');

assert(
  map.includes('const invalidateDriverLocation = useCallback('),
  'Map must have one stale-location invalidation path.',
);
assert(
  map.includes('driverLocationRef.current = null;') &&
    map.includes('setDriverLocation(null);'),
  'Invalidation must clear both immediate and rendered driver location.',
);
assert(
  map.includes('routeAbortControllerRef.current?.abort();') &&
    map.includes('setIsRouteFollowing(false);'),
  'Invalidation must stop a route that was based on stale location.',
);
assert(
  /permission\.status !== Location\.PermissionStatus\.GRANTED[\s\S]*invalidateDriverLocation\(/.test(map),
  'Permission loss must invalidate the current map location.',
);
assert(
  /catch \{[\s\S]*invalidateDriverLocation\([\s\S]*Could not get your location/.test(map),
  'GPS/current-position failure must invalidate the previous location.',
);
assert(
  /nextState === "active"[\s\S]*loadDriverLocation\(\{ requestPermission: false \}\)[\s\S]*restoreLiveDriveSession\(\)/.test(map),
  'Foreground return must re-check own location before restoring Live Drive.',
);
assert(
  /restoreLiveDriveSession[\s\S]*hasLiveDriveRuntimeAccess\(\)[\s\S]*stopSharing\(true\)/.test(map),
  'Personal presence restore must revoke sharing when foreground location access is gone.',
);

assert(
  liveDrive.includes('export async function hasLiveDriveRuntimeAccess()'),
  'Personal presence must expose one foreground runtime access reconciliation check.',
);
assert(
  /getForegroundPermissionsAsync\(\)[\s\S]*getBackgroundPermissionsAsync\(\)[\s\S]*hasServicesEnabledAsync\(\)/.test(liveDrive)
    && /background\.status !== Location\.PermissionStatus\.GRANTED/.test(liveDrive),
  'Personal runtime access must require foreground, background, and Location Services while minimized sharing is supported.',
);
assert(
  /PRECISE_LOCATION_MAX_ACCURACY_METERS = 1000/.test(liveDrive) &&
    /coords\.accuracy[\s\S]*accuracy < PRECISE_LOCATION_MAX_ACCURACY_METERS/.test(liveDrive),
  'Personal presence must reject kilometer-scale delivered location uncertainty.',
);
assert(
  /permission\.android\?\.accuracy[\s\S]*androidAccuracy !== 'coarse'[\s\S]*androidAccuracy !== 'none'/.test(liveDrive),
  'Android personal presence must reject coarse-only location access.',
);
const personalPermissionStart = liveDrive.indexOf('export async function requestLiveDrivePermissions()');
const personalPermissionEnd = liveDrive.indexOf('export async function hasLiveDriveRuntimeAccess()', personalPermissionStart);
const personalPermissionSlice = liveDrive.slice(personalPermissionStart, personalPermissionEnd);
assert(
  /requestForegroundPermissionsAsync\(\)[\s\S]*hasPreciseForegroundPermission\(foreground\)[\s\S]*const current = await getPreciseLocationSample\(\);[\s\S]*requestBackgroundPermissionsAsync\(\)[\s\S]*return current/.test(personalPermissionSlice),
  'Personal presence startup must validate a precise sample and obtain background access before minimized sharing starts.',
);
assert(
  /TaskManager\.defineTask[\s\S]*hasPreciseForegroundPermission\(foreground\)[\s\S]*background\.status !== Location\.PermissionStatus\.GRANTED[\s\S]*hasPreciseLocationSample\(latestLocation\.coords\)[\s\S]*expireSession\(session\)/.test(liveDrive),
  'The personal background task must fail closed when required location access or precision is revoked.',
);
assert(
  /buildPresencePayload[\s\S]*!hasPreciseLocationSample\(coords\)[\s\S]*return null/.test(liveDrive),
  'Personal presence persistence must fail closed for imprecise coordinates.',
);

if (!process.exitCode) {
  console.log('Map location revocation contract passed.');
}
