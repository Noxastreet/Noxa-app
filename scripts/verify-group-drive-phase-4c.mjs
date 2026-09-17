import crypto from 'node:crypto';
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

function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
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

  const expectedSharedMapBlob = '0b702610f9e817cf776d58ab9bc5b5081f8e054e';
  const actualSharedMapBlob = gitBlobSha(sharedMap);
  if (actualSharedMapBlob !== expectedSharedMapBlob) {
    failures.push(`shared Home/Map MapboxLiveMap changed unexpectedly (${actualSharedMapBlob})`);
  }
}

if (failures.length) {
  console.error('Group Drive Phase 4C verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Group Drive Phase 4C static contract: PASS (${files.length} files)`);
