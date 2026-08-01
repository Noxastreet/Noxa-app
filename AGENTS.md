# NOXA — AI Product, Design, and Engineering Instructions

This file is the mandatory operating instruction for ChatGPT, Codex, and any other AI agent working in this repository.

## 1. Mission

Build NOXA as a premium automotive social platform that helps drivers see real automotive activity nearby and move from observation to real-world action.

North Star:

> Ты не один в своей страсти. Прямо сейчас рядом есть свои.

NOXA is not a content-first social network, a game HUD, a generic events directory, or a police/evasion product. It is a social catalyst for drivers, Crews, Meets, Events, shared routes, and real-world automotive community.

## 2. Mandatory source-of-truth order

Before proposing or changing product behavior, read the relevant documents in this order:

1. `AGENTS.md`
2. `docs/ai-design-library/README.md`
3. `docs/ai-design-library/01-product-vision.md`
4. `docs/ai-design-library/02-product-constitution.md`
5. `docs/ai-design-library/03-home-map-mvp-spec.md`
6. `docs/ai-design-library/04-mvp-v2-boundary.md`
7. `docs/ai-design-library/06-decision-log.md`
8. `docs/ai-design-library/07-mvp-screen-plan.md`
9. `docs/ai-design-library/08-ui-foundation-and-library-policy.md`
10. Current canonical `main`, production Supabase behavior, and real runtime evidence

When documentation and runtime disagree, do not guess. Report the conflict and use verified runtime evidence as the implementation truth while preserving the approved product intent.

A Figma screen, generated mockup, open PR, code presence, or passing lint is not proof that a feature works. Native Android/iOS behavior is required evidence.

## 3. Product laws

- People before cars. The car creates context; the person creates connection.
- Reality before interface. The map and real data are the main visual layer.
- Action before engagement. Guide users toward driving, meeting, joining, or navigating—not endless scrolling.
- Depth before breadth. Five functions at 10/10 are better than twenty functions at 8/10.
- Honest emptiness. Never invent users, events, density, counts, activity, urgency, or social proof.
- Local density before global vanity. A city should feel like a real local circle.
- Progressive disclosure. Use `pin → Floating Card → Bottom Sheet → full screen` only when deeper intent exists.
- Control before convenience. Context may simplify a choice but must not silently make privacy or social decisions.
- One primary action per interaction level.
- Silence is never consent.
- Navigation is not social consent.

## 4. Visual identity

Target character:

- premium;
- minimal;
- dark;
- calm;
- automotive;
- precise;
- tactile;
- socially alive only where real data supports it.

Reference quality level:

- Apple for hierarchy, spacing, interaction clarity, and restraint;
- Porsche and Rivian for premium automotive confidence;
- Nothing for controlled technical character;
- not literal copies of any brand.

Avoid:

- game-like HUD layouts;
- excessive neon or glow;
- Cyberpunk styling;
- Need for Speed/GTA imitation;
- dense glassmorphism;
- decorative gradients without hierarchy value;
- excessive badges, pills, borders, shadows, and competing actions;
- large blocks of explanatory text where layout can communicate the same thing;
- AI-generated-looking generic dashboards.

Premium is created primarily through spacing, proportion, typography, geometry, motion discipline, and removal—not decoration.

## 5. App information architecture

Bottom navigation is canonical:

1. Crews
2. Events
3. Map
4. Garage
5. Profile

Map is the product center and must remain the most direct tab.

Home/Map must answer, in sequence:

1. Is there life nearby?
2. Where are my people or the most relevant activity?
3. What is worth choosing now?
4. How do I move to real action?

Object hierarchy on the map:

1. active people;
2. Crews;
3. Meets / Events;
4. businesses and commercial POI.

When density increases, businesses lose prominence first. People disappear last or aggregate into truthful density.

## 6. Component-system rules

The application must look like one product, not a collection of independently generated screens.

Use and improve the canonical NOXA primitives under `src/components/ui` and tokens under `src/theme`.

Required shared primitives:

- `NoxaButton`
- `NoxaIconButton`
- `NoxaTopBar`
- `NoxaBottomNav`
- `NoxaSegmentedControl`
- `NoxaCard`
- `NoxaFloatingCard`
- `NoxaSheet`
- `NoxaInput`
- `NoxaListRow`
- `NoxaAvatar` / `IdentityOrb`
- `NoxaBadge` only where status is real and necessary
- `NoxaEmptyState`
- `NoxaLoadingState`
- `NoxaToast`

