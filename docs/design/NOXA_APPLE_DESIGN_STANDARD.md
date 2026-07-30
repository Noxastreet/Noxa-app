# NOXA Apple-Inspired Interaction Standard

**Status:** Canonical design and interaction guidance for NOXA  
**Scope:** React Native + Expo mobile application  
**Product:** Premium automotive social platform  
**Source inspiration:** Apple fluid-interface principles, adapted to NOXA rather than copied visually

## 1. Product direction

NOXA should feel calm, precise, fast, tactile, and spatially understandable.

The governing rule is:

> **Apple behavior. NOXA character.**

Use Apple's discipline around feedback, direct manipulation, motion, typography, accessibility, and predictability. Preserve NOXA's own automotive identity:

- graphite-first dark interface;
- restrained deep-red accent;
- premium automotive tone;
- map as the primary spatial context;
- matte, clean, tactile components;
- no cyberpunk overload;
- no game HUD;
- no decorative glassmorphism everywhere.

This standard extends `DESIGN_SYSTEM.md`. If the two documents appear to conflict:

1. preserve the existing NOXA product architecture and visual tokens;
2. use this document for behavior, interaction, motion, hierarchy, and UX decisions;
3. document any intentional exception before implementation.

---

## 2. Design outcomes

Every NOXA screen should make the user feel:

- **safe:** actions are predictable and recoverable;
- **oriented:** the user always knows where they are;
- **in control:** gestures can be interrupted, reversed, or cancelled;
- **fast:** feedback begins immediately;
- **confident:** hierarchy and labels are unambiguous;
- **delighted:** quality emerges from craft, not visual noise.

A screen is not successful because it looks dramatic. It is successful when a user understands it quickly and completes the intended task without hesitation.

---

## 3. Purpose before styling

Every screen must have one dominant task.

Before adding or preserving an element, answer:

- Does it help the current task?
- Does it explain the current state?
- Does the user need it now?
- Can it be moved one level deeper?
- Does it compete with the primary action?
- Does it increase cognitive load?

Do not redesign a screen from scratch without evidence that its structure is fundamentally broken.

Use this order of intervention:

1. clarify the task;
2. fix navigation and wayfinding;
3. remove duplicated actions;
4. repair hierarchy and grouping;
5. correct spacing and typography;
6. improve component consistency;
7. add motion only where it explains behavior.

---

## 4. Wayfinding and navigation

Every screen must answer within a few seconds:

1. Where am I?
2. What is available here?
3. What can I do next?
4. Where can I go?
5. How do I leave or go back?

### Canonical bottom navigation

Preserve:

- Crews
- Events
- Map
- Garage
- Profile

Rules:

- Use concrete labels, not vague categories.
- Do not duplicate tab destinations in unrelated global controls.
- Keep navigation visually quiet.
- Map may be slightly more prominent, but never a glowing floating game-style button.
- Search and notifications remain contextual stack screens or header actions.
- Similar controls must remain in consistent positions across screens.
- Destructive actions must not occupy the same visual role as routine navigation.

---

## 5. Visual hierarchy

Each screen should have one primary visual focus.

Build hierarchy using:

- order;
- scale;
- weight;
- contrast;
- spacing;
- grouping;
- depth.

Avoid simultaneously emphasizing the map, hero image, title, multiple cards, primary CTA, active tab, and decorative glow.

> If everything is emphasized, nothing is emphasized.

### Density rules

- Use negative space deliberately.
- Avoid filling every empty area with chips, dividers, metadata, or decorative labels.
- Prefer one clear decision area over several competing cards.
- Keep secondary metadata visually subordinate.
- Reveal advanced options one level deeper when they are not required for the common path.

---

## 6. NOXA visual language

The interface should feel:

- premium;
- automotive;
- dark;
- technical;
- calm;
- precise;
- cinematic only during rare brand moments.

### Red accent

Use red for:

- the primary action;
- active navigation state;
- route or live state;
- warning or critical status;
- rare brand emphasis.

Do not use red as ambient decoration across many unrelated elements.

