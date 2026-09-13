import assert from 'node:assert/strict';
import fs from 'node:fs';

const events = fs.readFileSync('src/features/crews-events/CanonicalEventsScreen.tsx', 'utf8');
const crews = fs.readFileSync('src/features/crews-events/CanonicalCrewsScreen.tsx', 'utf8');
const garage = fs.readFileSync('app/(tabs)/garage.tsx', 'utf8');
const eventsTab = fs.readFileSync('app/(tabs)/events.tsx', 'utf8');

assert.equal(events.includes('NEARBY NOW'), false, 'Events must not claim proximity without a distance/location calculation.');
assert.equal(events.includes('available around you'), false, 'Events must not claim events are around the user without location evidence.');
assert.equal(events.includes('What is happening around you.'), false, 'Events subtitle must not imply proximity without location evidence.');
assert.ok(events.includes('LIVE & NEXT 7 DAYS'), 'Temporal event summary must describe the data it actually counts.');
assert.ok(events.includes('live or starting within 7 days'), 'Temporal event summary copy must match the seven-day calculation.');
assert.ok(events.includes('const nearTermCount = events.filter'), 'Temporal count should be named for what it measures.');

assert.ok(events.includes('createButton: {\n    minHeight: 44,'), 'Events Create control must meet the 44px minimum target.');
assert.ok(crews.includes('createButton: {\n    minHeight: 44,'), 'Crews Create control must meet the 44px minimum target.');
assert.equal(crews.includes('Nothing nearby yet'), false, 'Crews must not claim nearby discovery without location/distance evidence.');
assert.equal(crews.includes('ACTIVE NEAR YOU'), false, 'Crews must not claim proximity without location/distance evidence.');
assert.ok(crews.includes('Nothing to discover yet'), 'Crews empty state must use non-geographic discovery wording.');
assert.ok(crews.includes('ACTIVE CREWS'), 'Crews discovery section must use truthful non-geographic wording.');
assert.equal(crews.includes('PEOPLE NEARBY'), false, 'Crews profile strip must not claim proximity for an unfiltered profile sample.');
assert.ok(crews.includes('COMMUNITY PICKS'), 'Crews discovery profile strip must use non-geographic wording.');
assert.ok(crews.includes('filterButton: {\n    minHeight: 44,'), 'Crews Discover/My Crews controls must meet the 44px minimum target.');
assert.ok(garage.includes('addButton: {\n    minHeight: 44,'), 'Garage Add control must meet the 44px minimum target.');
assert.ok(eventsTab.includes('historyButton: {\n    position: \'absolute\','), 'Events History control must remain present.');
assert.ok(eventsTab.includes('right: spacing.md,\n    minHeight: 44,'), 'Events History control must meet the 44px minimum target.');

console.log('T8 core truth/accessibility contract: PASS (18 checks)');
