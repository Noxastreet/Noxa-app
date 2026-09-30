# NOXA Premium Motion Roadmap V1

**Status:** Canonical execution roadmap  
**Date:** 2026-09-30  
**Owner:** NOXA Product / Engineering  
**Applies after:** physical-device verification of the TestFlight checkpoint built from PR #328  
**Repository:** Noxastreet/Noxa-app

---

## 0. Purpose

This document is the canonical implementation order for NOXA motion, spatial interaction, haptics, premium depth, and final motion-performance QA.

The goal is **not** to maximize the amount of animation.

The goal is to make NOXA feel:
- immediate;
- spatially coherent;
- tactile;
- automotive;
- calm under load;
- premium without becoming decorative noise;
- predictable on a real device.

If a proposed effect does not improve orientation, feedback, state understanding, direct manipulation, or perceived quality, it does not enter the product.

---

# 1. Research basis

This roadmap was cross-checked against current official guidance and product patterns.

## Apple Human Interface Guidelines

### Motion
Key takeaways:
- motion must be purposeful;
- feedback should be brief and precise;
- people should not have to wait for animation to finish;
- custom motion should follow the direction and physical expectation of the gesture;
- motion must not be the only carrier of important information.

Reference:
https://developer.apple.com/design/human-interface-guidelines/motion

### Sheets
Key takeaways:
- a sheet should remain connected to the current task/context;
- on iOS a nonmodal sheet can affect the parent view without dismissing it;
- sheets should not become a substitute for hierarchical navigation.

Reference:
https://developer.apple.com/design/human-interface-guidelines/sheets

### Accessibility / Reduce Motion
Key takeaways:
- reduce automatic/repetitive motion;
- tighten springs when Reduce Motion is enabled;
- avoid unnecessary depth/zoom motion;
- replace spatial movement with simpler fades/static state changes where needed.

Reference:
https://developer.apple.com/design/human-interface-guidelines/accessibility

## Porsche Design System

Key takeaways:
- motion should be swift, subtle, and purposeful;
- shorter motion for local interactions;
- more deliberate motion only for larger spatial changes;
- Porsche defines short/moderate/long tiers around 250/400/600 ms rather than using one duration everywhere.

Reference:
https://designsystem.porsche.com/v4/tokens/motion/

NOXA will not copy these timings literally. The lesson is the tiered discipline.

## React Navigation

Key takeaways:
- bottom-tab screen transitions default to no animation;
- stack screens have platform-native/default transitions;
- custom tab transitions must be justified because they can add perceived latency;
- root navigation and detail navigation are different motion problems.

References:
https://reactnavigation.org/docs/bottom-tab-navigator/
https://reactnavigation.org/docs/stack-navigator/

## React Native Reanimated

Key takeaways:
- prefer non-layout properties such as transform and opacity;
- avoid animating too many components simultaneously;
- New Architecture animation performance must be measured, not assumed;
- physical-device profiling matters.

Reference:
https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/

## Expo Haptics

Key takeaways:
- selection feedback is appropriate for a registered selection change;
- success/warning/error haptics should represent actual state outcomes, not decoration.

Reference:
https://docs.expo.dev/versions/latest/sdk/haptics/

## Google Maps / Maps SDK

Key takeaways:
- marker selection, camera movement, and contextual actions should form one spatial chain;
- camera movement must distinguish user gestures from API/developer movement;
- programmatic camera movement must be interruptible by the user;
- marker taps are direct spatial object selection, not a request to leave the map immediately.

References:
https://developers.google.com/maps/documentation/android-sdk/events
https://developers.google.com/maps/documentation/android-sdk/marker
https://developers.google.com/maps/documentation/android-sdk/controls

## Life360

Key takeaways:
- a person/avatar on the map is the primary entry point to that person's contextual actions;
- live-location state stays attached to the map object;
- unavailable/offline location should be represented as a state of the object, not as a broken map.

References:
https://support.life360.com/hc/en-us/articles/23053527071255-See-a-Circle-Member-s-Location
https://support.life360.com/hc/en-us/articles/39407118334103-Temporary-Location-Sharing

## Strava

Key takeaways:
- route creation/editing remains map-first;
- points are manipulated directly in spatial context;
- map action -> route result should stay visually connected.

Reference:
https://support.strava.com/en-us/articles/15401660-how-do-i-create-a-route-on-the-strava-mobile-app

## Tesla

Key takeaways:
- the vehicle/status object is central;
- controls are close to the object they affect;
- important remote actions have an explicit state/result;
- status, control, and location belong to one coherent product context.

References:
https://www.tesla.com/support/tesla-app
https://www.tesla.com/ownersmanual/model3/en_gb/GUID-F6E2CD5E-F226-4167-AC48-BD021D1FFDAB.html

## Uber Base

Key takeaway:
- components and interaction patterns must behave as one system across the product rather than as screen-specific inventions.

Reference:
https://base.uber.com/

---

# 2. Non-negotiable NOXA guardrails

Throughout all eight phases:

1. Keep one Mapbox runtime.
2. Do not add a second MapView.
3. Do not add a second GPS/location watcher.
4. Do not change Supabase schema for visual polish.
5. Do not add new realtime channels for animation.
6. Do not change AUTH/privacy semantics.
7. Do not change Drive Together / Live Drive lifecycle only to make animation easier.
8. Preserve route-progress correctness.
9. Root tabs switch immediately. No full-screen root-tab cross-fade.
10. Motion uses shared tokens, not arbitrary per-screen values.
11. Reduce Motion is supported from the first PR of every phase.
12. A green CI run is not physical-device verification.
13. A motion regression blocks the next phase until fixed.
14. Existing product behavior wins over decorative ambition.

---

# 3. Canonical motion hierarchy

NOXA uses four interaction scales.

## Tier A: Press feedback
Use for:
- button press;
- icon press;
- card press;
- small selection acknowledgement.

Target:
- begins immediately;
- no visible delay;
- tiny scale/opacity response;
- no bounce spectacle.

## Tier B: Local state transition
Use for:
- segmented controls;
- toggles;
- RSVP;
- Join/Ready states;
- local loading -> result;
- marker selected/unselected.

Target:
- short;
- reversible where appropriate;
- content remains stable.

## Tier C: Contextual surface motion
Use for:
- driver card;
- event card;
- route card;
- bottom sheets;
- Drive Together panel;
- invite/add-driver surfaces.

Target:
- spatial origin is obvious;
- drag and release feel physical;
- interruption is safe;
- sheet state and map state remain synchronized.

## Tier D: Spatial/navigation transition
Use for:
- object -> detail;
- route start;
- map camera focus;
- recenter/follow;
- full contextual state changes.

Target:
- preserve orientation;
- never create a blank frame;
- user can interrupt where technically appropriate.

---

# 4. PHASE 1 - Detail screen transitions

## Goal

Make object -> detail -> back feel like one continuous interaction instead of two unrelated pages.

## First flows

Implement in this order:

1. Map -> Driver Profile -> Map
2. Map/Event Card -> Event Detail -> Map
3. Garage -> Vehicle Detail -> Garage
4. Crew -> Crew Detail -> Crew

## Step-by-step

### 1.1 Inventory current navigation
For each flow record:
- origin component;
- target route;
- current stack/navigator;
- back behavior;
- object ID;
- media/avatar available at both ends;
- loading state on target.

### 1.2 Prefer platform-native stack behavior first
Before inventing shared-element animation:
- test native/default stack transition;
- verify iOS back gesture;
- verify no black frame;
- verify destination renders immediately.

Only add custom continuity when it solves a visible product problem.