### Forbidden patterns

- constant neon glow;
- heavy transparent glass on every surface;
- multiple strong gradients on one screen;
- thick borders around ordinary content;
- game-like gauges without functional necessity;
- excessive floating controls;
- repeated icons for the same action;
- large decorative motion behind interactive content;
- one-off colors outside the design tokens.

---

## 7. Map as the primary spatial context

The map is not a decorative background. It is the main spatial workspace of NOXA.

### General map rules

- Do not cover the map with several large panels at once.
- Preserve enough visible geography for orientation.
- Keep selected markers visible.
- Move the camera only when the movement helps maintain context.
- Do not recenter unexpectedly after user gestures.
- User gestures should pause automatic camera following, not destroy route state.
- Route, selection, and follow states must be visually distinct.

### Selected-object hierarchy

After selecting an object, there should be one dominant active state:

1. selected marker;
2. associated card;
3. one primary next action.

Avoid showing multiple equal-priority action bars for the same selection.

### Floating Map Card

Drivers, Events, and Car Meets may use a compact floating card spatially connected to the selected marker.

The card must:

- appear from a logical origin;
- keep the selected marker visible;
- avoid colliding with bottom navigation;
- show only decision-critical information;
- support a predictable close gesture;
- preserve map context;
- use the same entry and exit path;
- remain interruptible during gesture-driven dismissal.

### Commercial POI

Businesses, services, detailing, shops, partners, and other commercial POI may retain a bottom card when this clearly communicates a different object type.

Do not force every map entity into the same card pattern if object type differentiation improves comprehension.

---

## 8. Immediate response

Perceived latency breaks directness.

### Press feedback

Interactive controls must react on touch-down, not only after `onPress` completes.

Acceptable feedback:

- subtle scale reduction;
- material or brightness change;
- controlled opacity change;
- haptic feedback for meaningful actions.

Press feedback should be restrained. Ordinary buttons should not jump, glow strongly, or morph without functional reason.

### Continuous feedback

For sliders, sheets, drags, route controls, and swipes:

- update continuously throughout the gesture;
- never wait until gesture completion to show the result;
- keep content visually attached to the finger;
- preserve the grab offset;
- allow cancellation by reversing or moving away.

---

## 9. Direct manipulation and gestures

Use `react-native-gesture-handler` and `react-native-reanimated` for gesture-driven UI where appropriate.

### Gesture rules

- Track movement 1:1 after intent is established.
- Use a small movement threshold to distinguish tap from drag.
- Preserve the point where the user grabbed the object.
- Detect plausible gesture directions early, then cancel losing interpretations once intent is clear.
- Avoid recognizers that provide only a final swipe result when continuous feedback is required.
- Use generous hit targets even when icons are visually small.

### Soft boundaries

At the end of a draggable range, use progressive resistance rather than an abrupt hard stop.

The interface should communicate:

> The gesture is still being received, but there is no more content in this direction.

---

## 10. Interruptibility

Interruptibility is mandatory for user-controlled motion.

A user must be able to:

- grab a moving card;
- reverse a closing sheet;
- redirect an animated object;
- interrupt a snap animation;
- continue from the current on-screen position.

Rules:

- Never block input merely because a transition is running.
- Start a new animation from the live presentation value, not the previous logical target.
- Retarget springs without visible jumps.
- Carry current velocity through reversals when possible.
- Keep X and Y motion independently controllable for two-dimensional gestures.

Non-interruptible animation is acceptable only for brief, non-interactive brand moments where user control is not expected.

---

## 11. Motion behavior

Motion exists to:

- confirm input;
- explain spatial relationships;
- communicate state changes;
- preserve continuity;
- direct attention;
- carry gesture momentum.

Do not animate something only because animation is available.

### Default motion character

- calm;
- fast;
- critically damped;
- no unnecessary overshoot;
- no decorative bounce.

### Bounce policy

A small overshoot is permitted only when the preceding gesture carried physical momentum, such as:

- flick;
- throw;
- fast drag release;
- momentum-based snap.

