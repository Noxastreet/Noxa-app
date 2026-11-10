# Foreground driver publication — client candidate

Depends on backend PR #394 and Stop/sign-out PRs #390/#391. **Draft / NO-GO.**

The Home map no longer opens a sender channel or directly sends raw GPS through
cached Realtime permissions. Existing authorized receiver subscriptions, topic
rotation, interpolation, Mapbox/GPS ownership and the two-second publication
cadence remain. A shared publisher in liveDrive.ts calls the new server RPC with
the expected authenticated account and point. The server chooses its current
private topic instead of trusting a client-held key.

The publisher checks session ownership before and after asynchronous auth. It
shares the existing presencePublishQueue, so every personal Stop/Ghost/sign-out
cleanup drains issued RPCs before its final DELETE. Slow networks allow at most
one in-flight smooth sample, dropping intermediate points rather than building
a backlog. There is no raw WebSocket fallback when the RPC is missing or fails.

New samples after an account switch, Stop, expiry or consent replacement are
rejected. The RPC independently checks expected_user_id equals auth.uid, closing
the interval between local auth checks and SDK request-token selection. The RPC
never starts/extends a session or writes coordinate history.

## Tests and rollout

`test-live-drive-stop-races.mjs` executes the actual client module with controlled
auth/network promises: issued RPC drains before Stop completion, queued auth is
cancelled, cross-account samples are rejected, pending work is bounded, and RPC
failure recovers with no direct-send fallback. Existing background-write Stop
regressions remain. Broadcast source contracts prevent a direct-send regression.

Backend migration is proposed only, and must be reviewed, backed up, approved,
applied to staging and accepted with the matching client before production use.
Do not ship this client independently; without the RPC smooth publication fails
closed while existing table-trigger presence updates remain. Native/performance
acceptance is still required for the receiver rendering and two-account flow.
Use #394's hosted WebSocket, connection-recycle and PostgreSQL concurrency plan.

No production schema, credentials, native signing, external testers, App Review
or public publication is changed here. Rollback must retain the direct-send
privacy boundary; do not restore cached client broadcasts as a silent fallback.
