# NOXA — Group Drive Lobby & Participant Stack

**Status: APPROVED PRODUCT/UX DECISION — DOCUMENTATION ONLY.**

Product Owner decision recorded 2026-08-19. This document defines the implementation contract for the pre-active Group Drive lobby and the vertical participant stack shown on Map / Active Drive. It does **not** authorize production Supabase changes, deployment, merge of PR #190/#191, or Phase 3/4 runtime implementation by itself.

Read this together with `AGENTS.md`, `docs/GROUP_DRIVE.md`, `docs/VISUAL_ARCHITECTURE_V2.md` §10.5/§13, issue #189, and the Phase 1/2 runbooks. Where this document is silent, those canonical privacy and lifecycle rules continue to govern.

## 1. Product decision

After an invited user accepts a Group Drive invitation, the user becomes an `accepted` participant and the drive has a **Lobby** state before it becomes active.

The user must not be trapped inside a dedicated lobby screen. The lobby is a persistent Group Drive context that can be opened from Group Drive details and represented on the Map by a compact participant stack.

The participant stack is **vertical**, positioned at the upper-left of the usable map area, inside safe-area/top-chrome constraints.

The same component has two semantic modes:

### Lobby mode — before `drive_sessions.status = active`

- shows accepted participants vertically;
- shows avatar + compact readiness state (`Ready` / `Waiting`) when readiness support is implemented;
- shows **no participant distance and no participant live position**;
- exact location is not read, written, requested or subscribed to;
- tapping the stack opens the Group Drive lobby/details context.

### Active mode — while `drive_sessions.status = active`

- shows participant avatar + **remaining route distance to the common destination**;
- participants are ordered by remaining route distance, smallest first;
- rows move smoothly when the truthful order changes;
- `Arrived` participants naturally remain at the top because their remaining distance is zero / their live state is `arrived`;
- tapping an avatar focuses that participant on the Active Drive map;
- the user's own participant remains accessible even when they are not in the visible top group.

This is **not a leaderboard**. Do not show `1st`, `2nd`, `3rd`, podiums, trophies, racing language, speed, rewards, points or competitive telemetry. Ordering exists only to communicate spatial progress toward the shared destination. This preserves the Visual V2 rule that Active Drive must not become a game HUD.

## 2. Privacy contract — non-negotiable

The existing Group Drive privacy model remains unchanged:

1. **Accepting/Joining does not start location sharing.**
2. **Ready does not start location sharing.** Readiness is coordination only, never location consent.
3. Before the drive is active, accepted participants may see the route and accepted participant identities, but they may not read/write/subscribe to `drive_location_state`.
4. When the host starts the Group Drive, the server may transition accepted participants to `active`, but the client still must not silently begin precise-location broadcasting.
5. Before a device starts the Group Drive location writer, the user must receive an explicit scoped disclosure that states:
   - audience: the participants of this Group Drive;
   - purpose: shared Active Drive map/navigation context;
   - duration: until Leave/End/expiry, with the server-owned active expiry visible;
   - that precise background location is involved.
6. Only after that explicit commit may the app request the required platform location permissions and start the Group Drive background task.
7. Permission refusal produces no false `sharing` state and no location row.
8. Leave, Remove, End, Cancel, expiry, sign-out, block/access revocation or user/session mismatch must fail closed: stop the task, clear local runtime state, unsubscribe and remove/lose access to the exact location row as already enforced by the server contract.

Personal Live Drive (`src/lib/liveDrive.ts`, `driver_locations`) remains independent and must not be modified or reused to implement Group Drive.

## 3. Minimal data-model changes

Do **not** add rank, remaining distance, ETA, speed or route progress columns to Supabase. Those values are derived runtime presentation state and must not become retained telemetry.

The existing Phase 1 tables remain the source of truth:

- `drive_sessions` — lifecycle and route;
- `drive_stops` — exact route stops for accepted/active participants;
- `drive_participants` — membership/role/lifecycle;
- `drive_invitations` — invitation state;
- `drive_location_state` — one ephemeral exact location row per active participant.

### 3.1 Readiness

If the approved Lobby UX includes `Ready / Waiting`, add the smallest possible readiness primitive **before Phase 1 is ever applied to production**:

