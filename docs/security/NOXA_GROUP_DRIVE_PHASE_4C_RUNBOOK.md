# NOXA — Group Drive Phase 4C Active Drive Map Runbook

## Scope

Phase 4C composes the already-reviewed Group Drive layers into the first real fullscreen Active Drive Map runtime.

It reuses:

- Phase 3A authorized snapshot + Realtime reconciliation;
- Phase 4A local route projection / truthful remaining distance / stable ordering;
- Phase 4B compact participant-stack presentation;
- the existing shared `MapboxLiveMap` presentation component.

It does not add another Mapbox service, another Directions path, another location table, or another location-sharing domain.

## Runtime composition

The Active Drive screen:

1. loads `loadGroupDriveDetails()` for the exact authorized route and participant identities;
2. loads `loadActiveDriveRealtimeSnapshot()` and then subscribes through `subscribeToActiveDriveRealtime()`;
3. converts the stored Group Drive LineString to the existing map route presentation;
4. derives participant progress locally with `deriveGroupDriveParticipantProgress()`;
5. applies Phase 4A reorder hysteresis with `reduceParticipantStackOrder()`;
6. builds the Phase 4B compact rows with `buildParticipantStackPresentation()`;
7. maps current Group Drive location rows to participant markers without reading `driver_locations`;
8. lets stack/marker taps focus the corresponding current marker;
9. exits back to the Group Drive view when authorized access is revoked.

## Isolation

The Phase 4C verifier fails if the Active Drive screen:

- references `driver_locations`, personal Live Drive, or `LIVE_DRIVE_TASK_NAME`;
- imports Supabase directly instead of using the reviewed Group Drive API/runtime;
- imports raw `@rnmapbox/maps` instead of reusing `MapboxLiveMap`;
- references Event Route, `calculateDriveRoute`, Directions, or any per-participant route request;
- changes the existing shared `MapboxLiveMap` blob inherited from canonical Home/Map.

No production Supabase schema/data is changed.

## Static verification

Required:

```text
npx tsc --noEmit
npm run lint
npm run verify:group-drive-phase-4c
npm run test:group-drive-phase-4c
```

The deterministic composition smoke uses a fixed stored LineString plus three participant locations and verifies:

- route preparation;
- two fresh participants receive truthful different remaining distances;
- a stale participant becomes unavailable rather than showing false precision;
- route ordering places the participant with less remaining distance above the other fresh participant;
- the current user remains identified;
- focusability is true only when a usable current location exists.

## Physical Android acceptance

Phase 4C remains NOT VERIFIED until a development build proves:

1. the stored Group Drive route renders on the fullscreen map;
2. participant markers reflect real Phase 3A Realtime updates;
3. participant stack distances update without jitter or false precision;
4. stale/off-route/unavailable states degrade correctly;
5. tapping a participant stack row focuses that real marker;
6. user pan disables follow/focus behavior locally without changing Home/Map state;
7. reconnect recovers from the authorized snapshot;
8. block/remove/Leave/End/access revocation fails closed;
9. returning to Home/Map preserves Drivers, Events, Route, Follow and Recenter behavior.

## Integration gate

Phase 4C is built on the Phase 4B stack and intentionally does not contain Phase 3B native GPS writer code yet. Before end-to-end device acceptance, create a reviewed integration branch that combines:

- Phase 3B native scoped consent/writer; and
- Phase 4C Active Drive Map runtime.

Do not merge either stack to `main` merely because static CI passes.
