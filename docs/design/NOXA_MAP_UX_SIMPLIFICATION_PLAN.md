# NOXA Map UX Simplification Plan

**Status:** Canonical UX architecture plan  
**Scope:** Default Map hierarchy, Visibility Setup, notices, selected-object states  
**Parent roadmap:** GitHub issue #108  
**Product decision:** GitHub issue #111  
**Execution issue:** GitHub issue #112

## 1. Objective

The NOXA Map must feel like a calm spatial workspace, not a dashboard layered over geography.

The primary job of the default state is:

> Discover nearby automotive activity, understand current visibility, and select one map object.

Every persistent overlay must directly support that job.

## 2. Current-state audit

The current Map can show all of these surfaces at once:

- NOXA logo;
- online-count pill;
- Search;
- Notifications;
- All / Drivers / Events filters;
- Visibility control;
- expanded Visibility menu;
- sharing notice;
- permission notice;
- location error notice;
- Nearby summary with driver and event counts;
- Recenter;
- bottom navigation;
- Event Card or Route Card.

This creates four structural problems.

### 2.1 Duplicate status

The online-count pill and Nearby summary communicate overlapping activity counts in different parts of the screen.

### 2.2 Excessive permanent surfaces

Multiple pills, cards, notices, controls, and bars split the map into small visual zones. The user sees interface chrome before geography.

### 2.3 Mixed control categories

Content filters and visibility mode currently occupy the same visual level even though they answer different questions:

- filters: what should I see on the map?
- visibility: who can see me?

### 2.4 Error dominance

Sharing, permission, and location errors can stack vertically. A technical failure can become the strongest visual object on the screen.

## 3. Canonical hierarchy

### 3.1 Persistent elements

Only these elements remain visible in the default state:

1. Compact header.
2. One content-filter group.
3. Visibility control.
4. Recenter control.
5. Bottom navigation.

### 3.2 Contextual elements

These appear only when required:

- first-run Visibility Setup;
- one recoverable notice;
- selected-object card;
- Route Card;
- loading indicator;
- temporary empty-state helper.

### 3.3 Elements removed from the permanent state

- online-count pill;
- permanent Nearby summary;
- multiple simultaneous notice banners;
- expanded Visibility options before user interaction.

## 4. Target default layout

```text
Top safe area
┌ NOXA                         Search  Bell ┐
│ All   Drivers   Events                    │
│                                             │
│                 MAP                         │
│                                             │
│                              Ghost           │
│                              Recenter         │
└ Crews  Events  Map  Garage  Profile ┘
```

The map remains the largest uninterrupted visual area.

## 5. Header

Preserve:

- compact NOXA logo on the left;
- Search on the right;
- Notifications on the right.

Remove:

- permanent online-count pill.

Reason:

The count duplicates Nearby information, adds another bordered surface, and does not enable an immediate action.

## 6. Filters

Preserve one calm segmented group:

- All;
- Drivers;
- Events.

Rules:

- do not show counts by default;
- use one active state;
- avoid strong glow;
- keep the group visually subordinate to selected map content;
- do not combine visibility modes with content filters.

## 7. Visibility architecture

Visibility is a safety and presence control, not a content filter.

Place Visibility and Recenter in one location-control stack on the right side above bottom navigation.

### Ghost state

Show a compact control:

```text
Ghost
Recenter
```

### Active state

Show mode and remaining time:

```text
Global · 3h 42m
Recenter
```

Equivalent labels apply to Friends and Crew.

Rules:

- the active sharing state must remain continuously visible;
- selecting Ghost must be reachable in one or two taps;
- the Visibility menu opens only after explicit user interaction;
- the control must not cover a selected marker or card;
- active sharing may use restrained red emphasis;
- Ghost must not be visually punished or hidden.

## 8. First-run Visibility Setup

After the existing product onboarding:

1. Open Map.
2. Present a one-time Visibility Setup sheet.
3. Explain Live Drive before requesting system permissions.
4. Primary action: `Go Global for 4 hours`.
5. Secondary action: `Continue in Ghost`.
6. Request permissions only after the user chooses a sharing mode.
7. On success, collapse the decision into the compact Visibility control.
8. On denial or failure, remain in Ghost.

Canonical copy direction:

### Title

`Be part of the live map`

### Body

`Let nearby drivers discover you while you drive. Your location is shared for up to 4 hours and can be turned off at any time.`

### Primary action

`Go Global for 4 hours`

### Secondary action

`Continue in Ghost`

Privacy rules:

