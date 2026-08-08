# NOXA — MVP Completion Master Audit

**Status:** Canonical execution baseline  
**Snapshot date:** 2026-08-05  
**Repository:** `Noxastreet/Noxa-app`  
**Working branch:** `feat/home-map-floating-card-foundation`  
**Draft PR:** `#135`  
**Snapshot HEAD:** `2c7a045f2aaeb065e2f4d064157283af126c8959`

> This document is the single repository-owned program for completing the NOXA MVP. It covers product scope, every known route, shared components, user flows, functional behavior, privacy, backend, quality gates, execution order and AI-agent coordination.
>
> It is an audit and acceptance contract, not proof that the app works. Physical-device evidence remains required before `Done`.

## 1. Purpose

The immediate objective is to produce a coherent **static release candidate** before paid Android/iOS distribution accounts and dedicated test devices are purchased.

That means:

1. every MVP route and feature is classified;
2. visual and interaction contracts are approved;
3. implementation is internally consistent;
4. TypeScript, lint, Expo checks and diff checks pass;
5. backend changes are reviewed but not applied to production without approval;
6. known runtime checks are documented and deferred;
7. after devices/accounts are available, the exact release candidate is tested and defects are fixed.

The objective is not to expand NOXA indefinitely. It is to make the existing core product reliable, understandable and visually unified.

## 2. Mandatory source-of-truth hierarchy

When sources conflict, use this order:

1. physical Android/iOS native runtime evidence;
2. verified production behavior;
3. code merged into `main`;
4. current branch/PR diff and CI evidence;
5. repository documentation;
6. Notion product/design planning;
7. mockups, generated designs and informal conversation.

A file, design, branch, passing lint result or Notion status does not prove runtime correctness.

During the current long-lived integration effort:

- the current GitHub branch/PR is the technical implementation truth;
- repository docs are the canonical execution contract;
- Notion is the product/design index and evidence dashboard;
- designs define approved intent only after review;
- physical-device validation is deferred, not waived.

## 3. Roles

### Product owner

- owns priorities and final product decisions;
- authorizes production migrations, secrets, releases and destructive operations;
- purchases distribution accounts and devices when the static MVP candidate is ready;
- accepts or rejects known limitations.

### ChatGPT

- maintains product coherence, architecture, privacy rules and acceptance criteria;
- converts product intent into scoped Design/Code briefs;
- reviews designs, diffs, checks and runtime evidence;
- resolves conflicts between screens and domains;
- updates canonical planning documents.

### Claude Design

- turns approved requirements into visual and interaction specifications;
- provides all states, responsive behavior, motion and accessibility notes;
- does not change product scope, data access, privacy or architecture autonomously;
- does not hand implementation-ready assumptions to Claude Code before review.

### Claude Code

- inspects the real repository before acting;
- implements only the approved scope;
- reuses canonical components and tokens;
- runs available static checks;
- commits each logical checkpoint separately;
- reports limitations and deferred runtime validation;
- does not merge, release or mutate production without approval.

## 4. Current verified snapshot

PR `#135` currently contains:

- `NoxaFloatingCard` foundation;
- EventCard and RouteCard migration plus action-layout correction;
- `IdentityOrb` presentation foundation;
- canonical Group Drive architecture and privacy hardening documentation.

It does **not** contain:

- IdentityOrb integration into Mapbox driver markers;
- Driver Floating Card behavior;
- Group Drive screens, data model, migrations or edge functions;
- production Supabase changes;
- production Mapbox resource changes.

Latest reported static evidence at the snapshot HEAD:

- TypeScript: pass;
- ESLint: pass with two pre-existing unrelated warnings;
- Expo Doctor: 18/18;
- `git diff --check`: clean;
- physical Android/iOS validation: not performed.

The PR remains draft and must not be merged merely because static checks pass.

## 5. NOXA product contract

North Star:

> Ты не один в своей страсти. Прямо сейчас рядом есть свои.

NOXA is a premium automotive social platform whose psychological Home is a live map. The product helps a driver discover real nearby automotive life and move toward a real action: joining, navigating, meeting or driving together.

Non-negotiable laws:

- people before cars;
- reality before interface;
- action before engagement;
- local density before global vanity;
- no fabricated users, movement, density, urgency or social proof;
- one primary action per interaction level;
- progressive disclosure: `pin → Floating Card → Sheet → full screen`;
- identity, communication and exact location are separate trust layers;
- exact live location requires explicit scoped consent;
- stranger identity defaults to `IdentityOrb`;
- driving-critical UI is glanceable and minimally interactive;
- five functions at 10/10 are better than twenty functions at 8/10;
- V2 edge cases do not block a safe, complete MVP path.

