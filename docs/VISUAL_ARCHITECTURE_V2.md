# NOXA — Visual Architecture V2

**Status: APPROVED FOR IMPLEMENTATION** (product direction approved by Product Owner + ChatGPT; this document is the repository-owned implementation contract derived from that approval).

This document translates the approved "NOXA Visual Architecture V2" design artifact into a canonical, implementation-facing specification. It does not replace `AGENTS.md`, `docs/ai-design-library/*`, or `docs/UI_RULES.md` — it is a visual-layer contract that operates inside those product laws. Where this document is silent, the product laws in `AGENTS.md` and `docs/ai-design-library/02-product-constitution.md` govern.

Reconciliation against the current codebase — what already matches, what must change, and the smallest first implementation step — lives in `docs/audit/VISUAL_V2_RECONCILIATION.md`. That document is the working checklist; this one is the target state.

## 1. Visual principles

- **One continuous premium surface, not premium cards everywhere.** The screen is the unit of layout, not the card.
- **Removal before addition.** Every screen is solved first by removing controls, containers and copy, then by adding only what remains necessary.
- **One primary action per interaction level.** Secondary and destructive actions never compete visually with the primary action.
- Premium comes from typography, spacing, proportion, geometry, photography/content and progressive disclosure — never from blur, glow, gradients, nested cards, badges, or game-HUD styling.
- A new screen is an arrangement of the thirteen shared primitives (§4–§7 below), not an invention of new one-off styling.

## 2. Surface hierarchy L0–L3

Four levels, no others. A card inside a card is a bug.

| Level | Role | Background | Notes |
|---|---|---|---|
| L0 | Screen / map / page environment | `#06060A` | The base. Map or screen canvas. |
| L1 | Content directly on the main surface | no container | Flat — no elevation, no shadow. Hairline dividers only (~6% white). No card wrapper. |
| L2 | One contextual elevated sheet/surface | `#0C0C10` | Rounded top corners only (target radius 28), 2 detents (preview / detail). **One restrained shadow/elevation is allowed here — this is the only surface in the hierarchy that carries one.** |
| L3 | Critical / destructive confirmation | replaces L2 content, inside the same shell | **Never stacks another elevated surface over L2.** L3 is L2's content swapped for destructive content in place — same shell, same elevation, no second shadow, no second sheet. |

## 3. Typography hierarchy

Two font roles: a display face for anything the user should *feel*, a body/system face for anything they must *read*, and a monospace face for anything the system is *reporting* (labels, metadata, counters). Never more than two display sizes on one screen.

| Role | Size / line-height / tracking | Example |
|---|---|---|
| Hero | 40 / 1.04, −3.5% tracking | Screen-defining title ("Night Drive", question text in onboarding) |
| Value | 30, −3% tracking | The 2–3 numbers that decide the screen (distance, power, price) |
| Section | 24 | Section-level heading |
| Row | 17 | List-row primary text |
| Body | 16 | Paragraph / descriptive text |
| Label | 11 mono, +14% tracking, uppercase | Field labels, units, metadata, kickers |

## 4. Spacing rules

