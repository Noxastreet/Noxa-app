import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = [
  'src/features/group-drive/completion.ts',
  'src/features/group-drive/runtime/locationSharingControl.ts',
  'src/features/group-drive/runtime/pendingServerAction.ts',
  'app/group-drives/index.tsx',
  'app/group-drives/[id]/controls.tsx',
  'app/group-drives/[id]/location-sharing.tsx',
  'app/group-drives/[id]/summary.tsx',
  'supabase/migrations/20260819080201_group_drive_phase_1.sql',
];
const failures = [];

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

if (!failures.length) {
  const completion = source('src/features/group-drive/completion.ts');
  const sharingControl = source('src/features/group-drive/runtime/locationSharingControl.ts');
  const pendingAction = source('src/features/group-drive/runtime/pendingServerAction.ts');
  const list = source('app/group-drives/index.tsx');
  const controls = source('app/group-drives/[id]/controls.tsx');
  const sharing = source('app/group-drives/[id]/location-sharing.tsx');
  const summary = source('app/group-drives/[id]/summary.tsx');
  const migration = source('supabase/migrations/20260819080201_group_drive_phase_1.sql');

  const requiredClient = [
    ['host end RPC is not wired', completion, /noxa_end_drive/],
    ['terminal summary RPC is not wired', completion, /noxa_get_drive_summary/],
    ['participant leave RPC is not wired', completion, /noxa_leave_drive/],
    ['end does not stop local Group Drive publishing before the server RPC', completion, /endGroupDrive[\s\S]*stopLocalWriterAndStage\('end'[\s\S]*noxa_end_drive/],
    ['leave does not stop local Group Drive publishing before the server RPC', completion, /leaveGroupDriveAndStopLocation[\s\S]*stopLocalWriterAndStage\('leave'[\s\S]*noxa_leave_drive/],
    ['pending lifecycle action is not persisted', completion, /stagePendingGroupDriveServerAction/],
    ['independent Group Drive Stop Sharing is not wired', sharing, /Stop Group Drive sharing/],
    ['Stop Sharing does not stop the native writer first', sharingControl, /stopGroupDriveLocationSession\(\)[\s\S]*stagePendingGroupDriveServerAction/],
    ['Stop Sharing does not clear server location state', sharingControl, /noxa_clear_my_drive_location/],
    ['pending server action storage is missing', pendingAction, /GROUP_DRIVE_PENDING_SERVER_ACTION_KEY/],
    ['terminal list items do not route to summary', list, /terminal[\s\S]*\/group-drives\/\[id\]\/summary/],
    ['active list items do not resume the Active Drive map', list, /if \(active\)[\s\S]*\/group-drives\/\[id\]\/active/],
    ['active drive context does not expose lifecycle controls', list, /Resume Active Drive[\s\S]*Drive controls[\s\S]*\/group-drives\/\[id\]\/controls/],
    ['host End Drive control missing', controls, /End Group Drive/],
    ['participant Leave Drive control missing', controls, /Leave Group Drive/],
    ['summary does not label route values as planned', summary, /PLANNED ROUTE[\s\S]*PLANNED TIME/],
  ];
  for (const [label, text, pattern] of requiredClient) {
    if (!pattern.test(text)) failures.push(label);
  }

  const requiredServer = [
    ['server end-drive RPC missing', /create or replace function public\.noxa_end_drive/],
    ['server terminal summary RPC missing', /create or replace function public\.noxa_get_drive_summary/],
    ['terminal transition does not delete exact location state', /new\.status in \('completed', 'cancelled'\)[\s\S]*delete from public\.drive_location_state/],
    ['participant exit does not delete exact location state', /noxa_delete_drive_location_on_participant_exit[\s\S]*delete from public\.drive_location_state/],
  ];
  for (const [label, pattern] of requiredServer) {
    if (!pattern.test(migration)) failures.push(label);
  }

  for (const [label, text] of [
    ['completion helper', completion],
    ['active controls', controls],
    ['terminal summary', summary],
  ]) {
    if (/driver_locations|LIVE_DRIVE_TASK_NAME|from ['"]@\/src\/lib\/liveDrive/.test(text)) {
      failures.push(`${label} must not reuse personal Live Drive runtime/data`);
    }
  }
}

if (failures.length) {
  console.error('Group Drive Phase 5 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Group Drive Phase 5 completion contract: PASS (${files.length} files)`);