### 1.3 Preserve object identity
Where safe:
- same avatar/vehicle/event image remains visually recognizable;
- detail header does not appear from an unrelated direction;
- origin object remains available when returning.

### 1.4 Tune transition hierarchy
Rules:
- detail push may move;
- root tabs do not;
- back transition visually reverses the hierarchy;
- no scale-heavy full-screen transition.

### 1.5 Handle loading
Destination must render a stable shell immediately.
Do not show a blank screen while network content loads.

### 1.6 Reduce Motion
Use a simpler native/static/fade alternative without losing navigation meaning.

## Acceptance criteria

- no black or empty frame;
- back gesture works;
- transition never blocks interaction after visual completion;
- no duplicate navigation action;
- origin state is preserved on return;
- no Mapbox remount caused by detail navigation;
- physical-device recording confirms the four flows.

## Output

PR group: **Motion Detail Transitions**

## TestFlight checkpoint A

Create a checkpoint after Phase 1 and Phase 2 are both merged.

---

# 5. PHASE 2 - Premium cards and sheets

## Goal

Create one physical behavior for NOXA contextual surfaces.

## Surfaces

Priority order:

1. Driver Card
2. Event Card
3. Route Card
4. Drive Together Sheet
5. Invite / Add Driver
6. Quick Connect contextual surface
7. Create/Edit contextual surfaces where appropriate

## Step-by-step

### 2.1 Build sheet inventory
For every sheet define:
- modal or nonmodal;
- collapsed height;
- medium height if needed;
- expanded height if needed;
- dismiss rules;
- map interaction while visible;
- keyboard behavior;
- destructive actions.

### 2.2 Canonical detents
Do not invent arbitrary detents per screen.

Prefer:
- compact;
- contextual;
- expanded.

A surface gets only the detents its content actually needs.

### 2.3 Drag physics
- direct finger tracking;
- interrupt current spring safely;
- velocity-aware nearest target;
- resistance only beyond valid bounds;
- no teleport after release.

### 2.4 Map relationship
For map sheets:
- selected marker remains selected;
- sheet state must not unexpectedly recenter the map;
- map remains interactive for nonmodal context where product behavior requires it.

### 2.5 Dismissal
Support the correct combination of:
- drag down;
- close button;
- tapping map/background;
- route/back action.

No hidden competing dismissal behavior.

### 2.6 Haptic at detent
One light/selection haptic when the sheet actually changes stable detent.
No repeated vibration during drag.

### 2.7 Keyboard
Search/destination inputs must:
- avoid jumping the whole sheet;
- remain visible;
- restore the previous detent predictably.

## Acceptance criteria

- no snap jump;
- no gesture fight with ScrollView;
- no accidental map pan lock;
- no sheet underneath tab bar;
- no content clipped at safe areas;
- one consistent feel across Driver/Event/Route/Drive Together.

---

# 6. PHASE 3 - Map spatial interactions

## Goal

Turn Map into the strongest premium layer of NOXA.

The canonical chain becomes:

**map object -> selected state -> contextual card -> action -> route/drive state**

## Step-by-step

### 3.1 Driver marker selection
On tap:
- visually select the exact driver;
- raise hierarchy subtly;
- open Driver Card;
- do not continuously pulse;
- do not create a new MapView.

### 3.2 Event marker selection
Use the same selection grammar as drivers, with event-specific content only.

### 3.3 Deselection
Define one predictable rule:
- tap elsewhere;
- close contextual card;
- select another object.

Avoid stale selected markers.

### 3.4 Camera intent model
Explicitly separate:
- USER_GESTURE;
- OBJECT_SELECTION;
- RECENTER;
- FOLLOW;
- ROUTE_FOCUS;
- DRIVE_FOLLOW.

A user gesture must be able to break a developer-controlled camera state when appropriate.

### 3.5 Marker -> card continuity
Selection and card entrance happen as one event:
- no marker response followed by a delayed unrelated sheet;
- selected state appears immediately;
- content can load after the shell appears.

### 3.6 Card -> route
When Route is pressed:
- selected object remains identifiable;
- route overlay appears;
- camera frames route intentionally;
- ETA/km state appears without layout shock.

### 3.7 Recenter / Follow
Define visual states:
- free map;
- recenter available;
- following self;
- following route;
- following Drive Together context.

The control icon/state must explain who owns the camera.

### 3.8 Live participant movement
Realtime movement must be smooth enough to read but must not fake precision.
Interpolation must not cause:
- overshoot;
- jumping backward;
- huge mass rerender;
- camera micro-jitter.

### 3.9 Clusters / dense map
If density grows:
- selection remains deterministic;
- selected object stays above surrounding markers;
- do not animate hundreds of markers simultaneously.

## Acceptance criteria

- marker tap response is immediate;
- contextual card is synchronized;
- user can take camera control;
- follow can be re-entered intentionally;
- route progress stays correct;
- 200-user architecture assumptions are not worsened by UI animation;
- no new location watcher or realtime subscription.

## TestFlight checkpoint B

Create after Phase 3 + Phase 4.

---

# 7. PHASE 4 - Loading, success, error, empty-state motion

## Goal

Remove abrupt state teleportation and blank waiting states.

## Step-by-step

### 4.1 Classify every loading state
Use only one of:

**Initial load**
- stable shell;
- skeleton/placeholder only when useful.

**Refresh**
- keep existing content visible;
- use small refresh state;
- do not blank the screen.

**Action loading**
- action control enters busy state;
- surrounding screen stays stable.

### 4.2 Loading threshold
Avoid flashing a skeleton for very fast responses.
If content arrives quickly, transition directly.

### 4.3 Success
Use concise confirmation for:
- RSVP;
- Join Crew;
- Quick Connect success;
- Ready;
- Drive creation;
- meaningful save.

Success must resolve into the final stable state.

### 4.4 Error
Error animation must never feel playful.
Use:
- clear static message;
- restrained entrance;
- retry action;
- retained prior content when safe.

### 4.5 Empty states
No looping decorative animation by default.
A tiny one-time entrance is acceptable if it helps hierarchy.

### 4.6 Layout stability
Content arriving must not push major controls unpredictably.

## Acceptance criteria

- no blank root screen;
- no skeleton flash;
- refresh keeps content;
- success state is visible but brief;
- error state is readable without motion;
- state transitions remain correct offline/slow-network.

---

# 8. PHASE 5 - Product-wide micro-interactions

## Goal

Make every frequent action feel immediate and consistent.

## Priority matrix

### Already foundation-covered
- NoxaButton;
- NoxaPressableSurface;
- NoxaIconButton;
- segmented controls;
- root tab indicator.

These are tuned, not reinvented.

### Next controls

1. Search focus/results
2. Visibility Global/Ghost/Crew/Friends
3. RSVP
4. Join/Request/Leave Crew
5. Quick Connect
6. Add Driver / Invite
7. Ready
8. Start Drive
9. End Drive
10. route selection
11. Garage vehicle actions
12. Settings toggles
13. notification actions
14. destructive confirmations

## Step-by-step

### 5.1 Define state machine per control
Example:

idle -> pressed -> loading -> success/error -> stable

### 5.2 Eliminate duplicate feedback
Do not combine:
- scale;
- large opacity change;
- glow;
- haptic;
- toast;
- icon morph

all at once.

Usually 1–2 visual cues plus optional haptic is enough.

### 5.3 Search
- immediate focus;
- stable field;
- clear result arrival;
- keyboard-safe;
- no animated list storm.

### 5.4 Toggles and segmented choices
Selection motion follows state, not the finger after state has already changed.