- nullable `drive_participants.ready_at timestamptz` (preferred over a new lifecycle status);
- authenticated RPC `noxa_set_drive_ready(target_drive_session_id, ready boolean)`;
- allowed only for the caller's own `accepted` participant row while the session is `draft`/`scheduled`;
- it never changes participant membership, session status or location permissions;
- host may start with participants still Waiting; the UI must confirm when starting while someone is not Ready rather than silently blocking forever;
- a material route or scheduled-start change resets non-host readiness server-side because previous readiness referred to the previous plan.

Do not overload `drive_participants.status` with `ready`. Membership lifecycle and readiness are separate concepts.

### 3.2 One active Group Drive per user

Before runtime location work begins, harden `noxa_start_drive` so one user cannot become active in two Group Drives simultaneously.

Required server rule:

- a Group Drive start is rejected if the host or any accepted participant is already `active` in another active Group Drive;
- concurrent starts involving the same participant must serialize safely (lock affected identities/participant ownership in deterministic order before checking/transitioning);
- the client must show a human-readable conflict rather than silently sharing one user into multiple Group Drive audiences.

This keeps the runtime unambiguous, limits background work and prevents accidental multi-audience precise-location sharing.

## 4. Runtime architecture

Keep the implementation isolated under the Group Drive feature. Suggested responsibilities (exact filenames may adapt to the existing structure):

- `src/features/group-drive/runtime/groupDriveSession.ts` — local active-runtime session, server expiry, start/stop guards;
- `src/features/group-drive/runtime/groupDriveLocationTask.ts` — separate TaskManager task for Group Drive only;
- `src/features/group-drive/runtime/useGroupDriveRuntime.ts` — foreground lifecycle/realtime controller;
- `src/features/group-drive/runtime/routeProgress.ts` — route projection + remaining-distance derivation;
- `src/features/group-drive/components/GroupDriveParticipantStack.tsx` — the vertical overlay;
- `app/group-drives/active/[id].tsx` (or the established equivalent) — dedicated fullscreen Active Drive map.

Do not create a second global design system. Reuse `NoxaAvatar`, `NoxaSheet`, `NoxaIconButton`, theme tokens, existing safe-area helpers and Reanimated.

### 4.1 Foreground Group Drive selection

There can be multiple accepted/scheduled drives, but only one Active Drive may exist per user after §3.2 is enforced.

For the compact Home/Map entry context, select deterministically:

1. current active Group Drive, if any;
2. otherwise the nearest upcoming accepted/scheduled Group Drive;
3. otherwise the most recently updated accepted unscheduled drive with a valid route.

Do not invent a second server-side `current drive` field solely for UI selection. If later testing shows users need manual switching, add it as a client presentation preference, not an access grant.

## 5. Lobby lifecycle

### Participant

`Invitation → Accept → Lobby / Map participant stack → Ready (coordination only) → host starts → explicit location consent → Active Drive`

### Host

`Create → route/invite/schedule → Lobby → observe participants/readiness → Start Drive → Active Drive`

Starting while one or more participants are Waiting is allowed only after a clear confirmation. Waiting is not a security state and must never be treated as permission to broadcast.

The current `app/group-drives/[id].tsx` pre-active details view should evolve into the canonical lobby/details surface rather than creating a duplicate screen with the same data.

## 6. Group Drive location writer

Use a **new Group Drive TaskManager task name and local session key**. Do not modify the personal Live Drive task just to share implementation.

The Group Drive task:

- starts only for an explicitly-consenting user whose participant status and session status are both `active`;
- stores only the minimum local runtime identity needed to recover safely (`driveSessionId`, `userId`, server expiry);
- uses platform background location at a conservative automotive cadence; initial target should match the already-tested personal Live Drive class of cadence rather than introducing high-frequency tracking (approximately 15 seconds / 20 meters, subject to runtime validation);
- calls the existing protected `noxa_upsert_drive_location` RPC; **no direct client INSERT/UPDATE to `drive_location_state`**;
- transmits latitude, longitude, heading and approximate movement state only; never exact speed;
- stops immediately when the runtime becomes invalid.

Two separate location tasks may temporarily coexist if a user separately enabled personal Live Drive and Group Drive. Do not unify them in MVP, because rewriting the proven personal Live Drive task would violate the isolation rule and increase regression risk. Battery/OS behavior must be measured in native acceptance.

## 7. Realtime pipeline

When Active Drive opens:

