import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = [
  'src/features/group-drive/completion.ts',
  'app/group-drives/index.tsx',
  'app/group-drives/[id]/controls.tsx',
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
  const list = source('app/group-drives/index.tsx');
  const controls = source('app/group-drives/[id]/controls.tsx');
  const summary = source('app/group-drives/[id]/summary.tsx');
  const migration = source('supabase/migrations/20260819080201_group_drive_phase_1.sql');

  const requiredClient = [
    ['host end RPC is not wired', completion, /noxa_end_drive/],
    ['terminal summary RPC is not wired', completion, /noxa_get_drive_summary/],
    ['participant leave does not use reviewed lifecycle API', completion, /leaveDrive\(driveSessionId\)/],
    ['end does not stop the native Group Drive writer', completion, /endGroupDrive[\s\S]*stopGroupDriveLocationSession/],
    ['leave does not stop the native Group Drive writer', completion, /leaveGroupDriveAndStopLocation[\s\S]*stopGroupDriveLocationSession/],
    ['terminal list items do not route to summary', list, /terminal[\s\S]*\/group-drives\/\[id\]\/summary/],
    ['active list items do not expose lifecycle controls', list, /active[\s\S]*\/group-drives\/\[id\]\/controls/],
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
