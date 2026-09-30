import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const layout = read('app/_layout.tsx');
const eventDetail = read('src/features/crews-events/CanonicalEventDetailScreen.tsx');
const crewDetail = read('src/features/crews-events/CanonicalCrewDetailScreen.tsx');

assert(
  /const detailScreenOptions = \{[\s\S]*animation:\s*'default'[\s\S]*gestureEnabled:\s*true[\s\S]*presentation:\s*'card'[\s\S]*backgroundColor:\s*colors\.background/.test(layout),
  'Detail navigation must use native hierarchical card transitions with gestures and a stable NOXA background.',
);

for (const name of ['event-details', 'driver-profile/\\[id\\]', 'vehicle-details', 'crew/\\[id\\]']) {
  const pattern = new RegExp(`<Stack\\.Screen name="${name}" options=\\{detailScreenOptions\\}`, 'm');
  assert(pattern.test(layout), `Missing canonical detail motion options for ${name}.`);
}

assert(
  /if \(loading\)[\s\S]{0,220}<EventHeader \/>/.test(eventDetail),
  'Event Detail must render its navigation shell before async data resolves.',
);

assert(
  /if \(loading\)[\s\S]{0,240}<CrewHeader onMore=\{\(\) => undefined\} \/>/.test(crewDetail),
  'Crew Detail must render its navigation shell before async data resolves.',
);

assert(
  !/animation:\s*['"]fade['"]/.test(layout),
  'Root/detail navigation must not reintroduce whole-screen fade transitions.',
);

console.log('PASS: NOXA detail navigation motion foundation');
