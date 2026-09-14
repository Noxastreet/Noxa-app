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
  /permission\.ios\?\.accuracy === 'reduced'/.test(liveDrive),
  'iOS Live Drive must reject Reduced Accuracy location access.',
);
assert(
  /permission\.android\?\.accuracy[\s\S]*androidAccuracy !== 'coarse'[\s\S]*androidAccuracy !== 'none'/.test(liveDrive),
  'Android Live Drive must reject coarse-only location access.',
);
assert(
  /requestForegroundPermissionsAsync\(\)[\s\S]*hasPreciseForegroundLocation\(foreground\)/.test(liveDrive),
  'Live Drive startup must enforce precise location access before sharing.',
);
assert(
  /TaskManager\.defineTask[\s\S]*getForegroundPermissionsAsync\(\)[\s\S]*hasPreciseForegroundLocation\(foreground\)[\s\S]*expireSession\(session\)/.test(liveDrive),
  'Active Live Drive must stop when precise foreground access is revoked.',
);

if (!process.exitCode) {
  console.log('Map location revocation contract passed.');
}
