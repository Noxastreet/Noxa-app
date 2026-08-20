import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = [
  'src/features/group-drive/runtime/participantStackPresentation.ts',
  'src/features/group-drive/components/GroupDriveParticipantStack.tsx',
  'src/features/group-drive/components/index.ts',
  'app/group-drives/participant-stack-preview.tsx',
  'docs/security/NOXA_GROUP_DRIVE_PHASE_4B_RUNBOOK.md',
];
const failures = [];

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

if (!failures.length) {
  const component = source('src/features/group-drive/components/GroupDriveParticipantStack.tsx');
  const presentation = source('src/features/group-drive/runtime/participantStackPresentation.ts');
  const preview = source('app/group-drives/participant-stack-preview.tsx');
  const runtimeIndex = source('src/features/group-drive/runtime/index.ts');
  const featureIndex = source('src/features/group-drive/index.ts');
  const code = `${component}\n${presentation}\n${preview}`;
  const required = [
    ['NoxaAvatar reuse missing', /<NoxaAvatar/],
    ['Reanimated layout transition missing', /LinearTransition/],
    ['approved 320 ms reorder duration missing', /duration\(320\)/],
    ['system Reduced Motion handling missing', /ReduceMotion\.System/],
    ['44 px interaction target missing', /(?:minHeight|height): 44/],
    ['participant accessibility label missing', /accessibilityLabel=\{row\.accessibilityLabel\}/],
    ['selected accessibility state missing', /accessibilityState=\{\{ selected \}\}/],
    ['truthful Arrived state missing', /'Arrived'/],
    ['truthful Unavailable state missing', /'Unavailable'/],
    ['current-user You label missing', />You</],
    ['hidden participant affordance missing', /presentation\.hiddenCount/],
    ['simulation layer is not wired into the preview', /createGroupDriveSimulation/],
    ['dev-only production guard missing', /if \(!__DEV__\) return <Redirect/],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(code)) failures.push(label);
  }
  if (!/export \* from '.\/participantStackPresentation'/.test(runtimeIndex)) {
    failures.push('participant presentation export missing');
  }
  if (!/export \* from '.\/components'/.test(featureIndex)) {
    failures.push('participant component export missing');
  }
  if (/from ['"](?:@\/src\/lib\/supabase|@rnmapbox\/maps|expo-location|expo-task-manager|@\/src\/lib\/liveDrive)['"]/.test(code)) {
    failures.push('Phase 4B must not import Supabase, Mapbox, native location, TaskManager or personal Live Drive');
  }
  if (/\b(?:speed|leaderboard|rank|eta)\b/i.test(`${component}\n${presentation}`)) {
    failures.push('Phase 4B presentation must not add speed, ranking, leaderboard or ETA state');
  }
}

if (failures.length) {
  console.error('Group Drive Phase 4B verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Group Drive Phase 4B static contract: PASS (${files.length} files)`);
