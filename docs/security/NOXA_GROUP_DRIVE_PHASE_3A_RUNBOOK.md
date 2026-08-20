# NOXA — Group Drive Phase 3A Realtime + Simulation Runbook

## Scope

This stacked draft adds the client-side state plumbing needed before native Group Drive location work:

- authorized active-session snapshot;
- participant and session lifecycle reconciliation through frequent authorized snapshots;
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
6. Reconcile from a new authorized snapshot after subscription/reconnection and every five seconds while active. Session/participant tables are intentionally not added to Realtime: their identifying primary keys would make DELETE packets unsafe because Postgres Changes cannot RLS-filter DELETE events.
7. Queue location events that arrive while a reconciliation request is in flight, then apply them on top of the returned snapshot so a late HTTP response cannot overwrite newer Realtime state.
8. Use a unique channel identity per runtime instance and remove the channel on teardown.

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

- Hosted staging has proven member snapshot visibility, INSERT/UPDATE delivery, opaque-only DELETE delivery, Leave/End cleanup, and live bidirectional-block revocation. This evidence does not replace native acceptance.
- A hosted transport disconnect/reconnect rehearsal has proven that an update missed while the client is offline is recovered by the authorized snapshot after resubscription. A real mobile network transition remains part of native acceptance.
- A blocked participant receives no subsequent host UPDATE, sees zero session/location rows, and cannot publish another location. The five-second lifecycle reconcile therefore has an authorized fail-closed signal even when Realtime correctly suppresses the blocked update.
- Native background GPS and permission behavior are deferred to Phase 3B and require a development build/physical-device acceptance.
- This draft is not safe to merge to `main` while its stacked Phase 1/2 dependencies remain draft and their release gates remain open.

## Hosted evidence — 2026-08-20

- Active members received location INSERT, UPDATE and DELETE events.
- An unrelated authenticated subscriber received no INSERT/UPDATE and no location rows. DELETE contained only the opaque `id` key.
- Participant Leave removed the participant location synchronously; host End removed the remaining location.
- A participant-to-host block immediately made session/location snapshots empty for the participant and rejected the next protected location RPC.
- The participant's already-open channel received no later host UPDATE. The host saw only the host row/update after the bidirectional block.
- A staging participant disconnected its Realtime transport, missed a host location UPDATE, resubscribed, and recovered the new coordinates (`38.0179`, `23.7376`) from the authorized snapshot.
- Temporary sessions, participants, location rows, blocks and auth users were deleted; residual fixture counts were zero.
- Production was not contacted or changed.