### 5.5 Destructive actions
Use restraint:
- clear confirmation;
- no celebratory animation;
- error/success haptic only after real result.

## Acceptance criteria

- every press starts immediately;
- loading disables duplicate submission;
- no double navigation;
- no stale success indicator;
- same action type feels the same across screens.

---

# 9. PHASE 6 - Haptics system

## Goal

Use touch feedback as product information, not decoration.

## Canonical matrix

### Selection haptic
Use for:
- root tab actual change;
- segmented control;
- sheet detent;
- meaningful mode selection.

### Light impact
Candidate for:
- map object selection;
- primary contextual action opening;
- Ready toggle if it is a high-salience state.

### Success notification
Use only after confirmed success:
- Quick Connect completed;
- room/drive successfully created;
- meaningful save complete.

### Warning/error notification
Use only for a real actionable failure or warning.
Do not haptic every network error.

## Step-by-step

1. Inventory existing haptics.
2. Remove duplicates.
3. Create one helper/API.
4. Map product events to semantic haptic types.
5. Ensure visual feedback exists without haptics.
6. Test on physical iPhone.
7. Test repeated use so the app does not become tiring.

## Acceptance criteria

- no haptic on passive realtime updates;
- no haptic on every map marker movement;
- no haptic on scroll;
- no repeated haptic during sheet drag;
- haptic fires only after the event it represents is real.

## TestFlight checkpoint C

Create after Phase 5 + Phase 6.

---

# 10. PHASE 7 - Premium depth and decoration

## Goal

Add the final expensive visual layer only after interaction behavior is stable.

## Allowed tools

- restrained blur;
- limited transparency;
- subtle elevation/depth;
- controlled highlight;
- media continuity;
- route/map contrast refinement;
- polished skeletons;
- selected-object emphasis.

## Step-by-step

### 7.1 Surface hierarchy
Define explicit levels:
1. map/background;
2. content;
3. raised control;
4. contextual card;
5. modal/critical overlay.

Every shadow/blur must correspond to one of these levels.

### 7.2 Glass
Use only where background context matters.
Never apply glass to every card.

### 7.3 Automotive object emphasis
Borrow the Tesla principle, not its visual design:
- object/status first;
- actions attached to what they control;
- clear active/inactive state.

For NOXA this applies especially to:
- vehicle card;
- active driver;
- Drive Together leader;
- route state.

### 7.4 Red accent discipline
Red means:
- active;
- important;
- destructive where applicable;
- selected accent.

It is not a general decorative glow.

### 7.5 Media transitions
Images may fade/resolve smoothly.
Do not zoom every photo.

### 7.6 Shadows / blur performance
Any blur or heavy shadow used over Map must be performance-tested on device before becoming canonical.

## Forbidden

- particles;
- neon HUD;
- constant ambient pulse;
- permanent glowing borders;
- excessive glass;
- animation that competes with route/navigation information.

## Acceptance criteria

- depth hierarchy is obvious with animation disabled;
- visual polish does not hide map labels/routes;
- scrolling remains smooth;
- Map FPS does not regress visibly;
- app still looks premium in a static screenshot.

---

# 11. PHASE 8 - Performance + final motion QA

## Goal

Prove that premium motion did not weaken the product.

## Test matrix

### Navigation stress
Rapidly cycle:
Map -> Crew -> Events -> Garage -> Profile -> Map

Requirements:
- no black frame;
- no frozen indicator;
- no stale tab state;
- no delayed touch response.

### Detail stress
Open/back repeatedly:
- driver;
- event;
- vehicle;
- crew.

### Sheet stress
For every sheet:
- drag slowly;
- fling;
- interrupt spring;
- scroll content;
- open keyboard;
- rotate between detents;
- dismiss and reopen.

### Map stress
- pan;
- pinch;
- tilt;
- rotate;
- marker selection;
- deselect;
- route;
- cancel;
- recenter;
- follow;
- Drive Together.

### Data stress
- slow response;
- offline;
- reconnect;
- stale data;
- realtime participant update;
- location permission revoke/restore.

### Accessibility
- Reduce Motion;
- larger text where supported;
- VoiceOver-critical labels;
- no information only in animation.

### Performance
Inspect:
- visible FPS/jank;
- JS/UI-thread stalls;
- unnecessary rerenders;
- simultaneous animation count;
- Mapbox camera smoothness;
- memory growth during repeated flows.

Prefer transform/opacity over layout animation wherever possible.

## Release gate

A final motion release is not accepted until:
- CI is green;
- physical iPhone runtime is checked;
- the critical map flows are VERIFIED;
- no new blocker exists in AUTH/realtime/location/routing;
- Reduce Motion is checked;
- no black/blank transition exists.

## TestFlight checkpoint D - Motion Release Candidate

This is the final premium-motion candidate before moving to unrelated product scope.

---

# 12. PR execution order

Use focused PRs instead of one huge motion branch.

Recommended sequence:

1. **PR M1 - Detail navigation foundation**
2. **PR M2 - Driver/Event/Vehicle/Crew detail transitions**
3. **PR M3 - Canonical contextual sheet physics**
4. **PR M4 - Remaining sheet migrations**
5. **TestFlight A**
6. **PR M5 - Map selection state**
7. **PR M6 - Map camera intent / follow / recenter**
8. **PR M7 - Route contextual continuity**
9. **PR M8 - Loading/success/error system**
10. **TestFlight B**
11. **PR M9 - Product micro-interactions**
12. **PR M10 - Haptic semantic layer**
13. **TestFlight C**
14. **PR M11 - Depth/decor tokens**
15. **PR M12 - Map-safe premium decoration**
16. **PR M13 - Performance cleanup**
17. **PR M14 - Final runtime fixes**
18. **TestFlight D / Motion RC**

If a PR exposes a runtime regression, pause the roadmap and fix that regression before opening the next motion PR.

---

# 13. Screen-by-screen priority

## P0 - Must feel premium first
- Map
- Driver Card
- Route Card
- Drive Together
- Driver Profile
- Event Detail
- Vehicle Detail

## P1 - Next
- Crew
- Crew Detail
- Events
- Garage
- Profile
- Search
- Quick Connect

## P2 - Polish after core
- Notifications
- Settings
- editors/forms
- secondary confirmation screens

P2 does not block P0 runtime validation.

---

# 14. Motion timing policy

Do not blindly copy external timing values.

Use NOXA shared tokens and tune from physical-device evidence.

Direction:

- press acknowledgement: approximately 90–130 ms perceived response;
- local selection: approximately 140–220 ms;
- contextual entrance/exit: approximately 180–320 ms;
- larger sheet/detail movement: approximately 260–420 ms;
- long spatial camera movement: only as long as needed to preserve orientation, and always interruptible where appropriate.

The ranges are guardrails, not API constants.

If an animation feels noticeable as “waiting,” it is probably too slow.

---

# 15. TestFlight evidence protocol

For every checkpoint, record a 60–120 second video covering the defined flow.

Every issue is labeled:

- **VERIFIED** - observed working on physical device.
- **NOT VERIFIED** - implemented/static/CI checked only.
- **BLOCKED** - cannot currently be verified due to a concrete dependency.

Do not use “done” for runtime behavior that has only passed CI.

---

# 16. Definition of Motion Release Candidate

NOXA Motion RC is reached only when:

- root tabs are instant and stable;
- detail navigation is coherent;
- contextual sheets share one physical grammar;
- map object selection is spatially clear;
- camera ownership is predictable;
- route/Drive Together motion preserves correctness;
- loading/error/success states never create blank UI;
- micro-interactions are consistent;
- haptics are semantic and restrained;
- depth/decor is subtle;
- Reduce Motion works;
- no Mapbox/GPS/realtime regression exists;
- performance is physically VERIFIED.