1. fetch the authorized initial `drive_location_state` snapshot;
2. build local state keyed by opaque row ID and user ID;
3. subscribe to authorized INSERT/UPDATE changes for the current drive;
4. handle DELETE using the opaque row ID contract — never rely on DELETE payloads exposing user/session identifiers;
5. separately observe session/participant lifecycle so End/Leave/Remove/access revocation tears down UI and location work immediately;
6. after reconnect/foreground recovery, re-fetch one snapshot to reconcile missed events.

Before the drive is active, do **not** create a `drive_location_state` subscription. Lobby participant/readiness changes may use the participant/session channels only.

## 8. Remaining-distance algorithm

Do **not** request a new Directions route for every participant update. That would create unnecessary network cost, rate-limit risk, latency and additional location processing.

All participants already share one immutable route while the drive is active. Derive progress locally from the stored `route_geometry`.

### 8.1 Route preprocessing

On `route_version`/geometry load:

1. validate the LineString;
2. precompute each segment length;
3. precompute cumulative distance along the geometry;
4. keep `route_distance_meters` from the routing provider as the canonical displayed total.

### 8.2 Participant projection

For each fresh participant position:

1. find the nearest point on the route polyline;
2. calculate the along-route progress fraction from cumulative geometry distance;
3. derive:

`remainingMeters = route_distance_meters × (1 - progressFraction)`

4. clamp to `[0, route_distance_meters]`;
5. display at restrained precision (normally 0.1 km) so GPS noise does not visually churn the UI.

This is **remaining distance along the common stored route**, not straight-line distance to the destination.

### 8.3 Off-route honesty

If the participant is materially off the stored route, do not fabricate precision.

Initial MVP threshold: approximately **250 m** from the route polyline (tune only from runtime evidence).

- briefly retain the last stable derived value while connectivity/GPS settles;
- if the off-route condition persists, replace the numeric value with an honest unavailable/stale presentation rather than ranking a false number;
- do not trigger automatic per-participant rerouting in MVP.

## 9. Ordering and anti-jitter rules

Canonical active ordering:

1. `arrived` participants;
2. fresh participants with a known remaining distance, ascending;
3. stale/unknown participants.

Do not use order as a competitive label.

To prevent GPS noise from making avatars swap constantly:

- preserve the previous stable order as a tie-breaker;
- do not visually swap neighboring participants for tiny differences;
- initial hysteresis target: require roughly **150 m** of truthful advantage and confirmation across **two consecutive location updates** before changing order;
- distance text may refresh without immediately reordering the rows;
- tune thresholds only from real multi-device driving evidence, not screenshots.

### Motion

Use Reanimated layout/position interpolation only:

- target reorder duration approximately **280–350 ms**;
- low/no overshoot;
- no bounce or decorative movement;
- Reduced Motion: immediate/static reorder or minimal fade;
- never animate a participant to a location that was not received from real data.

## 10. Participant Stack UI

### Placement

- upper-left of the usable map surface;
- respect safe area and existing top chrome; never cover the NOXA top bar/search/critical map controls;
- overlay remains compact and map-first.

### Row

Active mode minimum:

`avatar  ·  remaining km`

Lobby mode minimum:

`avatar  ·  Ready/Waiting`

Names may appear in the expanded participant sheet; they do not need to make the compact overlay wide.

### Visible-count rule

Keep the compact stack bounded:

- normally show up to 5 participant rows;
- if the current user is outside the visible nearest group, reserve one row for `You` so self-position/status is always reachable;
- represent remaining hidden participants with a compact `+N` affordance;
- tapping `+N` or the stack background opens the full participant sheet.

### Interaction

- lobby mode avatar tap → open lobby/participant detail; no map focus because no live position exists;
- active mode avatar tap → select participant and ease the Active Drive camera to their real current marker;
- selection may use one restrained accent ring, not a ranking badge;
- stale/no-position participant cannot be camera-focused; show a truthful unavailable state instead.

Accessibility labels must read the participant name and state/distance in words. Maintain at least a 44×44 effective target.

## 11. Fresh / stale / arrived presentation

With a background target around 15-second updates, initial presentation thresholds may be:

- fresh: latest row age ≤ ~45 s;
- stale: older than ~45 s or after realtime loss;
- unknown/no position: no authorized current row.

These thresholds are presentation defaults, not retained schema. Tune from device evidence.

`Arrived` comes from the Group Drive approximate state and/or a conservative destination proximity rule. Do not create `arrived_at`, race times or finishing-order history for MVP.

