# Visual Architecture V2 — Stage 0 Reconciliation Audit

Compares the approved target in `docs/VISUAL_ARCHITECTURE_V2.md` against the real current implementation on `main` (evidence gathered at commit `61aff8361b067b2c5dbff49743d75417838e0234`). This is a documentation-only artifact. No application code, Supabase, Mapbox, or dependency changed to produce it.

## 0. Base-state notes (read before the rest of this document)

- The task that requested this audit assumed a starting point of branch `feat/home-map-floating-card-foundation` / PR #135 at HEAD `58017f152b2da3e8e1de516e57ea742f02fb4cfe`. This session's actual assigned branch, `claude/noxa-visual-v2-audit-3xy3c2`, was cut from current `main` (HEAD `61aff8361b067b2c5dbff49743d75417838e0234`) instead. Per Product Owner direction, this audit was run against **current `main`**, not against PR #135's stale branch state — `AGENTS.md`/`CLAUDE.md` rank current `main` and runtime evidence above planning/integration branches.
- Consequence: several files PR #135 already added — `docs/mvp/*`, `docs/audit/CURRENT_ROUTE_ACTION_DATA_INVENTORY.md`, `docs/GROUP_DRIVE.md`, `NoxaFloatingCard`, `IdentityOrb` — **do not exist on `main`**. This audit treats those as not-yet-present rather than assuming their PR #135 content. PR #135 itself is currently `draft`, `mergeable_state: clean` against its recorded base, but its branch diverged from `main` 8 commits after a point that is now 30 commits behind `main`'s tip (onboarding, profile, garage, notifications, settings, auth and map-follow work all landed on `main` after PR #135 branched) — reconciling PR #135 itself is a separate, unstarted piece of work, not part of this audit.
- Existing unrelated P0 (carried forward, not touched here): **widening an already-active personal Live Drive audience must require explicit re-confirmation.** Current code widens silently (`app/(tabs)/index.tsx` visibility-mode change path). This is a privacy behavior fix, not a visual-foundation change, and must ship in its own commit/PR — see `docs/VISUAL_ARCHITECTURE_V2.md` §16.

Evidence below was gathered by direct file inspection plus one Explore-agent pass over `app/` and `src/` on the current branch (identical to `main`).

## A. Typography

**Current tokens** — `src/theme/typography.ts` (full file):
```
fontFamily.display: Platform.select({ ios:'HelveticaNeue-CondensedBold', android:'sans-serif-condensed', default:'Arial Narrow' })
fontFamily.body:    Platform.select({ ios:'System', android:'sans-serif', default:'system-ui' })
caption:12  badge:12  body:16  subtitle:18  cardTitle:18  title:22  sectionTitle:22  h2:28  h1:34  hero:48
lineHeight:{ caption:16, body:22, subtitle:24, title:28, h2:34, h1:40, hero:54 }
letterSpacing:{ tight:-0.6, title:-0.3, body:0, caption:0.4, label:1.8 }
```
No `mono` family key exists anywhere in the token file.

**Mismatch:**
- Target scale (hero 40, value 30, section 24, row 17, body 16, label 11 mono) has no direct token correspondence. Current `hero` is 48, not 40; there is no `value`/`row` step at all; letter-spacing is absolute px, not the target's percentage tracking.
- Target display font is **Archivo**, target mono is **JetBrains Mono**. Neither is integrated: no `expo-font`/`useFonts` call exists anywhere in `app/_layout.tsx` or elsewhere (confirmed by grep); `Archivo`/`JetBrains Mono` appear only in docs, never in a `.tsx`/`.ts` file. `expo-font` is installed but unused. Current display face is condensed Helvetica/system-default; body is plain System.
- 330 hardcoded `fontSize:` occurrences across 32 files under `app/`, 176 across 33 files under `src/` — biggest offenders `convoy-setup.tsx` (32), `(tabs)/index.tsx` (24), `CanonicalCrewsScreen.tsx` (28). Even screens that do use `typography.*` tokens (`app/onboarding.tsx`, `app/visibility-setup.tsx`) mix raw numeric `fontSize` in the same `StyleSheet.create`.

