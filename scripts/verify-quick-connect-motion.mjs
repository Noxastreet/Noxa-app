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
  /const QUICK_CONNECT_STAGE_ENTER = FadeIn[\s\S]{0,140}duration\(animations\.micro\)[\s\S]{0,120}ReduceMotion\.System/.test(screen)
    && /const QUICK_CONNECT_STAGE_EXIT = FadeOut[\s\S]{0,140}duration\(animations\.fast\)[\s\S]{0,120}ReduceMotion\.System/.test(screen),
  'Quick Connect stage transitions must be short and Reduce Motion aware.',
);

assert(
  /const stageKey =[\s\S]{0,420}'share'[\s\S]*'success'[\s\S]*'preview'[\s\S]*'scanner'[\s\S]*'connect'/.test(screen),
  'Quick Connect must classify its semantic internal stages explicitly.',
);

assert(
  /<Animated\.View[\s\S]{0,220}entering=\{QUICK_CONNECT_STAGE_ENTER\}[\s\S]{0,140}exiting=\{QUICK_CONNECT_STAGE_EXIT\}[\s\S]{0,100}key=\{stageKey\}/.test(screen),
  'Quick Connect must keep its screen shell stable while internal stages transition.',
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