---

# 17. Product principle

**NOXA should feel fast before it feels animated.**

Static identity gives NOXA its visual language.  
Motion explains behavior.  
Map continuity gives it spatial intelligence.  
Haptics give it tactility.  
Performance gives it credibility.  
Restraint gives it premium character.


---

# 18. LIVE EXECUTION TRACKER

This section is updated as work progresses and is the operational truth for the roadmap.

## Current baseline

**Physical-device evidence:** TestFlight build 62  
**Observed:** motion foundation works, but whole-screen root-tab fade produced near-black transition gaps.  
**Correction:** PR #328 removed root-tab screen fades while preserving animated tab indicator, press physics, haptics, contextual Map motion, and Drive Together sheet physics.  
**Canonical main containing the correction:** `4e449acbeaaa9981595208a94900b221192e0d09`

## Gate 0 - Post-PR #328 TestFlight verification

**Status:** NOT VERIFIED

Before Phase 1 starts, verify the next TestFlight checkpoint on a physical iPhone.

Required checks:

- [ ] Map -> Crew has no black/empty transition frame.
- [ ] Crew -> Events has no black/empty transition frame.
- [ ] Events -> Garage has no black/empty transition frame.
- [ ] Garage -> Profile has no black/empty transition frame.
- [ ] Profile -> Map has no black/empty transition frame.
- [ ] Tab indicator still animates correctly.
- [ ] Tab haptic occurs only on an actual tab change.
- [ ] Button/card press physics remain responsive.
- [ ] Driver/Event/Route contextual Map cards still enter/exit correctly.
- [ ] Drive Together sheet still opens, drags, interrupts, snaps, and dismisses correctly.
- [ ] No visible Mapbox camera/location regression.

**Gate rule:** If any black/blank transition remains, fix it before Phase 1.

## Phase status board

| Phase | Scope | Status | TestFlight gate |
|---|---|---|---|
| Gate 0 | Root-tab regression verification | NOT VERIFIED | Required before Phase 1 |
| Phase 1 | Detail screen transitions | NOT STARTED | Checkpoint A |
| Phase 2 | Premium cards and sheets | NOT STARTED | Checkpoint A |
| Phase 3 | Map spatial interactions | NOT STARTED | Checkpoint B |
| Phase 4 | Loading / success / error / empty states | NOT STARTED | Checkpoint B |
| Phase 5 | Product-wide micro-interactions | NOT STARTED | Checkpoint C |
| Phase 6 | Semantic haptics system | NOT STARTED | Checkpoint C |
| Phase 7 | Premium depth and decoration | NOT STARTED | Checkpoint D |
| Phase 8 | Performance + final motion QA | NOT STARTED | Motion RC |

## Immediate next work after Gate 0 passes

### PR M1 - Detail navigation foundation

Do not start with visual spectacle.

First:

1. inventory Map -> Driver Profile;
2. inventory Map/Event -> Event Detail;
3. inventory Garage -> Vehicle Detail;
4. inventory Crew -> Crew Detail;
5. record current navigator type and push/back behavior;
6. verify whether platform-native stack transition is already sufficient;
7. ensure every destination renders a stable shell before network data arrives;
8. preserve iOS interactive back gesture;
9. add Reduce Motion behavior;
10. add a dedicated navigation-motion CI contract.

Only after M1 is green do we add object-specific continuity in M2.

## Roadmap change-control rule

Any change to phase order requires one of these reasons:

- physical-device evidence shows a regression;
- a dependency blocks the current phase;
- a critical correctness/security/privacy issue appears;
- measured performance requires architecture-safe adjustment.

“Another animation looks cooler” is not a reason to reorder the roadmap.

## Runtime truth rule

At every checkpoint:

- CI success = implementation/static confidence only.
- TestFlight video = physical interaction evidence.
- A feature becomes VERIFIED only after the relevant physical flow is observed.


---

# 19. REFERENCE VIDEO STUDY R1 - PREMIUM SETTINGS / PERSONALIZATION INTERACTION GRAMMAR

**Source type:** user-provided reference-app screen recording  
**Video duration analyzed:** ~24.4 seconds  
**Analysis method:** frame-by-frame visual inspection at 30 fps, 1-second timeline pass, 200 ms contact-sheet pass, and 30 fps micro-sequences around key transitions.  
**Purpose:** extract reusable interaction principles for NOXA. This section records observed behavior, not product features that must be copied literally.

## 19.1 What makes the reference feel premium

The reference does not rely on one spectacular animation.

Its quality comes from a consistent stack of small behaviors:

1. navigation has clear hierarchy and direction;
2. the previous screen remains spatially related during a push;
3. local controls respond almost immediately;
4. selection changes update multiple related UI elements in the same beat;
5. screen structure stays stable while colors/states change;
6. scroll/header behavior feels native and physically connected;
7. unsaved-state feedback is persistent and calm;
8. large visual changes use crossfade/interpolation rather than hard replacement;
9. motion is concentrated at the point of interaction instead of animating the entire screen;
10. state is always visible before, during, and after the transition.

This is the interaction grammar NOXA should borrow.

---

## 19.2 Hierarchical push navigation

### Observed

On Home -> Profile, Profile -> Settings, Settings -> Appearance, Settings -> Language, Settings -> Notifications, and Settings -> Privacy:

- the destination enters from the right;
- the previous screen moves slightly left, creating shallow parallax;
- the destination visually sits above the previous level;
- the incoming screen has a rounded leading edge during the transition;
- the old screen remains partially visible for part of the push;
- there is no blank or black intermediate frame;
- the transition settles quickly.

Observed duration range is approximately **200–300 ms**, depending on the transition.

### Perceived physics

The motion feels like:
- destination layer: high-distance translation;
- source layer: low-distance parallax;
- slight depth separation;
- fast settle;
- minimal/no bounce.

The previous screen travels much less than the incoming screen. This is critical. Moving both screens the same distance would feel like a carousel rather than hierarchy.

### NOXA adoption

Apply to:
- Map -> Driver Profile;
- Map/Event -> Event Detail;
- Garage -> Vehicle Detail;
- Crew -> Crew Detail;
- Settings -> secondary settings;
- other true hierarchical pushes.

Do **not** apply to root tabs.

### Implementation rule

For custom transitions where native stack behavior is insufficient:

- incoming screen: ~100% -> 0% horizontal translation;
- outgoing screen: small negative parallax only;
- no root-level full-screen opacity fade;
- optional shallow background dim/depth;
- transition target: roughly 220–300 ms on iOS after physical tuning;
- preserve interactive back gesture;
- Reduce Motion uses simpler native/static behavior.

### Acceptance criteria

- prior screen remains visually related until destination nearly settles;
- no empty frame;
- no simultaneous large vertical movement;
- back is the visual inverse;
- object identity does not disappear before destination is understandable.

---

## 19.3 Staged content reveal under a stable shell

### Observed

The first Home -> Profile transition shows an important pattern:

- destination shell/header arrives first;
- avatar/identity becomes legible early;
- secondary metrics and lower content finish appearing shortly after;
- the screen is never empty.

This creates a perception of speed even if all content does not resolve on the exact same frame.

### NOXA adoption

Use on network-backed detail screens:

1. render navigation/header shell immediately;
2. render known identity/media immediately when already available from origin context;
3. reveal secondary information after it resolves;
4. use opacity/small translate only;
5. never gate the whole screen behind one spinner.

