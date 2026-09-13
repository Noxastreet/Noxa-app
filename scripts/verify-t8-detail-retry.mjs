import assert from 'node:assert/strict';
import fs from 'node:fs';

const eventDetail = fs.readFileSync('src/features/crews-events/CanonicalEventDetailScreen.tsx', 'utf8');
const crewDetail = fs.readFileSync('src/features/crews-events/CanonicalCrewDetailScreen.tsx', 'utf8');
const vehicleDetail = fs.readFileSync('app/vehicle-details.tsx', 'utf8');
const postDetail = fs.readFileSync('app/post-details.tsx', 'utf8');
const groupDriveInvitation = fs.readFileSync('app/group-drives/invitation/[id].tsx', 'utf8');

assert.ok(eventDetail.includes('uuidPattern.test(eventId) ? ('), 'Event Detail Retry must only appear for syntactically valid event IDs.');
assert.ok(eventDetail.includes('title="Retry"'), 'Event Detail unavailable state must expose Retry.');
assert.ok(eventDetail.includes('onPress={() => void load()}'), 'Event Detail Retry must rerun its existing load path.');

assert.ok(crewDetail.includes('uuidPattern.test(crewId) ? ('), 'Crew Detail Retry must only appear for syntactically valid crew IDs.');
assert.ok(crewDetail.includes('label="RETRY"'), 'Crew Detail unavailable state must expose Retry.');
assert.ok(crewDetail.includes('onPress={() => void load()}'), 'Crew Detail Retry must rerun its existing load path.');

assert.ok(vehicleDetail.includes('onRetry={loadVehicle}'), 'Vehicle Details must retain its existing Retry recovery path.');
assert.ok(postDetail.includes('uuidPattern.test(postId) ? ('), 'Post Detail Retry must remain hidden for syntactically invalid post IDs.');
assert.ok(postDetail.includes('onPress={() => void loadPost()}'), 'Post Detail first-load network errors must expose a full Retry path.');
assert.ok(groupDriveInvitation.includes("{invitationId ? ("), 'Invitation Retry must not appear when the route has no invitation ID.');
assert.ok(groupDriveInvitation.includes('onPress={() => void load()} title="Retry"'), 'Group Drive invitation errors must expose Retry through the existing load path.');

console.log('T8 detail recovery contract: PASS (11 checks)');