- never start Global automatically;
- never preselect consent;
- never request background permission before explanation;
- remember preferred mode only as a convenience;
- never automatically restart sharing after login;
- onboarding replay must not reopen or restart sharing.

## 9. Notice arbitration

Only one notice may be visible at a time.

Priority order:

1. sharing-safety failure;
2. location permission or device-location failure;
3. route failure;
4. transient data refresh failure.

Each notice must contain:

- one short human-readable message;
- at most one recovery action;
- no raw native, Mapbox, Supabase, or stack-trace text.

Examples:

```text
Location is off. Open Settings to use Recenter.
```

```text
Live Drive could not start. You are still in Ghost.
```

```text
Route unavailable. Retry when your connection returns.
```

Notices must not push the whole control layout downward through stacked offsets.

## 10. Empty states

Do not show a permanent large card with `0 drivers / 0 events`.

The clean map is a valid empty state.

An optional temporary helper may appear after loading:

```text
No live activity nearby yet. Explore the map or create an event.
```

Rules:

- dismiss after user interaction;
- do not compete with Visibility Setup;
- do not appear while an object is selected;
- do not appear during routing;
- do not block map gestures.

## 11. Selected-object hierarchy

After selecting an object, show one dominant active state:

1. selected marker;
2. associated card;
3. one primary next action.

### Drivers, Events, and Car Meets

Preferred long-term pattern:

- compact Floating Map Card spatially connected to the selected marker;
- preserve visible geography;
- keep marker visible;
- predictable close or deselect behavior;
- one primary action and limited secondary metadata.

### Commercial POI

Businesses, services, detailing, shops, and partners may retain a bottom card when category differentiation improves comprehension.

Do not force all object types into one universal card.

## 12. Route state

While routing:

- Route Card replaces ordinary selection card;
- route line remains visible;
- Follow state is explicit;
- manual map gesture pauses Follow but does not destroy the route;
- Visibility remains understandable but visually secondary;
- Recenter and Follow controls must not overlap the Route Card;
- empty-state and Nearby content remain hidden.

## 13. State matrix

| State | Header | Filters | Visibility | Notice | Lower content |
|---|---|---|---|---|---|
| Default Ghost | Yes | Yes | Ghost | None | None |
| Default Live Drive | Yes | Yes | Mode + timer | None | None |
| First run | Dimmed/background | Optional hidden | In setup sheet | None | Visibility Setup |
| Permission denied | Yes | Yes | Ghost | One recovery notice | None |
| Object selected | Yes | Optional | Compact | None | One object card |
| Route loading | Yes | Optional | Compact | None | Route Card loading |
| Route ready | Yes | Optional | Compact | None | Route Card + Follow |
| Route error | Yes | Optional | Compact | One route notice or card state | Retry |
| Data refresh failure | Yes | Yes | Compact | One subtle notice | Last known markers |

## 14. Delivery sequence

### Stage A — documentation

- add this canonical plan;
- keep runtime code unchanged;
- link issues #111 and #112.

### Stage B — structural simplification

One focused PR:

- remove online-count pill;
- remove permanent Nearby summary;
- move Visibility beside Recenter as a location-control stack;
- replace stacked notices with one notice arbiter;
- preserve all existing map, marker, route, permission, and Live Drive logic.

### Stage C — Visibility Setup

One focused PR:

- add separate persisted completion state;
- show setup once after product onboarding;
- reuse existing Live Drive functions;
- preserve Ghost fallback;
- handle denial, failure, expiry, sign-out, and app restart.

### Stage D — object-card architecture

Separate PRs by object type:

- Drivers;
- Events;
- Car Meets;
- commercial POI.

### Stage E — visual and motion polish

Only after validated mechanics:

- typography;
- spacing;
- borders;
- touch targets;
- restrained red usage;
- press feedback;
- interruptible gestures;
- accessibility;
- real-device performance.

## 15. Non-goals

This plan does not:

- change Supabase schema;
- change Live Drive duration;
- automatically enable Global;
- change route APIs;
- merge Draft PR #110;
- redesign all application screens;
- add decorative motion before runtime validation.

## 16. Acceptance criteria

The Map simplification is successful when:

- the map is the dominant visual focus;
- no duplicate online/Nearby count remains;
- Visibility is continuously clear but does not compete with filters;
- only one notice is visible at a time;
- Ghost remains the safe default;
- Global starts only after explicit consent;
- selected objects produce one clear active state;
- validated mechanics are preserved;
- runtime-affecting changes remain unmerged until real-device PASS.