Especially useful for:
- Driver Profile;
- Event Detail;
- Vehicle Detail;
- Crew Detail.

### Guardrail

This is not a license for decorative stagger everywhere.

Stagger exists only when content has real information hierarchy.

---

## 19.4 Collapsible large-title header

### Observed

Deep settings screens show two header states:

**At/near top**
- large left-aligned title;
- supporting description underneath.

**After scrolling**
- compact centered title in the navigation bar;
- content uses the reclaimed vertical space.

During scroll/overscroll the title transitions between these states rather than appearing as two unrelated headers.

The recording also shows native-feeling top overscroll/rubber-band behavior.

### NOXA adoption

Candidate screens:
- Driver Profile;
- Event Detail;
- Vehicle Detail;
- Crew Detail;
- Settings;
- Search result collections where hierarchy warrants it.

Do not use on:
- Map root;
- compact contextual sheets;
- screens where the title is not primary identity.

### Motion rule

- title collapse follows scroll position;
- no delayed animation after scroll has already stopped;
- large title and compact title crossfade/translate as one system;
- user drag directly controls progress;
- overscroll may stretch space subtly, but content must not wobble independently.

---

## 19.5 Global theme transition

### Observed

Dark -> light and light -> dark do not hard-switch.

The recording shows an approximately **180–250 ms** global palette transition:

- background;
- card surfaces;
- text;
- icons;
- borders;
- accent treatment;
- toggle state

all move through intermediate values together.

There is **no structural relayout** during the theme change.

The effect is a controlled whole-system color interpolation, not a full-screen navigation transition.

### Why it works

The brain sees the same interface changing material/state instead of a new screen replacing the old one.

### NOXA adoption

This principle is useful beyond literal dark/light mode.

Use the same concept for coordinated state transitions such as:

- Global -> Ghost visibility state;
- selected route mode;
- Drive Together ready/active states;
- selected map object emphasis;
- active/inactive navigation mode;
- semantic success/error surface changes.

### Guardrail

Do not animate every color change globally.

Only use coordinated token interpolation when the whole state genuinely changes together.

---

## 19.6 Accent-color selection behavior

### Observed

Theme-color choices use:

- a row of simple circular swatches;
- selected swatch gets an outer ring/check treatment;
- selection state updates immediately;
- related preview content changes in the same interaction beat;
- primary action/review accent changes as part of the same state;
- the rest of layout does not move.

Observed visible response is roughly **100–150 ms**.

### NOXA adoption

Map this behavior to selection controls, not necessarily color customization.

Examples:
- visibility mode;
- route option;
- vehicle selection;
- Drive Together role/state;
- filter chip;
- marker category;
- event attendance state.

### Rule

When a selection affects multiple visual dependents:

**selection indicator + affected preview/state + primary action emphasis update together.**

Do not update the selected control immediately and let related UI catch up noticeably later.

---

## 19.7 Segmented/text-size/UI-style selection

### Observed

Text-size and UI-style choices follow the same pattern:

- options stay in a fixed layout;
- selected option receives border/emphasis;
- descriptive label updates;
- change count updates;
- no layout bounce;
- no giant moving pill;
- response is immediate and local.

### NOXA adoption

For NOXA segmented controls:

- selected state should be clear without oversized movement;
- use short border/surface/indicator interpolation;
- content geometry remains stable;
- avoid sliding a large selector across long distances unless spatial meaning benefits from it.

This validates the restrained `NoxaSegmentedControl` direction already in the codebase.

---

## 19.8 Toggle physics

### Observed

Notification/settings toggles:

- state reacts within roughly one interaction beat;
- thumb translates directly;
- track color updates with thumb movement;
- no bounce spectacle;
- adjacent rows do not animate;
- repeated toggling remains calm and readable.

The impression is closer to **direct mechanical state change** than decorative animation.

### NOXA adoption

Use for:
- privacy toggles;
- notification settings;
- visibility-related binary preferences;
- location-sharing preferences where appropriate;
- settings.

### Canonical toggle behavior

1. press acknowledgement begins immediately;
2. thumb translation and track interpolation happen together;
3. target state settles quickly;
4. haptic only if semantic importance warrants it;
5. row itself does not scale unless it is also a navigation action.

---

## 19.9 Live preview as immediate feedback

### Observed

Appearance changes are previewed directly in an example chat card on the same screen.

The user does not need to:
- leave settings;
- open another screen;
- imagine the result.

Changes to accent/style update the preview immediately.

### NOXA adoption

Use the principle where preview has product value.

Candidate examples:
- profile/vehicle editor preview;
- selected map marker style/state preview;
- crew identity changes;
- event cover/crop preview;
- route preference outcome preview where deterministic;
- privacy/visibility explanation preview.

### Guardrail

Do not add fake previews purely for decoration.

Preview must reduce uncertainty before commit.

---

## 19.10 Persistent unsaved-changes action bar

### Observed

After the first settings modification, a bottom action area persists with:

- current change count;
- Discard;
- Review.

As more settings change, the count increments.

The action area remains anchored while page content scrolls.

This produces three useful effects:

1. the user always knows there are pending changes;
2. destructive discard is separated from normal controls;
3. commit/review is always reachable without scrolling back to a save button.

### NOXA adoption

Only for flows that genuinely support draft/batch editing.

Strong candidates:
- Profile Edit;
- Vehicle Edit;
- Event Edit;
- Crew Edit;
- future advanced preferences with multiple pending changes.

Not appropriate for:
- instant map actions;
- RSVP;
- Ready;
- Quick Connect;
- route start.

### Motion behavior

When first dirty state appears:
- bar enters once, preferably short slide/fade from safe-area bottom;
- subsequent count changes update locally;
- bar does not repeatedly re-enter;
- on successful save, it resolves/disappears after confirmed persistence.

---

## 19.11 Selection count / dirty-state feedback

### Observed

The reference does not merely show a generic Save button.

It communicates:
- `1 change`;
- `2 changes`;
- etc.

This gives the editing session a clear state.

### NOXA adoption

For multi-edit screens:

- maintain explicit dirty-field count when technically useful;
- count only meaningful changed values;
- reverting a value should reduce the count;
- save success returns count to zero;
- stale network failure must not falsely clear dirty state.

This belongs to Phase 4/5 behavior, not only visual polish.

---

## 19.12 Scroll behavior and spatial stability

### Observed

During Appearance, Language, Notifications, and Privacy scrolling:

- cards retain stable geometry;
- the bottom review bar stays anchored;
- content scroll does not animate individual cards independently;
- top title/navigation behavior is coupled to scroll;
- list items do not bounce individually;
- large blocks move as one scroll surface.

### NOXA adoption

Important rule:

**Scroll itself is already motion. Do not layer unnecessary per-card animation on top of active scrolling.**

Therefore:
- avoid animated card entrance while user is actively scrolling;
- do not continuously scale map/list items based on scroll unless there is a concrete spatial purpose;
- sticky elements must remain truly stable.

---

## 19.13 Screen-to-screen visual continuity

### Observed

Settings subpages preserve:
- same background material;
- same card radius language;
- same icon containers;
- same row heights;
- same title grammar;
- same bottom action grammar.

Navigation motion therefore feels coherent because the destination belongs to the same visual world.

### NOXA adoption

This reinforces a core requirement:

Motion cannot rescue inconsistent UI.

For each Phase 1/2 transition pair, confirm:
- surface hierarchy matches;
- icon treatment matches;
- spacing scale matches;
- typography hierarchy matches;
- destination object visually relates to origin object.

