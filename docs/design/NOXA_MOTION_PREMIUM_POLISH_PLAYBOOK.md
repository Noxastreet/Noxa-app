# NOXA Motion + Premium Polish Playbook

**Status:** Canonical working standard  
**Project:** NOXA mobile app  
**Stack:** React Native + Expo + TypeScript + Expo Router + Reanimated + Mapbox  
**Purpose:** Make NOXA feel premium, precise, automotive, spatial, and production-grade through motion, feedback, depth, and restrained decoration without changing product logic or destabilizing runtime.

---

## 0. Core rule

NOXA must not become “more animated”. NOXA must become **more intentional**.

Every motion, transition, haptic, overlay, blur, highlight, and micro-interaction must do at least one of these jobs:

1. explain spatial relationship;
2. confirm an action;
3. preserve context;
4. guide attention;
5. communicate hierarchy or state;
6. make direct manipulation feel physical and responsive.

If an effect does none of those jobs, it should not exist.

The visual target is not “flashy”. The target is **controlled, expensive, fast, tactile, automotive, coherent**.

---

# 1. Research before implementation

Before changing motion in production screens, build a reference set of **10–15 real premium interactions**.

For every reference, record:
- product / source;
- screen or interaction;
- what happens;
- why it feels premium;
- what product problem it solves;
- whether it fits NOXA;
- how it could map to React Native / Reanimated;
- risks for performance, accessibility, or usability.

Priority reference categories:
- Apple Human Interface Guidelines;
- high-quality iOS navigation and spatial apps;
- premium automotive apps;
- mapping apps;
- social apps with strong interaction polish;
- Mobbin references when useful;
- official React Native / Reanimated / Expo documentation.

### Rule

We do **not** copy branding or visual identity from another product. We study interaction principles, timing, hierarchy, physics, and feedback.

---

# 2. NOXA Motion System

Before screen-by-screen animation work, define one motion vocabulary.

## 2.1 Motion tiers

### Instant feedback
Use for tap acknowledgement, icon state, small toggles, and selection feedback. Target feeling: immediate.

### Short transition
Use for card state changes, small overlays, compact expand/collapse, and local content replacement. Target feeling: crisp and deliberate.

### Standard transition
Use for screen content entrance, sheets, detail expansion, route/contextual state transitions. Target feeling: smooth, confident, not slow.

### Spatial transition
Use for map object -> card, card -> detail, compact sheet -> expanded sheet, active navigation states. Target feeling: the user understands where the new UI came from.

## 2.2 Motion tokens

Implementation must use shared tokens rather than random per-screen numbers.

Canonical token families:
- `animations.press`
- `animations.micro`
- `animations.rootTab`
- `animations.sheetRise`
- `animations.spring.press`
- `animations.spring.tab`
- `animations.spring.surface`

No screen should invent its own animation curve without a documented reason.

## 2.3 Motion behavior

Preferred:
- transform;
- opacity;
- scale;
- translate;
- shared spatial continuity;
- spring physics where direct manipulation is involved.

Avoid:
- arbitrary bouncing;
- overshoot everywhere;
- large zooms;
- long fades;
- simultaneous animation of many unrelated elements;
- decorative movement that competes with the map.

---

# 3. Navigation transitions

Navigation must feel continuous.

Primary areas:
- Map;
- Crew;
- Events;
- Garage;
- Profile;
- details and secondary screens.

Goals:
- preserve orientation;
- avoid hard “web page” replacement feeling;
- make back navigation feel like reversing the previous transition;
- keep navigation fast;
- avoid heavy global transitions that delay interaction.

Rules:
1. Root tab switches remain restrained.
2. Object -> detail transitions should preserve object identity when practical.
3. Back transitions should visually return the user to the previous context.
4. Loading must not create unnecessary full-screen flashes.
5. Navigation motion must never interfere with gestures or native back behavior.

---

# 4. Cards and sheets

Cards and sheets are one of the main premium surfaces in NOXA.

