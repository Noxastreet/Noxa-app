#!/usr/bin/env node

import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const home = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const card = fs.readFileSync('src/features/map/MapDriverCard.tsx', 'utf8');
const driveTogether = fs.readFileSync(
  'src/features/group-drive/DriveTogetherMapLayer.tsx',
  'utf8',
);
const mapRuntime = fs.readFileSync(
  'src/features/mapbox/MapboxLiveMap.tsx',
  'utf8',
);
const mapCompat = fs.readFileSync(
  'src/features/mapbox/MapboxLiveMapCompat.tsx',
  'utf8',
);

assert(
  /onDriverPress=\{openDriverCard\}/.test(home)
    && /setSelectedDriverId\(driverId\)/.test(home)
    && /<MapDriverCard/.test(home),
  'Tapping a live driver marker must open an in-map contextual driver card.',
);

assert(
  !/const openDriverProfile[\s\S]{0,250}router\.push/.test(home)
    && /onDriverPress=\{props\.onDriverPress\}/.test(mapCompat)
    && !/selectedDriverId|View profile|Close driver preview/.test(mapCompat),
  'The primary marker tap must open exactly one canonical in-map driver card before full profile navigation.',
);

assert(
  /isRelevant: boolean/.test(card)
    && /const canRevealMapIdentity = isRelevant \|\| currentUserId === driverId/.test(card)
    && /setProfile\(null\);[\s\S]{0,80}setVehicle\(null\);/.test(card)
    && /const name = isRelevant \?/.test(card)
    && /: 'NOXA driver'/.test(card)
    && /isRelevant=\{Boolean\(selectedDriver\.is_relevant\)\}/.test(home),
  'Stranger identity and vehicle data must remain masked on the Map card until explicit profile navigation.',
);

assert(
  /from\('follows'\)/.test(card)
    && /relationship === 'mutual'/.test(card)
    && /relationship === 'incoming'/.test(card)
    && /relationship === 'outgoing'/.test(card),
  'Driver card actions must reflect the existing reciprocal-follow social graph.',
);

assert(
  /title: 'Connect'/.test(card)
    && /title: 'Accept'/.test(card)
    && /title: 'Connection sent'/.test(card)
    && /title: 'Invite to Drive'/.test(card),
  'Driver card must expose contextual social actions instead of one generic profile action.',
);

assert(
  /from\('vehicles'\)/.test(card)
    && /eq\('is_public', true\)/.test(card)
    && /pathname: '\/vehicle-details'/.test(card),
  'Driver card may preview only a public vehicle and must keep full vehicle details on the existing screen.',
);

assert(
  /pathname: '\/driver-profile\/\[id\]'/.test(card),
  'Driver card must retain an explicit path to the existing full public profile.',
);

assert(
  /setDriveTogetherQuickStartFriendId\(driverId\)/.test(home)
    && /initialFriendId=\{driveTogetherQuickStartFriendId\}/.test(home)
    && /initialFriendId \? new Set\(\[initialFriendId\]\)/.test(driveTogether),
  'Invite to Drive from a map card must reuse the existing destination-first Drive Together flow with that mutual friend preselected.',
);

assert(
  !/MapboxLiveMapCompat/.test(card)
    && !/watchPositionAsync|startLocationUpdatesAsync|TaskManager\.defineTask/.test(card)
    && /onDriverPress\(driver\.user_id\)/.test(mapRuntime),
  'Driver card must reuse the existing MapView and must not add a GPS/location runtime.',
);

if (!process.exitCode) {
  console.log('Map driver contextual card contract passed.');
}