Do not use bounce for:

- opening ordinary menus;
- appearing text;
- routine navigation;
- alerts;
- frequent buttons;
- loading states.

### Velocity handoff

When a drag ends, the next animation should continue from the release velocity rather than restarting from zero.

Choose snap targets using both position and gesture velocity. A fast flick should be able to commit even if the release point is not yet closest to the destination.

### Spatial consistency

- Enter and exit along the same path.
- Originate popovers, cards, and menus from their triggering source.
- Return dismissed content toward its source when spatially appropriate.
- Do not open from one edge and disappear through another without a clear reason.

---

## 12. React Native implementation guidance

NOXA currently includes:

- Expo;
- React Native;
- Expo Router;
- React Native Gesture Handler;
- React Native Reanimated;
- Expo Haptics;
- Mapbox.

Use these capabilities deliberately.

### Preferred animated properties

For frequent motion, prefer:

- `transform`;
- `opacity`;
- compositor-friendly worklet-driven values.

Avoid unnecessary animation of:

- layout-heavy dimensions;
- large blur regions;
- complex shadows;
- multiple fullscreen layers;
- large map overlays.

### Performance target

Target stable 60 FPS on a real mid-range Android device.

A design is not validated because it works in:

- Figma;
- a static screenshot;
- an iOS simulator;
- a high-end device;
- a code review alone.

Validate with runtime evidence on the actual Android build.

---

## 13. Materials and depth

Translucency communicates hierarchy; it is not a default decoration.

Appropriate uses:

- bottom navigation;
- compact map controls;
- floating map card;
- toolbar;
- modal sheet.

Rules:

- Do not stack multiple light translucent surfaces.
- Large surfaces should feel visually heavier than small controls.
- Use sufficient contrast over the changing map background.
- Use a dimming scrim for blocking modal tasks.
- Do not dim the app for a parallel, non-blocking panel.
- Prefer matte surfaces when transparency harms legibility or performance.
- Provide a more solid fallback where blur is expensive or unsupported.

---

## 14. Typography

Use platform-appropriate system typography unless a custom face has a proven product reason.

Build hierarchy from size, weight, line-height, tracking, and contrast together.

### Type rules

- Large headings use tighter line-height and slightly tighter tracking.
- Body text uses comfortable line-height and neutral tracking.
- Small labels require sufficient contrast and slightly more spacing when needed for legibility.
- Avoid many unrelated text sizes on one screen.
- Avoid low-contrast gray text over translucent or map surfaces.
- Respect system text scaling.
- Layout must survive increased font size without clipping, overlap, or inaccessible actions.

---

## 15. Haptics and sound

Use haptics only where feedback has utility.

Appropriate moments:

- successful commit;
- error;
- important state change;
- snap completion;
- route start or completion;
- destructive confirmation.

Rules:

- Visual and haptic feedback should occur at the same causal moment.
- Do not add haptics to every routine tap.
- Match haptic strength to action importance.
- Avoid delayed haptics after the visual state has already changed.

---

## 16. Accessibility

Design for:

- reduced motion;
- increased text size;
- sufficient contrast;
- adequate touch targets;
- one-handed use;
- changing map backgrounds;
- different experience levels;
- Android and iOS behavior differences.

### Reduced motion

When reduced motion is enabled:

- replace large slides and zooms with short fades;
- remove bounce and elastic overshoot;
- remove parallax;
- preserve useful state feedback through opacity, color, and static changes.

### Reduced transparency / high contrast

Where platform support or user needs require it:

- use more solid surfaces;
- reduce blur;
- add clear contrasting boundaries;
- preserve readability over maps and media.

---

## 17. Feedback and error states

Provide feedback in four categories:

- status;
- completion;
- warning;
- error.

Rules:

- Show meaningful progress while work is ongoing.
- Validate inline when possible.
- Do not wait until form submission to reveal avoidable errors.
- Warn only before genuinely risky actions.
- Use confirmation dialogs sparingly.
- Offer undo when recovery is safer and less disruptive than confirmation.
- Do not trap the user in an error state.

