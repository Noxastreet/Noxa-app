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
  'Live Drive restore must revoke sharing when runtime location access is gone.',
);

assert(
  liveDrive.includes('export async function hasLiveDriveRuntimeAccess()'),
  'Live Drive must expose one runtime access reconciliation check.',
);
assert(
  /getForegroundPermissionsAsync\(\)[\s\S]*getBackgroundPermissionsAsync\(\)[\s\S]*hasServicesEnabledAsync\(\)/.test(liveDrive),
  'Runtime access must require foreground permission, background permission and location services.',
);
assert(
  /PRECISE_LOCATION_MAX_ACCURACY_METERS = 1000/.test(liveDrive) &&
    /coords\.accuracy[\s\S]*accuracy < PRECISE_LOCATION_MAX_ACCURACY_METERS/.test(liveDrive),
  'Live Drive must reject kilometer-scale delivered location uncertainty.',
);
assert(
  /permission\.android\?\.accuracy[\s\S]*androidAccuracy !== 'coarse'[\s\S]*androidAccuracy !== 'none'/.test(liveDrive),
  'Android Live Drive must reject coarse-only location access.',
);
assert(
  /requestForegroundPermissionsAsync\(\)[\s\S]*hasPreciseForegroundPermission\(foreground\)[\s\S]*getCurrentPositionAsync\([\s\S]*hasPreciseLocationSample\(current\.coords\)/.test(liveDrive),
  'Live Drive startup permission flow must require a usable precise sample before background access.',
);
assert(
  /TaskManager\.defineTask[\s\S]*hasPreciseForegroundPermission\(foreground\)[\s\S]*hasPreciseLocationSample\(latestLocation\.coords\)[\s\S]*expireSession\(session\)/.test(liveDrive),
  'Active Live Drive must stop when permission or delivered accuracy becomes unsuitable.',
);
assert(
  /buildPresencePayload[\s\S]*!hasPreciseLocationSample\(coords\)[\s\S]*return null/.test(liveDrive),
  'Live Drive persistence must fail closed for imprecise coordinates.',
);

if (!process.exitCode) {
  console.log('Map location revocation contract passed.');
}
