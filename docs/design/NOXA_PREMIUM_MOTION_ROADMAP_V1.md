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
