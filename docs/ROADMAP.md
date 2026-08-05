# NOXA — Execution Roadmap

Work proceeds top to bottom. Only one stage is active at a time, with no more than five active tasks.

## Definition of Done

A runtime feature is Done only when all applicable conditions are met:

1. implementation is complete;
2. TypeScript passes;
3. ESLint passes;
4. required GitHub Quality and Expo Doctor checks pass;
5. the flow is validated in a native Android development build;
6. no critical regressions remain;
7. code is merged into `main`;
8. production deployment is independently verified when required.

Otherwise use `Implemented`, `Testing`, `In progress` or `PASS WITH LIMITATIONS`.

## Stage 0 — Freeze MVP and baseline

Goal: one approved MVP, one canonical `main`, one roadmap and one rollback path.

- Freeze post-MVP features and large social/commercial modules.
- Record current commit, framework versions, Supabase project and app identifiers.
- Verify rollback branches and remove duplicate planning documents only after review.
- Maintain one P0 defect list.

## Stage 1 — Runtime MVP foundation

Goal: prove core behavior on physical Android or an equivalent native development build.

### Build evidence

Record commit SHA, EAS build ID, app version, build number, device model, Android version and target Supabase environment.

### Map and GPS

Validate Mapbox loading, permission flow, recenter, coordinate accuracy, movement updates, gestures, markers and object selection.

### Route and Follow

Validate route creation, red route line, start/end, distance, duration, retry, close, Follow, gesture cancellation and reset behavior.

### Live Drive

Validate Ghost defaults, explicit visibility changes, background updates, stop behavior, expiry, multi-account behavior and blocked-user visibility.

### Critical journeys

Validate authentication, onboarding, Crews, Events, Garage, Profile, images, account deletion and related error states.

### Interface quality

Validate safe areas, keyboard handling, small/medium Android layouts, large text, touch targets, loading/empty/error states and removal of raw service errors.

Exit criterion: primary journeys pass on real Android and all P0 defects are fixed and re-tested.

## Stage 2 — Production backend and security

- Back up production and verify rollback.
- Reconcile production schema with migrations.
- Validate RLS for profiles, vehicles, crews, events, chats, storage and Live Drive.
- Deploy and validate Edge Functions.
- Validate OAuth, environment variables, token restrictions and secret scanning.
- Add monitoring, incident response and recovery checklists.

Exit criterion: production backend, security matrix, backups and recovery are proven.

## Stage 3 — User safety and moderation

Implement reporting, blocking, content controls, moderation queues, severity/SLA rules, appeals and community guidelines.

## Stage 4 — Legal and privacy readiness

Finalize public policies, GDPR/location procedures, data retention/deletion, intellectual-property ownership and third-party license review.

## Stage 5+ — Publication and business

Proceed to store release, support operations, growth and commercial layers only after previous exit criteria are met.
