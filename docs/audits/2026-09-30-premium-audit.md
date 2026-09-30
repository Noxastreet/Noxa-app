# NOXA product audit — 30 September 2026

Starting canonical source: `fb74ff4fdea496917cd3ddbd46271a5acbc1275f`. Quality run [36716392278](https://github.com/Noxastreet/Noxa-app/actions/runs/36716392278) succeeded. PRs #354, #355, #356, #358 are merged. [Release #357](https://github.com/Noxastreet/Noxa-app/issues/357) records NOXA 1.0.0 (69), native build/metadata/upload evidence; physical runtime remains NOT VERIFIED. Build 67 is the Product Owner's physical baseline.

## Inventory and authority

The adjacent JSON inventories all 60 Expo routes and 150 TSX surfaces from 495 application/component/hook source files. It includes loaders, errors, permissions, privacy, editors, keyboards, rare chat/gallery/poll/convoy routes, overlays, confirmations and navigation layouts. State terms describe existing source capability, not proof of native execution. Reused primitives are recorded per surface; no parallel design system is introduced.

Current main + production Supabase + Build 67 runtime evidence override stale documentation. AGENTS/design-library root-tab order and the 18 September Notion Control Center are stale relative to the explicitly authorized current Map / Crew / Events / Garage / Profile product. They do not override current navigation. The Product Owner explicitly permits scoped automated-gated merges without physical-device access, overriding AGENTS' mandatory native-before-merge gate for this task.

Official source retrieval: [research run](https://github.com/Noxastreet/Noxa-app/actions/runs/36742195113), [rendered documentation run](https://github.com/Noxastreet/Noxa-app/actions/runs/36744361105). URL/status/time/hash evidence is adjacent. HTML shells, 404/403 pages and redirects are recorded but not used as guidance. Apple DocC JSON and rendered official pages provide actual readable guidance.

## Synthesis

- [Apple HIG accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [typography](https://developer.apple.com/design/human-interface-guidelines/typography), [modality](https://developer.apple.com/design/human-interface-guidelines/modality), [motion](https://developer.apple.com/design/human-interface-guidelines/motion), [current WWDC design catalog](https://developer.apple.com/videos/design/): predictable native cancellation, Dynamic Type, readable content, explicit gesture alternatives, optional motion. iOS behavior wins.
- [Uber Base](https://base.uber.com/) (current styleguide updated 25 September 2026), [Base Web button](https://baseweb.design/components/button/): coherent building blocks; one leading action, secondary hierarchy, loading/selected/disabled states. Spatial application keeps the existing map alive under the user/event/Drive Together context.
- [Material 3 principles](https://m3.material.io/foundations/overview/principles), [Google accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility?hl=en): perceivable states, contrast and descriptive controls. Google recommends 48dp; NOXA's established iOS minimum remains 44pt with equivalent hit areas. No navigation or component framework migration.
- [Design at Meta](https://www.meta.com/design-at-meta/), [Meta accessibility](https://www.meta.com/accessibility/): people, usability and inclusion; relationship actions use existing real identity and explicit consent. NOXA does not adopt a feed or vanity metrics.
- [Fluent accessibility](https://fluent2.microsoft.design/accessibility), [motion](https://fluent2.microsoft.design/motion): functional, natural, consistent, interruptible, short transitions; semantic hierarchy and focus must survive temporary UI.
- [Airbnb accessibility](https://www.airbnb.com/accessibility): trustworthy descriptions, inclusion and honest unavailable states; never invent missing vehicle/person data.
- [Porsche typography](https://designsystem.porsche.com/v3/styles/typography/), [motion](https://designsystem.porsche.com/v3/styles/motion/): proportional shared typography and spacing; swift, subtle, purposeful feedback. Keep existing NOXA cut-corner geometry, graphite and restrained accent.

Apple's newest visual-system guidance is not a mandate to add glass; NOXA's map-first identity and existing native architecture favor restrained surfaces. Porsche web durations are references for discipline, not values copied into every mobile interaction.

## Connected evidence

Production Supabase read-only aggregate: 9 profiles, 4 missing avatars, 2 missing usernames; 8 vehicles, 4 missing cover images. These are normal supported absent states. RLS is enabled on all nine inspected profile/vehicle/relationship/location/event/drive/connect tables. No schema, policy or production data was changed.

Supabase performance advisories only report 13 unused indexes; that is not evidence of slow UI and does not justify dropping them. Existing security advisories: [pg_net placement](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [authenticated security-definer RPC review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password leak protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). RPC-only friend_connect_sessions has RLS and no direct read policy; do not expose it for UI.

Mobbin searches on both connected accounts are BLOCKED by the provider's paid-plan requirement. No screenshots were returned or claimed. Figma connection is available with a View seat; no current NOXA file URL was found in repository/Notion evidence. No stale design is promoted over main. Connected Desktop Commander is offline; physical runtime is NOT VERIFIED. Continue engineering and use hosted native tooling where possible.

## Surface audit decisions

| Surface group | Purpose / primary action | Evidence and retained behavior | Corrections |
| --- | --- | --- | --- |
| Map root, controls, markers, event/route/navigation overlays | Observe nearby real people; select contextual action | Single live map, existing ownership/follow, masked identity, route bridge and cleanup contracts | Readable supporting labels; accessible marker roles/selection; no camera/GPS changes |
| Driver card / other profile | Person + vehicle, existing profile/connect/invite | Async request epochs, focus reload, public primary vehicle, real relationships, unavailable/retry; close alternative | Supporting-copy contrast and interruption-safe shared actions |
| Crew root/detail/manage, social/search/connect | Relationship + vehicle → real interaction | Existing requests, invitations, joining and error retry; no feed | Selection/disabled semantics, labeled controls, readable metadata |
| Events root/detail/editor/calendar/gallery | Destination → route → Add Driver | Build 67 Event bridge, existing room reuse preserved | Date-picker cancellation/commit and readable event metadata |
| Garage / vehicle picker/detail/editor | Automotive identity, real vehicle photography/manage | Real fields and missing covers, shared signature surfaces | Readable metadata, accessible selections, no invented stats |
| Own profile / edit / settings / moderation / legal | Identity, privacy and account agency | Explicit destructive confirmations and backend-success navigation | Dynamic heading hierarchy, readable copy and confirmation scroll bounds |
| Drive Together composer/lobby/live/invitations/schedule/completion | Shared destination + individual route + realtime people | Existing rooms/channels/consent/permissions; route/native contracts | Roles/selected/busy state and target sizes on existing controls |
| Auth/welcome/onboarding/recovery/delete | Safely enter/recover/leave account | Auth wiring, autofill/validation/recovery and delete storage-order contracts preserved | Field error association, native keyboard dismissal, remove debug lifecycle noise |
| Shared sheets/action surfaces | Scoped reversible task or protected destructive commitment | Existing motion epochs prevent stale dismiss completion | Bounded full-content scroll, modal semantics, accessibility escape, title headers |
| Rare chat/polls/galleries/posts/convoy | Existing scoped functionality; no expansion | Existing data, mutations and media cleanup protected | Button roles/labels and supporting-copy contrast only |

No evidence-backed new backend or root-flow redesign is needed. Existing avatar error fallback, list race guards, permission recovery, private identity/vehicle filtering, one MapView and cached/limited map presentations are retained.

## Finding ledger

| ID | Severity | Evidence | Implementation / gate |
| --- | --- | --- | --- |
| A01 | P1 | textSubtle contrast 1.77:1 and textTertiary 2.98:1 on surfacePressed; both consumed by real labels | Add readable semantic copy/accent tokens; migrate content uses while retaining legacy neutral ramp |
| A02 | P1 | Reduced Motion tab still applied focus translate/scale and press scale | Identity transforms with Reduced Motion; deterministic actual-component smoke |
| A03 | P1 | Shared controls had no animation reset on disable/loading/selection interruption | Reset/cancel on state change and cleanup; press→disable→resume and Reduced Motion interruption smoke |
| A04 | P1 | Confirmation body/actions unbounded on small screen / large text | Bounded ScrollView contains complete task and actions; title/modal/escape semantics; existing epoch smoke |
| A05 | P1 | 54 raw interactive controls lacked role; selected/disabled semantics missing in some map/drive/picker controls | Scoped accessibility-only controls pass; preserve callbacks and privacy-safe label sources |
| A06 | P2 | Field error not associated with input; loading parent not explicitly grouped/busy; headings truncated at one line | Shared semantic/error/hierarchy corrections |
| A07 | P2 | Auth scroll forbids keyboard dismissal; lifecycle/focus debug logs ship in field | Native interactive/on-drag dismissal; remove logs without auth rewrite |

Automated evidence is separate from physical evidence. Full device gestures, VoiceOver focus traversal, extreme Dynamic Type, GPS, multi-user realtime and background/foreground remain NOT VERIFIED until actual device evidence exists. No FPS/latency improvement is claimed from source inspection.