Do not create a new one-off button, card, top bar, field, sheet, or spacing scale inside a screen when a shared primitive can cover it.

Do not introduce a second global styling system without an approved migration decision. Follow `08-ui-foundation-and-library-policy.md`.

### Interaction requirements

- Interactive targets should be at least 44 × 44 logical pixels unless the platform convention clearly provides an equivalent accessible hit area.
- Every icon-only control requires an accessibility label.
- Disabled, loading, selected, pressed, focused, error, and success states must be defined.
- State must not rely on color alone.
- Destructive actions must be separated from common actions.
- Primary actions must remain visually stable while asynchronous work is running.

## 7. Motion language

Use the existing `react-native-reanimated` stack for purposeful motion.

Motion exists to explain:

- spatial continuity;
- selection;
- hierarchy change;
- object arrival/removal caused by real data;
- successful action;
- screen or sheet transition.

Motion must not fabricate activity.

Default motion character:

- restrained;
- fast but readable;
- low overshoot;
- no repeated decorative bounce;
- no constant floating elements;
- no fake marker movement.

Respect the system Reduced Motion preference. Essential state changes must remain understandable without animation.

The map remains alive behind preview cards. A card changes focus, not reality.

## 8. Privacy and trust

- Identity, communication, and exact location are separate permission layers.
- Exact live location always requires explicit scoped consent.
- Public Meet participation does not automatically reveal precise GPS position.
- A stranger sees a neutral Identity Orb by default, not an unrestricted real avatar.
- Audience, purpose, and expiration must be visible before location sharing.
- Audience expansion must never occur silently.
- Ghost remains the safe default when consent or permission is absent.
- Blocking immediately removes access and visibility where applicable.

## 9. MVP scope discipline

Use `04-mvp-v2-boundary.md` and `07-mvp-screen-plan.md`.

Do not polish or expand V2 modules while an MVP screen remains incomplete. Chat, galleries, polls, convoy coordination, posts, advanced meeting confirmation, and complex social-trust mechanics do not block the MVP unless explicitly promoted through a new product decision.

When a useful idea is outside MVP:

1. record it in backlog or V2 documentation;
2. do not add runtime complexity;
3. continue the current MVP task.

## 10. Engineering workflow

For every implementation task:

1. Read the relevant product and screen specification.
2. Inspect canonical `main`; do not assume an old branch is current.
3. Inspect production Supabase schema/policies when data behavior is involved.
4. Identify the smallest user-visible outcome.
5. Reuse shared components and tokens.
6. Preserve existing working routes, auth, Live Drive, Mapbox, and Supabase behavior unless the task explicitly changes them.
7. Work in a dedicated branch and PR.
8. Run TypeScript and ESLint.
9. Record what was not verified.
10. Require Android runtime evidence before merge for visual, navigation, permission, gesture, map, and animation changes.

Never rewrite the entire app to solve one screen.

Do not add dependencies merely to avoid writing a small component. A dependency must solve a repeated, high-value problem and pass the library policy.

## 11. Screen implementation protocol

For each screen, define before coding:

- job-to-be-done;
- one primary action;
- information hierarchy;
- loading state;
- empty state;
- error state;
- offline or permission state where relevant;
- navigation entry and exit;
- reusable components introduced or reused;
- animation purpose;
- Android acceptance checklist.

A screen is not complete because it looks polished in one screenshot. It must work with real data, long text, empty data, loading, errors, keyboard, safe areas, and different Android screen sizes.

## 12. AI response and PR requirements

When proposing work, provide:

- what user problem is being solved;
- which canonical decision supports it;
- MVP or V2 classification;
- files likely affected;
- risks to existing runtime behavior;
- exact acceptance criteria.

When finishing work, report only verified facts:

- changed files;
- tests run and results;
- runtime checks performed;
- remaining limitations;
- whether the PR is safe to merge.

Do not claim implementation success from code presence alone.

## 13. Safety exclusions

Do not build:

- police tracking;
- speed-camera evasion;
- law-enforcement avoidance;
- illegal street-race organization;
- public top-speed leaderboards on public roads;
- features designed to encourage phone interaction while driving.

Driving mode must prioritize navigation, glanceability, and minimal interaction. Social discovery, chat, profile browsing, and complex input must not be promoted while the user is moving.

## 14. Stop rule

Once the main scenario is understandable, safe, and testable, stop expanding edge cases. Record rare scenarios as constraints or V2 and proceed to implementation.

> Build the smallest coherent premium system, verify it, then expand.