- 24px is the **preferred** phone gutter, edge-to-edge. It is not a rigid requirement on every viewport: on narrow/small screens the gutter may adapt downward — within the existing responsive 16–24px range already established by `src/hooks/useResponsive.ts` — when necessary for readability, accessibility, touch-target integrity, or layout stability. Do not force a flat, non-responsive 24px constant, and do not change `NoxaScreen`'s default padding globally to reach this — see `docs/audit/VISUAL_V2_RECONCILIATION.md` §B for how this maps onto the existing token/hook.
- Content blocks anchor to fixed offsets so the eye does not re-hunt between steps (e.g. onboarding's question block starts at a fixed distance from the top on every step).
- Primary actions pin a fixed distance from the bottom safe area (reference: 44px).
- Rows are separated by hairlines (~6% white) at 18–22px vertical padding; dividers never touch the screen edge inside a list, only in section breaks.

## 5. Action hierarchy

Four control kinds, not six:

- **Primary** — filled red (`#C8102E`), one per interaction level, never two filled primaries visible at once.
- **Secondary** — outlined.
- **Tertiary** — text only.
- **Destructive** — outlined red, separated from common actions, never the same control as Primary with a color swap.

Rules:

- Filled red appears once per screen, or not at all.
- Radius 12 for buttons, 999 only for orbs/chips/status pills.
- Minimum touch target 44×44; standard control height 56.
- Rare or destructive actions live behind a quiet `···` overflow, not as a permanent visible control competing with the primary action.

## 6. Sheet / modal behavior

- One sheet per runtime/flow. Destructive confirmation **replaces** the current sheet's content — it does not stack a second sheet or a second `Modal` on top.
- Cancel returns to the previous contextual content. Commit performs the explicit destructive action.
- Android Back always steps out of the destructive state first, never out of the flow entirely, and never silently discards it — Back is always a safe cancel.
- No accidental destructive action from a pan/swipe/long-press gesture that an incidental touch (e.g. a bump while driving) could trigger.
- Map sheets use two detents (preview ≈300, detail ≈630); dragging past the top pushes to full screen.

## 7. Motion principles

- Motion explains spatial continuity, selection, hierarchy change, arrival/removal caused by real data, successful action, or screen/sheet transition. It never fabricates activity (see `AGENTS.md` §7 and the Product Constitution's motion laws).
- Reference durations: step/screen transitions ~240ms; sheet rise ~320ms; fades ~160–180ms; minimise collapse ~260ms; live participant-state interpolation ~1.2s (so nothing jumps).
- Low or no overshoot. No repeated decorative bounce, no constantly floating elements, no fake marker movement.
- `react-native-reanimated` remains the canonical animation engine (per `docs/ai-design-library/08-ui-foundation-and-library-policy.md`); no new animation dependency is introduced by this spec.
- System Reduced Motion is always respected; essential state changes remain understandable with motion off (see §9).

## 8. Accessibility rules

- Every icon-only control has an accessibility label.
- Minimum interactive target 44×44 logical px.
- State (selected, disabled, loading, error, success, destructive) is never conveyed by color alone — pair with text, icon, or shape.
- Destructive controls (e.g. "Leave drive" vs "End drive") are labelled with their scope to assistive tech, not just their verb.
- Sheets trap focus; a sheet's open/closed state and a chip's active state are stated in words for screen readers, not implied only by appearance.
- Long text (names, titles) wraps rather than silently truncating where the design calls for it (e.g. Garage vehicle name wraps to two lines and shrinks before truncating).

## 9. Small-screen behavior and Reduced Motion

- The hierarchy in §3–§5 must hold on small Android screens: if a screen only has room for one display-size element, the Hero/Value distinction still applies — nothing above Row size may appear twice on a small viewport.
- Reduced Motion: steps/sheets appear in their settled end-state instead of animating in; state-defining motion (e.g. the onboarding map handoff, a live participant dot) has a static equivalent that still communicates the state correctly.
- Progress and status must be legible at 200% text scale without breaking the primary-action layout.

## 10. Five reference experience contracts

These are the first implementation wave. Do not expand V2 styling to other screens until these are implemented and validated (see `docs/audit/VISUAL_V2_RECONCILIATION.md` for current-state gaps).

### 10.1 Onboarding
Flow: **Welcome → Account → Identity → City → First Car → Privacy → Map**. One question/primary task per screen. Nickname + optional photo; city; first car (make/model/year, photo optional) — no build/mods/social links in onboarding, those move to Garage/Profile. Privacy step offers exactly two honest choices ("Appear in the city" / "Stay invisible for now"), neither pre-selected by silence; exact location is not offered here at all. Onboarding ends with a motion handoff into the Map, not a success screen.

### 10.2 Home / Map
Default state: two persistent overlays only — a city/context line and a visibility control. Recenter is progressive-disclosure (§13). Tap → one contextual sheet (L2) → one obvious next action. No fabricated activity, ever (see §14).

### 10.3 Event Detail
One architecture, five contexts (meet, cruise/drive, track day, drift/drag, Crew event) — only the kicker, the 2–3 values, and the verb (Join/Register/Attend) change between contexts. Hierarchy order: what → where/when → who → why relevant → what next. Save/Share/Report live behind a quiet `···`, never as competing buttons next to Join.

### 10.4 Garage / Vehicle
Car first, interface second. Vehicle photo and identity dominate; specification is available, not displayed by default (progressive disclosure). Viewing and editing are visually separated — editing happens on an L2 sheet above the car, never inline on the viewing screen. Supports stock/street/track/drift/drag/show without gamification (no progress rings, no achievement rows, no stat-chip grids).

### 10.5 Active Drive
Dedicated fullscreen runtime. Gets simpler as it becomes active: route, group, one status line, two controls. No exact participant speed, no racing telemetry, no leaderboard, no gaming HUD. Approximate participant states only: Moving / Stopped / Arrived / Stale. Leave vs End are distinct, separately confirmed actions, and the host does not have a Leave control in MVP (§13). Minimise returns to the app with a persistent resumable bar; it never ends or leaves the drive.

## 11. Map Recenter progressive-disclosure rule

Recenter is not removed and not permanently visible. While the camera is following/centered on the user, Recenter does not exist on screen. The moment the user pans away from their own position, Recenter fades in above the bottom navigation; tapping it eases the camera back and the control fades out again once the camera is centered. One control, one condition, no permanent cluster of camera controls.

## 12. Honest empty-state rule

Emptiness is reported, never disguised. No ghost pins, no invented activity, no popularity/timing/behavioral claims unless backed by real data (per `AGENTS.md` §3 "Honest emptiness" and the Product Constitution's "Never do" list). The canonical pattern is one sentence of truth plus one real way forward — e.g. "No drivers are visible nearby right now." + "Browse upcoming events." The same treatment covers offline, permission-denied, and stale-location states.

## 13. Active Drive Leave vs End semantics

These are two distinct destructive actions and must never be presented as one action with a different label. This is the MVP runtime contract in full, per the canonical `docs/GROUP_DRIVE.md` (§4.3, §5.1, §5.3, §9):

- **Leave drive** — a **non-host participant's** action only. The confirmation states that this participant leaves, their location sharing stops immediately, and the Group Drive continues for the remaining participants.
- **End drive** — the **host's** action only. The confirmation states that the Active Group Drive ends for everyone — all participants stop sharing and no one can rejoin.

**The host does not have a Leave control in MVP.** The host row can never be removed and cannot transition to `left` — the host's only way out of an active drive is ending it for everyone. There is no "host leaves, drive continues without them" path, no host-transfer, and no UI affordance that offers the host a Leave action. Any future host-transfer or host-leave capability is a Post-MVP product decision and is not part of the present runtime contract — do not design, mock, or gray-out a host Leave control "for later."

Minimising the runtime is neither Leave nor End — it collapses the runtime UI into a persistent resumable bar while the drive continues unchanged. Both destructive actions are L3 confirmations that replace the current sheet content (§6); neither uses a swipe-to-confirm or long-press gesture.

## 14. Privacy-copy principles

- Exact location is never shared by default. It always requires an explicit, scoped, time-bounded user action.
- Every instance of exact-location sharing states, before commit: who can see it (audience), why (purpose/context), and how long (duration/expiry).
- Audience expansion never happens silently.
- Public participation in a Meet/Event/Drive does not by itself reveal a precise GPS position — presence and precise location are separate disclosures.
- A stranger's default identity is the neutral `IdentityOrb`, not an unrestricted real avatar or a blurred photo — the orb is a legitimate resting state, not a missing-avatar placeholder.
- This document does not redefine NOXA's backend privacy/visibility architecture (Ghost/Friends/Crew/Global, RLS, session duration). It only specifies how that architecture is presented.

## 15. Approved design artifact / source references

- Primary source: the approved Claude design export "NOXA Visual Architecture V2" (five reference-experience flows + a thirteen-primitive foundation page), supplied as design attachment and reconciled into this document. The export's own on-canvas status label reads "Implementation candidate"; product approval to proceed was communicated directly by the Product Owner/ChatGPT-authored task brief, not by the label on the artifact itself — see `docs/audit/VISUAL_V2_RECONCILIATION.md` §0 for this distinction.
- The exported HTML artifact is external reference material and is intentionally **not** embedded in this repository (per the task's instruction to avoid committing large binary/design exports). It is referenced here textually; the canonical values it contains (typography scale, color hexes, radii, spacing, motion durations) are transcribed in this document and in the reconciliation audit.
- Supporting product-law sources used to resolve ambiguity: `AGENTS.md`, `docs/ai-design-library/01` through `09`, `docs/UI_RULES.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`.
- `docs/GROUP_DRIVE.md` is the canonical Group Drive architecture and MVP contract (data model, state machines, privacy matrix, RLS requirements, Leave-vs-End semantics) referenced by §13 and §10.5 above. It was reconciled from PR #135 and imported into `main` alongside this document — see `docs/audit/PR135_CONTRACT_RECONCILIATION.md` for the classification of what was and wasn't carried forward from that branch.

## 16. Implementation boundaries

Approved for this document to define: visual/typographic/spacing/surface/motion contract for the five reference experiences above, expressed against the existing `src/theme` and `src/components/ui` foundations.

Not approved and out of scope for this document or its immediate follow-on work without a separate explicit decision:

- Any Mapbox, Supabase, RLS, Edge Function, or migration change.
- Any new dependency (bottom-sheet libraries, animation libraries, font-loading strategy) — evaluate through `docs/ai-design-library/08-ui-foundation-and-library-policy.md`'s dependency gate first.
- Group Drive / multi-participant Active Drive application code — it does not exist yet (the closest current system is the crew-scoped "Convoy" flow in `app/convoy-setup.tsx`, which is a frozen V2 screen per `docs/ai-design-library/07-mvp-screen-plan.md`). `docs/GROUP_DRIVE.md` is the target architecture for when that work is scheduled; this document specifies its target visual contract. Neither document authorizes starting it. Whether Group Drive is MVP-required or Post-MVP/V2 is itself an open question — see `docs/audit/PR135_CONTRACT_RECONCILIATION.md`'s "Open items for the Product Owner."
- Widening an already-active personal Live Drive audience without explicit re-confirmation — this is a separately tracked P0 privacy defect (see `docs/audit/VISUAL_V2_RECONCILIATION.md` §0), not a visual-foundation change, and must not be mixed into the same implementation commit as this work. **Resolving this P0 has priority over broad Visual Architecture V2 screen rollout** — it should land before, or at minimum not be blocked behind, Stage 1 (Onboarding) and later screen-level work.
- Bottom navigation structure, route names, auth, or any other runtime behavior not explicitly named above.

## 17. Design package is intent, not runtime authority

This document, and the design artifact it is derived from, express **approved intent**. They are not proof that any screen works. Per `AGENTS.md` §2 and `docs/AI_CONTEXT.md`'s source-of-truth hierarchy, runtime behavior remains governed by: (1) physical-device/native runtime evidence, (2) code merged into `main`, (3) CI/PR evidence, (4) production Supabase evidence — in that order, ranked above this document and above the design artifact. Where implementation of this contract conflicts with verified runtime behavior or an existing privacy/backend contract, the runtime/backend contract wins and the conflict is reported rather than silently resolved in favor of the visual spec.
