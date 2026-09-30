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
const layer = read('src/features/group-drive/DriveTogetherMapLayer.tsx');
const api = read('src/features/group-drive/api.ts');

assert(
  /title="Add driver"/.test(home)
    && /onAddDriver=\{\(\) => startDriveTogetherForEvent\(selectedEvent\)\}/.test(home),
  'A ready Event route must expose Add driver and hand the selected Event into Drive Together.',
);

assert(
  /const startDriveTogetherForEvent = useCallback/.test(home)
    && /setDriveTogetherInitialDestination\(\{[\s\S]{0,240}id: event\.id[\s\S]{0,180}latitude: event\.latitude[\s\S]{0,120}longitude: event\.longitude[\s\S]{0,120}label: event\.title/.test(home)
    && /setDriveTogetherOpen\(true\)/.test(home),
  'Event -> Drive Together must reuse Event coordinates/title without asking for destination again.',
);

assert(
  /eventDestinations=\{driveTogetherEventDestinations\}/.test(home)
    && /lifecycle === "scheduled"/.test(home)
    && /lifecycle === "live"/.test(home),
  'Drive Together destination chooser must receive only scheduled/live Events from Home Map.',
);

assert(
  /export type DriveTogetherDestinationSeed/.test(layer)
    && /initialDestination\?: DriveTogetherDestinationSeed \| null/.test(layer)
    && /eventDestinations\?: DriveTogetherDestinationSeed\[\]/.test(layer),
  'Drive Together must accept a reusable destination seed and Event destination options.',
);

assert(
  /if \(!open \|\| !driveStateResolved \|\| !initialDestination\) return;/.test(layer)
    && /if \(roomId\)[\s\S]{0,180}setPendingExternalDestination\(initialDestination\)/.test(layer)
    && /setDraftDestination\(nextDestination\)[\s\S]{0,180}setComposerMode\('create-friends'\)/.test(layer)
    && /setSelectedFriendIds\([\s\S]{0,140}initialFriendId[\s\S]{0,140}new Set\(\)/.test(layer),
  'Destination bridge must reuse an existing room or skip directly to friend selection for a new room.',
);

assert(
  /title="Drive Together to this event\?"/.test(layer)
    && /proposeQuickDriveDestination\(roomId, next\)/.test(layer)
    && /const clearRoom = useCallback[\s\S]{0,420}setPendingExternalDestination\(null\)/.test(layer),
  'Existing Drive Together rooms must confirm/reuse the room and clear external Event intent when room state is cleared.',
);

assert(
  /destinationSectionLabel/.test(layer)
    && /eventDestinations\.slice\(0, 6\)\.map/.test(layer)
    && /calendar-outline/.test(layer),
  'Drive Together destination composer must expose Events as first-class destination choices.',
);

assert(
  /createQuickDriveRoom\([\s\S]{0,120}\[\.\.\.selectedFriendIds\][\s\S]{0,120}draftDestination/.test(layer),
  'New Event-driven rooms must keep using the existing quick-room creation path.',
);

assert(
  /noxa_create_quick_drive_with_destination/.test(api)
    && /noxa_propose_quick_drive_destination/.test(api),
  'Event bridge must reuse existing quick-drive backend RPCs.',
);

assert(
  !/event_id|eventId.*drive_sessions|alter table public\.drive_sessions/.test(layer),
  'Event bridge must not introduce a new Event/Drive schema coupling.',
);

console.log('PASS: NOXA Event <-> Drive Together bridge');