If not, fix the mismatch before adding a sophisticated transition.

---

## 19.14 Nested hierarchy without modal chaos

### Observed

The app uses normal hierarchical pushes for settings subsections rather than turning every subsection into a bottom sheet.

This keeps depth understandable:

Settings -> Appearance  
Settings -> Language  
Settings -> Notifications  
Settings -> Privacy

### NOXA adoption

Use:
- **push** for durable hierarchical destinations;
- **sheet** for contextual/temporary map actions;
- **modal** for blocking confirmation or focused creation only.

This distinction becomes canonical:

### Push
- Driver Profile
- Event Detail
- Vehicle Detail
- Crew Detail
- Settings subsections

### Sheet
- Driver Card
- Event Card
- Route Card
- Invite/Add Driver
- contextual Drive Together controls

### Modal
- destructive confirmation;
- permission explanation when required;
- tightly scoped focused creation when a sheet is insufficient.

Do not use sheets merely because they look premium.

---

## 19.15 Navigation vs local-state motion

### Observed

The reference clearly separates:

**Navigation**
- directional translation;
- depth/parallax;
- ~200–300 ms.

**Local state**
- selection/toggle/color change;
- ~100–150 ms;
- little/no spatial travel.

**System material change**
- global palette interpolation;
- ~180–250 ms;
- no navigation movement.

This three-class separation is one of the strongest lessons from the video.

### NOXA canonical rule

Never use the same animation recipe for all three classes.

Map to shared token families:

- navigation spatial push;
- local state spring/timing;
- coordinated material/state interpolation.

---

## 19.16 Perceived latency rule

### Observed

The UI acknowledges selections before a long explanatory animation could begin.

No interaction in the recording appears to wait for decorative movement before showing state.

### NOXA adoption

For every user action:

**feedback first, completion second.**

Examples:

### RSVP
- immediate pressed/selected feedback;
- loading indicator if needed;
- server-confirmed final state;
- rollback/error if request fails.

### Ready
- immediate local response;
- confirmed shared state;
- do not wait silently for realtime roundtrip.

### Route
- immediate route-action acknowledgement;
- stable loading shell;
- route appears when ready.

### Add Driver
- immediate press/loading;
- result confirmed after actual success.

---

## 19.17 Animation sequencing

### Observed principle

When more than one thing changes, the reference does not fire unrelated animation everywhere.

Typical sequence is:

1. direct target reacts;
2. dependent state updates;
3. surrounding UI remains stable.

For navigation:

1. incoming layer begins;
2. outgoing layer parallax follows;
3. destination settles;
4. content/state becomes fully legible.

### NOXA adoption

For complex map interactions use the same order.

Example marker -> Driver Card:

1. marker selected immediately;
2. camera adjusts only if required;
3. card enters;
4. detail/action content resolves;
5. no unrelated controls animate.

Example Start Route:

1. button acknowledges;
2. route shell/status appears;
3. camera frames route;
4. ETA/km settles;
5. secondary controls update.

---

## 19.18 Depth language

### Observed

Depth is created mostly through:
- layered dark surfaces;
- subtle border contrast;
- small shadows/glows;
- source/destination parallax;
- selected outline;
- limited accent color.

It does not rely on:
- heavy drop shadows;
- giant blur;
- neon everywhere;
- background particles.

### NOXA adoption

This is highly compatible with NOXA.

For premium depth:
- use edge/border contrast before heavy shadow;
- use elevation only where interaction hierarchy requires it;
- selected map/card state may receive subtle accent edge;
- keep map labels/routes higher priority than decoration.

---

## 19.19 Motion density budget

### Observation

At almost every moment, only **one interaction family** is visually dominant.

Examples:
- screen push;
- one toggle;
- one selected swatch;
- scroll;
- theme interpolation.

The UI does not animate navigation, multiple cards, background decoration, and buttons simultaneously.

### NOXA rule

Introduce a motion-density budget:

### Low-density moment
Normal idle screen:
- optional subtle status only.

### Medium-density moment
Local interaction:
- target + directly dependent state only.

### High-density moment
Navigation/camera/sheet transition:
- suspend decorative motion;
- prioritize one spatial story.

This rule is especially important on Map.

---

## 19.20 Reference-derived timing ranges

These are **observed/estimated from the recording**, not exact source-code values.

| Interaction | Observed feel / estimate | NOXA starting range |
|---|---:|---:|
| Local selection response | ~100–150 ms | 100–180 ms |
| Toggle settle | ~100–160 ms | 100–180 ms |
| Accent/selected-state interpolation | ~100–150 ms | 100–180 ms |
| Theme/material transition | ~180–250 ms | 180–260 ms |
| Hierarchical push/back | ~200–300 ms | 220–300 ms |
| Sticky action bar entrance | short, single entrance | 180–260 ms |
| Collapsible title | directly driven by scroll | gesture-driven |

These ranges must be tuned on TestFlight hardware.

---

# 20. REFERENCE R1 -> NOXA ROADMAP MAPPING

The reference study modifies the eight phases as follows.

## Phase 1 additions - Detail transitions

Add:
- hierarchical push with shallow source parallax;
- no blank transition frames;
- optional rounded incoming edge only if it matches native implementation cleanly;
- stable shell before async content;
- staged secondary content reveal;
- collapsible large-title pattern for appropriate detail screens;
- push/back symmetry.

### Phase 1 new acceptance items

- [ ] incoming detail enters with clear hierarchy;
- [ ] source moves less than destination;
- [ ] back visually reverses the push;
- [ ] header shell is visible immediately;
- [ ] async content does not blank the destination;
- [ ] large-title collapse, if used, is scroll-driven;
- [ ] no decorative stagger beyond information hierarchy.

---

## Phase 2 additions - Cards and sheets

Add:
- preserve one dominant motion story;
- anchored persistent actions remain spatially stable;
- avoid turning durable navigation destinations into sheets;
- bottom action bars, if present, enter once and remain stable;
- direct target reaction precedes dependent surface motion.

### Phase 2 new acceptance items

- [ ] sheet motion does not compete with active scroll;
- [ ] sticky actions remain physically stable;
- [ ] sheet is used because context is temporary, not because sheets look premium;
- [ ] local controls inside sheet remain faster than sheet motion.

---

## Phase 3 additions - Map spatial interactions

Add the sequencing rule:

### Marker selection
1. immediate selected marker state;
2. optional camera response;
3. contextual card entrance;
4. content resolution.

### Route start
1. action acknowledgement;
2. route-status shell;
3. camera frame;
4. route/ETA data;
5. secondary controls.

Add motion-density budget:
- no decorative background movement during camera transitions;
- do not animate multiple marker families while a camera move is active.

---

## Phase 4 additions - Loading / success / error

Add:
- stable shell first;
- staged data reveal based on information priority;
- no full-screen spinner if origin already knows enough to build the destination shell;
- retain dirty state on save failure;
- use coordinated material interpolation for major semantic state changes when appropriate.

---

## Phase 5 additions - Micro-interactions

Add:
- local selections target 100–180 ms starting range;
- selected control + dependent preview update in the same beat;
- fixed geometry during selection;
- toggles use direct mechanical thumb/track motion;
- do not scale an entire settings row for a simple toggle;
- explicit pending-change count for multi-edit flows where applicable.

---

## Phase 6 additions - Haptics

Haptics must follow the reference's low motion-density philosophy.

Add:
- do not pair every local animation with haptic;
- for toggles, default to visual/mechanical feedback unless state importance justifies haptic;
- navigation pushes do not require haptic by default;
- batch-edit dirty-count changes do not haptic;
- final confirmed save may use success haptic.

