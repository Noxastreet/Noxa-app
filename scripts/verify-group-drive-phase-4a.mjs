import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = [
  'src/features/group-drive/runtime/routeProgress.ts',
  'src/features/group-drive/runtime/participantStack.ts',
  'src/features/group-drive/runtime/index.ts',
  'docs/security/NOXA_GROUP_DRIVE_PHASE_4A_RUNBOOK.md',
];
const failures = [];

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

if (!failures.length) {
  const progress = source('src/features/group-drive/runtime/routeProgress.ts');
  const stack = source('src/features/group-drive/runtime/participantStack.ts');
  const runtime = source('src/features/group-drive/runtime/index.ts');
  const all = `${progress}\n${stack}`;
  const required = [
    ['route preprocessing missing', /prepareDriveRoute/],
    ['route projection missing', /projectDriveLocation/],
    ['provider distance scaling missing', /routeDistanceMeters \* \(1 - progressFraction\)/],
    ['250 m off-route default missing', /OFF_ROUTE_THRESHOLD_METERS = 250/],
    ['45 s stale default missing', /STALE_AFTER_MS = 45_000/],
    ['150 m reorder advantage missing', /REORDER_ADVANTAGE_METERS = 150/],
    ['two-update confirmation missing', /REORDER_CONFIRMATIONS = 2/],
    ['three-avatar compact window missing', /STACK_MAX_VISIBLE = 3/],
    ['current-user reservation missing', /currentUserReserved/],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(all)) failures.push(label);
  }
  if (!/export \* from '.\/routeProgress'/.test(runtime)) failures.push('route progress export missing');
  if (!/export \* from '.\/participantStack'/.test(runtime)) failures.push('stack export missing');
  if (/supabase|\.rpc\(|fetch\(|expo-location|expo-task-manager|driver_locations|liveDrive/i.test(all)) {
    failures.push('Phase 4A must remain pure local logic without network, native GPS or personal Live Drive');
  }
  if (/\b(?:speed|leaderboard|rank|eta)\b/i.test(all)) {
    failures.push('Phase 4A must not add speed, ranking, leaderboard or ETA state');
  }
}

if (failures.length) {
  console.error('Group Drive Phase 4A verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Group Drive Phase 4A static contract: PASS (${files.length} files)`);
