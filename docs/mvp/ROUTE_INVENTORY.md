# NOXA — MVP Route Inventory

**Parent contract:** `docs/MVP_COMPLETION_MASTER.md`

## 7. Complete known route inventory

Legend:

- **MVP:** required release path.
- **Support:** runtime infrastructure for MVP.
- **Frozen:** preserve but do not improve.
- **Quarantine:** classify before touching.
- **Planned:** approved but not implemented.

| Area | Route / surface | Classification | User job / contract | Current evidence |
|---|---|---:|---|---|
| System | `app/_layout.tsx` | Support | Stable providers, auth/deep-link routing and global navigation | Exists; runtime not verified |
| System | `app/index.tsx` | Support | Send user to correct entry/onboarding/app state | Exists; runtime not verified |
| System | `src/screens/NoxaSplashScreen.tsx` | Support | Brand-consistent startup without fake loading | Exists |
| System | `src/screens/NoxaConfigurationErrorScreen.tsx` | Support | Explain missing configuration safely | Exists |
| Auth | `app/auth/callback.tsx` | Support | Complete email/OAuth/deep-link callback | Exists |
| Entry | `app/welcome.tsx` | MVP | Explain value quickly; Get started / Sign in | Exists; design marked incomplete |
| Auth | `app/sign-in.tsx` | MVP | Email/social sign-in; recovery link | Implemented foundation; device test pending |
| Auth | `app/sign-up.tsx` | MVP | Minimal account creation and email confirmation | Exists; audit required |
| Auth | `app/forgot-password.tsx` | MVP | Send reset link with success state | Exists |
| Auth | `app/reset-password.tsx` | MVP | Save new password safely | Exists |
| Onboarding | `app/onboarding.tsx` | MVP | Explain people, Events, Crews and Map in 3–4 steps | Exists |
| Privacy | `app/visibility-setup.tsx` | MVP | Choose Ghost/Friends/Crew/Global with scoped consent | Exists; critical runtime test pending |
| Navigation | `app/(tabs)/_layout.tsx` | MVP | Stable Crews / Events / Map / Garage / Profile navigation | Exists; canonical visual audit required |
| Map | `app/(tabs)/index.tsx` | MVP | See real nearby activity and move to action | Implemented, monolithic, runtime pending |
| Map | Driver Floating Card | Planned MVP | First driver tap preserves map context | Component foundation only |
| Map | Event/Route Floating Cards | MVP | Preview selected Event/route without overlap | Migrated in PR #135 |
| Map | Personal Live Drive controls | MVP | Start/stop 4h sharing with explicit audience | Exists in Home/Map and `src/lib/liveDrive.ts` |
| Map | `src/features/mapbox/MapboxLiveMap.tsx` | Support | Render real map, sources, layers, camera and gestures | Exists; must remain stable |
| Search | `app/search.tsx` | MVP | Search supported entities and open correct context | Exists; mock/real-data audit required |
| Utility | `app/notifications.tsx` | MVP | Open useful action/context, not vanity updates | Exists; mock-data risk |
| Social | `app/social-list.tsx` | Conditional MVP | Followers/following/member list when reached from profile | Exists; reachability audit required |
| Events | `app/(tabs)/events.tsx` | MVP | Understand what is happening soon and open Event | Canonical screen wrapper implemented |
| Events | `app/event-details.tsx` | MVP | Decide whether to go; route/RSVP/context | Canonical screen wrapper implemented |
| Events | `app/event-editor.tsx` | MVP | Create/edit a real Event | Exists; incomplete design/runtime |
| Events | `app/event-chat.tsx` | Frozen | Event coordination after MVP | Preserve only |
| Events | `app/event-gallery.tsx` | Quarantine | Legacy/advanced Event media | Classify reachability |
| Events | `app/event-summary.tsx` | Quarantine | Legacy/advanced Event result | Classify reachability |
| Crews | `app/(tabs)/crews.tsx` | MVP | See own/local Crews and open one | Canonical screen wrapper implemented |
| Crews | `app/crew/[id].tsx` | MVP | Understand Crew and Join/Leave/Manage | Canonical screen wrapper implemented |
| Crews | `app/crew-chat.tsx` | Frozen | Crew communication after MVP | Preserve only |
| Crews | `app/crew-calendar.tsx` | Quarantine/V2 | Advanced Crew calendar | Classify, do not polish |
| Crews | `app/crew-gallery.tsx` | Quarantine/V2 | Advanced Crew media | Classify, do not polish |
| Crews | `app/crew-garage.tsx` | Quarantine/V2 | Advanced shared garage | Classify, do not polish |
| Crews | `app/crew-polls.tsx` | Quarantine/V2 | Advanced Crew polling | Classify, do not polish |
| Legacy drive | `app/convoy-setup.tsx` | Frozen V2 | Legacy convoy setup | Never use as Group Drive base |
| Garage | `app/(tabs)/garage.tsx` | MVP | Open primary vehicle or add first vehicle | Exists; canonical redesign/audit required |
| Garage | `app/vehicle-details.tsx` | MVP | View vehicle; owner can edit | Exists |
| Garage | `app/vehicle-editor.tsx` | MVP | Add/edit vehicle; safe delete and draft handling | Exists |
| Profile | `app/(tabs)/profile.tsx` | MVP | View own identity, main vehicle and account entry points | Exists |
| Profile | `app/driver-profile/[id].tsx` | MVP | Understand another driver after explicit intent | Exists; privacy audit required |
| Profile | `app/edit-profile.tsx` | MVP | Edit identity without mixing location privacy | Exists |
| Content | `app/post-details.tsx` | Quarantine/V2 | Legacy social content detail | Classify reachability |
| Content | `app/post-editor.tsx` | Frozen V2 | Publish feed content | Do not improve |
| Settings | `app/settings.tsx` | MVP | Open account, privacy, safety and legal settings | Shared primitives introduced; runtime pending |
| Safety | `app/blocked-users.tsx` | MVP | View and unblock users | Exists |
| Safety | `src/components/moderation/ReportModal.tsx` | MVP support | Report supported entity with safe categories | Exists; coverage audit required |
| Account | `app/delete-account.tsx` | MVP | Explain consequences and confirm deletion | Exists; edge function/deployment audit required |
| Legal | `app/privacy-policy.tsx` | MVP | Read current policy | Exists as LegalDocumentScreen wrapper |
| Legal | `app/terms-of-service.tsx` | MVP | Read current terms | Exists as LegalDocumentScreen wrapper |
| Group Drive | My Group Drives | Planned MVP | View invited/scheduled/active/completed drives | Design v1.1; code absent |
| Group Drive | Drive Details | Planned MVP | Enter/edit title and description; understand status | Later design package required |
| Group Drive | Route Builder | Planned MVP | Set start and destination | Design v1.1; code absent |
| Group Drive | Add Participants | Planned MVP | Invite friends or expand Crew to individuals | Later design package required |
| Group Drive | Scheduling | Planned MVP | Start now or choose date/time | Later design package required |
| Group Drive | Route Review | Planned MVP | Confirm calculated route and commit | Design v1.1; code absent |
| Group Drive | Invitation Detail | Planned MVP | Join/decline from limited preview | Design v1.1 needs micro-correction |
| Group Drive | Active Drive Map | Planned MVP | Route, participants, approximate status and safe controls | Design v1.1 needs micro-correction |
| Group Drive | Completed Summary | Planned MVP | Basic post-drive summary within privacy limits | Later design package required |

The exact action-level contract is maintained in `docs/MVP_SCREEN_ACTION_REGISTER.md`.
