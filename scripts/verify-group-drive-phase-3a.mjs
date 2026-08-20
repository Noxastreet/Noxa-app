import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = [
  'src/features/group-drive/runtime/locationState.ts',
  'src/features/group-drive/runtime/realtime.ts',
  'src/features/group-drive/runtime/simulation.ts',
  'src/features/group-drive/runtime/index.ts',
  'docs/security/NOXA_GROUP_DRIVE_PHASE_3A_RUNBOOK.md',
];
const failures = [];

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

if (!failures.length) {
  const realtime = source('src/features/group-drive/runtime/realtime.ts');
  const state = source('src/features/group-drive/runtime/locationState.ts');
  const simulation = source('src/features/group-drive/runtime/simulation.ts');
  const allRuntime = `${realtime}\n${state}\n${simulation}`;

  const required = [
    ['authorized initial snapshot', /loadActiveDriveRealtimeSnapshot/],
    ['filtered INSERT subscription', /event: 'INSERT'[\s\S]*drive_location_state[\s\S]*drive_session_id=eq/],
    ['filtered UPDATE subscription', /event: 'UPDATE'[\s\S]*drive_location_state[\s\S]*drive_session_id=eq/],
    ['opaque-only DELETE handling', /event: 'DELETE'[\s\S]*drive_location_state[\s\S]*applyOpaqueDelete/],
    ['session lifecycle reconciliation', /table: 'drive_sessions'[\s\S]*reconcile/],
    ['participant lifecycle reconciliation', /table: 'drive_participants'[\s\S]*reconcile/],
    ['channel teardown', /removeChannel\(channel\)/],
    ['reconnect snapshot reconciliation', /status === 'SUBSCRIBED'[\s\S]*reconcile/],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(realtime)) failures.push(label);
  }
  if (!/createGroupDriveSimulation/.test(simulation)) failures.push('simulation factory missing');
  if (!/reduceGroupDriveLocationState/.test(state)) failures.push('location reducer missing');
  if (/expo-task-manager|startLocationUpdatesAsync|requestBackgroundPermissionsAsync|driver_locations|liveDrive/.test(allRuntime)) {
    failures.push('Phase 3A must not contain native background GPS or personal Live Drive code');
  }
  if (/\.rpc\(['"]noxa_upsert_drive_location/.test(allRuntime)) {
    failures.push('Phase 3A simulation/realtime layer must not start a real location writer');
  }
}

if (failures.length) {
  console.error('Group Drive Phase 3A verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Group Drive Phase 3A static contract: PASS (${files.length} files)`);
