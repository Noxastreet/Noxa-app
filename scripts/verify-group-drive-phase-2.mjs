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
  const lobbyScreen = requireText('app/group-drives/[id].tsx', [
    ['Lobby title missing', /GROUP DRIVE LOBBY/],
    ['Ready action missing', /I'm ready/],
    ['Ready undo state missing', /Ready · tap to undo/],
    ['host Start action missing', /title="Start Drive"/],
    ['Waiting confirmation missing', /still waiting/],
    ['pending-invitation Start warning missing', /invitations will'}?/,],
    ['Lobby refresh missing', /setInterval\(\(\) => void refreshLobby\(\), 5000\)/],
    ['cross-device context refresh missing', /snapshot\.sessionStatus !== current\.status[\s\S]*snapshot\.routeVersion !== current\.routeVersion/],
    ['Ready privacy copy missing', /Ready coordinates the Lobby only\. It never starts location sharing\./],
  ]);
  if (/drive_location_state|startLocationUpdatesAsync|requestBackgroundPermissionsAsync/.test(lobbyScreen)) {
    failures.push('Phase 2B screen must not contain precise-location runtime code');
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
    ['provider timeout missing', /setTimeout\(\(\) => controller\.abort\(\), 8000\)/],
    ['provider disclosure missing', /provider: 'openrouteservice'/],
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