---

## Phase 7 additions - Depth / decoration

Add:
- prefer border/elevation hierarchy over heavy shadow;
- selected state can use a restrained accent edge/ring;
- large material/theme changes interpolate without relayout;
- one accent family at a time;
- avoid simultaneous glow + scale + blur + shadow.

---

## Phase 8 additions - Performance QA

Add tests for:

### Navigation
- source/destination parallax remains smooth at 60 fps target;
- no blank frame under repeated push/back;
- large-title collapse does not jank during fast scroll.

### Settings/editing
- rapidly toggle 10+ controls;
- repeatedly change segmented selections;
- verify anchored dirty-action bar remains stable;
- verify preview updates do not rerender the entire screen unnecessarily.

### Map
- ensure motion-density budget is respected during camera transitions;
- no hundreds-of-marker animation burst.

---

# 21. NEW CANONICAL INTERACTION RULES FROM REFERENCE R1

These rules become part of NOXA motion review.

1. **Hierarchy moves farther than context.**  
   Incoming destination may travel substantially; outgoing context only parallax-shifts.

2. **State moves less than navigation.**  
   Local selection should rarely move large distances.

3. **Feedback precedes network completion.**  
   The user must know the tap registered immediately.

4. **One motion story at a time.**  
   Do not animate unrelated layers simultaneously.

5. **Stable geometry is premium.**  
   State changes should prefer color/border/opacity/short transform over layout jumps.

6. **Scroll is already an animation.**  
   Avoid redundant card animations while the user scrolls.

7. **Preview uncertainty away.**  
   If a setting materially changes appearance/behavior and preview is useful, show it immediately.

8. **Dirty state is visible.**  
   Multi-edit flows explicitly communicate pending changes.

9. **Material transitions do not masquerade as navigation.**  
   Whole-system color/state changes interpolate in place.

10. **Push, sheet, and modal have different jobs.**  
    Choose by interaction semantics, not visual fashion.

11. **The destination shell must beat the data.**  
    Known context renders immediately; network details follow.

12. **A premium transition remains understandable at half speed.**  
    If slowing the motion exposes unrelated elements moving for no reason, the transition is too complicated.

---

# 22. REFERENCE R1 CHECKLIST FOR FUTURE PR REVIEWS

For any motion PR, reviewers ask:

- [ ] Is this navigation, local state, or material/state interpolation?
- [ ] Is the chosen motion class appropriate?
- [ ] Does direct feedback start immediately?
- [ ] Is geometry stable where it should be?
- [ ] Are dependent states synchronized?
- [ ] Is more than one unrelated motion story running?
- [ ] Does the old context remain understandable during hierarchy change?
- [ ] Could a stable shell render earlier?
- [ ] Is this a push that was incorrectly implemented as a sheet?
- [ ] Is this a sheet that was incorrectly implemented as a full page?
- [ ] Does scroll already provide enough movement?
- [ ] Does Reduce Motion still communicate the same state?
- [ ] Does the interaction remain clear without haptics?
- [ ] Has this been physically checked on TestFlight?



---

# 23. ACCELERATED EXECUTION MODE

**Activated:** 2026-09-30

The Product Owner explicitly selected accelerated delivery. From this point, NOXA does not create a TestFlight build for every small motion PR.

## Rules

1. Every implementation PR still runs full Quality/CI.
2. Small compatible PRs are grouped into one runtime batch.
3. TestFlight is created only at meaningful physical-device checkpoints.
4. A failed CI contract still blocks merge.
5. A physical regression found at a batch checkpoint blocks the next batch.
6. Runtime evidence is evaluated across the whole batch, not per tiny diff.

## Batch checkpoint policy

### Batch A - Detail hierarchy + sheet foundation
Includes:
- PR #333 - detail navigation foundation;
- PR #334 - premium shared EntityActionSheet physics;
- PR #335 - unified detail header interactions;
- PR #336 - staged detail content reveal.

**Canonical main:** `4cd770c5f3ea704578a5e6f45a70f2a848446ca1`  
**Implementation status:** MERGED / CI VERIFIED  
**Physical-device status:** NOT VERIFIED  
**TestFlight:** one combined checkpoint queued.

Required Batch A physical checks:
- root tabs have no black/blank gap;
- Map -> Driver Profile push/back is coherent;
- Map/Event -> Event Detail push/back is coherent;
- Garage -> Vehicle Detail push/back is coherent;
- Crew -> Crew Detail push/back is coherent;
- native iOS back gesture remains functional;
- detail shell appears before async content;
- loaded content reveals without layout jump;
- header controls have consistent spring feedback;
- shared action sheet rises smoothly;
- action sheet drag can interrupt its spring;
- velocity dismissal works;
- backdrop and sheet dismiss together;
- action fires only after sheet dismissal;
- Reduce Motion remains functional;
- no visible Mapbox/GPS/realtime regression.

## Next batch after A passes

### Batch B - Map spatial interaction + state continuity
Planned focus:
- marker selected state;
- marker -> contextual card sequencing;
- camera ownership model;
- recenter/follow states;
- card -> route continuity;
- route shell + ETA/km reveal;
- loading/success/error continuity around map actions.

No TestFlight is required between individual Batch B PRs unless a critical runtime-risk change is introduced.


---

# 24. PHYSICAL RUNTIME VIDEO REVIEW - 2026-09-30

**Evidence:** two iOS screen recordings supplied by the Product Owner on 2026-09-30.  
**Build number:** not visible in the recordings, so these videos are treated as physical runtime evidence without assigning a TestFlight build number.

## What is already working visually

- Root tab switching stays spatially stable with no observed black/blank interstitial frame.
- Native hierarchical push/back behavior is visible across Create Event, Garage setup, Edit Profile, Settings and Event Detail.
- The Map remains mounted and visually stable while contextual UI changes.
- Event selection already communicates selected state clearly.
- The shared Event action sheet reads as a distinct bottom-sheet interaction rather than a full-page navigation.
- Map camera movement, route line rendering and focused navigation are functioning in physical runtime.
- Sticky bottom actions in Create Event remain usable around keyboard and long-form content.
- The bottom navigation remains visually anchored during ordinary root-screen use.

## Runtime motion issues visible in the recordings

### 1. Drive Together sheet still changes state by layout jump

Observed during:
- destination selection;
- participant selection;
- waiting-room state;
- room controls.

Problem:
- the same bottom region changes height/content too abruptly;
- internal controls appear/disappear as separate layouts rather than one continuous sheet state;
- the user can perceive component replacement instead of state progression.

Required fix:
- preserve one stable sheet shell;
- animate internal state with short opacity/translate transitions;
- use measured snap points for compact / destination / participants / waiting states;
- keep the map visually continuous behind the sheet;
- do not create another MapView or route runtime.

### 2. Live Drive confirmations are still generic center modals

Observed:
- audience-change confirmation;
- start 4-hour Live Drive confirmation.

Problem:
- they visually belong to a different interaction system than NOXA sheets;
- fade-in center cards feel generic next to the new premium sheet language.

Required fix:
- move to one canonical NOXA confirmation surface;
- coordinated backdrop fade + restrained material entrance;
- no drag-to-dismiss for consent/privacy confirmations;
- explicit Cancel / Confirm hierarchy;
- preserve all current privacy copy and business logic.

### 3. Native iOS alert remains for destructive Drive Together cancellation

Observed:
- "Cancel Drive Together?" system alert.

Problem:
- breaks the NOXA visual/motion language at a high-attention moment.

