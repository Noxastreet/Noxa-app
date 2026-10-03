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

const layer = read('src/features/group-drive/DriveTogetherMapLayer.tsx');
const sheet = read('src/features/group-drive/components/DriveTogetherSheet.tsx');

assert(
  /const DRIVE_STAGE_FORWARD_ENTER = SlideInRight[\s\S]{0,180}duration\(animations\.sheet\)[\s\S]{0,180}ReduceMotion\.System/.test(layer)
    && /const DRIVE_STAGE_FORWARD_EXIT = SlideOutLeft[\s\S]{0,180}duration\(animations\.base\)[\s\S]{0,180}ReduceMotion\.System/.test(layer)
    && /const DRIVE_STAGE_BACK_ENTER = SlideInLeft[\s\S]{0,180}duration\(animations\.sheet\)[\s\S]{0,180}ReduceMotion\.System/.test(layer)
    && /const DRIVE_STAGE_BACK_EXIT = SlideOutRight[\s\S]{0,180}duration\(animations\.base\)[\s\S]{0,180}ReduceMotion\.System/.test(layer),
  'Drive Together internal stages must use directional push/pop motion and remain Reduce Motion aware.',
);

assert(
  /const transitionComposerMode = useCallback[\s\S]{0,700}setStageTransitionDirection\(direction\)[\s\S]{0,220}requestAnimationFrame/.test(layer)
    && /transitionComposerMode\('create-friends', 'forward'\)/.test(layer)
    && /transitionComposerMode\('create-destination', 'back'\)/.test(layer)
    && /transitionComposerMode\('room', 'back'\)/.test(layer),
  'Drive Together must distinguish forward and back navigation instead of using one abrupt replacement direction.',
);

assert(
  /const stageKey =[\s\S]{0,700}'create-destination'[\s\S]*'create-friends'[\s\S]*'invite-drivers'[\s\S]*'room-active'[\s\S]*'room-waiting'[\s\S]*'room-loading'/.test(layer),
  'Drive Together must classify meaningful internal sheet states explicitly.',
);

assert(
  /<DriveTogetherSheet[\s\S]{0,500}<Animated\.View[\s\S]{0,180}entering=\{stageEntering\}[\s\S]{0,120}exiting=\{stageExiting\}[\s\S]{0,100}key=\{stageKey\}/.test(layer),
  'Drive Together must preserve one sheet shell while directionally animating internal state replacement.',
);

assert(
  /PanResponder/.test(sheet)
    && /animations\.spring\.sheet/.test(sheet)
    && /useReducedMotion/.test(sheet),
  'Existing interruptible sheet snap physics must remain intact.',
);

assert(
  !/MapboxLiveMapCompat|<MapView|watchPositionAsync|startLocationUpdatesAsync|TaskManager\.defineTask/.test(layer),
  'Drive Together motion continuity must not add a second map, GPS watcher, or background task.',
);

console.log('PASS: NOXA Drive Together stage continuity');