---

## 18. Design review process

Before approving a UI change:

1. State the screen's primary task.
2. Identify the dominant source of cognitive load.
3. Verify wayfinding.
4. Check for duplicated actions.
5. Confirm one primary visual focus.
6. Remove elements that do not help the task.
7. Verify consistency with design tokens and existing components.
8. Prototype interaction, not only appearance.
9. Test on a real device.
10. Review motion at normal speed and frame-by-frame.
11. Test rapid repeated input and gesture interruption.
12. Test loading, empty, error, offline, permission-denied, and long-content states.

### Evidence hierarchy

Use this order of confidence:

1. real-device runtime behavior;
2. reproducible development build;
3. automated checks and logs;
4. source code;
5. interactive prototype;
6. static design;
7. written intention.

A Figma frame, PR, or code presence does not prove the feature works.

---

## 19. Screen-review response format

When an AI agent or designer reviews a NOXA screen, return:

1. **Primary task**
2. **What works**
3. **Where the user may get lost**
4. **Sources of visual tension**
5. **Unnecessary or duplicated elements**
6. **Highest-priority fix**
7. **What must remain unchanged**
8. **Specific improvements without a full redesign**
9. **Motion and gesture recommendations**
10. **Accessibility concerns**
11. **Android performance risks**
12. **Score from 1 to 10**
13. **Acceptance criteria**

The review must distinguish:

- visual preference;
- usability defect;
- implementation defect;
- performance risk;
- product-architecture decision.

---

## 20. Canonical AI prompt

Use the following prompt whenever an AI system designs or reviews NOXA:

```text
You are the Design Director and Senior Interaction Designer for NOXA, a premium automotive social platform built with React Native, Expo, TypeScript, Supabase, Mapbox, React Native Gesture Handler, and React Native Reanimated.

Apply Apple-level discipline to interaction behavior, hierarchy, predictability, accessibility, typography, and fluid motion, but do not copy the visual appearance of iOS.

Preserve NOXA's identity:
- graphite-first dark interface;
- restrained deep-red accent;
- premium automotive character;
- calm matte components;
- map as the central spatial context;
- no cyberpunk overload, game HUD, or excessive glassmorphism.

For every screen:
1. Identify one primary user task.
2. Ensure the user can answer: Where am I? What is here? What can I do? Where can I go? How do I leave?
3. Remove duplicated actions and competing focal points.
4. Keep the main action visible and move uncommon options one level deeper.
5. Preserve existing product architecture unless evidence proves it must change.
6. Use immediate touch-down feedback and continuous gesture feedback.
7. Make gesture-driven motion 1:1, interruptible, reversible, velocity-aware, and spatially consistent.
8. Use critically damped spring behavior by default; permit slight bounce only after momentum gestures.
9. Use translucency only to communicate functional hierarchy.
10. Respect reduced motion, text scaling, contrast, touch targets, and one-handed use.
11. Prefer transform and opacity for frequent motion and verify stable 60 FPS on a real Android device.
12. Do not treat Figma, code, or a PR as proof of working implementation.

Do not propose a full redesign by default. First improve task clarity, navigation, hierarchy, grouping, spacing, typography, consistency, and behavior.

When reviewing a screen, return:
- primary task;
- strengths;
- wayfinding failures;
- visual tension;
- unnecessary elements;
- highest-priority fix;
- elements that must remain;
- concrete improvements;
- motion and gesture guidance;
- accessibility issues;
- Android performance risks;
- score out of 10;
- measurable acceptance criteria.

The intended emotional result is calm, control, speed, confidence, and premium automotive craft.
```

---

## 21. Final decision rule

When choosing between a more dramatic interface and a clearer interface, choose clarity.

When choosing between decorative motion and responsive motion, choose responsiveness.

When choosing between copying Apple and applying Apple's reasoning, apply the reasoning.

NOXA should not look like an application trying to prove it is premium. It should feel premium because every decision is deliberate, predictable, restrained, and well executed.
