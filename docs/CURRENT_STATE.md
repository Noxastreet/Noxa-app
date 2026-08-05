# NOXA — Current State

_Last consolidated: 5 August 2026._

## Current focus

**Crews & Events MVP canon — Android runtime validation.**

The implementation and GitHub Quality checks are complete and the changes are merged into `main`, but physical Android runtime PASS has not yet been confirmed. The correct status is therefore **Implemented / PASS WITH LIMITATIONS**, not Done.

## Verified repository state

- Canonical repository: `Noxastreet/Noxa-app`.
- Canonical branch: `main`.
- Crews & Events canon: merged through PR #133.
- Product merge commit referenced by the project context: `db9e525`.
- A later housekeeping commit `e11e5d8` removed an erroneous Android Studio `.idea` file; runtime impact is not independently verified.
- UI Foundation work for Sign in and Settings was merged through PR #132.
- Migration A exists in code, but production application is not confirmed.

## Required Android validation

- Crews Home and Crew Detail: loading, images, join/request/leave, errors and navigation.
- Events Home and Event Detail: real Supabase data, images, Mapbox preview and route action.
- Sign in and Settings after UI Foundation changes.
- Red route line visibility.
- Follow behavior and gesture cancellation.
- Google sign-in completion.
- Map, GPS and primary navigation regressions.

## Immediate next action

Run the current `main` in a native Android development build and record either:

1. runtime PASS with device/build/commit evidence; or
2. a precise defect list with reproduction steps.

## Next product stage

After Android PASS for Crews & Events:

1. Garage and Vehicles MVP;
2. Profile MVP;
3. remaining runtime P0 issues and release hardening;
4. production publication and business layers.

## Blocked work

- Production Supabase Migration A remains blocked until a manual database dump, rollback verification and explicit approval.
- Apple authentication runtime validation requires an iOS environment and Apple Developer configuration.
- New large features remain frozen until MVP runtime stability is proven.
