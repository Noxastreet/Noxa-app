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

const screen = read('app/quick-connect.tsx');

assert(
  /const QUICK_CONNECT_FORWARD_ENTER = SlideInRight[\s\S]{0,180}duration\(animations\.sheet\)[\s\S]{0,180}ReduceMotion\.System/.test(screen)
    && /const QUICK_CONNECT_FORWARD_EXIT = SlideOutLeft[\s\S]{0,180}duration\(animations\.base\)[\s\S]{0,180}ReduceMotion\.System/.test(screen)
    && /const QUICK_CONNECT_BACK_ENTER = SlideInLeft[\s\S]{0,180}duration\(animations\.sheet\)[\s\S]{0,180}ReduceMotion\.System/.test(screen)
    && /const QUICK_CONNECT_BACK_EXIT = SlideOutRight[\s\S]{0,180}duration\(animations\.base\)[\s\S]{0,180}ReduceMotion\.System/.test(screen),
  'Quick Connect stages must use directional push/pop motion and remain Reduce Motion aware.',
);

assert(
  /const transitionStage = useCallback[\s\S]{0,650}setStageTransitionDirection\(direction\)[\s\S]{0,220}requestAnimationFrame/.test(screen)
    && /transitionStage\('forward',[\s\S]{0,160}setScannerOpen\(true\)/.test(screen)
    && /transitionStage\('back',[\s\S]{0,180}setScannerOpen\(false\)/.test(screen),
  'Quick Connect must preserve navigation direction for forward and back stage changes.',
);

assert(
  /const stageKey =[\s\S]{0,420}'share'[\s\S]*'success'[\s\S]*'preview'[\s\S]*'scanner'[\s\S]*'connect'/.test(screen),
  'Quick Connect must classify its semantic internal stages explicitly.',
);

assert(
  /<Animated\.View[\s\S]{0,220}entering=\{stageEntering\}[\s\S]{0,140}exiting=\{stageExiting\}[\s\S]{0,100}key=\{stageKey\}/.test(screen),
  'Quick Connect must keep its screen shell stable while directionally transitioning internal stages.',
);

assert(
  /<CameraView[\s\S]{0,180}barcodeScannerSettings=\{\{ barcodeTypes: \['qr'\] \}\}[\s\S]{0,140}onBarcodeScanned=\{scannerLocked \? undefined : handleScan\}/.test(screen),
  'Scanner behavior must remain unchanged inside the animated stage.',
);

assert(
  /resolveQuickConnect\(value\)/.test(screen)
    && /redeemQuickConnect\(preview\.sessionId\)/.test(screen)
    && /preview\.alreadyFriends/.test(screen),
  'Quick Connect resolve/redeem/already-friends business logic must remain intact.',
);

assert(
  !/expo-location|watchPositionAsync|startLocationUpdatesAsync|driver_locations/.test(screen),
  'Quick Connect motion must not introduce location sharing or GPS runtime.',
);

console.log('PASS: NOXA Quick Connect stage continuity');
