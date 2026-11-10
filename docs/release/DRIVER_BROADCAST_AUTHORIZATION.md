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
