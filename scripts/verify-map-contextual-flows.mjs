import fs from 'node:fs';

function source(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireMatch(label, text, pattern) {
  if (!pattern.test(text)) throw new Error(label);
}

function requireNoMatch(label, text, pattern) {
  if (pattern.test(text)) throw new Error(label);
}

const mapRoot = source('app/(tabs)/index.tsx');
const planner = source('src/features/map-context/MapGroupDriveFlow.tsx');
const placeSearch = source('src/features/map-context/MapPlaceSearch.tsx');
const liveMap = source('src/features/mapbox/MapboxLiveMap.tsx');
const mapTypes = source('src/features/mapbox/types.ts');
const groupDriveApi = source('src/features/group-drive/api.ts');
const eventDetail = source('src/features/crews-events/CanonicalEventDetailScreen.tsx');
const rootLayout = source('app/_layout.tsx');

requireMatch('Gesture-driven sheets must have one app root', rootLayout, /<GestureHandlerRootView/);
requireMatch('Map root must keep the canonical live Mapbox surface', mapRoot, /<MapboxLiveMapCompat/);
requireMatch('Map root must compose the contextual Group Drive flow', mapRoot, /<MapGroupDriveFlow/);
requireMatch('Map camera must receive measured sheet inset', mapRoot, /bottomContentInset=\{mapBottomContentInset\}/);
requireMatch('Map root must expose camera center for destination selection', mapRoot, /onMapCenterChange=\{setMapCenter\}/);
requireMatch('Event preview must use the Drive there CTA', mapRoot, /title="Drive there"/);
requireMatch('Event route must preserve provider identity for Group Drive reuse', mapRoot, /provider: route\.provider/);
requireMatch('Event route must pass the existing route into Group Drive', mapRoot, /initialRoute=\{groupDriveRoute\}/);
requireMatch('Route planning must expose one Start CTA', mapRoot, /title="Start"/);
requireMatch('Driver markers must open contextual preview first', mapRoot, /onDriverPress=\{openDriverPreview\}/);
requireMatch('Group Drive route must reuse the canonical map route prop', mapRoot, /route=\{groupDriveRoute \?\? route\}/);

requireMatch('Planner must have the five compact decision states', planner, /"destination".*"route".*"people".*"departure".*"review"/s);
requireMatch('Planner must show segmented progress', planner, /progressSegment/);
requireMatch('Planner must animate decisions within one persistent sheet', planner, /FadeInRight[\s\S]*FadeOutLeft/);
requireMatch('Planner must keep Lobby in the same contextual card', planner, /"lobby"[\s\S]*renderLobby/);
requireMatch('Planner must make point A the current user location', planner, /A · START[\s\S]*Current location/);
requireMatch('Planner must embed destination search in the Where card', planner, /<MapPlaceSearch/);
requireMatch('Known Event route must skip repeated Where and Route decisions', planner, /goTo\(initialRoute \? "people" : "destination"\)/);
requireMatch('Planner must defer creation until review action', planner, /const createDrive = async \(\)/);
requireMatch('Planner must reuse existing route calculation', planner, /calculateDriveRoute/);
requireMatch('Planner must reuse pre-creation invite candidates', planner, /loadDriveInviteCandidates/);
requireMatch('Planner must persist the already calculated route', planner, /saveCalculatedDriveRoute/);
requireMatch('Planner must support Android Back within the flow', planner, /BackHandler\.addEventListener\("hardwareBackPress"/);
requireNoMatch('Planner must not mount a second Mapbox surface', planner, /MapboxLiveMap|MapboxEventLocationPicker|<MapView/);
requireNoMatch(
  'Planner must not return to the old page wizard',
  planner,
  /\/group-drives\/(details|route|participants|schedule|review)/,
);
requireNoMatch(
  'Planner must not open the legacy full-screen Lobby after creation',
  planner,
  /pathname:\s*"\/group-drives\/\[id\]"\s*,/,
);
requireMatch('Destination search must reuse Mapbox Search Box', placeSearch, /search\/searchbox\/v1\/suggest/);
requireMatch('Destination search must retrieve exact Mapbox coordinates', placeSearch, /search\/searchbox\/v1\/retrieve/);
requireNoMatch('Planner must not introduce trip or route history UI', planner, /trip history|route history|visited-place history/i);

requireMatch('Live map props must expose sheet-aware bottom inset', mapTypes, /bottomContentInset\?: number/);
requireMatch('Live map props must expose map center changes', mapTypes, /onMapCenterChange\?: \(point: LatLng\)/);
requireMatch('Live map must report stable camera center on idle', liveMap, /onMapIdle=/);
requireMatch('Live map follow padding must be sheet aware', liveMap, /paddingBottom: bottomContentInset \?\? 260/);
requireMatch(
  'Required Mapbox wordmark and attribution must share one quiet corner',
  liveMap,
  /attributionPosition=\{\{ bottom: mapFooterInset, left: 88 \}\}[\s\S]*logoPosition=\{\{ bottom: mapFooterInset, left: 8 \}\}/,
);

requireMatch('Group Drive API must reuse calculated route persistence', groupDriveApi, /saveCalculatedDriveRoute/);
requireMatch('Group Drive invite candidate loader must share one implementation', groupDriveApi, /loadDriveInviteCandidatesForUser/);
requireMatch('Event Detail must continue to reuse known event destination', eventDetail, /focusEventId: event\.id, mapMode: "route"/);
requireMatch('Event Detail must use the same Drive there language', eventDetail, /title="Drive there"/);

console.log('Map contextual flow verification passed.');