## 12. Active Drive vs Home/Map

Preserve the existing architecture:

- **Active Drive** is the dedicated fullscreen realtime map and owns participant markers, route focus and the full participant stack behavior.
- **Home/Map** receives only an isolated, compact Group Drive entry/lobby stack in Phase 4 so the user can see/resume the current Group Drive context without replacing the existing Home/Map mechanics.
- personal Drivers/Events/Route/Follow/Live Drive behavior on Home/Map must remain unchanged.

Do not make the Home/Map query `drive_location_state` as general public map data. Group Drive positions exist only inside the participant-scoped Group Drive runtime.

## 13. Correct implementation sequence

### A — Documentation gate (this change)

- record product/UX/privacy/technical contract in GitHub + Notion;
- no application code;
- no Supabase deployment.

### B — Phase 1 contract amendment before production

Only if readiness remains part of approved Lobby UX:

- add `ready_at` + narrow readiness RPC/tests;
- harden `noxa_start_drive` for one-active-Group-Drive-per-user and concurrency;
- extend local SQL/security tests;
- keep PR #190 draft/review-only;
- do not apply to production until the existing hosted/security/rollback gate passes and Product Owner explicitly approves it.

### C — Phase 2B: Lobby client behavior

Build on the existing Phase 2 surface without Map/location work:

- accepted invitation lands in/opens canonical Group Drive lobby/details;
- participant list and Ready/Waiting update truthfully;
- host Start control and waiting-participant confirmation;
- no precise-location permission and no `drive_location_state` access;
- TypeScript/lint/static checks + native UI runtime.

### D — Phase 3: isolated location + realtime plumbing

- new Group Drive background task/session controller;
- protected RPC writer only;
- initial snapshot + Realtime + reconnect reconciliation;
- fail-closed stop paths;
- no Home/Map changes yet;
- hosted multi-account/privacy/runtime validation required.

### E — Phase 4: Active Drive Map + Participant Stack

- dedicated fullscreen Active Drive map;
- route geometry + Group Drive participant markers;
- local route-progress derivation;
- vertical stack, stable sorting/hysteresis, avatar focus;
- isolated compact Home/Map entry/stack;
- no change to personal Live Drive/Event Route/Follow behavior;
- Android and iOS native acceptance.

### F — Phase 5: completion/summary

- participant Leave / host End final runtime;
- summary and retention checks;
- no rank/finish-order history added as part of summary.

## 14. Acceptance criteria

Do not mark this feature Done unless all applicable checks pass:

### Lobby/privacy

- Accept/Join creates no Group Drive location row and requests no location permission.
- Ready/Waiting creates no location row and requests no permission.
- Pre-active stack shows no participant kilometers.
- Starting while someone is Waiting uses explicit host confirmation.
- A user cannot be active in two Group Drives simultaneously.

### Active runtime

- precise sharing starts only after explicit scoped consent on that device;
- one current location row per active participant;
- no exact speed is stored/transmitted;
- Leave/Remove/End/expiry/sign-out stops sharing and revokes/removes access immediately;
- blocked/revoked users cannot continue receiving participant updates;
- process restart/background behavior fails closed.

### Participant stack

- vertical placement is stable and does not collide with safe area/top controls;
- remaining distance is derived from the common route, not straight-line distance;
- no per-participant Directions calls are made for the ordering;
- small GPS changes do not cause constant row swapping;
- stale/off-route participants do not show false precise progress;
- avatar tap focuses the matching real participant marker;
- own participant remains reachable when the group is large;
- no rank numbers, speed, trophies or racing copy exist;
- Reduced Motion and accessibility remain usable.

### Regression

- existing Home/Map Drivers, Events, route line, Follow, Recenter and gestures behave as before;
- personal Live Drive Ghost/Friends/Crew/Global behavior is unchanged;
- Event `event-route` remains unchanged;
- no Crew Convoy reuse;
- TypeScript, ESLint, project verifiers and GitHub Quality pass;
- multi-account native runtime evidence exists for Android and iOS before final MVP acceptance.

## 15. Explicit non-goals

Not part of this implementation:

- speed display or speed ranking;
- race/leaderboard/finishing order;
- automatic rerouting for every participant;
- chat/voice overlay;
- telemetry HUD;
- retained location history;
- public/open Group Drives;
- late join after start;
- host transfer;
- rewriting personal Live Drive to share a background task;
- broad Home/Map redesign.
