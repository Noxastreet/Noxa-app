import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = [
  'app/group-drives/[id]/active.tsx',
  'src/features/mapbox/MapboxLiveMap.tsx',
  'src/features/mapbox/MapboxLiveMapCompat.tsx',
  'src/features/group-drive/runtime/localNavigationLocation.ts',
  'src/features/group-drive/runtime/realtime.ts',
  'src/features/group-drive/runtime/routeProgress.ts',
  'src/features/group-drive/runtime/participantStack.ts',
  'src/features/group-drive/runtime/participantStackPresentation.ts',
];
const failures = [];

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

if (!failures.length) {
  const screen = source('app/group-drives/[id]/active.tsx');
  const sharedMap = source('src/features/mapbox/MapboxLiveMap.tsx');
  const compat = source('src/features/mapbox/MapboxLiveMapCompat.tsx');
  const localNavigation = source('src/features/group-drive/runtime/localNavigationLocation.ts');

  const required = [
    ['shared Mapbox compatibility layer is not reused', /from '@\/src\/features\/mapbox\/MapboxLiveMapCompat'/],
    ['authorized initial snapshot missing', /loadActiveDriveRealtimeSnapshot/],
    ['Phase 3A realtime subscription missing', /subscribeToActiveDriveRealtime/],
    ['stored route preparation missing', /prepareDriveRoute/],
    ['local participant progress derivation missing', /deriveGroupDriveParticipantProgress/],
    ['anti-jitter participant ordering missing', /reduceParticipantStackOrder/],
    ['Phase 4B participant stack presentation missing', /buildParticipantStackPresentation/],
    ['Phase 4B participant stack component missing', /GroupDriveParticipantStack/],
    ['stored route not passed to map', /route=\{mapRoute\}/],
    ['participant focus does not use map handle', /animateToRegion/],
    ['access revocation handling missing', /onAccessRevoked/],
    ['user pan isolation missing', /onUserPan=\{\(\) =>/],
    ['local navigation source is not wired', /watchLocalNavigationLocation/],
    ['local-only recenter permission path is missing', /readLocalNavigationLocation\(true\)/],
    ['map camera still depends only on published Group Drive location', /driverLocation=\{cameraLocation\}/],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(screen)) failures.push(label);
  }

  if (!/import\("\.\/MapboxLiveMap"\)/.test(compat)) {
    failures.push('Mapbox compatibility layer must lazy-load the existing native MapboxLiveMap');
  }
  if (/from ['"]@\/src\/features\/mapbox\/MapboxLiveMap['"]/.test(screen)) {
    failures.push('Active Drive must not bypass the shared Mapbox compatibility layer');
  }
  if (/driver_locations|liveDrive|LIVE_DRIVE_TASK_NAME/.test(screen)) {
    failures.push('Active Drive screen must not reuse personal Live Drive data/runtime');
  }
  if (/event-route|calculateDriveRoute|Directions|directions/i.test(screen)) {
    failures.push('Active Drive screen must not call Directions or event-route');
  }
  if (/from ['"]@rnmapbox\/maps['"]/.test(screen)) {
    failures.push('Active Drive screen must reuse the existing shared Mapbox layer instead of creating a second raw Mapbox layer');
  }
  if (/from ['"]@\/src\/lib\/supabase['"]/.test(screen)) {
    failures.push('Active Drive screen must consume the Group Drive API/runtime rather than query Supabase directly');
  }

  if (!/getForegroundPermissionsAsync/.test(localNavigation)
    || !/requestForegroundPermissionsAsync/.test(localNavigation)
    || !/watchPositionAsync/.test(localNavigation)) {
    failures.push('local navigation GPS must use only foreground location primitives');
  }
  if (/supabase|\.rpc\(|driver_locations|drive_location_state|TaskManager|startLocationUpdatesAsync|requestBackgroundPermissionsAsync/i.test(localNavigation)) {
    failures.push('local navigation GPS must never publish, start a background task, or request background permission');
  }

  const sharedMapRequired = [
    ['shared map must keep the existing Mapbox Standard basemap', /NOXA_MAPBOX_LIVE_STYLE_URL/],
    ['shared map must keep the existing Camera runtime', /<Camera/],
    ['shared map must keep the existing location puck', /<LocationPuck/],
    ['shared map must keep the existing Group Drive route source', /id="noxa-route-source"/],
    ['shared map must keep the existing route casing layer', /id="noxa-route-casing"/],
    ['shared map must keep the existing route line layer', /id="noxa-route-line"/],
    ['shared map must keep FollowWithCourse', /UserTrackingMode\.FollowWithCourse/],
    ['sheet-aware follow padding must preserve the legacy Active Drive fallback', /paddingBottom: bottomContentInset \?\? 260/],
    ['sheet-aware footer inset must preserve the legacy Mapbox footer fallback', /Math\.max\(84, \(bottomContentInset \?\? 0\) \+ 8\)/],
  ];
  for (const [label, pattern] of sharedMapRequired) {
    if (!pattern.test(sharedMap)) failures.push(label);
  }

  const mapViewCount = (sharedMap.match(/<MapView\b/g) ?? []).length;
  if (mapViewCount !== 1) {
    failures.push(`shared Mapbox layer must still own exactly one MapView (found ${mapViewCount})`);
  }
  if (/supabase|TaskManager|startLocationUpdatesAsync|requestBackgroundPermissionsAsync/i.test(sharedMap)) {
    failures.push('shared Mapbox layer must remain presentation-only and must not own backend/background location runtime');
  }
}

if (failures.length) {
  console.error('Group Drive Phase 4C verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Group Drive Phase 4C static contract: PASS (${files.length} files)`);
