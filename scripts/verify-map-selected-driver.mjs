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

const types = read('src/features/mapbox/types.ts');
const geojson = read('src/features/mapbox/geojson.ts');
const runtime = read('src/features/mapbox/MapboxLiveMap.tsx');
const home = read('app/(tabs)/index.tsx');
const active = read('app/group-drives/[id]/active.tsx');

assert(
  /selectedDriverId\?: string \| null/.test(types),
  'Shared Mapbox props must expose an optional selected driver id.',
);

assert(
  /createDriverFeatureCollection\([\s\S]{0,120}selectedDriverId: string \| null = null/.test(geojson)
    && /selected: driver\.user_id === selectedDriverId/.test(geojson),
  'Driver feature data must encode selected state for shared layers.',
);

assert(
  /selectedDriverId = null/.test(runtime)
    && /createDriverFeatureCollection\(activeDrivers, selectedDriverId\)/.test(runtime),
  'Native Mapbox runtime must consume the shared selected driver state.',
);

assert(
  /isSelected=\{selectedDriverId === driver\.user_id\}/.test(runtime)
    && /styles\.driverMarkerSelected/.test(runtime)
    && /driverMarkerSelected:\s*\{[\s\S]{0,180}scale:\s*1\.16/.test(runtime),
  'Unclustered selected driver marker must receive restrained emphasis and z-selection.',
);

assert(
  /\["==", \["get", "selected"\], true\]/.test(runtime)
    && /circleRadius:[\s\S]{0,140}22[\s\S]{0,80}18/.test(runtime),
  'Cluster-source unclustered driver glow must also understand selected state.',
);

assert(
  /selectedDriverId=\{selectedDriverId\}/.test(home),
  'Home Map must bind its canonical selected driver to Mapbox.',
);

assert(
  /selectedDriverId=\{selectedUserId\}/.test(active),
  'Active Group Drive must reuse the same selected participant marker state.',
);

assert(
  !/watchPositionAsync|startLocationUpdatesAsync|TaskManager\.defineTask/.test(
    [types, geojson].join('\n'),
  ),
  'Selected marker presentation must not create location runtime primitives.',
);

console.log('PASS: NOXA selected driver marker contract');
