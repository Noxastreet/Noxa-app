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

const sheet = read('src/features/crews-events/EntityActionSheet.tsx');

assert(
  /animationType="none"/.test(sheet)
    && /Animated\.spring\(translateY/.test(sheet)
    && /animations\.spring\.sheet/.test(sheet)
    && /useReducedMotion/.test(sheet),
  'EntityActionSheet must use shared spring physics with Reduce Motion support.',
);

assert(
  /PanResponder\.create/.test(sheet)
    && /gesture\.vy > 0\.85/.test(sheet)
    && /gesture\.dy > 72/.test(sheet)
    && /translateY\.stopAnimation/.test(sheet),
  'EntityActionSheet must support interruptible velocity-aware drag dismissal.',
);

assert(
  /backdropOpacity/.test(sheet)
    && /Animated\.timing\(backdropOpacity/.test(sheet)
    && /requestClose\(action\.onPress\)/.test(sheet),
  'EntityActionSheet must coordinate backdrop motion and defer actions until dismissal.',
);

assert(
  /<NoxaSurface[\s\S]*corners="top"[\s\S]*level="sheet"/.test(sheet)
    && /<NoxaSurface[\s\S]*corners="signature"[\s\S]*maskChildren/.test(sheet),
  'EntityActionSheet must use canonical NOXA surface geometry.',
);

assert(
  !/watchPositionAsync|startLocationUpdatesAsync|Mapbox\.MapView|<MapView/.test(sheet),
  'Sheet motion must not introduce Mapbox or GPS runtime primitives.',
);

console.log('PASS: NOXA premium action-sheet motion');
