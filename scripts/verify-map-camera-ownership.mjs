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
const runtime = read('src/features/mapbox/MapboxLiveMap.tsx');

assert(
  /type MapCameraOwner =[\s\S]*"free"[\s\S]*"selection"[\s\S]*"recenter"[\s\S]*"route-context"[\s\S]*"route-follow"[\s\S]*"drive-context"[\s\S]*"drive-follow"/.test(home),
  'Home Map must define one explicit camera ownership vocabulary.',
);

assert(
  /const mapObjectSelectionLocked =[\s\S]{0,220}isRouteMode[\s\S]{0,120}isRouteFocusMode[\s\S]{0,120}driveTogetherPanelVisible[\s\S]{0,120}Boolean\(driveTogetherNavigation\)/.test(home),
  'Route/Drive contexts must own the map and block competing marker selections.',
);

assert(
  /const openDriverCard[\s\S]{0,140}if \(mapObjectSelectionLocked\) return;/.test(home)
    && /const selectMapboxEvent[\s\S]{0,180}if \(mapObjectSelectionLocked\) return;/.test(home),
  'Driver and event marker selection must respect active camera context ownership.',
);

assert(
  /const selectEvent[\s\S]{0,160}setSelectedDriverId\(null\);[\s\S]{0,80}setSelectedEvent\(event\)/.test(home)
    && /const openDriverCard[\s\S]{0,220}setSelectedEvent\(null\);[\s\S]{0,80}setSelectedDriverId\(driverId\)/.test(home),
  'Only one map object selection may own contextual UI at a time.',
);

assert(
  /const routeToEvent[\s\S]{0,180}setSelectedDriverId\(null\)/.test(home)
    && /if \(next\) \{[\s\S]{0,120}setSelectedDriverId\(null\);[\s\S]{0,80}setSelectedEvent\(null\)/.test(home),
  'Route and Drive contexts must evict stale object selections.',
);

assert(
  /const handleUserPan = useCallback\(\(\) => \{[\s\S]{0,220}setIsCameraAwayFromUser\(true\);[\s\S]{0,100}setIsRouteFollowing\(false\);[\s\S]{0,100}setIsDriveTogetherFollowing\(false\)/.test(home),
  'A real user pan must reclaim camera ownership and cancel follow modes.',
);

assert(
  /const cameraOwner: MapCameraOwner =[\s\S]{0,700}"drive-follow"[\s\S]*"route-follow"[\s\S]*"selection"[\s\S]*"recenter"[\s\S]*"free"/.test(home)
    && /const showRecenter =[\s\S]{0,120}cameraOwner === "free"/.test(home),
  'Recenter disclosure must derive from the canonical camera owner.',
);

assert(
  /onCameraChanged=\{\(state\) => \{[\s\S]{0,180}state\.gestures\.isGestureActive[\s\S]{0,120}onUserPan\(\)[\s\S]{0,140}onFollowUserLocationChange\(false\)/.test(runtime),
  'Native Mapbox user gestures must remain authoritative over programmatic follow.',
);

console.log('PASS: NOXA Map camera ownership contract');
