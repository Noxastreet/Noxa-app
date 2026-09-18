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
const liveMap = source('src/features/mapbox/MapboxLiveMap.tsx');
const mapTypes = source('src/features/mapbox/types.ts');
const groupDriveApi = source('src/features/group-drive/api.ts');
const eventDetail = source('src/features/crews-events/CanonicalEventDetailScreen.tsx');

requireMatch('Map root must keep the canonical live Mapbox surface', mapRoot, /<MapboxLiveMapCompat/);
requireMatch('Map root must compose the contextual Group Drive flow', mapRoot, /<MapGroupDriveFlow/);
requireMatch('Map camera must receive measured sheet inset', mapRoot, /bottomContentInset=\{mapBottomContentInset\}/);
requireMatch('Map root must expose camera center for destination selection', mapRoot, /onMapCenterChange=\{setMapCenter\}/);
requireMatch('Event preview must use the Drive there CTA', mapRoot, /title="Drive there"/);
requireMatch('Route planning must expose one Start CTA', mapRoot, /title="Start"/);
requireMatch('Driver markers must open contextual preview first', mapRoot, /onDriverPress=\{openDriverPreview\}/);
requireMatch('Group Drive route must reuse the canonical map route prop', mapRoot, /route=\{groupDriveRoute \?\? route\}/);

requireMatch('Planner must have the five compact decision states', planner, /"destination".*"route".*"people".*"departure".*"review"/s);
requireMatch('Planner must show segmented progress', planner, /progressSegment/);
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
requireNoMatch('Planner must not introduce trip or route history UI', planner, /trip history|route history|visited-place history/i);

requireMatch('Live map props must expose sheet-aware bottom inset', mapTypes, /bottomContentInset\?: number/);
requireMatch('Live map props must expose map center changes', mapTypes, /onMapCenterChange\?: \(point: LatLng\)/);
requireMatch('Live map must report stable camera center on idle', liveMap, /onMapIdle=/);
requireMatch('Live map follow padding must be sheet aware', liveMap, /paddingBottom: bottomContentInset \?\? 260/);

requireMatch('Group Drive API must reuse calculated route persistence', groupDriveApi, /saveCalculatedDriveRoute/);
requireMatch('Group Drive invite candidate loader must share one implementation', groupDriveApi, /loadDriveInviteCandidatesForUser/);
requireMatch('Event Detail must continue to reuse known event destination', eventDetail, /focusEventId: event\.id, mapMode: "route"/);

console.log('Map contextual flow verification passed.');
