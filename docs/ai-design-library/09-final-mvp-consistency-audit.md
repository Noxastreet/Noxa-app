# NOXA MVP — Final Consistency Audit

Status: **static/code side ready for final Android runtime gate**

Canonical baseline audited: `main` after onboarding integration (`52febe1f9a1d1cccf2c47460a0f44cd712552d34`).

This document is evidence, not a runtime substitute. A green TypeScript/ESLint run or merged source code does **not** mean an Android screen has passed runtime validation.

## 1. Product hierarchy now used across the MVP

NOXA should read as an automotive identity/community product, not as a dashboard HUD or an Instagram clone.

- Person identity comes before vanity metrics.
- Vehicle photography/identity comes before dense technical specifications.
- Real actions and upcoming context come before generic activity chrome.
- Secondary owner actions belong in restrained `•••` action sheets when appropriate.
- Red is reserved for primary/active/destructive emphasis, not decorative glow everywhere.
- Car and Motorcycle are both first-class vehicle types.
- Precise location, route history and movement history are not exposed in Profile/Identity surfaces.

## 2. Completed MVP waves

### Crews / Events
- Secure entity covers and production authorization are implemented.
- Crew/Event list and detail hierarchy is aligned to the current NOXA visual system.
- User-confirmed Android runtime exists for the merged Crews/Events wave.

### Garage / Vehicles
- Car + Motorcycle catalog and shared VehiclePicker.
- Make → Model → optional Generation → Year → Color → optional Photo → Save.
- Real production Supabase persistence and `vehicle-images` Storage.
- Identity-first Garage cards.
- Vehicle Details uses Back + `•••` owner actions and a clean details list.
- Vehicle Editor uses Vehicle / Performance / Profile hierarchy and optional horsepower.
- Reanimated picker motion uses separate semantic animation boundaries and system Reduce Motion.
- User-confirmed Android runtime exists for the real Car/Motorcycle add/save flow, including photo and no-photo paths.
- Later motion/presentation-only commits were merged with an explicit runtime waiver.

### Profile / Public Driver Identity
- Own Profile: person → Garage vehicle → NOXA context → Community → Moments/Account.
- Public Driver Profile: Car/Motorcycle-aware vehicle identity before generic Moments.
- Follow/Unfollow retained; Report/Block moved into secondary action sheet.
- Edit Profile preserves real Supabase/avatar behavior with quieter identity hierarchy.
- Exact-head TypeScript/ESLint passed; post-redesign Android recheck was waived.

### Notifications / Activity Inbox
- Real existing signals only.
- Pending Crew invitations → Needs attention.
- Joined future Events → Upcoming.
- Followers → Community.
- No fake read/unread, mark-all-read, badge count or notification table.
- Exact-head TypeScript/ESLint passed; Android recheck was waived.

### Settings / Account Safety
- Account → Privacy & Safety → App & Support → Session.
- Blocked Users remains backed by moderation helpers and confirmation.
- Delete Account retains password or Google/Apple re-authentication, explicit `DELETE`, Live Drive stop, Edge Function deletion and sign-out/reset.
- No fake persisted settings switches were added.
- Exact-head TypeScript/ESLint passed; Android recheck was waived.

### First-run Onboarding
- Short NOXA intro.
- Optional identity setup: prefilled display name, optional username/city/avatar.
- Same production VehiclePicker / VehicleFinalizeFlow as Garage.
- Car/Motorcycle and entire vehicle setup can be skipped for now.
- Replay from Settings stays informational/read-only.
- No duplicate catalog, vehicle persistence or new migration.
- Exact-head TypeScript/ESLint passed; Android recheck was waived.

## 3. Static stale-pattern sweep

The final code search on canonical `main` found no remaining occurrences for the targeted stale patterns:

- `ADD FIRST CAR`
- `Cars` as the generic Garage/Public Profile collection label
- required `horsepower: number` vehicle model assumption
- vehicle `speedometer-outline` motorcycle placeholder
- `OWNER CONTROLS` legacy block
- direct legacy add flow to `/vehicle-editor`
- `mock` / `fake` runtime markers in the searched core source
- `TODO` markers in the searched core source

These searches are a regression aid only; they do not prove all runtime layouts are correct.

## 4. Backend truth preserved

No final consistency wave should invent UI state that production does not persist.

Current important production-backed systems include:

- Supabase Auth and profile row creation.
- `profiles` + `avatars` Storage.
- `vehicles` + `vehicle-images` Storage.
- Car/Motorcycle additive vehicle schema migration `20260807153807`.
- `follows`.
- Crews, Crew membership/invitations and invitation response RPC.
- Events + attendees.
- Moderation/block helpers.
- Delete Account Edge Function and re-authentication path.
- Live Drive/session controls.

## 5. Runtime evidence vs waivers

### Confirmed Android runtime evidence
- Crews / Events closure.
- Garage VehiclePicker baseline.
- Full Car quick-add/save.
- Full Motorcycle quick-add/save.
- Photo upload path.
- No-photo path.

### Explicit runtime waivers in this continuation
The user asked to continue without repeated manual checks. The following post-baseline presentation waves therefore have CI/static evidence but **not** a new Android PASS:

- final Garage compatibility/polish;
- VehiclePicker motion;
- Profile/Public Driver redesign;
- Notifications redesign;
- Settings/Blocked Users redesign;
- first-run identity + vehicle onboarding integration.

A waiver is not a PASS.

## 6. Final Android consistency gate for parent #128

Before #128 can be closed, run one deliberate Android consistency build against canonical `main` and check at minimum:

1. Welcome → Sign Up / Sign In → first-run Onboarding.
2. Onboarding identity save, identity skip, vehicle save and vehicle skip.
3. Replay onboarding from Settings remains read-only.
4. Home/Map primary actions, marker cards, visibility/Live Drive state and navigation.
5. Events list/detail and RSVP paths.
6. Crews list/detail and membership/admin paths.
7. Garage list, Car/Motorcycle details, edit, cover, visibility and owner delete.
8. Own Profile, Public Driver Profile, Follow/Unfollow, Report and Block.
9. Notifications / Activity Inbox, invitation Accept/Decline and row navigation.
10. Settings, Blocked Users, Sign Out and Delete Account entry/safety UI.
11. Small-screen clipping, keyboard overlap, safe-area issues, tab/header overlap and stale-bundle artifacts.
12. No critical regression in Supabase-backed actions.

Use canonical `main`; do not validate an old feature branch or stale Metro bundle.

## 7. Parent #128 completion rule

Parent #128 must remain **OPEN** until the final Android consistency gate passes. After that:

- record the tested main SHA;
- record Android PASS and any accepted minor limitations;
- sync GitHub + Notion/Screen Bible/Roadmap;
- only then close #128.

Until that runtime gate happens, the correct project state is:

**MVP design-system rollout: code/static ready for final Android consistency validation.**
