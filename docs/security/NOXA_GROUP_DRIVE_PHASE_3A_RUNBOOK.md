# NOXA — Group Drive Phase 3A Realtime + Simulation Runbook

## Scope

This stacked draft adds the client-side state plumbing needed before native Group Drive location work:

- authorized active-session snapshot;
- participant and session lifecycle reconciliation;
- `drive_location_state` Realtime INSERT/UPDATE handling;
- opaque-primary-key DELETE handling;
- reconnect/foreground-compatible snapshot reconciliation primitive;
- deterministic in-memory participant movement simulation.

It does not add a screen, Map integration, a Group Drive location writer, native location permissions, TaskManager/background GPS, a migration, or a production deployment.

## Isolation guarantees

- Personal Live Drive, `src/lib/liveDrive.ts`, and `driver_locations` are untouched.
- Phase 3A never calls `noxa_upsert_drive_location`; simulated rows exist only in memory.
- No location permission is requested.
- No schema or retained route-progress/rank/distance telemetry is added.
- Production Supabase must not be contacted by the static/simulation checks.

## Realtime contract

1. Fetch the RLS-authorized active session, participant set, and current location rows.
2. Fail closed unless both the session and current participant are `active`.
3. Key current location state by opaque row ID and maintain a secondary user lookup.
4. Filter INSERT/UPDATE by `drive_session_id`.
5. Subscribe to DELETE without a row filter and remove only opaque IDs already known locally. Supabase Postgres Changes DELETE events are not filterable and must not be assumed to expose user/session identity.
6. Reconcile from a new authorized snapshot after subscription/reconnection and on lifecycle changes.
7. Remove the channel on teardown.

## Local/CI verification

Run:

```text
npm run verify:group-drive-phase-3a
npm run test:group-drive-phase-3a
npx tsc --noEmit
npm run lint
```

The simulation smoke covers snapshot replacement, cross-drive rejection, opaque ID replacement/deletion, movement, arrival, participant removal, and reset.

## Hosted/runtime gates not claimed

- Hosted websocket INSERT/UPDATE/DELETE delivery is not proven by static tests.
- Reconnect under a real network transition is not proven.
- Multi-account block/access-revocation delivery is not proven.
- Native background GPS and permission behavior are deferred to Phase 3B and require a development build/physical-device acceptance.
- This draft is not safe to merge to `main` while its stacked Phase 1/2 dependencies remain draft and their release gates remain open.
