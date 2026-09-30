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
  /const DRIVE_STAGE_ENTER = FadeIn[\s\S]{0,140}duration\(animations\.micro\)[\s\S]{0,120}ReduceMotion\.System/.test(layer)
    && /const DRIVE_STAGE_EXIT = FadeOut[\s\S]{0,140}duration\(animations\.fast\)[\s\S]{0,120}ReduceMotion\.System/.test(layer),
  'Drive Together internal stage transitions must be short and Reduce Motion aware.',
);

assert(
  /const stageKey =[\s\S]{0,700}'create-destination'[\s\S]*'create-friends'[\s\S]*'invite-drivers'[\s\S]*'room-active'[\s\S]*'room-waiting'[\s\S]*'room-loading'/.test(layer),
  'Drive Together must classify meaningful internal sheet states explicitly.',
);

assert(
  /<DriveTogetherSheet[\s\S]{0,500}<Animated\.View[\s\S]{0,180}entering=\{DRIVE_STAGE_ENTER\}[\s\S]{0,120}exiting=\{DRIVE_STAGE_EXIT\}[\s\S]{0,100}key=\{stageKey\}/.test(layer),
  'Drive Together must preserve one sheet shell while animating internal state replacement.',
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