**Recommended change:** add a second, explicit V2 scale to `src/theme/typography.ts` (hero/value/section/row/body/label) rather than redefining the existing `h1`/`h2`/`title` keys in place, since 150+ files depend on the current keys. Decide font-loading strategy for Archivo/JetBrains Mono (or substitute system-available equivalents) as a distinct, scoped decision — this is the single highest-leverage open question before any pixel work starts.

**Risk:** Low if additive (new keys). Medium if existing `hero`/`h1`/`title` values are changed in place — that would silently reflow every screen still on the current token names.

**Presentation-only or behavioral:** Presentation-only (token/style layer). Font-loading (if a custom font family is adopted) touches `app/_layout.tsx` startup and app bundle size — worth flagging as a slightly bigger presentation change than a pure token edit.

**Dependencies:** None required if Archivo/JetBrains Mono are dropped in favor of system fonts; a font-loading dependency (`expo-font` `useFonts`, already installed) if the exact target faces are adopted.

**Validation:** Visual diff on 2–3 pilot screens + TypeScript/ESLint pass; Android device check of legibility at 200% text scale (per `docs/UI_RULES.md`).

## B. Spacing

**Current tokens** — `src/theme/spacing.ts` (full file): `xxs:4 xs:8 sm:12 md:16 lg:20 xl:24 xxl:32 xxxl:40 huge:48`.

**Mismatch:**
- Target gutter is a flat, constant 24px. Current gutter is **not constant** — two different values depending on code path: `NoxaScreen`'s own `padded` style uses `spacing.lg` (20px; `src/components/ui/NoxaScreen.tsx:26-30`), while `Screen`/`useResponsive`'s adaptive gutter is `clamp(16, width*0.045, 24)` on phones, 32 on tablets (`src/hooks/useResponsive.ts:50-52`, consumed by `src/components/layout/Screen.tsx:51-53`). Neither path currently produces a flat 24px on all phone widths.
- Screens that already use `spacing.*` tokens consistently: `app/onboarding.tsx`, `app/welcome.tsx`, `app/vehicle-details.tsx`, `CanonicalEventDetailScreen.tsx`. Screens with raw magic-number padding: `app/(tabs)/index.tsx` (`paddingHorizontal: 10/11`, `padding: 14` at lines 1870/1944/2184 — none map cleanly to an existing token).

**Recommended change:** Add `spacing.xl` (24) as the canonical constant screen gutter for V2 screens, and reconcile `NoxaScreen`'s `padded` default (currently `lg`/20) and `useResponsive`'s clamp against it — likely: keep the responsive clamp for genuinely narrow devices, but anchor its ceiling at the same 24 the design uses, and change `NoxaScreen`'s default from `lg` to `xl` for V2 screens specifically (not globally, to avoid reflowing every existing screen at once).

**Risk:** Medium — `NoxaScreen` is a shared primitive; changing its default padding reflows every screen that uses it, not just the five V2 reference screens.

**Presentation-only or behavioral:** Presentation-only.

**Dependencies:** None.

**Validation:** Compare rendered gutter on a small (360dp) and a wide phone; confirm no clipped content at existing 20px-tuned screens after any shared-default change.

## C. Surfaces

**Current tokens:**
- `src/theme/colors.ts` — `background:#06060A, surfaceBase:#0C0C10, surface:#111116, surfaceSoft:#18181D, surfaceRaised:#1F1F25, surfacePressed:#26262D, divider:rgba(255,255,255,.04), border:rgba(255,255,255,.072), borderStrong:rgba(255,255,255,.12), primary:#C8102E, primaryHover:#E01535, text:#F0F0F4, textMuted:#8E8E98, textSubtle:#4C4C56, textDisabled:#2C2C34, success:#30D158, warning:#FF9F0A`.
- `src/theme/radius.ts` — `xs:5 sm:8 md:12 lg:16 xl:20 xxl:24 card:16 hero:20 input:12 button:12 avatar:999 pill:999`.
- `src/theme/shadows.ts` — three presets (`card`, `redGlow`, `control`), all opacity .18–.22, applied broadly.

