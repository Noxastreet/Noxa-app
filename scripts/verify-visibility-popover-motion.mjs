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

assert(
  /const VISIBILITY_MENU_ENTER = FadeIn[\s\S]{0,220}duration\(animations\.rootTab\)[\s\S]{0,260}translateY:\s*-6[\s\S]{0,160}scale:\s*0\.985[\s\S]{0,180}ReduceMotion\.System/.test(home),
  'Visibility popover must use restrained anchored entrance motion with Reduce Motion.',
);

assert(
  /const VISIBILITY_MENU_EXIT = FadeOut[\s\S]{0,140}duration\(animations\.fast\)[\s\S]{0,120}ReduceMotion\.System/.test(home),
  'Visibility popover must exit quickly without delaying map interaction.',
);

assert(
  /<Animated\.View[\s\S]{0,220}entering=\{VISIBILITY_MENU_ENTER\}[\s\S]{0,140}exiting=\{VISIBILITY_MENU_EXIT\}[\s\S]{0,180}visibilityMenuPosition/.test(home)
    && /<NoxaSurface level="overlay" style=\{styles\.visibilityMenu\}>/.test(home),
  'Visibility choices must animate as one anchored overlay surface.',
);

assert(
  /accessibilityState=\{\{ checked: selected \}\}/.test(home)
    && /changeVisibilityMode\(mode\.id\)/.test(home),
  'Visibility radio semantics and mode-change behavior must remain intact.',
);

assert(
  /pendingAudienceChange/.test(home)
    && /applyAudienceChange\(pendingAudienceChange\.to\)/.test(home),
  'Active Live Drive audience changes must still require the existing explicit confirmation path.',
);

assert(
  !/watchPositionAsync|startLocationUpdatesAsync|TaskManager\.defineTask/.test(
    home.slice(
      home.indexOf('const VISIBILITY_MENU_ENTER'),
      home.indexOf('function EventCard'),
    ),
  ),
  'Visibility popover motion must not add location runtime primitives.',
);

console.log('PASS: NOXA visibility popover motion contract');
