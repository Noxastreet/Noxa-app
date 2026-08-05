# NOXA — Current State

_Last consolidated: 5 August 2026 (exact-source audit checkpoint)._

## Current program

**MVP completion and normalization before physical-device validation.**

The product owner is intentionally completing the visual system, user flows, static behavior and documentation before purchasing Android and Apple developer accounts and dedicated test devices. Physical Android/iOS validation will then run against a fixed release-candidate commit, followed by defect correction.

The canonical completion program is:

1. `docs/MVP_COMPLETION_MASTER.md`;
2. `docs/MVP_SCREEN_ACTION_REGISTER.md`;
3. `docs/AI_EXECUTION_PLAYBOOK.md`.

## Verified active integration work

- Repository: `Noxastreet/Noxa-app`.
- Active integration branch: `feat/home-map-floating-card-foundation`.
- Draft PR: `#135`.
- Parent snapshot before the MVP-program documentation checkpoint: `2c7a045f2aaeb065e2f4d064157283af126c8959`.
- Current verified HEAD (this checkpoint): `a9e9a982935a6b26d65366360448b20e0959ff2d`, equal to PR #135's `headRefOid`.
- PR state at verification: open, draft, mergeable, not merged.
- Existing PR scope:
  - `NoxaFloatingCard` foundation;
  - EventCard/RouteCard migration and action-layout fix;
  - `IdentityOrb` presentation foundation;
  - canonical Group Drive architecture and privacy hardening.
- No Group Drive application code, database migrations or production changes exist in this PR.
- `IdentityOrb` is not wired into the general map.

## Group Drive design state

- Architecture: approved in `docs/GROUP_DRIVE.md`.
- Design Package v1.1: reviewed.
- Remaining v1.1.1 micro-corrections:
  1. pending invitation uses `IdentityOrb` and safe nickname, never host photo;
  2. one sheet controller; confirmation replaces content instead of stacking sheets;
  3. Minimize always goes to My Group Drives without stopping sharing;
  4. Resume Active Drive is primary when a drive is active; Create remains secondary.
- Implementation is blocked until that design contract is approved.

## Exact-source audit checkpoint

- `docs/audit/CURRENT_ROUTE_ACTION_DATA_INVENTORY.md` is complete — documentation-only inventory of all 42 `app/` route files (plus their owning `src/features`/`src/screens`/`src/components` behavior) at commit `a9e9a982935a6b26d65366360448b20e0959ff2d`.
- See that document for full findings, line-cited evidence, the route reachability graph and the raw-error/duplicate-primitive/oversized-file lists; not duplicated here.
- Next implementation checkpoint (P0, privacy): widening the live-location audience while a Live Drive session is already active (`app/(tabs)/index.tsx:692-731`, `changeVisibilityMode`) must require explicit confirmation before it proceeds — currently silent, contradicting AGENTS.md §8. See the audit document's Executive Summary item 1 for full evidence.

## Static evidence already recorded for PR #135

At the previous code checkpoint, and re-verified at the exact-source audit checkpoint (`a9e9a982935a6b26d65366360448b20e0959ff2d`):

- TypeScript: pass;
- lint: pass with two pre-existing unrelated warnings in `CanonicalCrewDetailScreen.tsx`;
- Expo Doctor: 18/18;
- diff check: clean.

The documentation checkpoint itself does not prove runtime behavior.

## Immediate next checkpoints

1. Commit and adopt the canonical MVP audit/action/playbook documents. **Done.**
2. Complete Group Drive Design Package v1.1.1 after Claude Design limits reset.
3. ~~Run Claude Code's documentation-only exact-source audit and create `docs/audit/CURRENT_ROUTE_ACTION_DATA_INVENTORY.md`.~~ **Done** — see "Exact-source audit checkpoint" above.
4. Fix the P0 privacy defect identified by the audit: require explicit confirmation before widening an active Live Drive audience (`app/(tabs)/index.tsx:692-731`).
5. Reconcile GitHub and Notion status drift.
6. Execute the ordered MVP waves from the master document with one scoped commit per checkpoint.
7. Keep PR #135 draft and unmerged.
8. After the static release candidate is complete, purchase/configure Android and Apple developer access and run physical-device validation.

## Production and account restrictions

Blocked without separate explicit approval:

- production Supabase migrations or data changes;
- production Edge Function deployment;
- OAuth/secret changes;
- Mapbox account-level mutations;
- billing changes;
- store submission;
- PR merge or production release.

## Honest status vocabulary

- **Planned** — contract exists, implementation not started.
- **Designed** — approved behavior and visual contract exist.
- **Implemented** — code exists.
- **Static PASS** — required static checks pass.
- **Runtime pending** — native device behavior not tested.
- **Runtime PASS** — exact build/commit/device evidence exists.
- **Done** — acceptance, runtime, documentation and production evidence are complete.

Until physical validation, the maximum honest product state is **Static PASS / Runtime pending**.
