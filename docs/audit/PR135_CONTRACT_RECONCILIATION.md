# PR #135 Contract Reconciliation

This document completes the comparison the original Stage 0 task required and the first reconciliation pass missed: every unique product/privacy/MVP/Group Drive decision recorded on `feat/home-map-floating-card-foundation` (PR #135, HEAD `58017f152b2da3e8e1de516e57ea742f02fb4cfe`) against current `main` (HEAD `61aff8361b067b2c5dbff49743d75417838e0234` at the time of this pass). Current `main` remains implementation truth throughout — nothing below is imported because it is old, only because it is still correct and not otherwise recorded.

Classification legend:
- **STILL VALID** — the decision doesn't conflict with anything on `main` and isn't proven wrong by newer code; preserved/imported into current canon.
- **SUPERSEDED BY MAIN** — `main` has since established a different, canonical way of covering the same ground; recorded here as superseded, not imported.
- **STALE EVIDENCE** — the content is a snapshot of code/line-number evidence tied to an old HEAD; not imported as current truth, would need a fresh audit against `main` to reuse.
- **NEEDS PRODUCT DECISION** — a real, unresolved conflict or open question; reported here, not resolved by this pass.

## 1. `docs/GROUP_DRIVE.md` (378 lines, PR #135)

**STILL VALID — imported verbatim into `main` as `docs/GROUP_DRIVE.md`**, with a provenance header and one addition (§14, below). Rationale: Group Drive has zero application code, tables, or RLS on `main` — nothing in this document is contradicted by runtime evidence, because there is no runtime yet to contradict it. It is a self-contained, carefully isolated domain (explicitly does not touch `driver_locations`, `event-route`, `events`, `crew_convoys`, `NoxaFloatingCard`, `IdentityOrb`, or the main Home/Map screen), so importing it creates no conflict with anything that exists on `main` today.

Specifically confirmed still valid and directly relevant to this correction pass:
- **Host cannot Leave in MVP.** §4.3: "The host row can never be removed and the host cannot leave without first cancelling or ending the drive." §5.1's state machine has exactly one host-driven terminal transition out of `active`: `active → completed` via explicit "End Drive." §5.3's participant state diagram marks `left` as reachable only by "(participant leaves)" — the host row has no `left` transition at all in MVP. This directly supports the Visual Architecture V2 correction requested in this pass (§2 below).
- The full data model, state machines, privacy matrix, RLS requirements, retention rules, MVP/Not-in-MVP boundary, navigation rules, Definition of Done, and Android runtime checklist — all internally consistent, none touch existing tables, none assume code that doesn't exist.

**Not imported:** §13.1's "single long-lived integration branch, one draft PR" delivery process. That was PR #135's own working arrangement, not a Group Drive architecture decision — see item 6 below. The obsolete operational instructions were **removed outright** from the imported document (Stage 0A finalization) rather than preserved under a superseded note, so no future agent is pointed at PR #135's branch mechanics. §13.1 now states only that phases remain independently reviewable gates, that branch/PR strategy is governed by current `docs/ROADMAP.md`/`docs/AI_CONTEXT.md`/Product Owner instruction at implementation time, and that no branch strategy may weaken phase-level validation or production gates. The architectural Phase 0–5 definitions in §13.2 are unchanged.

**Both items raised by this pass are now RESOLVED by Product Owner decision (Stage 0A finalization):**
- **Group Drive is MVP-required**, not Post-MVP/V2. This pass originally flagged the conflict between PR #135's `MVP_COMPLETION_MASTER.md` §6.1 item 13 (Group Drive listed as a required MVP system) and `main`'s `docs/ai-design-library/*` (which did not mention Group Drive at all, and froze the closest analog, Crew Convoy). The Product Owner resolved it in favor of MVP-required, with Group Drive sequenced as the **final major functional MVP system** — after the privacy P0 and after the Visual Architecture V2 foundation and core reference experiences. `docs/ai-design-library/04-mvp-v2-boundary.md`, `docs/ai-design-library/07-mvp-screen-plan.md` (Release Wave 8) and `docs/CURRENT_STATE.md` have been updated accordingly. This does **not** authorize production Supabase changes: Group Drive's DB/RLS/migrations still require their own scoped review and production approval gates. Crew Convoy remains frozen/legacy V2 and is not reused as the Group Drive domain.
- **Naming is final:** **Group Drive** = feature/entity; **Active Drive** = fullscreen runtime screen/state; **Live** = status label only; **Live Drive** = reserved exclusively for the existing personal temporary location-sharing feature. The Group Drive feature is never called "Live Drive." `docs/GROUP_DRIVE.md` was retitled ("NOXA — Group Drive Architecture"), its unresolved naming-collision section removed, and its Group-Drive-context uses of "Live Drive" replaced with "Active Drive"; the remaining "Live Drive" references in that document refer only to the existing personal feature, which is not renamed or modified.

## 2. `NoxaFloatingCard` / `IdentityOrb` intent (`src/components/ui/*.tsx`, PR #135)

**STILL VALID as design intent; not imported as code** (out of scope for a documentation-only pass — importing component source is an `app`/`src` change).

- `IdentityOrb` (`size: 'small'|'medium'|'large'` → 32/44/56px diameter, car-sport icon, optional `selected` ring, optional `presence` dot): structurally matches Visual Architecture V2's requirement that the orb be "the default state of a person, not a fallback... never a blurred photo or an initial" and that a `medium` orb hits the 44px minimum target. **Gap worth recording:** PR #135's implementation renders one fixed look (icon on `surfaceSoft`) — it does not vary tone per user, which the target design explicitly calls for ("tone varies per user"). Not a blocker, just a known gap for whoever implements the real component.
- `NoxaFloatingCard` (kicker/title/subtitle header, close button, one-or-two-action footer, built entirely from existing `colors`/`radius`/`shadows`/`spacing` tokens, no new dependency): a reasonable general-purpose "map selection card" shape, closer to the target's L2 preview-detent sheet than to a full sheet. **Same "shadow always on" pattern flagged elsewhere in this audit** — it applies `shadows.card` unconditionally with no L0–L3 distinction, same as every other current card-like surface (see `docs/audit/VISUAL_V2_RECONCILIATION.md` §C).

Both are reasonable starting points for the real Stage 2+ (Home/Map) and Stage 5 (Active Drive) implementations, not something to build from scratch — but they are 0% present on `main` today and must be (re)implemented, reviewed, and validated as part of whichever stage actually wires them up, not assumed to already exist.

## 3. `docs/MVP_COMPLETION_MASTER.md` (232 lines, PR #135)

**Mostly SUPERSEDED BY MAIN.** This was PR #135's attempt at a single master execution program (roles, source-of-truth hierarchy, frozen MVP boundary, module index). `main` already has its own, different-shaped canonical execution framework — `docs/ROADMAP.md` (stages + Definition of Done) plus `docs/ai-design-library/04-mvp-v2-boundary.md` and `07-mvp-screen-plan.md` (MVP/V2 boundary + per-screen release waves). Importing a second, differently-structured "master program" would create two competing execution frameworks in the same `docs/` tree, which is exactly the drift this reconciliation exists to prevent. Not imported.

The product-law content (§5: North Star, "people before cars," honest emptiness, etc.) is identical in substance to what's already canonical in `AGENTS.md` and `docs/ai-design-library/02-product-constitution.md` — duplicate, not new information.

**One exception, already covered above:** §6.1 item 13's claim that Group Drive is MVP-required is the one substantive, non-duplicate assertion in this document. It was flagged for decision by this pass and has since been **confirmed** by the Product Owner — Group Drive is MVP-required (item 1).

## 4. `docs/MVP_SCREEN_ACTION_REGISTER.md` (117 lines, PR #135)

**Mixed.** The general action matrix (non-Group-Drive rows) is **SUPERSEDED BY MAIN** in the sense that `main`'s `docs/ai-design-library/07-mvp-screen-plan.md` already covers the same screens at a comparable level of product intent, and the specific per-action state requirements here were written against PR #135's HEAD, not re-verified against 30 commits of subsequent work on `main` (settings, notifications, profile, garage, onboarding, auth all changed since). Not imported wholesale.

**The 11 Group-Drive-specific rows (My Group Drives through Completed Drive Summary) are STILL VALID** — they describe screens that don't exist anywhere else in `main`'s docs, don't depend on any code that's changed, and directly confirm the Leave-vs-End correction this pass makes (Active Drive Map: "Participant Leave confirmation; host End confirmation"; Group Drive Host Controls: "End Drive confirmation" only, no host Leave). **Imported** as new §14 of `docs/GROUP_DRIVE.md`.

## 5. `docs/AI_EXECUTION_PLAYBOOK.md` (434 lines, PR #135)

**SUPERSEDED BY MAIN.** This is an AI-agent operating protocol (session-bootstrap prompt templates, a four-role model including "Claude Design," task-brief format, review gates, stop conditions). Its content overlaps almost entirely with `main`'s existing `docs/AI_CONTEXT.md`, just at greater length and with more prescriptive prompt templates. One concrete, checkable claim inside it is actively contradicted by `main`'s real history:

- §9 "Commit and PR protocol": *"Use the current long-lived integration branch unless product explicitly changes the strategy... Keep one draft PR."* `main`'s actual merged history shows the opposite pattern in practice — many independent `feat/*` branches (`feat/onboarding-identity-148`, `feat/settings-safety-146`, `feat/notifications-mvp-144`, `feat/profile-identity-142`, `feat/garage-final-polish-138`, `feat/crews-events-final-polish-136`, etc.), each merged through its own PR. **SUPERSEDED BY MAIN** — recorded, not imported; this is also the reason `docs/GROUP_DRIVE.md` §13.1 above needed its own superseded-note rather than being imported unmodified.

The "Claude Design" role concept (a fourth agent role between Product Owner and Claude Code, owning visual/interaction specs) did not exist in `main`'s `docs/AI_CONTEXT.md` when this pass ran. **RESOLVED — the Product Owner has formalized it.** `docs/AI_CONTEXT.md` now carries the four-role split (Product Owner / ChatGPT / Claude Design / Claude Code) with Claude Design owning approved visual architecture, screen composition, interaction flows, component behavior specs, and motion/accessibility design — and explicitly prohibited from autonomously changing product scope, inventing features, changing backend/privacy architecture, touching the database/Mapbox/Supabase, implementing application code, or overriding an approved contract. The repository/runtime source-of-truth hierarchy is unchanged. Note this is the role definition only — PR #135's prompt templates and review-gate boilerplate remain not imported.

## 6. `docs/mvp/*` (5 files: `ROUTE_INVENTORY.md`, `UI_FOUNDATION_AND_SCREEN_AUDIT.md`, `FUNCTIONAL_SYSTEM_AUDIT.md`, `BACKEND_SECURITY_PERFORMANCE.md`, `EXECUTION_WAVES.md`)

**Mostly SUPERSEDED BY MAIN or STALE EVIDENCE**, with a few corroborating data points worth noting:

- `EXECUTION_WAVES.md` — a 10-wave execution order (Wave 0 Knowledge/audit → Wave 9 Physical-device validation), Group Drive as Wave 7. **SUPERSEDED BY MAIN** as a competing structure to `docs/ROADMAP.md`'s stage model; not imported. The status vocabulary (Planned/Design in review/.../Done, "never use Done for code presence alone") is good practice already present in substance in `main`'s `docs/ROADMAP.md` Definition of Done.
- `BACKEND_SECURITY_PERFORMANCE.md` — production-controls checklist (no migrations/secrets/Mapbox mutation without approval) duplicates `docs/ARCHITECTURE.md` and `AGENTS.md` §13/§10 already on `main`. **SUPERSEDED BY MAIN.**
- `UI_FOUNDATION_AND_SCREEN_AUDIT.md` — **one genuinely useful, still-valid, independently-arrived-at corroboration**: its §8.2 "Missing or incomplete shared contracts" lists `NoxaSheetController` (portal/modal ownership, Android Back, focus restoration, pan gesture, scroll boundary, Reduced Motion) and "Destructive confirmation content contract" as the two biggest foundation gaps — this matches, independently, the same conclusion this Stage 0 audit's `docs/audit/VISUAL_V2_RECONCILIATION.md` §E reached from a fresh inspection of current `main`. Recorded as corroborating evidence there; not imported as a separate document since it would duplicate that section.
- `FUNCTIONAL_SYSTEM_AUDIT.md`, `ROUTE_INVENTORY.md` — **STALE EVIDENCE.** Route-by-route classification (MVP/Frozen/Quarantine) and functional checklists tied to PR #135's HEAD, 30 commits behind `main`'s current tip. The classification methodology (MVP/Support/Frozen/Quarantine/Planned) is a reasonable pattern but the specific route list needs re-running against `main`, not copying — several routes it discusses (e.g. `app/notifications.tsx`, `app/settings.tsx`, `app/blocked-users.tsx`) have had real MVP work land since this snapshot per `docs/CURRENT_STATE.md`'s "Next product stage" history, so their classification/evidence here is not trustworthy as current fact.

## 7. `docs/audit/CURRENT_ROUTE_ACTION_DATA_INVENTORY.md` (535 lines, PR #135)

**STALE EVIDENCE — do not import as current truth.** This is a route/action/data snapshot audit tied to a specific old HEAD (`8514965645ba1abc2580006a2a8d598ae7fe8d36`), explicitly self-described as "evidence, not a design decision," with every finding cited to a file:line at that HEAD. 30 commits have landed on `main` since, several touching exactly the files this audit cites (`app/(tabs)/index.tsx`, profile/settings/notifications/onboarding screens). Line numbers and even some findings' continued existence cannot be assumed without a fresh audit.

**One finding independently corroborated, not imported from here but worth noting as a data point:** finding #1 in this document's executive summary — "P0 — Silent audience expansion on the live map," `app/(tabs)/index.tsx:692-731` (`changeVisibilityMode`), no confirmation on widening an already-active Live Drive audience, contradicting `AGENTS.md` §8 — is the same P0 already carried forward independently in this Stage 0's `docs/VISUAL_ARCHITECTURE_V2.md` and `docs/CURRENT_STATE.md`. The file:line citation is **not** re-verified against current `main` by this pass (that would require a fresh code read, out of scope for a documentation-only correction), so it's cited here only as corroborating context for why the P0 was already being tracked, not as a re-confirmed current fact.

## Summary table

| Source (PR #135) | Classification | Action taken |
|---|---|---|
| `docs/GROUP_DRIVE.md` | STILL VALID | Imported verbatim as `docs/GROUP_DRIVE.md`, with a provenance header, a §13.1 superseded-note on branch strategy, and a new §14 (Group Drive action-register rows) |
| `IdentityOrb`, `NoxaFloatingCard` intent | STILL VALID (design intent only) | Recorded here; component code not imported (out of scope) |
| `docs/MVP_COMPLETION_MASTER.md` | Mostly SUPERSEDED BY MAIN; its Group-Drive-is-MVP claim since CONFIRMED | Not imported; Group Drive MVP-required decision now recorded in `docs/ai-design-library/*` and `docs/CURRENT_STATE.md` |
| `docs/MVP_SCREEN_ACTION_REGISTER.md` | Mixed — general rows SUPERSEDED BY MAIN, Group Drive rows STILL VALID | Group Drive rows imported into `docs/GROUP_DRIVE.md` §14; rest not imported |
| `docs/AI_EXECUTION_PLAYBOOK.md` | SUPERSEDED BY MAIN (branch/PR protocol contradicted by real history); "Claude Design" role since FORMALIZED | Document not imported; obsolete branch mechanics removed from `docs/GROUP_DRIVE.md` §13.1; Claude Design role added to `docs/AI_CONTEXT.md` |
| `docs/mvp/EXECUTION_WAVES.md`, `BACKEND_SECURITY_PERFORMANCE.md` | SUPERSEDED BY MAIN | Not imported |
| `docs/mvp/UI_FOUNDATION_AND_SCREEN_AUDIT.md` | STALE EVIDENCE, but §8.2's gap analysis independently corroborated | Not imported as a document; corroboration noted here only |
| `docs/mvp/FUNCTIONAL_SYSTEM_AUDIT.md`, `ROUTE_INVENTORY.md` | STALE EVIDENCE | Not imported |
| `docs/audit/CURRENT_ROUTE_ACTION_DATA_INVENTORY.md` | STALE EVIDENCE | Not imported; P0 corroboration noted here only |

## Product Owner decisions — all RESOLVED (Stage 0A finalization)

The three items this pass raised have all been decided. None remain open.

1. **Group Drive MVP boundary — RESOLVED: Group Drive is required for the NOXA MVP.** It is not Post-MVP/V2. It is the final major functional MVP system, sequenced after the privacy P0 and after the Visual Architecture V2 foundation and core reference experiences, and it begins only on explicit implementation authorization. Recorded in `docs/ai-design-library/04-mvp-v2-boundary.md`, `docs/ai-design-library/07-mvp-screen-plan.md` (Release Wave 8), `docs/CURRENT_STATE.md` and `docs/GROUP_DRIVE.md`. The decision does **not** authorize production Supabase changes — Group Drive's DB, RLS, RPCs and migrations keep their own scoped review and production approval gates. Crew Convoy stays frozen/legacy V2 and is not the Group Drive domain.
2. **Naming — RESOLVED and final.** Group Drive = feature/entity. Active Drive = fullscreen runtime screen/state. Live = status label only. Live Drive = the existing personal temporary location-sharing feature, exclusively. `docs/GROUP_DRIVE.md` retitled to "NOXA — Group Drive Architecture," collision section removed, Group-Drive-context "Live Drive" replaced with "Active Drive." The existing personal Live Drive implementation is not renamed or modified.
3. **Claude Design role — RESOLVED: formalized** in `docs/AI_CONTEXT.md`, with explicit responsibilities and explicit prohibitions. Source-of-truth hierarchy unchanged.
