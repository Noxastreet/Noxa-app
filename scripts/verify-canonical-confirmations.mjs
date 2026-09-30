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

const component = read('src/components/ui/NoxaConfirmationSheet.tsx');
const home = read('app/(tabs)/index.tsx');
const drive = read('src/features/group-drive/DriveTogetherMapLayer.tsx');

assert(
  /animationType="none"/.test(component)
    && /Animated\.spring\(translateY/.test(component)
    && /animations\.spring\.surface/.test(component)
    && /Animated\.timing\(backdropOpacity/.test(component)
    && /useReducedMotion/.test(component),
  'Canonical confirmation must use restrained material motion with Reduce Motion support.',
);

assert(
  /corners="top"/.test(component)
    && /level="sheet"/.test(component)
    && /confirmVariant/.test(component)
    && /variant=\{content\.confirmVariant\}/.test(component),
  'Canonical confirmation must use the NOXA sheet surface and semantic confirm action.',
);

assert(
  /contentRef = useRef/.test(component)
    && /if \(visible\)[\s\S]{0,500}contentRef\.current/.test(component),
  'Confirmation copy must remain stable while the surface dismisses.',
);

assert(
  (home.match(/<NoxaConfirmationSheet/g) ?? []).length === 2
    && /Start a 4-hour Live Drive\?/.test(home)
    && /Change Live Drive audience\?/.test(home)
    && /applyAudienceChange\(pendingAudienceChange\.to\)/.test(home)
    && /startSharing\(pendingVisibilityMode\)/.test(home),
  'Live Drive start and audience-change confirmations must preserve their existing privacy actions.',
);

assert(
  !/<Modal/.test(home),
  'Home Map must not retain ad-hoc Live Drive confirmation Modals after migration.',
);

assert(
  /pendingDestructiveAction/.test(drive)
    && /<NoxaConfirmationSheet/.test(drive)
    && /Cancel Drive Together\?/.test(drive)
    && /End Drive Together\?/.test(drive)
    && /Leave Drive Together\?/.test(drive),
  'Drive Together destructive actions must use the canonical confirmation surface.',
);

assert(
  !/Alert\.alert/.test(drive)
    && /cancelDrive\(roomId\)/.test(drive)
    && /endGroupDrive\(roomId\)/.test(drive)
    && /leaveGroupDriveAndStopLocation\(roomId\)/.test(drive),
  'Presentation may change, but Drive Together destructive backend semantics must remain unchanged.',
);

assert(
  /if \(!cancelled\)[\s\S]{0,180}room is no longer cancellable/.test(drive)
    && /refreshDetails\(roomId\)/.test(drive),
  'Cancel-room failure must still validate backend result and reconcile state.',
);

console.log('PASS: NOXA canonical confirmation contract');
