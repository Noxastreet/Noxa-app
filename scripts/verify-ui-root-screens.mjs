#!/usr/bin/env node

import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const map = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const crews = fs.readFileSync(
  'src/features/crews-events/CanonicalCrewsScreen.tsx',
  'utf8',
);
const events = fs.readFileSync(
  'src/features/crews-events/CanonicalEventsScreen.tsx',
  'utf8',
);
const garage = fs.readFileSync('app/(tabs)/garage.tsx', 'utf8');
const profile = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');
const driverCard = fs.readFileSync('src/features/map/MapDriverCard.tsx', 'utf8');
const canonical = fs.readFileSync(
  'src/features/crews-events/CanonicalPrimitives.tsx',
  'utf8',
);
const surface = fs.readFileSync('src/components/ui/NoxaSurface.tsx', 'utf8');
const pressableSurface = fs.readFileSync(
  'src/components/ui/NoxaPressableSurface.tsx',
  'utf8',
);
const rootHeader = fs.readFileSync(
  'src/components/ui/NoxaRootHeader.tsx',
  'utf8',
);

for (const [name, source] of [
  ['Crew', crews],
  ['Events', events],
  ['Garage', garage],
  ['Profile', profile],
]) {
  assert(
    /NoxaRootHeader/.test(source),
    `${name} root screen must use the shared NOXA root header.`,
  );
}

assert(
  /NoxaSegmentedControl/.test(crews)
    && /NoxaPressableSurface/.test(crews)
    && /maskChildren/.test(crews),
  'Crew must use shared segmented and cut-corner pressable surfaces.',
);

assert(
  /NoxaPressableSurface/.test(events)
    && /NoxaSurface/.test(events),
  'Events must use shared NOXA surfaces instead of bespoke card shells.',
);

assert(
  /NoxaSurface/.test(garage)
    && /NoxaButton/.test(garage),
  'Garage must use shared NOXA surface and button primitives.',
);

assert(
  /NoxaPressableSurface/.test(profile)
    && /NoxaButton/.test(profile)
    && /NoxaRootHeader/.test(profile),
  'Profile must use the shared NOXA surface hierarchy and actions.',
);

assert(
  /NoxaSurface/.test(driverCard)
    && /NoxaPressableSurface/.test(driverCard)
    && /NoxaButton/.test(driverCard),
  'Map driver card must share the same surface and action language as root screens.',
);

assert(
  /NoxaSurface[\s\S]*corners="top"[\s\S]*level="sheet"/.test(map)
    && /NoxaSurface level="overlay"/.test(map),
  'Map event, route, navigation, visibility and notice chrome must use shared NOXA surfaces.',
);

assert(
  (map.match(/<MapboxLiveMapCompat/g) ?? []).length === 1,
  'Root UI migration must preserve exactly one existing Mapbox map instance.',
);

assert(
  !/watchPositionAsync|startLocationUpdatesAsync|TaskManager\.defineTask/.test(map)
    && !/watchPositionAsync|startLocationUpdatesAsync|TaskManager\.defineTask/.test(driverCard),
  'Root UI migration must not introduce a second GPS watcher or background location task.',
);

assert(
  /maskChildren\?: boolean/.test(surface)
    && /outsideFill\?: string/.test(surface)
    && /NoxaCornerMask/.test(surface),
  'Shared surfaces must support real cut-corner masking for media cards.',
);

assert(
  /useReducedMotion/.test(pressableSurface),
  'Shared pressable surfaces must already respect reduced-motion preferences.',
);

assert(
  /typography\.v2\.hero/.test(rootHeader),
  'Root headers must use the canonical V2 display hierarchy.',
);

assert(
  /NoxaCutBackground/.test(canonical)
    && /geometry\.cut\.sm/.test(canonical)
    && /artworkImage:\s*\{\s*borderRadius:\s*0/.test(canonical),
  'Crew/Event shared status chips and artwork must align with the angular surface geometry.',
);

assert(
  (crews.match(/<NoxaSurface style={styles\.stateCard}>/g) ?? []).length >= 2
    && /NoxaPressableSurface[\s\S]*contentStyle={styles\.errorBanner}/.test(crews)
    && !/compactCard:\s*\{[^}]*borderRadius/.test(crews)
    && !/driveCard:\s*\{[^}]*borderRadius/.test(crews),
  'Crew root loading, error and content cards must not fall back to bespoke rounded shells.',
);

assert(
  (events.match(/<NoxaSurface style={styles\.stateCard}>/g) ?? []).length >= 3
    && /NoxaPressableSurface[\s\S]*contentStyle={styles\.pickCard}/.test(events)
    && !/eventCard:\s*\{[^}]*borderRadius/.test(events)
    && !/nearbyStrip:\s*\{[^}]*borderRadius/.test(events)
    && !/pickCard:\s*\{[^}]*borderRadius/.test(events),
  'Events root states, list cards and horizontal picks must use the canonical surface geometry.',
);

assert(
  (garage.match(/<NoxaSurface style={styles\.collectionState}>/g) ?? []).length >= 3
    && !/collectionState:\s*\{[^}]*borderRadius/.test(garage)
    && !/styles\.retryButton/.test(garage),
  'Garage root states and retry actions must use shared NOXA surfaces and buttons.',
);

if (!process.exitCode) {
  console.log('NOXA root-screen visual system contract passed.');
}
