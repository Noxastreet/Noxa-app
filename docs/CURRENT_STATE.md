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

## Visual Architecture V2

**Status: APPROVED FOR IMPLEMENTATION.** See `docs/VISUAL_ARCHITECTURE_V2.md` for the canonical contract, `docs/audit/VISUAL_V2_RECONCILIATION.md` for the current-vs-target reconciliation, `docs/GROUP_DRIVE.md` for the canonical Group Drive architecture, and `docs/audit/PR135_CONTRACT_RECONCILIATION.md` for what was and wasn't carried forward from PR #135. Implementation has **not started**; this is a documentation checkpoint only.

Planned stages, sequenced independently of the Crews/Events/Garage runtime-validation track above:

- **Stage 0A — Visual V2 canonical reconciliation. COMPLETE.** Canonical spec, reconciliation audit and PR #135 contract reconciliation written against current `main`. No token, component or screen code changed yet.
- **Stage 0B — Additive Visual Foundation V2 tokens. NEXT.** Additive-only changes to `src/theme/{typography,colors,animations,radius}.ts` (new keys, nothing existing changed) — see `docs/audit/VISUAL_V2_RECONCILIATION.md`'s recommended first commit. Not yet implemented.
- **Stage 1 — Onboarding.**
- **Stage 2 — Home / Map.**
- **Stage 3 — Event Detail.**
- **Stage 4 — Garage / Vehicle.**
- **Stage 5 — Active Drive, only when Group Drive backend phases are authorized.** Group Drive application code does not exist yet (only a crew-scoped, frozen-for-MVP "Convoy" flow does) — the target architecture is documented in `docs/GROUP_DRIVE.md`, but Stage 5 is not authorized to start Group Drive backend work by itself. Whether Group Drive is MVP-required or Post-MVP/V2 is an open Product Owner decision (see `docs/audit/PR135_CONTRACT_RECONCILIATION.md`).

A separately tracked, unrelated P0 remains open: widening an already-active personal Live Drive audience must require explicit re-confirmation (currently silent). This must ship as its own commit/PR, never combined with a Visual Architecture V2 change. **This P0 takes priority over broad Visual Architecture V2 screen rollout** — it should land before, or at minimum not be blocked behind, Stage 1 onward.

## Blocked work

- Production Supabase Migration A remains blocked until a manual database dump, rollback verification and explicit approval.
- Apple authentication runtime validation requires an iOS environment and Apple Developer configuration.
- New large features remain frozen until MVP runtime stability is proven.
