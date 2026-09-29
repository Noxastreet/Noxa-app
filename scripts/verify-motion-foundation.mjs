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

const animations = read('src/theme/animations.ts');
const surface = read('src/components/ui/NoxaPressableSurface.tsx');
const button = read('src/components/ui/NoxaButton.tsx');
const tabs = read('components/noxa-bottom-tab-bar.tsx');
const layout = read('app/(tabs)/_layout.tsx');

assert(
  /rootTab:\s*160/.test(animations)
    && /spring:\s*\{/.test(animations)
    && /press:\s*\{/.test(animations)
    && /tab:\s*\{/.test(animations),
  'Canonical motion tokens must define root tab timing and shared press/tab springs.',
);

assert(
  /useSharedValue/.test(surface)
    && /useAnimatedStyle/.test(surface)
    && /withSpring/.test(surface)
    && /useReducedMotion/.test(surface)
    && /animations\.spring\.press/.test(surface),
  'NoxaPressableSurface must use shared spring press physics with Reduce Motion support.',
);

assert(
  /useSharedValue/.test(button)
    && /useAnimatedStyle/.test(button)
    && /withSpring/.test(button)
    && /useReducedMotion/.test(button)
    && /animations\.spring\.press/.test(button),
  'NoxaButton must use shared spring press physics with Reduce Motion support.',
);

assert(
  /function MotionTabItem/.test(tabs)
    && /Haptics\.selectionAsync/.test(tabs)
    && /animations\.spring\.tab/.test(tabs)
    && /useReducedMotion/.test(tabs)
    && /scaleX/.test(tabs),
  'Bottom navigation must animate selection with shared motion tokens and restrained haptics.',
);

assert(
  /animation:\s*['"]fade['"]/.test(layout)
    && /duration:\s*animations\.rootTab/.test(layout),
  'Root tab navigation must use the canonical restrained fade transition.',
);

assert(
  !/watchPositionAsync|startLocationUpdatesAsync|Mapbox\.MapView|<MapView/.test(
    [surface, button, tabs, layout].join('\n'),
  ),
  'Motion foundation must not introduce Mapbox or GPS runtime primitives.',
);

console.log('PASS: NOXA motion foundation contract');