Required fix:
- replace only the presentation layer with canonical NOXA destructive confirmation;
- keep the exact existing destructive action semantics;
- no new backend state or cancellation logic.

### 4. Visibility popover needs anchored motion

Observed:
- Global / Friends / Ghost menu.

Problem:
- appears/disappears almost as a static block;
- does not visually communicate that it belongs to the avatar/visibility control.

Required fix:
- anchored fade + short scale/translate from the trigger;
- selected mode changes in place;
- privacy confirmation remains a separate confirmation interaction when required.

### 5. Event Card -> Route transition still reads as two UI states

Observed:
- Event Card;
- route request;
- Route Card;
- camera fit;
- ETA / km.

Problem:
- the sequence is functional but visually separable.

Status:
- **Batch B B3** directly addresses this with immediate loading shell, fixed geometry, short state reveal and camera fit after route-state commit.

### 6. Driver/Event object focus needs one shared spatial beat

Observed:
- event marker selection has clear selected state;
- driver selection was not fully exercised in these recordings.

Status:
- **Batch B B4/B5** addresses shared selected-driver state and selected-state -> camera-focus sequencing.

### 7. Bottom-tab and small control press feedback remains understated

Observed:
- root tab changes are stable, but press feedback itself is visually minimal.

Required later:
- shared micro spring/opacity response;
- optional restrained haptic only on meaningful mode changes;
- no animated tab-bar translation or decorative bounce.

## Physical evidence status from these recordings

### VERIFIED from video
- root tab transitions do not show a visible black/blank gap;
- Map remains mounted through the exercised flows;
- Event Detail push/back is coherent;
- Event action sheet opens as a bottom sheet;
- Map event selection and route rendering function in runtime;
- focused route/navigation UI can enter and exit;
- Create Event long-form + keyboard interaction remains usable.

### NOT VERIFIED by these recordings
- Driver Profile push/back specifically;
- Vehicle Detail push/back specifically;
- Crew Detail push/back specifically;
- action-sheet drag interruption;
- velocity-based sheet dismissal;
- Reduce Motion;
- haptic behavior;
- exact realtime location accuracy;
- long-duration Live Drive reliability;
- selected-driver marker treatment from Batch B.

## Batch C - Contextual sheets + confirmations

After Batch B physical checkpoint, priority order:

1. Drive Together stable multi-state sheet;
2. canonical Live Drive privacy confirmation surface;
3. canonical destructive Drive Together cancellation confirmation;
4. visibility popover anchored motion;
5. Quick Connect internal scanner/result state continuity;
6. remaining map/contextual sheet snap-point consistency.

## Batch D - Micro-interactions + final tactile layer

After sheet/confirmation behavior is stable:

1. root tab press response;
2. small icon/button press springs;
3. segmented/toggle mechanical motion;
4. selective haptics;
5. final depth/blur/highlight pass;
6. Reduce Motion physical QA;
7. final performance/jank pass on physical iPhone.



---

# 25. BUILD 64 PHYSICAL CHECKPOINT - BATCH B

**Evidence:** iOS screen recording supplied by Product Owner on 2026-09-30.  
**Runtime:** physical iPhone, installed TestFlight build 64.

## VERIFIED on build 64

- root-tab switching shows no black/blank transition frame;
- Map remains mounted through the exercised flows;
- Event marker selection is immediate and visually clear;
- Event contextual card opens without a duplicate preview layer;
- Event -> Route shows a stable route shell rather than a blank handoff;
- route line renders;
- ETA / distance remain visible during route interaction;
- camera fit follows route-state commit without a visible blank frame;
- manual map interaction does not destroy the route state;
- Event Detail push/back remains coherent;
- the updated Map motion does not visibly regress root navigation.

## NOT VERIFIED on build 64

- ordinary driver-marker tap -> selected-driver emphasis;
- ordinary driver-marker tap -> canonical Driver Card without duplicate preview;
- driver card -> Profile flow;
- Active Group Drive participant selected-marker treatment;
- long-running follow/recenter behavior;
- Reduce Motion;
- haptic semantics.

These items remain runtime NOT VERIFIED rather than failed.

## Batch B status

**Event / Route / camera continuity:** VERIFIED  
**Driver-marker continuity:** NOT VERIFIED  
**Overall Batch B:** PASS WITH LIMITATIONS

The remaining driver-marker checks do not block accelerated Batch C development because no regression was observed in build 64 and the unverified cases are isolated runtime checks.

## Build 64 new confirmation for Batch C

Drive Together still changes its internal sheet content too abruptly between:
- destination selection;
- driver selection;
- waiting-room state;
- room controls.

The outer sheet physics are acceptable. The problem is the instantaneous replacement of the inner content tree.

### C1 target

Keep one mounted Drive Together sheet shell and animate only the internal semantic stage:
- create destination;
- choose drivers;
- waiting room;
- active room;
- invite;
- loading.

Use:
- short local-state fade;
- existing sheet spring for snap movement;
- system Reduce Motion;
- no second MapView;
- no new GPS or realtime runtime.



---

# 26. BATCH C - CONTEXTUAL CONTINUITY CHECKPOINT

## Implementation set

### C1 - Drive Together internal stage continuity
**Status:** MERGED / CI VERIFIED

- one existing Drive Together sheet shell remains mounted;
- destination / drivers / waiting / active / invite / loading use short local transitions;
- existing drag/snap physics remain intact;
- no Mapbox/GPS/realtime architecture change.

### C2 - Canonical confirmations
**Status:** MERGED / CI VERIFIED

- one NOXA confirmation surface replaces Home/Map Live Drive center modals;
- Drive Together Cancel / End / Leave no longer use system alerts;
- privacy copy and audience semantics remain unchanged;
- destructive backend calls remain unchanged;
- destructive confirmation remains visible while the backend action commits.

### C3 - Visibility popover
**Status:** MERGED / CI VERIFIED

- Global / Crew / Friends / Ghost opens from the map identity trigger with restrained anchored motion;
- radio semantics and privacy confirmation path remain unchanged;
- Reduce Motion supported.

### C4 - Quick Connect internal continuity
**Status:** IMPLEMENTED / CI PENDING

- stable Quick Connect screen shell;
- short semantic transitions between Share / Connect / Scanner / Preview / Success;
- existing QR, camera permission, resolve, redeem and already-friends behavior untouched;
- no location/GPS behavior added.

## Batch C physical checkpoint

Create **one** TestFlight only after C4 is merged.

Required checks:

- [ ] Drive Together destination -> driver selection transition no longer hard-jumps.
- [ ] Drive Together waiting -> active/room controls remains one continuous sheet.
- [ ] Drive Together drag/snap still works after internal stage animation.
- [ ] Live Drive start confirmation uses the NOXA bottom confirmation surface.
- [ ] Live Drive audience-change confirmation uses the same surface.
- [ ] Cancel Drive Together no longer opens the native iOS alert.
- [ ] End/Leave Drive Together uses the canonical destructive confirmation.
- [ ] destructive confirmation remains visible while processing.
- [ ] visibility popover opens from the identity control without a static pop.
- [ ] Global/Crew/Friends/Ghost behavior is unchanged.
- [ ] Quick Connect Add Driver -> Scanner is continuous.
- [ ] Scanner -> Preview is continuous.
- [ ] Preview -> Connected success is continuous.
- [ ] Quick Connect QR scan and manual code entry still work.
- [ ] no Mapbox/GPS/realtime regression.
- [ ] no root-tab black/blank transition regression.

## Batch C gate

If the above critical flows pass, move to **Batch D: product-wide micro-interactions, semantic haptics, depth/decor, and final iPhone performance QA.**
