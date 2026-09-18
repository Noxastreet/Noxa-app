# NOXA Native Frontend Audit — 2026-09-18

Status: implementation baseline for the Native Mobile UX First migration.

Canonical code inspected: `Noxastreet/Noxa-app@47b1289b0cf14574677528f48cbd59cb2944b311` (`main`).

Canonical product intent inspected:
- Notion: `Native Mobile UX First — frontend redesign baseline` (`UX-NATIVE-001`)
- NOXA Design Bible
- NOXA Screen Bible
- NOXA Component Library
- Crews & Events — MVP UX/UI Canon
- NOXA Control Center and relevant Group Drive roadmap/audit pages

Repository contracts inspected:
- `AGENTS.md`
- `DESIGN_SYSTEM.md`
- `docs/VISUAL_ARCHITECTURE_V2.md`
- `docs/audit/VISUAL_V2_RECONCILIATION.md`
- `docs/UI_RULES.md`

## 1. Current frontend map

Navigation is a root Expo Router Stack with a protected five-tab shell:

1. Crews
2. Events
3. Map
4. Garage
5. Profile

Important route families currently present in canonical main:

- Entry/Auth/Onboarding
- Map
- Events list/detail/editor/history/gallery/chat/summary
- Crews list/detail/manage/calendar/garage/gallery/chat/polls
- Garage/Vehicle list/detail/editor/picker
- Profile/public profile/edit/social list
- Group Drive lobby/active/participants/controls/location sharing/route/schedule/review/summary
- Search/Notifications/Settings/Legal

The codebase is materially ahead of parts of the Notion Screen Bible. Screen Bible status must not be used as proof of current implementation state.

## 2. Shared UI inventory

Global primitives exist under `src/components/ui`:
- NoxaScreen
- NoxaTopBar / NoxaHeader
- NoxaButton / NoxaIconButton
- NoxaListRow
- NoxaCard
- NoxaSheet
- NoxaSegmentedControl
- NoxaInput
- NoxaAvatar / NoxaBadge
- NoxaEmptyState / NoxaLoadingState

Theme tokens exist under `src/theme`:
- colors
- typography
- spacing
- radius
- shadows
- animations

Feature-specific primitive systems also exist:
- `src/features/crews-events/CanonicalPrimitives.tsx`
- `src/features/group-drive/GroupDrivePrimitives.tsx`
- large ad hoc screen-level StyleSheets, especially Map, Events/Crews, Profile, editors and secondary modules

## 3. System-level root causes

### RC1. No single composition layer

Global primitives exist, but major product families still construct their own headers, cards, status chips, actions and layout grammar. The app therefore has shared tokens without a consistently shared screen composition model.

### RC2. Cardboard UI is mostly ad hoc

`NoxaCard` is effectively unused in real screens. The wall-of-cards feeling primarily comes from repeated screen-local bordered Views, radii, shadows and named surfaces such as `infoCard`, `mapCard`, `goingCard`, `organizerCard`, `stateCard` and similar patterns.

Fixing `NoxaCard` globally would not solve the current product.

### RC3. Parallel primitive systems

Crews/Events use `CanonicalPrimitives`; Group Drive has another primitive layer; the rest of the app mixes global NOXA UI components and screen-local components.

This produces different typography, action hierarchy, density and state treatment for the same conceptual jobs.

### RC4. Page composition before user flow

Several screens are structured as hero + section + card + section + card + CTA instead of native decision sequences.

The result is strong visual composition but weak action-to-result hierarchy.

### RC5. Raw typography and uppercase are widespread

Large screens contain many direct numeric font sizes and repeated uppercase transformations. The additive `typography.v2` semantic roles exist but are not broadly consumed.

### RC6. Lists are frequently implemented as ScrollView compositions

Events, Crews, Garage and Profile use ScrollView-heavy screen structures instead of native list/feed primitives where the content model is row-oriented.

This increases manual layout work and weakens scan density and virtualization.

### RC7. Shared sheet behavior is not real yet

`NoxaSheet` is a visual View shell, not a shared modal/sheet controller. Several flows use independent React Native Modal implementations with different back/dismiss behavior.

### RC8. Product documentation and implementation state have drifted

Notion contains correct product intent, but several implementation/status records lag canonical main. GitHub main and verified runtime remain implementation truth.

## 4. Native mobile grammar

### List / Feed
- compact native header
- row-first hierarchy
- short metadata
- status only when meaningful
- one clear row interaction
- FlatList for repeating data when practical
- no decorative hero unless media itself is decision-critical
- no card wrapper for every row

### Detail
Identity
→ primary facts
→ primary action
→ contextual information
→ secondary information

Use flat L1 sections with hairline separation. L2 elevation is reserved for contextual sheets.

### Map
Map remains the dominant working surface. Overlays must preserve map context and use progressive disclosure.

### Lobby / Live
Lobby is a readiness/context surface. Live state is map-dominant and minimizes interaction while driving.

### Create / Edit
Forms prioritize input, validation, keyboard safety and one save/publish action. Avoid marketing composition.

### Sheet / Modal
Use modality for focused contextual work. Avoid stacking elevated surfaces. Android Back must safely cancel the current modal depth.

## 5. Visual rules

- Prefer responsive phone gutter from `useResponsive().gutter` rather than adding a new spacing system.
- Use existing semantic colors. Red means action, selected, live or warning, not decoration.
- Use `typography.v2` additively on migrated screens. Do not globally redefine legacy typography.
- Avoid global `NoxaButton` or theme changes until consumers are audited.
- L1 content is flat. Borders/shadows are not default grouping tools.
- 44x44 minimum interactive targets.
- One filled primary action per interaction level.
- Keep media only when it helps identity, location, timing or decision making.
- Empty/loading/error states remain compact and useful.

## 6. First reference family findings: Events

Current Events List has:
- a 286px hero artwork surface
- large date tile
- multiple pills
- uppercase title hierarchy
- inline RSVP inside the hero
- floating History control added outside the screen
- a separate `NearbyStrip`
- horizontal `MORE EVENTS` carousel
- multiple competing content treatments for the same Event entity

Trust issue:
`NearbyStrip` is not geographically derived. Its count is based on event time within seven days; the events query has no distance/location filter. The current “available around you” wording is therefore not supported by the queried data.

First pilot should:
- move History into the header
- remove giant hero treatment
- represent Events consistently as scan-friendly rows
- use the existing event detail screen for RSVP/deeper action
- replace false Nearby messaging with truthful upcoming/7-day context
- use FlatList
- preserve existing Supabase schema and event-detail routes

## 7. Migration order

Dependency-based order:

1. Events List pilot
2. Events Detail
3. Crews List
4. Crew Detail
5. Garage + Vehicle Detail
6. Profile + Public Driver Profile
7. Group Drive Lobby
8. Active Drive UI shell, preserving already verified Mapbox/runtime behavior
9. Create/Edit screens
10. Secondary Utility/Settings screens
11. Map overlays only after the shared disclosure/sheet behavior is stable

Map is intentionally not first because canonical main contains recent physical-iPhone/TestFlight-verified navigation/3D work and has the largest behavioral blast radius.

## 8. Verification gates

For every migration slice:

1. TypeScript
2. ESLint
3. relevant repository verification scripts
4. navigation/runtime smoke
5. tap and back behavior
6. loading/empty/error states
7. safe area and small-screen checks
8. physical Android acceptance where UI/navigation/gesture behavior changed
9. physical iOS/TestFlight acceptance for critical iOS flows

A passing static check is not runtime proof.
