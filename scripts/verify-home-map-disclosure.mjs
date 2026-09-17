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
    ['stranger vehicle masking missing', /vehicle_label: null/],
    ['stranger label masking missing', /label: "NOXA driver"/],
    ['driver preview state missing', /selectedDriverId/],
    ['pin press must open preview before profile', /setSelectedDriverId\(driverId\)/],
    ['trusted preview avatar missing', /selectedDriver\.is_relevant && selectedDriver\.avatar_url/],
    ['trusted preview vehicle missing', /selectedDriver\.vehicle_label/],
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

  if (!/mapFocusedRef\.current = true;[\s\S]{0,120}void loadMyDriverIds\(\);/.test(home)) {
    failures.push('Map focus must refresh trusted-driver relationships');
  }
  if (!/Promise\.all\(\[loadMyDriverIds\(\), refreshActiveDrivers\(\)\]\)/.test(home)) {
    failures.push('Map foreground resume must refresh trusted-driver relationships');
  }
  if (!/\.eq\("is_public", true\)[\s\S]{0,80}\.eq\("is_primary", true\)/.test(home)) {
    failures.push('Trusted driver preview must load only public primary vehicles');
  }
  const relationshipErrorStart = home.indexOf('if (relationshipError) {');
  const relationshipErrorEnd = home.indexOf('const outgoing = new Set(', relationshipErrorStart);
  const relationshipErrorBlock = home.slice(relationshipErrorStart, relationshipErrorEnd);
  if (relationshipErrorStart < 0 || !relationshipErrorBlock.includes('return;') || relationshipErrorBlock.includes('setMyDriverIds')) {
    failures.push('Transient relationship failures must preserve the previous trusted-driver set');
  }
}

if (failures.length) {
  console.error('Home / Map progressive disclosure verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Home / Map progressive disclosure contract: PASS');
