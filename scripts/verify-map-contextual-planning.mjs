import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mapScreen = read('app/(tabs)/index.tsx');
const liveMap = read('src/features/mapbox/MapboxLiveMap.tsx');
const planner = read('src/features/group-drive/GroupDrivePlannerSheet.tsx');
const groupDriveApi = read('src/features/group-drive/api.ts');
const groupDriveList = read('app/group-drives/index.tsx');
const crewManage = read('app/crew-manage.tsx');
const eventDetail = read('src/features/crews-events/CanonicalEventDetailScreen.tsx');

assert(
  mapScreen.includes('<MapboxLiveMapCompat') &&
    mapScreen.includes('<GroupDrivePlannerSheet'),
  'Map must host Group Drive planning above the existing persistent MapboxLiveMap.',
);
assert(
  !planner.includes('MapboxLiveMap') && !planner.includes('<Modal'),
  'Contextual Group Drive planning must not mount a second map or full-screen Modal.',
);
assert(
  planner.includes("['where', 'route', 'crew', 'departure', 'review']"),
  'Planner must preserve the five compact decision states.',
);
assert(
  planner.includes("step === 'review'") &&
    planner.includes('createDriveSession('),
  'Durable Group Drive creation must remain a Review action.',
);
assert(
  mapScreen.includes('groupDriveRoutePreview ?? route') &&
    mapScreen.includes('selectionPoint={groupDriveSelectionPoint}'),
  'The existing live map must render planning route and point state.',
);
assert(
  liveMap.includes('onMapPress') && liveMap.includes('selectionPoint'),
  'MapboxLiveMap must expose point selection without a duplicate picker map.',
);
assert(
  groupDriveApi.includes('saveCalculatedDriveRoute') &&
    groupDriveApi.includes('driveSessionId: string | null = null'),
  'Planner must reuse Group Drive APIs before durable creation.',
);
assert(
  groupDriveList.includes("groupDriveMode: 'create'") &&
    !groupDriveList.includes("router.push('/group-drives/details')"),
  'Primary Group Drive creation must return to the persistent Map flow.',
);
assert(
  crewManage.includes("groupDriveMode: 'create'") &&
    crewManage.includes('groupDriveCrewId: crewId'),
  'Crew-context creation must preserve Crew context while moving to the Map flow.',
);
assert(
  mapScreen.includes('title="Drive there"') &&
    eventDetail.includes('title="Drive there"'),
  'Event quick and detail actions must use the same drive-first language.',
);
assert(
  mapScreen.includes('contextualSurfaceHeight') &&
    mapScreen.includes('onHeightChange={handleContextualSurfaceHeight}'),
  'Map padding/control placement must follow measured contextual-surface height.',
);

console.log('Map contextual planning contract: OK');
