import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const compatPath = 'src/features/mapbox/MapboxLiveMapCompat.tsx';
const nativeMapPath = 'src/features/mapbox/MapboxLiveMap.tsx';
const homePath = 'app/(tabs)/index.tsx';
const failures = [];

for (const file of [compatPath, nativeMapPath, homePath]) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

if (!failures.length) {
  const compat = source(compatPath);
  const nativeMap = source(nativeMapPath);
  const home = source(homePath);

  const requiredCompat = [
    ['Home progressive-disclosure scope missing', /mapFilter === "all"[\s\S]*!props\.isRouteMode/],
    ['stranger avatar masking missing', /avatar_url: null/],
    ['stranger username masking missing', /username: null/],
    ['stranger vehicle masking missing', /vehicle_label: null/],
    ['stranger label masking missing', /label: "NOXA driver"/],
    ['stranger direct-invite masking missing', /can_invite_directly: false/],
    ['driver selection state missing', /selectedDriverId/],
    ['pin press must select before profile', /setSelectedDriverId\(driverId\)/],
    ['native selected-driver id wiring missing', /selectedDriverId=\{/],
    ['free-map dismissal wiring missing', /onMapPress=\{\(\) =>/],
    ['native profile callback wiring missing', /onDriverProfilePress=\{/],
    ['native invite callback wiring missing', /onDriverInvitePress=\{/],
  ];
  for (const [label, pattern] of requiredCompat) {
    if (!pattern.test(compat)) failures.push(label);
  }

  const requiredNative = [
    ['selected driver must be resolved by stable user id', /activeDrivers\.find\(\(driver\) => driver\.user_id === selectedDriverId\)/],
    ['selected driver card must stay attached to MarkerView', /<MarkerView[\s\S]{0,220}coordinate=\{toPosition\(selectedDriver\)\}/],
    ['trusted attached avatar missing', /selectedDriver\.avatar_url/],
    ['trusted attached vehicle missing', /selectedDriver\.vehicle_label/],
    ['explicit profile action missing', /onDriverProfilePress \?\? onDriverPress/],
    ['Invite to Drive permission gate missing', /selectedDriver\.can_invite_directly && onDriverInvitePress/],
    ['free map tap must dismiss selection', /onPress=\{\(\) => onMapPress\?\.\(\)\}/],
  ];
  for (const [label, pattern] of requiredNative) {
    if (!pattern.test(nativeMap)) failures.push(label);
  }

  if (/getPointInView|pointForCoordinate|coordinateForPoint/.test(nativeMap)) {
    failures.push('attached driver card must not use screen projection APIs');
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
  if (
    relationshipErrorStart < 0 ||
    !relationshipErrorBlock.includes('return;') ||
    relationshipErrorBlock.includes('setMyDriverIds')
  ) {
    failures.push('Transient relationship failures must preserve the previous trusted-driver set');
  }
}

if (failures.length) {
  console.error('Home / Map progressive disclosure verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Home / Map progressive disclosure contract: PASS');