**Match already:** `background` (#06060A), `primary`/`primaryHover` (#C8102E/#E01535), `text` (#F0F0F4), `success` (#30D158), `warning` (#FF9F0A), and button/pill radii (12/999) already equal the target exactly — no token change needed there.

**Mismatch:**
- Target grey ramp (`#8E8E98 / #6E6E78 / #4C4C56 / #3C3C46 / #33333E`) is only half-present: `textMuted`(#8E8E98) and `textSubtle`(#4C4C56) match; `#6E6E78`, `#3C3C46`, `#33333E` do not exist as tokens at all.
- Target L2 sheet radius is 28 (top corners only); no token produces that — sheet-ish surfaces currently use `radius.xl`(20) or `radius.hero`(20) or `radius.card`(16) inconsistently depending on screen.
- Target wants shadow used **only** on L3 destructive; current `shadows.card` is applied broadly and unconditionally (`NoxaCard`, `NoxaSheet`, garage vehicle cards, empty states) with no L0–L3 distinction encoded anywhere.
- **The "cardboard" feeling does not come from `NoxaCard`/`NoxaSheet` misuse — it comes from those primitives being dead code.** Grep across the whole repo found zero `<NoxaCard` and zero `<NoxaSheet` instantiations in `app/` or `src/`. Every real screen (`(tabs)/index.tsx`, `CanonicalEventDetailScreen.tsx`, `vehicle-details.tsx`, `garage.tsx`) reimplements its own bordered `View` (`infoCard`, `organizerCard`, `vehicleCard`, `stateCard`, …) with `borderWidth:1 + colors.surface + shadows.card` repeated ad hoc. `CanonicalEventDetailScreen.tsx` alone has five independent sibling "cards" (`infoCard`, `mapCard`, `goingCard`, `organizerCard`, `detailsCard`) — not nested, but each one is its own bordered container, which is exactly the "wall of cards" the design brief is solving for.

**Recommended change:** Add the missing 3 grey tokens; add an explicit `radius.sheet` (28, top-only via component styling, not a single scalar); introduce a documented convention (comment/lint note, not a new system) that `shadows.*` is reserved for L2/L3 only. The larger structural fix — retiring the five independent ad hoc "cards" on Event Detail/Garage/Vehicle in favor of flat L1 content with hairline separation — is the real Stage 1+ work, not a token change.

**Risk:** Low for token additions. Medium-high for removing borders/shadows from existing screens without a full visual pass (regressions would read as "flattened", not "premium", if done piecemeal).

**Presentation-only or behavioral:** Presentation-only.

**Dependencies:** None.

**Validation:** Screenshot diff per reference screen; confirm no accidental card-in-card remains once L1 content is flattened.

## D. Buttons / action hierarchy

**Current:** `src/components/ui/NoxaButton.tsx` — 6 variants (`primary, secondary, ghost, danger, overlay, google`), not the target's clean 4 (Primary/Secondary/Tertiary/Destructive). Sizes: `sm:32, md:44, lg:54` — target wants standard height 56 and min target 44; current `lg` is 54, not 56. `secondary` is filled (`surfaceSoft` background), not outlined as the target requires. `danger` is a tinted fill (`primaryMuted` + `borderAccent`), not a plain outline. Button radius (`radius.button`=12) already matches. `NoxaIconButton` already enforces `Math.max(size,44)` — matches target's 44px minimum.

`NoxaFloatingActionButton` is defined but **never rendered anywhere** in `app/` or `src/` — confirmed dead code.

**Where actions compete:** `CanonicalEventDetailScreen.tsx` shows two simultaneously-visible filled/red-style buttons — the in-map "NAVIGATE" button (`CanonicalPrimaryButton variant="accent" compact`, ~line 663) and the sticky-footer "I'M GOING"/RSVP button (~line 778) — directly violating the "one filled primary per screen" rule.

**Recommended change:** Map `ghost`→Tertiary and `danger`→Destructive conceptually; change `secondary` to outlined (border + transparent/near-transparent fill) rather than filled `surfaceSoft`; bump `lg` height 54→56. Decide the fate of `overlay`/`google` (likely: keep as documented exceptions for OAuth-branded buttons, not part of the 4-variant hierarchy). On Event Detail specifically, demote NAVIGATE to a secondary/tertiary control so only "I'M GOING" remains filled.

**Risk:** Medium — `NoxaButton` is used across many existing screens; changing `secondary`'s fill or `lg`'s height affects all of them, not just the 5 reference screens.

**Presentation-only or behavioral:** Presentation-only for style; the Event Detail two-primary-buttons fix is presentation-only too (visual demotion, not new behavior).

**Dependencies:** None.

**Validation:** Grep all `NoxaButton` `variant="secondary"`/`variant="danger"` usages after the change to confirm no screen now reads as broken/invisible; Android tap-target check at 56px.

## E. Sheets / modals

**Current:** `NoxaSheet` exists (`src/components/ui/NoxaSheet.tsx`, 55 lines) but, like `NoxaCard`, is **never instantiated** anywhere in `app/` or `src/`. Its own values don't match the target anyway: background `colors.surface`(#111116) not `surfaceBase`(#0C0C10); radius `radius.xl`(20) not 28; always carries `shadows.card`, contradicting "shadow only on L3."

Instead, at least 6 independent ad hoc `Modal`-based sheets exist: `EntityActionSheet.tsx` (used by both `vehicle-details.tsx` and `CanonicalEventDetailScreen.tsx`), an inline Live-Drive-confirmation `Modal` in `app/(tabs)/index.tsx:1730-1777`, and separate `Modal`s in `crew-gallery.tsx`, `event-gallery.tsx`, `event-editor.tsx` (two), plus `CountryPicker`, `CityPicker`, `CanonicalCrewsScreen`, `ReportModal`. No bottom-sheet library (`@gorhom/bottom-sheet` or otherwise) is used anywhere — confirmed by grep, consistent with `docs/ai-design-library/08-ui-foundation-and-library-policy.md`'s decision to pause that library.

Android back handling is inconsistent per-screen: `app/onboarding.tsx` has custom multi-stage back logic; `app/visibility-setup.tsx` **fully swallows** back (`() => true`, blocking back navigation entirely); the `Modal`-based sheets rely on RN `Modal`'s own `onRequestClose`. There is no shared "safe cancel" hook.

Destructive confirmation today is `Alert.alert(..., {style:'destructive'})`, copy-pasted independently across at least 10 screens (`vehicle-details.tsx`, `settings.tsx`, `blocked-users.tsx`, `delete-account.tsx`, etc.) — no shared L3 component. `app/convoy-setup.tsx`'s host-leave case uses a **blocking notice**, not a proper Leave/End confirmation pair, and there is no "Leave drive" / "End drive" pair anywhere yet (Group Drive doesn't exist — see §K).

**Recommended change:** This is the largest architectural gap in the audit. Do not implement yet (per task instructions). The smallest safe next step is a design-only decomposition of `NoxaSheet` into a visual shell (backdrop, radius, detents, handle) versus a behavior controller (mount/unmount, Android Back → safe cancel, focus trap, Reduced-Motion-aware animation, scroll passthrough), so that a single controller can host both "Level 2 content" and "Level 3 destructive content" as the design's replace-not-stack rule requires. Building this is Stage 1+ work, not Stage 0.

**Risk:** High if rushed — this primitive underlies every reference experience's destructive-confirmation requirement (Onboarding privacy step has none, but Event/Garage/Active-Drive all need Leave/End/Delete confirmations). Get the shell/controller split right once rather than iterating six ad hoc `Modal`s into six slightly-different sheets.

**Presentation-only or behavioral:** Behavioral — Android Back handling and focus trapping are real interaction-logic changes, not styling.

**Dependencies:** None required (stay on RN `Modal` + Reanimated, per the library-policy doc's "not now" on `@gorhom/bottom-sheet`).

**Validation:** Android Back at every sheet depth; TalkBack/accessibility focus trap check; Reduced Motion check (sheet appears settled, no animation-dependent state).

## F. Motion

**Current tokens** — `src/theme/animations.ts` (full file): `press:110, micro:180, sheet:280, fast:120, base:220, slow:380, entrance:380, entranceDistance:12, pressedScale:.98, iconPressedScale:.96`.

**Mismatch:** No named constant for target's ~240ms step transition, ~320ms sheet rise, ~260ms minimise, or 1.2s participant-dot interpolation. Closest existing values (`micro:180` for fades, `sheet:280` vs target 320) are close but not equal.

`react-native-reanimated` (4.1.1) is installed and used in ~20 files, but substantive motion (not just `useReducedMotion` checks) is confined almost entirely to the vehicle-picker onboarding subflow (`src/features/garage/vehicle-picker/*`). Everywhere else — Home/Map, Event/Vehicle Detail, Garage list — motion is done with the legacy RN `Animated` API and hardcoded values: `garage.tsx:123-124` (`Animated.timing(...,{duration:420, delay:index*50})`), `welcome.tsx:39` (`transition={220}` on `expo-image`), `(tabs)/index.tsx:1370` (`animateToRegion(..., 250)`), none referencing `animations.ts`.

**Recommended change:** Add the missing named durations to `animations.ts` (`step:240, sheetRise:320, minimise:260, participantInterpolation:1200`) without removing existing ones (other screens depend on `sheet:280` etc.). Do not migrate legacy `Animated`-API call sites to Reanimated as part of Stage 0/1 — that is a larger, separate refactor with its own regression risk on already-working screens (garage stagger fade, map camera animation).

**Risk:** Low for additive tokens. The broader "everything should be Reanimated" migration is explicitly out of scope until proven necessary on 3+ V2 screens, per the library policy's dependency-gate rule.

**Presentation-only or behavioral:** Presentation-only (tokens). No dependency change — Reanimated is already canonical.

**Dependencies:** None.

**Validation:** Confirm Reduced Motion still short-circuits any new motion using existing `useReducedMotion` pattern already present in `NoxaButton`/`NoxaIconButton`.

## G. Map overlays

**Current** (`app/(tabs)/index.tsx`, 2393 lines): persistent overlays are a header bar (identity/visibility control + inline "N nearby now" living-pulse counter + All/Mine lens toggle), a conditional visibility dropdown, an **always-rendered** Recenter button, conditional permission/error notices, and a conditional `EventCard`/`RouteCard`. There is no persistent search bar, filter row, layer switcher, or floating create button (confirmed absent). No explicit "no drivers nearby" empty-state copy exists on the map screen today — zero-drivers is only implied by the counter reading 0.

| Current element | Disposition |
|---|---|
| Header identity/visibility control | keep — maps to target's "visibility chip" |
| Inline "N nearby / M events" counter | keep — maps to target's city/context line, needs copy-only adjustment |
| All/Mine lens toggle | keep — outside the 5 reference screens' explicit scope but not in conflict |
| Visibility dropdown | move to contextual surface — target routes this into the L2 "Who can see you" sheet, not an inline dropdown |
| **Recenter button** | **behavioral change required** — currently always rendered (`app/(tabs)/index.tsx:1642-1663`, no conditional wrapper); target requires it hidden while following and disclosed only after manual pan (§11 of `VISUAL_ARCHITECTURE_V2.md`). This is the one G-item that is a runtime/behavior change, not styling. |
| EventCard / RouteCard | keep, restyle — inline components today (`(tabs)/index.tsx:268-440`), candidates to become the L2 sheet content once a real sheet controller exists (see §E) |
| Driver markers (`MapboxLiveMap*`) | cannot change — native Mapbox layer, explicitly out of scope for this task |
| "No drivers" empty state | candidate for later addition — does not exist yet; adding it is new copy/UI, not currently present to reconcile against |

**Recommended change (Stage 0):** none — Map behavior is explicitly not to be touched in this task. Recorded here as the Stage 2 (Home/Map) implementation entry point.

**Risk:** The Recenter conditional-visibility change touches a P0 runtime system (Map/GPS) per `docs/ROADMAP.md` — requires care and Android validation when it is actually implemented.

**Presentation-only or behavioral:** Recenter disclosure is behavioral (conditional render tied to camera-follow state). Everything else in this section is presentation/copy.

**Dependencies:** None.

**Validation:** Android device check of pan → Recenter appears → tap → camera eases back → Recenter disappears, with no regression to existing Follow/route logic.

## H. Onboarding

**Current real flow** (traced via `router.replace`/`router.push`): `app/welcome.tsx` → sign-up/sign-in → `app/onboarding.tsx` (3 internal stages: a 4-page **intro carousel** not in the target flow at all, then a combined **Identity+City** form via `OnboardingIdentitySetup`, then **First Car** via `VehiclePicker`/`VehicleFinalizeFlow`) → `app/visibility-setup.tsx` (binary Global-4hr/Ghost choice) → `/(tabs)`.

**Target flow:** Welcome → Account → Identity → City → First Car → Privacy → Map (each as its own single-question step).

**Gaps:**
- Current has an extra intro-carousel stage the target flow doesn't have at all (target explicitly removes "feature carousel, three-dot pager" per the design brief).
- Target's discrete City step is merged into Identity today, not a separate screen.
- `visibility-setup.tsx`'s wiring from `onboarding.tsx` was not confirmed in the code read (onboarding's finish handler calls `markOnboardingComplete` + `router.replace('/(tabs)')` directly; visibility-setup appears to be reached via a separate routing guard, not confirmed here) — needs a direct read of the routing guard before any Stage 1 change, not assumed.
- `visibility-setup.tsx` currently swallows the Android back button entirely (`() => true`) — a pre-existing accessibility/UX issue independent of V2, worth fixing but not part of this audit's scope.

**Already supported (no backend work needed):** City is a real `profiles.city` column, written via `saveProfileIdentity` (`src/features/profile/profileIdentityPersistence.ts`). First car is a real `vehicles` insert via `createVehicleFromPicker`. Both target steps ("City", "First Car") already have full DB/schema support today.

**Recommended change (future stage, not now):** Split the combined Identity+City form into two single-question screens; remove or defer the intro carousel; confirm and, if needed, fix the routing path into `visibility-setup.tsx` so Privacy is reliably step 6 of 7 with a visible progress indicator, per the target's "step 4 of 6" accessibility requirement.

**Risk:** Medium — onboarding is an auth-adjacent critical path; a broken step order blocks account creation entirely. Requires full Android validation before merge (new-user flow, not just a visual screen).

**Presentation-only or behavioral:** Splitting Identity/City is presentation + minor state-machine change (one more `stage` value). Removing the carousel is presentation-only. Fixing/confirming the `visibility-setup.tsx` routing guard, if it's actually broken, is behavioral.

**Dependencies:** None.

**Validation:** Full fresh-account Android run through all 7 steps; confirm `profiles.city` and `vehicles` rows are written correctly with the split flow; confirm back-button behavior at every step.

## I. Event Detail

**Current** (`app/event-details.tsx` → `src/features/crews-events/CanonicalEventDetailScreen.tsx`, 851 lines): Header with **already-present** `···` overflow (Save/Share/Edit/Change-cover — but no Report action wired in, unlike other entities in the app) → full-bleed Hero with category pill, title, one summary sentence → a vertical 3-row "ESSENTIAL INFO" card (Time/Place/Capacity) rather than the target's horizontal 3-value row → map preview + Navigate button → "WHO'S GOING" (avatar stack + count only, no per-attendee vehicle) → Organizer card → optional gallery → Details card → sticky "I'M GOING" footer.

| Target element | Current state |
|---|---|
| Kicker | Partial — category pill functions as a kicker but isn't literal small-caps kicker text |
| Title | Present |
| Time | Present (duplicated between Hero and Essential Info) |
| 3 values as one horizontal row | **Not present** — implemented as a vertical bordered list instead |
| One sentence of context | Present (Hero's social-proof line) |
| Attendee list with cars | **Not present** — avatar stack + count only, no vehicle per attendee |
| Join (single primary) | Present, but competes with a second filled Navigate button (see §D) |
| `···` overflow (Save/Share/Report) | Save+Share+Edit+Cover present; **Report absent** |

**Recommended change:** Presentation-only restyle of the existing data into the target's kicker/title/time/3-value-row/sentence hierarchy — all the underlying data (time, place, capacity, attendees) already exists and is fetched; this is a layout change, not a new data requirement. Adding attendee vehicle info to the "WHO'S GOING" row would require confirming the attendee query already joins vehicle data (not verified in this audit — flag for the Stage 3 implementation task). Wire "Report" into the existing `EntityActionSheet` menu (the `ReportModal` component already exists elsewhere in the app).

**Risk:** Low-medium — mostly presentation-only; the attendee-vehicle-join is the one item that might be a real data-layer change and needs its own check before promising it in a PR.

**Presentation-only or behavioral:** Presentation-only, except the possible attendee/vehicle data join (flag as "verify before promising").

**Dependencies:** None.

**Validation:** Visual diff against the 5 event contexts (meet/cruise/track/drift-drag/crew) the target spec requires sharing one architecture for; confirm no regression to existing RSVP/Join Supabase calls.

## J. Garage / Vehicle

**Current:** `app/(tabs)/garage.tsx` — hero image with brand/model/year overlay, a joined meta string (not chips: `vehicleMeta()` produces `"612 hp · STAGE 2 · RWD"` as one text run), legacy `Animated.timing` stagger fade-in, `vehicleCard` styled with border+shadow (own card, not `NoxaCard`). `app/vehicle-details.tsx` — hero, owner card, a row-list "spec sheet" (Type/Year/Power/0-100/Color/Transmission/Drivetrain/Tuning/Visibility), about text. Edit routes to a **separate full-screen** `app/vehicle-editor.tsx` (not a sheet); delete is `EntityActionSheet` → `Alert.alert` destructive confirm → direct Supabase delete.

**Gaps vs target:** No spec grid/progress ring/achievement row exist today (good — nothing to remove there, the current implementation is already closer to "no gamification" than the design brief's "removed" list implies was a risk). The real gaps are: (1) meta is a plain joined string, not the target's discrete value row; (2) edit is a full separate screen, not an L2 sheet layered above the car as the target requires ("viewing and editing never share a screen" is already true, but "editing happens on an L2 sheet" is not — it's a full route); (3) vehicle-editor duplicates its own color-swatch array separately from the vehicle-picker's, a reuse gap unrelated to V2 but worth noting.

**Recommended change:** Restyle the joined meta string into the target's discrete value row (presentation-only). Converting `vehicle-editor.tsx` from a full screen into an L2 sheet is a bigger, genuinely architectural change — depends on the sheet shell/controller work in §E landing first; do not attempt before that.

**Risk:** Low for the meta-row restyle. Medium-high for the editor→sheet conversion (large existing screen, many form fields, keyboard-avoidance behavior already tuned).

**Presentation-only or behavioral:** Meta-row restyle is presentation-only. Editor→sheet conversion is behavioral/structural.

**Dependencies:** Editor→sheet conversion depends on §E's sheet controller.

**Validation:** Visual diff on stock vs. built vehicles (confirm "stock stays equal" — no "0 mods" empty cells); confirm edit/delete still write/delete the correct Supabase rows after any restructuring.

## K. Active Drive

**Confirmed: Group Drive application code does not exist**, consistent with the task's premise. No occurrence of "Group Drive"/"groupDrive" anywhere in `app/` or `src/`. What exists instead is a **crew-scoped "Convoy"** system: `app/convoy-setup.tsx` (872 lines) with real Supabase tables (`crew_convoys`, `crew_convoy_participants`), an RPC (`noxa_create_crew_convoy`), realtime subscriptions, and a `lobby → live → completed/cancelled` state machine with join/leave/ready-toggle. This is a working but crew-scoped, non-target-shaped system — it is not "Group Drive" and does not match the target's invitation/waiting-room/minimise-bar/Leave-vs-End structure. Per `docs/ai-design-library/07-mvp-screen-plan.md`, `app/convoy-setup.tsx` is an explicitly **frozen V2 screen** — it does not get redesign priority until MVP is complete, "Исключение — критический баг, блокирующий существующий MVP-путь" (exception only for a critical bug blocking an existing MVP path).

Personal (single-user) Live Drive (`src/lib/liveDrive.ts`) is separate and non-integrated with Convoy: 4-hour fixed session, background location, Ghost/Friends/Crew/Global visibility modes, entered via the onboarding Privacy step and the map header's visibility dropdown. It has no minimise bar, no Leave/End distinction (turning off is just re-selecting Ghost), and no per-participant state model — it's fundamentally single-user, not a "drive with N participants" runtime.

**Recommended change:** None in Stage 0/1. The target's Active Drive contract (§10.5 / §13 of `VISUAL_ARCHITECTURE_V2.md`) is recorded as the eventual visual target for whenever Group Drive backend work is scheduled (per `docs/ai-design-library/04-mvp-v2-boundary.md`, Convoy/complex social mechanics remain frozen until MVP runtime passes). This audit explicitly does **not** propose building Group Drive, does not touch `convoy-setup.tsx`, and does not touch `liveDrive.ts`.

**Risk:** N/A — no change proposed.

**Presentation-only or behavioral:** N/A.

**Dependencies:** Full Group Drive backend (schema, RLS, realtime) is a prerequisite not yet scheduled.

**Validation:** N/A until Group Drive implementation is scheduled as its own stage.

## Stage 0 recommended first implementation commit

**Do not implement in this task** — recorded here per the task's request for a recommendation only.

**Smallest coherent first commit: shared visual-foundation tokens only**, scoped to additive changes so nothing currently on `main` regresses:

- `src/theme/typography.ts` — add the V2 scale as new keys (`hero`, `value`, `section`, `row`, `body`, `label` — renamed to avoid collision with existing `hero`/`h1`/etc., e.g. under a `v2` sub-object) without touching existing keys.
- `src/theme/colors.ts` — add the 3 missing grey-ramp tokens (`#6E6E78`, `#3C3C46`, `#33333E`).
- `src/theme/spacing.ts` — add `xl` as the documented canonical V2 gutter (it already exists at 24 — this is a documentation/usage change, not a new token).
- `src/theme/animations.ts` — add the 4 missing named durations (`step:240`, `sheetRise:320`, `minimise:260`, `participantInterpolation:1200`).
- `src/theme/radius.ts` — add a `sheet` radius token (28) for future L2 surfaces.

**Exact files likely affected:** `src/theme/typography.ts`, `src/theme/colors.ts`, `src/theme/animations.ts`, `src/theme/radius.ts` (4 files, additive only — no existing screen imports change).

**Risk:** Low — purely additive token changes touch no existing render path, so nothing currently working can regress. The risk is entirely in the *next* commit (first screen consuming these tokens), not this one.

**Validation:** `npx tsc --noEmit`, `npm run lint`, confirm no existing screen's visual output changes (nothing consumes the new keys yet).

This intentionally excludes the P0 Live-Drive privacy fix (§0) and any Recenter/sheet/screen behavior change — those remain separate, later commits per the task's explicit instruction not to mix privacy behavior and visual-foundation work.