Visual character:

- dark, calm, premium, automotive and precise;
- near-monochrome surfaces with controlled accent;
- premium through spacing, proportion, typography and restraint;
- no game HUD, cyberpunk styling, excessive glow, random gradients, dense glass or generic AI dashboard composition.

## 6. Frozen MVP boundary

### 6.1 Required MVP systems

1. Entry, authentication and account recovery.
2. Product onboarding and privacy-first visibility setup.
3. Canonical five-tab navigation: Crews / Events / Map / Garage / Profile.
4. Home/Map with real drivers, Events, route, Follow, truthful activity and safe map controls.
5. Personal four-hour Live Drive with Ghost/Friends/Crew/Global visibility.
6. Search across supported places, Events, Crews and users.
7. Crews list/detail and essential join/request/leave/admin behavior.
8. Events list/detail/editor and essential RSVP/route behavior.
9. Garage, vehicle detail and vehicle editor.
10. Own profile, public driver profile and edit profile.
11. Useful notifications and social-list navigation where required by MVP profiles.
12. Settings, blocked users, report/block, legal documents and account deletion.
13. Group Drive MVP as defined by `docs/GROUP_DRIVE.md` and the approved design contract.
14. Release foundations: configuration handling, error sanitization, accessibility, static quality, security review and later device validation.

### 6.2 Explicitly frozen or rejected for MVP

Do not improve or expand these during MVP completion unless product explicitly promotes them:

- `app/crew-chat.tsx`;
- `app/event-chat.tsx`;
- `app/convoy-setup.tsx`;
- `app/post-editor.tsx`;
- infinite/global feed;
- exact speed collection or display;
- public/open Group Drives;
- Group Drive chat, moderator role, multi-stop UI, turn-by-turn navigation, auto-rerouting, event linking, CarPlay or Android Auto;
- Mutual Wave, Scoped Chat, Coordination Cards and other advanced social-trust mechanics;
- business partner pages and commercial POI;
- broad design-system migrations such as Tamagui;
- global adoption of an unverified bottom-sheet dependency.

### 6.3 Repository routes requiring classification, not automatic polishing

These routes exist in code but are absent from or outside the canonical MVP Screen Bible. Treat them as **quarantined** until the route/reference audit proves they are needed:

- `app/crew-calendar.tsx`;
- `app/crew-gallery.tsx`;
- `app/crew-garage.tsx`;
- `app/crew-polls.tsx`;
- `app/event-gallery.tsx`;
- `app/event-summary.tsx`;
- `app/post-details.tsx`;
- any legacy route reachable only through frozen modules.

For each route, Claude Code must determine:

1. Is it reachable from an MVP route?
2. Is its database behavior required by an MVP acceptance criterion?
3. Does removing or hiding it cause a regression?
4. Should it remain preserved but unreachable, be explicitly frozen, or be promoted through a product decision?

No deletion is allowed from filenames alone.

## 7. Detailed audit modules

The complete audit is intentionally split into maintainable repository-owned modules:

1. `docs/mvp/ROUTE_INVENTORY.md` — every known route, classification and ownership.
2. `docs/mvp/UI_FOUNDATION_AND_SCREEN_AUDIT.md` — shared primitives, tokens, cleanup candidates and universal screen acceptance.
3. `docs/mvp/FUNCTIONAL_SYSTEM_AUDIT.md` — auth, navigation, Home/Map, Live Drive, Events, Crews, Garage, profiles, search, notifications, settings and Group Drive.
4. `docs/mvp/BACKEND_SECURITY_PERFORMANCE.md` — tables/functions, privacy, production controls, Mapbox, performance and static checks.
5. `docs/mvp/EXECUTION_WAVES.md` — status vocabulary, ordered delivery waves and final completion definition.
6. `docs/MVP_SCREEN_ACTION_REGISTER.md` — every target user action and required state.
7. `docs/AI_EXECUTION_PLAYBOOK.md` — prompts, review gates and operating protocol.

These modules are part of this master contract. Claude Code and Claude Design must read the relevant module before working on a wave.

## 16. Definition of MVP completion

NOXA MVP is complete only when:

- all required MVP routes are implemented and classified;
- every screen has approved visual/interaction behavior;
- all required states are implemented;
- all core actions reach real outcomes;
- V2 modules are frozen and cannot confuse the core flow;
- TypeScript, lint, Expo Doctor and diff checks pass;
- security/privacy contracts are reviewed;
- production changes have explicit runbooks and evidence;
- exact Android and iOS release candidates pass their device checklists;
- P0 defects are closed;
- documentation and Notion are synchronized to the verified state.

Until device testing, the maximum honest state is **Static PASS / Runtime pending**.
