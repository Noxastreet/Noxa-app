# NOXA — Group Drive Phase 4A Route Progress Runbook

## Scope

This stacked draft adds pure local presentation logic for the future Active Drive Participant Stack:

- validate and precompute the shared stored LineString;
- project current participant positions onto that route;
- scale along-route progress against the routing provider's canonical distance;
- represent arrived, fresh, off-route, stale and unknown states honestly;
- stabilize participant ordering and keep the current user reachable in a bounded stack.

It does not add an Active Drive screen, Mapbox integration, a location writer, native permissions, background GPS, a Directions request, a migration or a deployment.

## Truth and privacy rules

1. Remaining distance is derived locally from the one immutable shared route. It is not straight-line distance and does not call Directions per participant.
2. The routing provider's `route_distance_meters` remains the displayed total; geometry length is used only to derive a progress fraction.
3. Route progress, remaining distance and order are transient presentation state. They are not written to Supabase or retained as telemetry.
4. No exact speed, ETA, rank, finishing order or competitive label exists.
5. Personal Live Drive, `src/lib/liveDrive.ts`, `driver_locations`, Event Route and Home/Map are untouched.

## Initial presentation defaults

- Fresh row: at most 45 seconds old.
- Off route: more than 250 meters from the stored geometry.
- The first off-route update may retain the last stable numeric value; a persistent second update becomes unavailable.
- A distance-based reorder requires at least 150 meters of advantage and the same proposed order on two consecutive updates.
- Arrived participants precede fresh known values; stale/off-route-unavailable/unknown participants follow them.
- The compact window shows at most five participant rows and reserves one for the current user when needed.

These are product-approved working defaults. Native multi-device evidence may tune them later without changing the privacy model.

## Local/CI verification

Run:

```text
npm run verify:group-drive-phase-4a
npm run test:group-drive-phase-4a
npx tsc --noEmit
npm run lint
```

The deterministic smoke covers route validation, start/middle/end projection, provider-distance scaling, stale/unknown/arrived states, off-route grace and recovery, anti-jitter confirmation, participant removal and current-user visibility.

## Gates not claimed

- No visual Participant Stack or Active Drive map exists in Phase 4A.
- No Mapbox camera, marker, animation, Reduced Motion or accessibility runtime is validated.
- No real GPS or mobile network transition is validated.
- Android and iOS native acceptance remain required for the later UI/native phases.
- This draft is not safe to merge to `main` while its stacked Phase 1/2/3A dependencies remain draft and their release gates remain open.
- Production Supabase must remain unchanged.
