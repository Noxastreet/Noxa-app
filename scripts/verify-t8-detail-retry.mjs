import assert from 'node:assert/strict';
import fs from 'node:fs';

const eventDetail = fs.readFileSync('src/features/crews-events/CanonicalEventDetailScreen.tsx', 'utf8');
const crewDetail = fs.readFileSync('src/features/crews-events/CanonicalCrewDetailScreen.tsx', 'utf8');
const vehicleDetail = fs.readFileSync('app/vehicle-details.tsx', 'utf8');

assert.ok(eventDetail.includes('uuidPattern.test(eventId) ? ('), 'Event Detail Retry must only appear for syntactically valid event IDs.');
assert.ok(eventDetail.includes('title="Retry"'), 'Event Detail unavailable state must expose Retry.');
assert.ok(eventDetail.includes('onPress={() => void load()}'), 'Event Detail Retry must rerun its existing load path.');

assert.ok(crewDetail.includes('uuidPattern.test(crewId) ? ('), 'Crew Detail Retry must only appear for syntactically valid crew IDs.');
assert.ok(crewDetail.includes('label="RETRY"'), 'Crew Detail unavailable state must expose Retry.');
assert.ok(crewDetail.includes('onPress={() => void load()}'), 'Crew Detail Retry must rerun its existing load path.');

assert.ok(vehicleDetail.includes('onRetry={loadVehicle}'), 'Vehicle Details must retain its existing Retry recovery path.');

console.log('T8 detail recovery contract: PASS (7 checks)');
