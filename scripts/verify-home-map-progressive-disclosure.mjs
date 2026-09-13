import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const homePath = 'app/(tabs)/index.tsx';
const specPath = 'docs/ai-design-library/03-home-map-mvp-spec.md';
const failures = [];

for (const file of [homePath, specPath]) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

if (!failures.length) {
  const home = fs.readFileSync(path.join(root, homePath), 'utf8');
  const spec = fs.readFileSync(path.join(root, specPath), 'utf8');

  const requiredHome = [
    ['driver measurement time is not preserved', /type ActiveDriver[\s\S]*updated_at: string/],
    ['driver normalization drops updated_at', /normalizeActiveDriver[\s\S]*updated_at: row\.updated_at/],
    ['Home local stale threshold missing', /HOME_DRIVER_STALE_AFTER_MS/],
    ['Home freshness clock missing', /driverFreshnessClock/],
    ['fresh driver filtering missing', /freshActiveDrivers[\s\S]*driverIsFresh/],
    ['nearby must not fall back to every active driver', /const nearbyDrivers = useMemo\([\s\S]*driverLocation[\s\S]*: \[\]/],
    ['unknown own position is not labelled honestly', /location unavailable/],
    ['stranger marker avatar is not masked', /avatar_url: trusted \? driver\.profile\?\.avatar_url \?\? null : null/],
    ['stranger marker label is not neutralized', /label: trusted \? driverLabel\(driver\) : "NOXA driver"/],
    ['driver selection state missing', /selectedDriver/],
    ['driver pin still bypasses preview', /onDriverPress=\{selectMapboxDriver\}/],
    ['compact driver preview missing', /function DriverCard/],
    ['profile transition is not explicit', /View profile/],
    ['driver preview auto-dismiss missing', /DRIVER_PREVIEW_AUTO_DISMISS_MS/],
  ];

  for (const [label, pattern] of requiredHome) {
    if (!pattern.test(home)) failures.push(label);
  }

  if (!/neutral Identity Orb/i.test(spec) || !/Тап по пину не уводит пользователя с карты/.test(spec)) {
    failures.push('Home/Map MVP spec no longer contains the progressive-disclosure contract');
  }

  if (/onDriverPress=\{openDriverProfile\}/.test(home)) {
    failures.push('driver pin must not open a deep profile directly');
  }
}

if (failures.length) {
  console.error('Home / Map progressive-disclosure verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Home / Map progressive-disclosure contract: PASS');
