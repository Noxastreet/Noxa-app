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

const home = read('app/(tabs)/index.tsx');

assert(
  /const animateTo = useCallback\([\s\S]{0,180}\(region: MapRegion, duration = 550\)[\s\S]{0,120}animateToRegion\(region, duration\)/.test(home),
  'Map camera helper must preserve the longer default duration while allowing targeted spatial timing.',
);

assert(
  /const selectEvent[\s\S]{0,220}setSelectedEvent\(event\);[\s\S]{0,120}requestAnimationFrame\(\(\) =>[\s\S]{0,120}animateTo\(eventRegion\(event\), animations\.step\)/.test(home),
  'Event selection must commit selected state before short camera focus.',
);

assert(
  /const openDriverCard[\s\S]{0,320}setSelectedDriverId\(driverId\);[\s\S]{0,280}const focusRegion =[\s\S]{0,260}requestAnimationFrame\(\(\) =>[\s\S]{0,100}animateTo\(focusRegion, animations\.step\)/.test(home),
  'Driver selection must commit contextual state before the same short camera focus.',
);

assert(
  /const recenterMap[\s\S]{0,520}animateTo\(pointRegion\(point\)\)/.test(home),
  'Recenter must retain the default camera timing rather than inherit object-selection timing.',
);

assert(
  !/animateToRegion\([\s\S]{0,180},\s*260\s*\)/.test(
    home.slice(home.indexOf('const openDriverCard'), home.indexOf('const inviteDriverToDriveTogether')),
  ),
  'Driver focus must not retain a separate hard-coded camera duration.',
);

console.log('PASS: NOXA Map object focus sequencing contract');
