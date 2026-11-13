# Driver Broadcast authorization — proposed rollout

Refs #392, #196. **NOT APPLIED. Production release remains NO-GO.**

## Failure and proposed boundary

Supabase caches private-channel permissions until a new subscription or JWT:
https://supabase.com/docs/guides/realtime/authorization#updating-rls-policies

NOXA rotates private driver topic keys when blocking, mutual follows, crew
membership or audience change. Server table-trigger messages use the current
key. The existing foreground client also sends raw coordinates every two
seconds on its previously opened channel. Until its next presence response
updates that key, a formerly authorized receiver can retain cached access.
Strict immediate revocation is therefore not established by key rotation alone.

The proposed authenticated RPC takes expected account ID and coordinates. The
private SECURITY DEFINER implementation checks auth.uid equals that account,
locks its existing presence row FOR SHARE, validates active audience, expiry
and freshness using clock_timestamp after the lock, and sends on the current
server-owned private topic. The public wrapper is SECURITY INVOKER. Anonymous
EXECUTE is revoked; search paths are empty. There is no caller-controlled topic,
session creation, expiry extension, stored coordinate update or trip history.
Stop DELETE and key rotation serialize with the share lock through send/commit.

The old direct-client driver-send policy is removed. A restrictive INSERT policy
also prevents a future broad channel policy from allowing noxa-driver sends.
Existing per-driver read policies and rotation/table Broadcast triggers remain.

## Concrete pre-apply requirements

1. Review a current database backup/export and recovery procedure; verify this
   migration against the live schema again. Nothing has been backed up or
   changed in production by this PR. Explicit Product Owner approval is required.
2. Apply to a disposable/staging Supabase project first. Install the companion
   client; it must call this RPC, drain in-flight publication on Stop and never
   fall back to raw channel.send. Deploying the client first drops smooth updates
   until the RPC exists; deploying the schema first denies direct sends by old
   clients. Existing 30-second table-trigger updates are not removed.
3. Test with A/B plus an outsider using already-open private channels: block,
   remove mutual follow/crew, narrow audience, expire and Stop. Capture whether
   B receives any new coordinate after confirmed revocation. Ordinary subscribers
   and reconnects must remain functional. Do not log real-user coordinates.
4. Test concurrent PostgreSQL sessions, holding a publication transaction open
   while rotating/deleting the same row: rotation/Stop must wait; the next send
   must choose the new key or fail after deletion. PGlite tests are single-session
   and do not prove this lock-order property in a hosted environment.
5. Refresh/recycle existing Realtime connections during the authorized cutover
   and verify old direct-send permissions are gone. Applying RLS alone does NOT
   evict cached WebSocket permissions. Do not claim old binaries are protected
   without this deployment acceptance.
6. Measure 2-second RPC latency, database contention and request load against the
   previous WebSocket path. Message cadence stays the same, but database-backed
   sends add work. No performance/cost benchmark is claimed here.

## Verification and rollback

`node scripts/test-driver-broadcast-authorization.mjs` applies the actual old and
new migrations to an isolated PGlite fixture. It loads canonical visibility/block
helpers and real rotation triggers, tests caller isolation, malformed coordinates,
friend/crew/block changes, fresh/expired/Ghost/Stop state, function privileges and
restrictive send policy. realtime.send is a capture stub, not a WebSocket server.

Fail-closed recovery after an authorized deployment: stop Live Drive distribution,
revoke authenticated EXECUTE on both new function signatures (uuid,float8,float8)
and keep the direct-send denial. Table-trigger updates remain available for an
active session. This pauses smooth publication without restoring the privacy bug.
Reverting to the old send policy needs a separately reviewed migration and explicit
approval; do not run the earlier migration again or edit applied history.

This PR changes backend SQL/test/docs only. It does not apply a migration, deploy
a client, change signing, build a signed binary, or submit App Review.

## Stronger test environments — November 11 follow-up

`scripts/postgres/driver-broadcast-concurrency.mjs` uses independent real psql
connections and observes pg_stat_activity lock waits. It tests publication before
block/Stop, publication behind a key rotation, and expiry while waiting for a
row lock. All four passed on disposable local PostgreSQL 16.2. A negative control
using transaction time instead of clock_timestamp failed the expiry scenario as
expected. PostgreSQL 17 CI is configured separately; record its actual result.

`scripts/supabase/driver-broadcast-websocket.mjs` is a separate real-transport
acceptance test using three synthetic accounts in disposable local Supabase.
It tests positive private delivery, raw-send denial, outsider/impersonation,
revocation with an already-joined channel, Stop and expiry. Unlike SQL captures,
it preserves real Auth, PostgREST and realtime.send. It is pending until the
dedicated CI workflow actually passes. This is a narrow social/location fixture,
not proof of the full production schema, native app or all privacy policies.

Both workflows use only ephemeral runner resources and no production credentials.
The concurrency test refuses hosted connections/non-test databases; the transport
test refuses non-loopback API URLs. The full Supabase workflow does not print or
upload its generated local API credential file. Its containers are removed at end.

The existing hosted staging project could not be resumed: Supabase rejected the
request because the account already has two active free projects. No hosted
project was paused/deleted/upgraded, and no production migration was applied.

## Read-probe compatibility defect found by the real transport test

The first two real-Supabase runs failed for an authorized friend: the canonical
visibility helper returned true and the authenticated publication RPC succeeded,
but joining the private channel returned Unauthorized. Supabase's authorization
implementation inserts a topic/extension probe without the messages.private flag.
NOXA's existing SELECT policy required private IS TRUE, so the probe was invisible.
Upstream implementation inspected:
https://api.github.com/repos/supabase/realtime/contents/lib/realtime/tenants/authorization.ex

The new append-only `fix_driver_broadcast_read_probe` migration removes that
probe-incompatible flag condition, explicitly matches the row topic to the
requested topic, and retains the existing helper for audience, rotating key,
blocking, freshness and expiry. It grants no anonymous access and no direct
client driver publication; #394's restrictive send policy remains.

`test-driver-broadcast-read-probe.mjs` reproduces the original denial with a real
RLS-filtered probe, then verifies authorized reads and outsider/topic/block/stale/
expiry denial after the fix. Real WebSocket acceptance must pass on the fixed
candidate before this gate can be treated as closed. The migration is NOT APPLIED
to production. Fail-closed rollback is to remove the new driver read policy and
pause private driver Broadcast reads pending review, leaving send restrictions.
