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
// Route state commits before spatial camera movement.
// B3 quality synchronize.

assert(
  /const ROUTE_STATE_ENTER = FadeIn[\s\S]{0,120}duration\(animations\.micro\)[\s\S]{0,120}ReduceMotion\.System/.test(home),
  'Route internal state transitions must use the shared short motion token and Reduce Motion.',
);

assert(
  /const routeToEvent[\s\S]{0,360}setRoute\(null\);[\s\S]{0,100}setRouteMessage\(null\);[\s\S]{0,100}setRouteStatus\("loading"\);[\s\S]{0,140}router\.setParams/.test(home),
  'Route tap must acknowledge immediately with a stable loading shell before route params resolve.',
);

assert(
  /setRouteStatus\(isRouteMode && focusEventId \? "loading" : "idle"\)/.test(home),
  'Route-mode reset must preserve loading state instead of flashing idle content.',
);

assert(
  /setRoute\(nextRoute\);[\s\S]{0,120}setRouteStatus\(nextRoute \? "ready" : "error"\);[\s\S]{0,180}requestAnimationFrame\(\(\) =>[\s\S]{0,180}fitRouteToMap/.test(home),
  'Route data/state must commit before the camera fit begins.',
);

assert(
  /style=\{styles\.routeStateSlot\}/.test(home)
    && /routeStateSlot:\s*\{[\s\S]{0,120}minHeight:\s*44/.test(home)
    && /key="route-loading"/.test(home)
    && /key="route-ready"/.test(home)
    && /key="route-error"/.test(home),
  'Route loading/ready/error states must share one stable geometry slot.',
);

assert(
  !/watchPositionAsync|startLocationUpdatesAsync|TaskManager\.defineTask/.test(
    home.slice(home.indexOf('function RouteCard'), home.indexOf('function routeManeuverIcon')),
  ),
  'Route-card motion must not add GPS/location runtime primitives.',
);

console.log('PASS: NOXA route continuity motion contract');
