import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = [
  'src/features/group-drive/runtime/nativeLocation.ts',
  'app/group-drives/[id]/location-sharing.tsx',
  'app/_layout.tsx',
  'app.json',
  'src/lib/liveDrive.ts',
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
  const runtime = source('src/features/group-drive/runtime/nativeLocation.ts');
  const consentScreen = source('app/group-drives/[id]/location-sharing.tsx');
  const layout = source('app/_layout.tsx');
  const appJson = source('app.json');
  const personalLiveDrive = source('src/lib/liveDrive.ts');

  const requiredRuntime = [
    ['dedicated task name missing', /noxa-group-drive-location-v1/],
    ['scoped disclosure primitive missing', /acceptGroupDriveLocationDisclosure/],
    ['foreground permission request missing', /requestForegroundPermissionsAsync/],
    ['background permission request missing', /requestBackgroundPermissionsAsync/],
    ['server-owned active expiry missing', /activeExpiresAt/],
    ['protected location RPC missing', /\.rpc\('noxa_upsert_drive_location'/],
    ['auth mismatch cleanup missing', /authData\.session\?\.user\.id !== session\.userId[\s\S]*clearLocalRuntime/],
    ['authorization failure cleanup missing', /isAuthorizationFailure[\s\S]*clearLocalRuntime/],
    ['transient retry state missing', /GroupDriveLocationPublishResult = 'published' \| 'retry' \| 'revoked'/],
    ['background automotive activity missing', /ActivityType\.AutomotiveNavigation/],
    ['task teardown missing', /stopLocationUpdatesAsync\(GROUP_DRIVE_LOCATION_TASK_NAME\)/],
  ];
  for (const [label, pattern] of requiredRuntime) {
    if (!pattern.test(runtime)) failures.push(label);
  }

  if (/driver_locations|src\/lib\/liveDrive|LIVE_DRIVE_TASK_NAME/.test(runtime)) {
    failures.push('Phase 3B native runtime must stay isolated from personal Live Drive');
  }
  if (/speed_mps|accuracy_meters|route_progress|rank|leaderboard/.test(runtime)) {
    failures.push('Phase 3B must not persist speed, accuracy, progress or ranking telemetry');
  }

  if (!/const consent = acceptGroupDriveLocationDisclosure\(driveSessionId\);[\s\S]*await requestGroupDriveLocationPermissions\(\);[\s\S]*await startGroupDriveLocationSession\(consent\);/.test(consentScreen)) {
    failures.push('consent screen must accept scoped disclosure before requesting permissions and starting writer');
  }
  if (!/Join and Ready never enable location sharing/.test(consentScreen)) {
    failures.push('consent screen must state that Join/Ready do not enable sharing');
  }
  if (!/import '@\/src\/features\/group-drive\/runtime\/nativeLocation';/.test(layout)) {
    failures.push('Group Drive TaskManager module must be registered from the root layout');
  }
  if (!/active Group Drive/.test(appJson) || !/background location/.test(appJson)) {
    failures.push('platform permission copy must disclose active Group Drive background location');
  }

  const expectedPersonalLiveDriveBlob = '6e71749c289e869359e8d66beb0ebc6894cec287';
  const actualPersonalLiveDriveBlob = gitBlobSha(personalLiveDrive);
  if (actualPersonalLiveDriveBlob !== expectedPersonalLiveDriveBlob) {
    failures.push(`personal Live Drive changed unexpectedly (${actualPersonalLiveDriveBlob})`);
  }
}

if (failures.length) {
  console.error('Group Drive Phase 3B verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Group Drive Phase 3B static contract: PASS (${files.length} files)`);