Applies to driver cards, event cards, vehicle cards, route cards, contextual map sheets, Live Drive / Drive Together surfaces, and confirmation surfaces.

Required qualities:
- clean entrance;
- velocity-aware drag where applicable;
- controlled snapping;
- natural resistance;
- predictable dismissal;
- clear compact / expanded states;
- no “floating random panel” feeling.

Where practical:

`map object -> compact card -> expanded context -> detail`

The user should understand that these are different levels of the same object, not unrelated screens.

**Guardrail:** No nested rounded-card chaos. The existing NOXA cut-corner geometry remains canonical.

---

# 5. Map motion

The Map must remain the calmest and most disciplined part of the product.

Motion may be used for selected driver/event, marker state change, marker -> card relationship, route start/progress, recenter/follow, Live Drive, Drive Together, and contextual visibility state.

Rules:
1. Never animate the entire map UI at once.
2. Selection should be clear without becoming visually loud.
3. Markers should not pulse continuously unless a real product state requires it.
4. Camera motion must be predictable.
5. Recenter/follow transitions must communicate control transfer clearly.
6. Map overlays must enter from a spatially logical origin.
7. Motion must never make route progress harder to read.
8. No new MapView or GPS watcher for visual polish.

---

# 6. Micro-interactions

Premium feel comes from hundreds of tiny correct responses, not giant cinematic transitions.

Apply consistent feedback to buttons, icon buttons, cards, tabs, segmented controls, toggles, search results, selections, loading, success, errors, and destructive confirmations.

A press may use a restrained combination of:
- tiny scale compression;
- opacity change;
- surface emphasis;
- icon response;
- haptic feedback when appropriate.

Press feedback must begin immediately.

Prefer:
`idle -> pressed -> loading -> success/error -> stable`

Avoid sudden state teleportation when a small transition can explain the change.

---

# 7. Haptics

Haptics must be sparse and meaningful.

Good candidates:
- important selection;
- sheet snap;
- successful creation or confirmation;
- entering a significant state;
- destructive confirmation;
- route / drive state confirmation.

Avoid haptics for:
- every tap;
- passive scrolling;
- decorative events;
- repeated realtime updates.

Haptics must reinforce an action the user already understands visually. They must never be the only state signal.

---

# 8. Performance and technical discipline

Motion is not premium if it stutters.

NOXA motion work must preserve Mapbox runtime, GPS, realtime, authentication, privacy, Drive Together, Live Drive, navigation, and existing business logic.

Technical rules:
1. Prefer Reanimated worklets/UI-thread execution for interactive animations.
2. Avoid unnecessary shared-value reads on the JS thread.
3. Avoid animating large numbers of components simultaneously.
4. Avoid expensive blur/shadow effects in scrolling or map-heavy surfaces unless proven safe.
5. Avoid layout thrashing.
6. Do not add duplicate animation wrappers around the same interaction.
7. Do not create new MapViews, GPS watchers, backend APIs, tables, or realtime channels for animation.
8. Measure on physical devices.
9. A green TypeScript/CI check is not runtime proof.

Runtime acceptance:
- no visible jank;
- no dropped interaction response;
- no blocked gestures;
- no map camera regressions;
- no input lag;
- no navigation race conditions;
- no animation continuing after state is invalid;
- no broken reduced-motion behavior.

---

# 9. Premium decoration and depth

Decoration is the **last layer**, not the foundation.

Possible tools:
- restrained blur;
- subtle transparency;
- depth hierarchy;
- shadow only where structurally useful;
- controlled highlights;
- media transitions;
- subtle map depth;
- contextual glow/accent;
- refined loading states.

Rules:
1. No effect exists only to “look cool”.
2. No constant ambient movement without a product reason.
3. No excessive glass.
4. No neon overload.
5. No particle effects.
6. No decorative animation competing with navigation or map information.
7. Red remains an accent, not a wallpaper.
8. Deep black / graphite / white / refined grey remain dominant.
9. Cut-corner NOXA geometry remains part of the identity.
10. Circular geometry remains reserved for avatars, status dots, and intentional small orbs.

