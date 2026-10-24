import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const slice = (source, start, end) => {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `Missing code marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `Missing code marker: ${end}`);
  return source.slice(from, to);
};

const config = JSON.parse(read('app.json'));
const plugins = config.expo.plugins;
const picker = plugins.find((plugin) =>
  Array.isArray(plugin) && plugin[0] === 'expo-image-picker'
);
const photoCopy = config.expo.ios.infoPlist.NSPhotoLibraryUsageDescription;
assert.ok(typeof photoCopy === 'string' && photoCopy.length > 50);
assert.equal(picker?.[1]?.photosPermission, photoCopy);
assert.match(photoCopy, /profile picture/i);
assert.match(photoCopy, /vehicles/i);

const layer = read('src/features/group-drive/DriveTogetherMapLayer.tsx');
const createRoom = slice(layer, '  const createRoom = useCallback(', '  const joinInvite = useCallback(');
const joinInvite = slice(layer, '  const joinInvite = useCallback(', '  const declineInvite = useCallback(');
const manualShare = slice(layer, '  const enableSharing = useCallback(', '  const openDestinationComposer = useCallback(');

for (const [name, flow] of [['room creation', createRoom], ['join invitation', joinInvite]]) {
  assert.doesNotMatch(flow, /startGroupDriveLocationSession\(/, `${name} must never start location sharing`);
  assert.doesNotMatch(flow, /acceptGroupDriveLocationDisclosure\(/, `${name} must not auto-consent`);
  assert.doesNotMatch(flow, /requestRequiredGroupDriveLocationPermissions\(/, `${name} must not force permission`);
}
assert.doesNotMatch(layer, /pendingHostConsentRef/, 'Host must not auto-enable location when first participant joins');
assert.match(manualShare, /acceptGroupDriveLocationDisclosure\(roomId\)/);
assert.match(manualShare, /requestRequiredGroupDriveLocationPermissions\(\)/);
assert.match(manualShare, /startGroupDriveLocationSession\(consent\)/);
assert.match(layer, /Share your location \(optional\)/);
assert.match(layer, /Share my location with Drive Together participants/);
assert.doesNotMatch(layer, /title="Join & share"/, 'Joining Drive Together must not imply location consent');
assert.match(layer, /title="Join drive"/);
assert.match(layer, /accessibilityLabel="Stop sharing my Drive Together location"/);
assert.match(layer, /accessibilityLabel="Retry clearing my last Drive Together location"/);
assert.match(layer, /await stopGroupDriveLocationSharing\(roomId\)/, 'Stop button must request server cleanup');
assert.match(layer, /await retryGroupDriveLocationCleanup\(roomId\)/, 'Retry must clear server position');
assert.match(layer, /setIsSharingLocation\(false\)/);
const sharingControl = read('src/features/group-drive/runtime/locationSharingControl.ts');
assert.match(sharingControl, /await stopGroupDriveLocationSession\(\)/);
assert.match(sharingControl, /'noxa_clear_my_drive_location'/);
assert.match(sharingControl, /stagePendingGroupDriveServerAction\(/);

const runtime = read('src/features/group-drive/runtime/nativeLocation.ts');
assert.match(runtime, /CONSENT_MAX_AGE_MS = 10 \* 60 \* 1000/);
assert.match(runtime, /if \(!validConsent\(consent\)\)/);
assert.match(runtime, /await assertPermissionsAlreadyGranted\(\)/);
const rls = read('supabase/migrations/20261023181500_expire_stale_group_drive_location_reads.sql');
assert.match(rls, /create policy drive_location_state_fresh_for_viewers/);
assert.match(rls, /as restrictive/);
assert.match(rls, /updated_at >= now\(\) - interval '2 minutes'/);

const legal = read('src/legal/legalDocuments.ts');
assert.match(legal, /at least 18 to use the NOXA mobile app/);
assert.match(legal, /adults aged 18 or older/);

console.log('Apple App Review static privacy contract: PASS');
