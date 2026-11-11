# Map and root-navigation clarity — November 11

Status: Draft implementation; native visual acceptance pending. MVP scope.

## User outcome

A returning user can identify the five destinations and the current location-sharing audience without remembering icons or interpreting a colored dot. Map remains the initial destination, in the center of Crews / Events / Map / Garage / Profile.

This is a targeted improvement of the existing graphite/red identity, shared angular surfaces and motion. It introduces no palette, font, dependency, backend, permission or sharing-consent changes.

## Evidence and design decisions

The inspected main (4b28dfac) renders Map first, with five icon-only controls. Its visibility control has an avatar and a color-only dot; the menu uses 8–11pt copy. The activity counter initially shows 0 while its request is loading. These are concrete wayfinding, readability and state-communication issues, independent of visual preference.

The canonical navigation order is defined by AGENTS.md §5 and the product library. The older Home spec asks for All/My Lens while the approved Visual Architecture V2 asks for reduced persistent chrome; current code keeps search/notifications and a fixed All lens. This PR preserves those utility entry points and does not add a Lens or silently resolve that product-design conflict. A fully reduced Home header remains separate review work.

## Implemented slice

- Five visible tab labels, selected solid icon/label/indicator, canonical order and explicit initial Map route. Existing tabPress cancellation, keyboard hiding, safe areas and Reduced Motion behavior stay in place.
- Edge-to-edge matte bottom bar. Shared height calculation allows two-line labels at enlarged text sizes; Map offsets and root scroll clearances consume the same height.
- One shared matte header surface for legibility over the changing map. Audience appears in text; the remaining Live timer is visible when applicable. Header height is measured instead of assuming 44pt for menu placement.
- Activity distinguishes loading, refresh failure and a successful zero. Cached markers are preserved; a failed request is not presented as a fresh count.
- Visibility options use body/caption tokens, expandable rows and a bounded scroll area. Android Back and accessibility Escape close the menu. Existing confirmation and permission flows still own every sharing decision.

## State and interaction model

Primary map task: inspect actual activity, select a real object, then use its existing contextual action. Root navigation is wayfinding, not a new primary CTA. Visibility is an explicit settings entry with expanded state; changing it still invokes the existing scoped confirmation path.

Loading: spinner + Updating. Failure: dash + Unavailable, with existing retry notice. Success with no drivers: 0 with nearby/active context. Permission denial/offline: existing recovery notices. No fake activity or additional GPS subscriptions. Existing map, selection, route, sharing and auth logic remain authoritative.

## Acceptance before approval/merge

- Android and iOS screenshots at 320/390pt and tablet widths, normal and 200% text size: all five labels/actions reachable; Map centered and initially selected; selected state legible without color.
- VoiceOver/TalkBack: one label per tab, correct selected state; audience and timer announced once; expanded visibility menu usable; Android Back/Escape returns to map without changing consent.
- Ghost/Friends/Crew/Public, with and without avatar, long duration and expiry: readable text; no overlap with menus/controls. Full four-option menu scrolls on short landscape screens.
- Loading/error/success-zero/real density: honest state; retry preserves known markers. No pin/route/Mapbox camera regressions.
- Screen recordings: rapid tab switching, interrupted press, Reduced Motion, keyboard hide/restore; check native frame time without making an FPS claim from source.
- Last items on Crews/Events/Garage/Profile remain scrollable above navigation at enlarged text sizes and with bottom safe areas.

Validation results belong in the PR. Code/static checks do not constitute visual acceptance or a signed native build. Recommendation: needs native review before visual approval or merge.
