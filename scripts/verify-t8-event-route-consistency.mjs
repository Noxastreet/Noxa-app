import assert from 'node:assert/strict';
import fs from 'node:fs';

const mapScreen = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const eventDetail = fs.readFileSync('src/features/crews-events/CanonicalEventDetailScreen.tsx', 'utf8');
const nativeMap = fs.readFileSync('src/features/mapbox/MapboxLiveMap.tsx', 'utf8');

assert.ok(
  mapScreen.includes('if (isRouteMode && focusEventId && fullEvent.id !== focusEventId) return;'),
  'Route mode must ignore taps on events other than the focused route event.',
);
assert.ok(
  mapScreen.includes('[events, focusEventId, isRouteMode, selectEvent]'),
  'Route-mode event selection guard dependencies must remain complete.',
);
assert.ok(
  mapScreen.includes('if (selectedEvent.id !== focusEventId) return;'),
  'Route requests must remain bound to the focused event id.',
);
assert.ok(
  eventDetail.includes('params: { focusEventId: event.id, mapMode: "route" }'),
  'Event Detail must open Map route mode with the same event id.',
);
assert.ok(
  nativeMap.includes('onPress={() => onEventPress(event)}'),
  'Native event markers remain interactive, so the parent route-consistency guard is required.',
);

console.log('T8 event route consistency contract: PASS (5 checks)');
