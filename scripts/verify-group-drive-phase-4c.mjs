import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = [
  'app/group-drives/[id]/active.tsx',
  'src/features/mapbox/MapboxLiveMap.tsx',
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

  const required = [
    ['existing MapboxLiveMap is not reused', /from '@\/src\/features\/mapbox\/MapboxLiveMap'/],
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
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(screen)) failures.push(label);
  }

  if (/driver_locations|liveDrive|LIVE_DRIVE_TASK_NAME/.test(screen)) {
    failures.push('Active Drive screen must not reuse personal Live Drive data/runtime');
  }
  if (/event-route|calculateDriveRoute|Directions|directions/i.test(screen)) {
    failures.push('Active Drive screen must not call Directions or event-route');
  }
  if (/from ['"]@rnmapbox\/maps['"]/.test(screen)) {
    failures.push('Active Drive screen must reuse existing MapboxLiveMap instead of creating a second raw Mapbox layer');
  }
  if (/from ['"]@\/src\/lib\/supabase['"]/.test(screen)) {
    failures.push('Active Drive screen must consume the Group Drive API/runtime rather than query Supabase directly');
  }

  const expectedSharedMapBlob = '5b917360910c3ee9de09910cb4fdb13a7d41f13a';
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
