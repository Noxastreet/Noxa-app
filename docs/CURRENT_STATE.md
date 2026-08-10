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

### Resolved product decisions (Stage 0A finalization)

1. **Group Drive is required for the NOXA MVP** — it is not Post-MVP/V2. It is the final major functional MVP system and does not interrupt the privacy + Visual Architecture V2 work ordered below. Being MVP-required does **not** authorize any production Supabase change: Group Drive's DB, RLS, RPCs and migrations still require their own scoped review and the existing production approval gates. Group Drive is **not** Crew Convoy — `app/convoy-setup.tsx` and `crew_convoys` remain frozen/legacy V2 and are not reused as the Group Drive domain.
2. **Canonical naming is final.** **Group Drive** = the feature / user-facing entity. **Active Drive** = the fullscreen runtime screen/state while a Group Drive is active. **Live** = a status label only. **Live Drive** = reserved exclusively for the existing personal temporary location-sharing feature (`src/lib/liveDrive.ts`). The Group Drive feature is never called "Live Drive"; the existing personal Live Drive implementation is not renamed or modified.
3. **Claude Design is a formalized role** — see `docs/AI_CONTEXT.md` for the Product Owner / ChatGPT / Claude Design / Claude Code responsibility split and Claude Design's explicit prohibitions. The repository/runtime source-of-truth hierarchy is unchanged.

### Stage ordering

- **Stage 0A — Visual V2 canonical reconciliation. COMPLETE / APPROVED.** Canonical spec, reconciliation audit and PR #135 contract reconciliation written against current `main`. No token, component or screen code changed.
- **Stage 0B — Additive Visual Foundation V2 tokens. NEXT.** Additive-only changes to `src/theme/{typography,colors,animations,radius}.ts` (new keys, nothing existing changed) — see `docs/audit/VISUAL_V2_RECONCILIATION.md`'s recommended first commit. Not yet implemented.
- **Stage 1 — Onboarding.**
- **Stage 2 — Home / Map.**
- **Stage 3 — Event Detail.**
- **Stage 4 — Garage / Vehicle.**
- **Stage 5 — Group Drive / Active Drive. MVP REQUIRED**, but begins only after explicit implementation authorization and prerequisite backend/security planning. Group Drive application code does not exist yet; the target architecture is `docs/GROUP_DRIVE.md` and the target visual contract is `docs/VISUAL_ARCHITECTURE_V2.md` §10.5/§13.

Then:

- **Static MVP release candidate.**
- **Physical Android/iOS runtime validation.**

### Privacy P0 — active Live Drive audience change

**IMPLEMENTED — STATIC PASS / PHYSICAL RUNTIME VALIDATION PENDING.**

Changing the audience of an *already-active* personal Live Drive previously mutated the live audience with no separate confirmation, contradicting `AGENTS.md` §8 ("Audience expansion must never occur silently"). It now requires explicit consent:

- selecting the current audience again is a no-op;
- selecting Ghost still revokes sharing immediately, with no extra confirmation;
- every other non-Ghost → non-Ghost change (Crew / Friends / Global) opens a confirmation naming the current and proposed audience, stating that precise location is shared, and stating that the session duration does not restart or extend. Crew and Friends are treated as different audiences, not nested ones, so no change is exempt.

Nothing is mutated before the user confirms; Cancel and Android Back leave the session and audience exactly unchanged. On confirm, the existing `expiresAt` is preserved — no new four-hour window, no permission re-prompt. If the session expired while the confirmation was open, it fails safe to the non-sharing state.

Shipped separately from Visual Architecture V2 work, as required. **Not Done** — this status reflects static checks only; native Android/iOS runtime evidence is still required before the P0 can be closed.

## Blocked work

- Production Supabase Migration A remains blocked until a manual database dump, rollback verification and explicit approval.
- Apple authentication runtime validation requires an iOS environment and Apple Developer configuration.
- New large features remain frozen until MVP runtime stability is proven.
