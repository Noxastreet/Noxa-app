import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const expectedFiles = [
  'src/features/group-drive/api.ts',
  'src/features/group-drive/lobby.ts',
  'src/features/group-drive/types.ts',
  'src/features/group-drive/GroupDrivePrimitives.tsx',
  'supabase/functions/drive-route/index.ts',
  'supabase/functions/drive-route/deno.json',
  'app/group-drives/index.tsx',
  'app/group-drives/details.tsx',
  'app/group-drives/route.tsx',
  'app/group-drives/participants.tsx',
  'app/group-drives/schedule.tsx',
  'app/group-drives/review.tsx',
  'app/group-drives/[id].tsx',
  'src/features/map-context/MapGroupDriveFlow.tsx',
  'app/group-drives/invitation/[id].tsx',
  'docs/security/NOXA_GROUP_DRIVE_PHASE_2_RUNBOOK.md',
];

const failures = [];
for (const file of expectedFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

function requireText(file, patterns) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [label, pattern] of patterns) {
    if (!pattern.test(text)) failures.push(`${file}: ${label}`);
  }
  return text;
}

if (fs.existsSync(path.join(root, 'src/features/group-drive/api.ts'))) {
  const api = requireText('src/features/group-drive/api.ts', [
    ['list RPC missing', /noxa_list_my_group_drives/],
    ['safe invitation preview RPC missing', /noxa_get_drive_invitation_preview/],
    ['invitation response RPC missing', /noxa_respond_to_drive_invitation/],
    ['route RPC missing', /noxa_set_drive_route/],
    ['drive-route invocation missing', /functions\.invoke<DriveRouteResult>\('drive-route'/],
  ]);
  if (/drive_location_state|noxa_upsert_drive_location/.test(api)) {
    failures.push('Phase 2 API must not contain live-location code');
  }
}

if (fs.existsSync(path.join(root, 'src/features/group-drive/lobby.ts'))) {
  const lobby = requireText('src/features/group-drive/lobby.ts', [
    ['Ready RPC missing', /noxa_set_drive_ready/],
    ['Start RPC missing', /noxa_start_drive/],
    ['Lobby snapshot missing', /loadDriveLobbySnapshot/],
    ['Lobby session context read missing', /select\('status,route_version,scheduled_start_at'\)/],
    ['Lobby readiness read missing', /select\('user_id,ready_at'\)/],
    ['JWT refresh path missing', /refreshSupabaseSessionOnce/],
  ]);
  if (/drive_location_state|noxa_upsert_drive_location|startLocationUpdatesAsync|expo-task-manager/.test(lobby)) {
    failures.push('Phase 2B Lobby must not contain precise-location runtime code');
  }
}

if (fs.existsSync(path.join(root, 'app/group-drives/[id].tsx'))) {
  requireText('app/group-drives/[id].tsx', [
    ['Legacy Lobby route must redirect to the Map tab', /pathname: "\/\(tabs\)"/],
    ['Legacy Lobby route must preserve the drive id', /groupDriveId: driveSessionId/],
  ]);
}

if (fs.existsSync(path.join(root, 'src/features/map-context/MapGroupDriveFlow.tsx'))) {
  const lobbyCard = requireText('src/features/map-context/MapGroupDriveFlow.tsx', [
    ['Contextual Lobby state missing', /\| "lobby"/],
    ['Ready-at-A action missing', /I'm at A · Ready/],
    ['Ready-at-A undo state missing', /Ready at A · tap to undo/],
    ['host Start action missing', /Start Group Drive/],
    ['waiting-at-A start gate missing', /Waiting for .* at A/],
    ['pending-invitation Start warning missing', /Starting the drive cancels pending invitations/],
    ['Lobby refresh missing', /setInterval\(\(\) => void loadLobby\(lobbyDriveId\), 5000\)/],
    ['cross-device realtime refresh missing', /subscribeToDriveLobbyStatus/],
    ['foreground reconciliation missing', /AppState\.addEventListener\("change"/],
    ['Ready privacy copy missing', /Ready coordinates the Lobby only\. It never starts location sharing\./],
  ]);
  if (/startGroupDriveLocationSession|startLocationUpdatesAsync|requestBackgroundPermissionsAsync/.test(lobbyCard)) {
    failures.push('Phase 2B contextual Lobby must not start precise-location runtime code');
  }
}

if (fs.existsSync(path.join(root, 'app/group-drives/route.tsx'))) {
  requireText('app/group-drives/route.tsx', [
    ['destination preview must use coarse area fields', /address\.city[\s\S]*address\.region/],
    ['destination fallback must remain non-precise', /Destination shared after joining/],
  ]);
}

if (fs.existsSync(path.join(root, 'app/group-drives/participants.tsx'))) {
  requireText('app/group-drives/participants.tsx', [
    ['Crew expansion must preview individual recipients', /crew\.eligibleUserIds/],
  ]);
}

if (fs.existsSync(path.join(root, 'supabase/functions/drive-route/index.ts'))) {
  requireText('supabase/functions/drive-route/index.ts', [
    ['auth validation missing', /\/auth\/v1\/user/],
    ['ordered points validation missing', /points\.length < 2/],
    ['provider timeout missing', /PROVIDER_TIMEOUT_MS = 5500/],
    ['traffic-aware Mapbox primary missing', /mapbox\/driving-traffic/],
    ['Mapbox alternatives missing', /alternatives: 'true'/],
    ['fastest ORS fallback missing', /preference: 'fastest'/],
    ['Mapbox provider disclosure missing', /provider: 'mapbox-driving-traffic'/],
    ['ORS fallback provider disclosure missing', /provider: 'openrouteservice-fastest'/],
    ['route geometry missing', /type: 'LineString'/],
  ]);
}

const phase2RuntimeFiles = expectedFiles
  .filter((file) => !file.startsWith('docs/'))
  .filter((file) => fs.existsSync(path.join(root, file)))
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
if (/expo-task-manager|startLocationUpdatesAsync|driver_locations/.test(phase2RuntimeFiles)) {
  failures.push('Phase 2 unexpectedly references background or personal Live Drive state');
}

if (failures.length) {
  console.error('Group Drive Phase 2 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Group Drive Phase 2 verification passed (${expectedFiles.length} files).`);
