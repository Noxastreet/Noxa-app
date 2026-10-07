import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const runtime = fs.readFileSync('src/features/map/liveDriverBroadcast.ts', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20261007112000_add_private_driver_broadcast.sql',
  'utf8',
);

assert.match(
  runtime,
  /DRIVER_BROADCAST_SEND_MS = 2_000/,
  'Foreground live movement must publish at a two-second cadence.',
);
assert.match(
  runtime,
  /DRIVER_BROADCAST_ANIMATION_MS = 1_850/,
  'Remote markers must interpolate between network samples.',
);
assert.match(
  runtime,
  /MAX_LIVE_DRIVER_CHANNELS = 80/,
  'Home Map must cap private live subscriptions.',
);
assert.match(
  runtime,
  /noxa-driver:\$\{userId\}:\$\{broadcastKey\}/,
  'Driver topics must rotate with a server-owned broadcast key.',
);

assert.match(
  home,
  /updated_at,broadcast_key,profiles/,
  'Authorized driver snapshots must return the current broadcast key.',
);
assert.match(
  home,
  /config: \{ private: true \}/,
  'Driver Broadcast channels must require Realtime authorization.',
);
assert.match(
  home,
  /event: DRIVER_BROADCAST_EVENT/,
  'Foreground driver movement must use Broadcast rather than table-wide Postgres Changes.',
);
assert.match(
  home,
  /interpolateDriverPoint/,
  'Remote driver markers must interpolate instead of teleporting.',
);
assert.equal(
  home.includes('table: "driver_locations"'),
  false,
  'Home Map must not restore the global driver_locations Postgres Changes subscription.',
);

assert.match(
  migration,
  /add column if not exists broadcast_key uuid/,
  'Migration must add the rotating driver Broadcast key.',
);
assert.match(
  migration,
  /private\.noxa_can_view_driver_location/,
  'Broadcast read authorization must reuse the existing visibility policy.',
);
assert.match(
  migration,
  /private\.noxa_users_blocked/,
  'Broadcast authorization must preserve block privacy.',
);
assert.match(
  migration,
  /create policy noxa_driver_broadcast_read[\s\S]*private\.noxa_can_read_driver_broadcast/,
  'Private Broadcast reads must be protected by RLS.',
);
assert.match(
  migration,
  /create policy noxa_driver_broadcast_send[\s\S]*private\.noxa_can_send_driver_broadcast/,
  'Clients may only publish their own authorized driver topic.',
);
assert.match(
  migration,
  /follows_rotate_driver_broadcast_keys/,
  'Friendship changes must rotate live-location channel keys.',
);
assert.match(
  migration,
  /user_blocks_rotate_driver_broadcast_keys/,
  'Block changes must rotate live-location channel keys.',
);
assert.match(
  migration,
  /crew_members_rotate_driver_broadcast_keys/,
  'Crew membership changes must rotate live-location channel keys.',
);

console.log('Private live driver Broadcast contract: PASS');