The desired feeling is **precision instrument**, not gaming HUD.

---

# Accessibility and Reduce Motion

NOXA must respect Reduce Motion.

When Reduce Motion is enabled:
- remove or simplify large spatial movement;
- avoid parallax/depth simulations that can cause discomfort;
- replace motion-only communication with static state changes;
- keep all functionality available;
- preserve haptic/text/icon feedback where appropriate.

No important information may exist only inside an animation.

---

# Implementation order

Do not animate the entire app in one PR.

## Phase A - Research + tokens
- reference library;
- motion principles;
- shared tokens;
- spring/easing presets;
- Reduce Motion policy.

## Phase B - Interaction primitives
- buttons;
- icon buttons;
- cards;
- segmented controls;
- sheets;
- press states;
- shared loading transitions.

## Phase C - Root navigation
- Map;
- Crew;
- Events;
- Garage;
- Profile.

## Phase D - Map spatial motion
- markers;
- object selection;
- cards;
- route;
- recenter/follow;
- Live Drive;
- Drive Together overlays.

## Phase E - Secondary screens
- driver/profile details;
- vehicle details;
- event details;
- search;
- notifications;
- Quick Connect;
- settings;
- editors and confirmation flows.

## Phase F - Decoration polish
Only after functional motion is stable:
- blur;
- depth;
- highlights;
- media transitions;
- refined loading;
- final haptic tuning.

## Phase G - Physical-device QA
- iPhone TestFlight;
- Android native build where relevant;
- Reduce Motion;
- low power / degraded conditions where useful;
- real map interaction;
- navigation stress test.

---

# Definition of Premium-Ready

A screen is **PREMIUM-READY** only when all are true:
- visual hierarchy matches NOXA system;
- press feedback is immediate;
- transitions explain state/context;
- animations use shared motion tokens;
- gestures remain responsive;
- Reduce Motion works;
- no business logic changed for decoration;
- no visual jank on physical device;
- no duplicate motion implementation;
- loading/error/success states feel intentional;
- haptics are restrained;
- map behavior remains correct;
- the screen feels coherent with the rest of NOXA.

If any item is missing, status remains **NOT VERIFIED**.

---

# Review status language

Use only:
- **VERIFIED** - proven in the relevant environment.
- **NOT VERIFIED** - implemented or statically checked but not proven in runtime.
- **BLOCKED** - cannot currently be validated or completed due to a concrete dependency.

Never call a motion interaction finished because the code compiles.

---

# Final QA checklist

Before merging any motion/polish PR:
- [ ] Scope is visually focused and reversible.
- [ ] No architecture expansion.
- [ ] No new MapView.
- [ ] No new GPS watcher.
- [ ] No new backend table/API solely for UI polish.
- [ ] Existing handlers preserved.
- [ ] Shared motion tokens used.
- [ ] Reduced Motion handled.
- [ ] Loading/error/disabled states checked.
- [ ] Gestures checked.
- [ ] Map camera behavior checked where relevant.
- [ ] TypeScript passes.
- [ ] Lint passes.
- [ ] Existing project contracts pass.
- [ ] Physical-device status explicitly recorded.
- [ ] Final status marked VERIFIED / NOT VERIFIED / BLOCKED.

---

# Authoritative references

## Apple
- Human Interface Guidelines - Motion
- Human Interface Guidelines - Gestures
- Reduce Motion evaluation criteria
- Rendering efficiency

## React Native motion
- Reanimated documentation
- Reanimated performance guide

## Expo
- Expo Haptics

---

# NOXA final principle

**Static UI creates identity. Motion creates behavior. Performance creates trust. Restraint creates premium feel.**

The job of the animation pass is not to impress the user with animation. The job is to make NOXA feel so coherent, responsive, physical, and deliberate that the animation itself almost disappears.
