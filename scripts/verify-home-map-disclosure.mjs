import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const compatPath = 'src/features/mapbox/MapboxLiveMapCompat.tsx';
const homePath = 'app/(tabs)/index.tsx';
const failures = [];

for (const file of [compatPath, homePath]) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

if (!failures.length) {
  const compat = source(compatPath);
  const home = source(homePath);

  const requiredCompat = [
    ['Home progressive-disclosure scope missing', /mapFilter === "all"[\s\S]*!props\.isRouteMode/],
    ['stranger avatar masking missing', /avatar_url: null/],
    ['stranger label masking missing', /label: "NOXA driver"/],
    ['driver preview state missing', /selectedDriverId/],
    ['pin press must open preview before profile', /setSelectedDriverId\(driverId\)/],
    ['explicit profile action missing', /View profile/],
    ['preview close action missing', /Close driver preview/],
  ];
  for (const [label, pattern] of requiredCompat) {
    if (!pattern.test(compat)) failures.push(label);
  }

  if (!/driverLocation \? "nearby now" : "active now"/.test(home)) {
    failures.push('Home Living Pulse must not label all active drivers as nearby when own location is unknown');
  }
  if (!/myDriverIds\.has\(driver\.user_id\)/.test(home)) {
    failures.push('Home trusted-driver relationship signal is missing');
  }
}

if (failures.length) {
  console.error('Home / Map progressive disclosure verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Home / Map progressive disclosure contract: PASS');
