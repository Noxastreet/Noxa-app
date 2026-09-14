import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
  button: fs.readFileSync('src/components/ui/NoxaButton.tsx', 'utf8'),
  primitives: fs.readFileSync('src/features/crews-events/CanonicalPrimitives.tsx', 'utf8'),
  crewDetail: fs.readFileSync('src/features/crews-events/CanonicalCrewDetailScreen.tsx', 'utf8'),
  profile: fs.readFileSync('app/(tabs)/profile.tsx', 'utf8'),
  driverProfile: fs.readFileSync('app/driver-profile/[id].tsx', 'utf8'),
  vehicleDetail: fs.readFileSync('app/vehicle-details.tsx', 'utf8'),
  eventEditor: fs.readFileSync('app/event-editor.tsx', 'utf8'),
  vehicleEditor: fs.readFileSync('app/vehicle-editor.tsx', 'utf8'),
};

assert.ok(files.button.includes("hitSlop={size === 'sm' ? 6 : undefined}"), 'Small shared buttons must expose an equivalent 44px vertical hit area.');
assert.ok(files.primitives.includes('primaryButtonCompact: {\n    minHeight: 44,'), 'Compact canonical primary buttons must meet 44px minimum.');
assert.ok(files.crewDetail.includes('headerButton: {\n    width: 44,\n    height: 44,'), 'Crew Detail header actions must be 44x44.');
assert.ok(files.crewDetail.includes('tab: {\n    flex: 1,\n    minWidth: 0,\n    minHeight: 44,'), 'Crew Detail tabs must meet 44px minimum.');
assert.ok(files.profile.includes("iconButton: {\n    width: 44,\n    height: 44,"), 'Profile settings control must be 44x44.');
assert.ok(files.profile.includes('editButton: {\n    minHeight: 44,'), 'Edit Profile CTA must meet 44px minimum.');
assert.ok(files.driverProfile.includes('headerAction: {\n    width: 44,\n    height: 44,'), 'Driver Profile header actions must be 44x44.');
assert.ok(files.driverProfile.includes('followButton: { minHeight: 44,'), 'Driver Profile Follow CTA must meet 44px minimum.');
assert.ok(files.vehicleDetail.includes("headerButton: {\n    width: 44,\n    height: 44,"), 'Vehicle Detail header actions must be 44x44.');
assert.ok(files.eventEditor.includes('backButton: {\n    width: 44,\n    height: 44,'), 'Event Editor Back must be 44x44.');
assert.ok(files.eventEditor.includes('categoryOption: {\n    minHeight: 44,'), 'Event category choices must meet 44px minimum.');
assert.ok(files.vehicleEditor.includes("backButton: {\n    width: 44,\n    height: 44,"), 'Vehicle Editor Back must be 44x44.');
assert.ok(files.vehicleEditor.includes('coverActionButton: {\n    minHeight: 44,'), 'Vehicle cover actions must meet 44px minimum.');

console.log('T8 core touch-target contract: PASS (13 checks)');
