# NOXA — MVP Screen and Action Register

**Status:** Canonical target contract  
**Companion:** `docs/MVP_COMPLETION_MASTER.md`

This register covers every known user-facing MVP surface and every action category that must be audited. It defines the intended user contract. Claude Code must compare it with the actual source and record mismatches before changing behavior.

## Rules for every action

Every button, icon button, row tap, map tap, gesture, sheet action, deep link and hardware Back path must have:

- visible purpose;
- deterministic destination or state change;
- loading/disabled behavior;
- duplicate-action prevention;
- sanitized failure behavior;
- accessibility label/state;
- analytics classification if analytics is adopted;
- privacy/authorization gate where applicable;
- cancellation/rollback behavior where applicable.

A visual element that appears tappable must act. A noninteractive element must not imitate an active control.

## Complete action matrix

| Surface | Primary action | Secondary/contextual actions | Consent/destructive actions | Required states |
|---|---|---|---|---|
| Splash | None; resolve startup | Retry only for recoverable startup failure | None | loading, configuration error, authenticated, unauthenticated |
| Configuration Error | Retry / open setup guidance | Copy non-secret diagnostic if intentionally supported | None | missing Supabase, missing Mapbox, generic safe error |
| Welcome | Get started | Sign in | Legal links if shown | default, small screen, offline-safe static |
| Sign in | Sign in | Forgot password, Create account, Google, Apple on iOS | None | idle, field errors, submitting, auth error, success/callback |
| Sign up | Create account | Sign in, Google, Apple on iOS | Terms/Privacy acknowledgment | idle, validation, submitting, email-confirmation success, duplicate email |
| Forgot Password | Send reset link | Back to Sign in | None | idle, invalid email, submitting, success, rate/error |
| Reset Password | Save password | Return to Sign in after success | None | invalid token, validation, submitting, success, expired link |
| Auth Callback | Complete automatically | Retry or return to Sign in on safe failure | None | loading, success redirect, expired/invalid callback |
| Product Onboarding | Continue | Back/Skip only if product-approved | None | 3–4 steps, last step, persisted completion |
| Visibility Setup | Continue safely | Choose Ghost/Friends/Crew/Global; Not now | Start location sharing only after explicit confirmation | permission not asked, denied, limited, granted; audience explanation |
| Bottom Navigation | Open selected tab | Reselect current tab behavior must be defined | None | active/inactive, safe-area, restored state |
| Home/Map base | Select real activity; context-dependent `Еду сюда` | Search, notifications, All/Mine, recenter, route close, Follow | Start/change/stop personal Live Drive via explicit consent | map loading/error, permission denied, no activity, selected item, route loading/error/success, follow/following |
| Driver Pin | Open Driver Floating Card | Cluster/density behavior at scale | None | stranger orb, trusted identity, stale, selected |
| Driver Floating Card | Approved contextual action / Open details | Close, follow/unfollow if allowed | Block/Report only in deeper context or menu | loading-safe data, stranger, trusted, blocked/unavailable |
| Event Pin/Card | `Еду сюда` / Open Event | Close, Route details | RSVP/cancel only where contract permits | upcoming, live, cancelled, completed, route error |
| Route Card | Follow / contextual route action | Retry, Close route, recenter | None | loading, calculated, error, following, user gesture cancelled |
| Personal Live Drive | Start or manage current sharing | Choose audience, view expiry, stop | Exact location consent; audience expansion confirmation | Ghost, Friends, Crew, Global, permission denied, active, expired, restoring |
| Search | Open selected result in correct context | Clear query, cancel/back, recent query if real | None | initial, typing, loading, grouped results, empty, error |
| Notifications | Open notification context | Mark read/refresh only if implemented | Delete/clear only with clear semantics | loading, empty, error, target available, target expired/deleted |
| Social List | Open profile/member | Follow/unfollow if allowed, search list | Block/report via profile | loading, empty, pagination/error, blocked item |
| Events List | Open Event | Create Event, refresh, approved segment/filter | None | loading, empty city, populated, error, cancelled item |
| Event Detail | `Еду сюда` or canonical RSVP/route action | Route, Save/Share only if retained, host Edit | Cancel RSVP; host cancel/delete with confirmation | loading, upcoming, attending, not attending, full/closed if supported, cancelled, completed, error |
| Event Editor | Publish / Save | Location picker, image picker, back | Discard changes; delete existing Event if supported | create/edit, validation, image upload, submitting, success, failure, unsaved changes |
| Map Location Picker | Confirm location | Search/move pin/recenter, cancel | Location permission only after context | loading, permission denied, selected, geocode error |
| Crews List | Open Crew | Create Crew, refresh, discovery | None | loading, My Crews empty, discovery empty, error |
| Crew Detail | Join / Request / Open activity / Manage by state | Members, Events, approved overflow actions | Leave, remove member, ownership/destructive admin actions with confirmation | public/private/invite, nonmember/requested/member/admin/owner, loading/error |
| Garage | Open primary vehicle or Add vehicle | Open another vehicle | Delete is not exposed here without confirmation | loading, no vehicles, one, multiple, error |
| Vehicle Detail | Edit for owner | View images/details, back | Delete vehicle via explicit confirmation | loading, owner/public, image failure, missing vehicle |
| Vehicle Editor | Save | Add/remove/reorder image, optional details | Discard changes; delete existing vehicle | create/edit, validation, upload, submitting, success, failure |
| Own Profile | Edit profile | Open vehicle, Crews, social lists, Settings | Sign out lives in Settings; no location disclosure action | loading, partial profile, no vehicle, image failure |
| Public Driver Profile | Contextual follow/open shared context | Vehicle/Crew/social list if permitted | Block and Report; no exact-location action by default | stranger, followed/mutual if supported, blocked, unavailable, loading/error |
| Edit Profile | Save | Change avatar, back | Discard changes | loading current values, validation, uploading, saving, success, error |
| Settings | Open setting | Visibility, blocked users, legal, support, sign out | Sign out confirmation where active sharing exists | loading user/session if needed, normal, action error |
| Blocked Users | Unblock | Open limited profile only if safe | Unblock confirmation if required by product | loading, empty, populated, error |
| Report Modal | Submit report | Choose category, cancel | Submission is explicit; never auto-block unless stated | idle, validation, submitting, success, error |
| Delete Account | Confirm deletion after consequence review | Cancel/back, support/legal links | Re-authentication and final destructive confirmation | loading eligibility, validation, deleting, success, server error |
| Privacy Policy | Read | Open external contact/link, back | None | local document available, link failure |
| Terms of Service | Read | Open external contact/link, back | None | local document available, link failure |
| My Group Drives | Resume Active Drive when one exists; otherwise Create | Open scheduled/invited/completed item; Create remains secondary during active drive; back to Map | Cancel scheduled drive through detail confirmation | loading, empty, error, invited, scheduled, active, completed |
| Group Drive Details | Continue/Edit according to creation state | Back, edit title/description | Cancel draft/scheduled drive with confirmation | draft, scheduled, active read-only, completed |
| Group Drive Route Builder | Continue after start and destination | Set/edit start, set/edit destination, back | Location permission in context | empty, start only, both set, permission denied; no route line |
| Add Participants | Continue | Search/select friend, select Crew to expand server-side, remove selection | Sending invitations is explicit | loading, empty contacts, selected, duplicate/already invited, error |
| Group Drive Scheduling | Continue | Start now, choose date/time, back | None | immediate, scheduled, invalid/past time |
| Group Drive Route Review | Start Drive or Schedule Drive | Back to edit; Retry route | Starting commits session state; no second equal CTA | loading, calculated immediate, calculated scheduled, error |
| Invitation Detail | Join Drive | Decline opens confirmation, close | Decline confirmation | loading, default limited preview, expired/cancelled, declined, server-rejected late accept |
| Active Drive Map | Map is content; Resume state | Minimize to My Group Drives, participant sheet, recenter | Participant Leave confirmation; host End confirmation | moving, stopped, arrived, stale, offline, participants sheet, host controls |
| Group Drive Participants | Close/return | View approximate statuses | Participant Leave; host remove participant only if MVP contract allows | loading, active list, stale rows, empty impossible state |
| Group Drive Host Controls | Return/close | Allowed host management only | End Drive confirmation | active, operation failure |
| Completed Drive Summary | Done / return to My Group Drives | Limited summary details | None | loading, completed, cancelled/expired, former participant limited view |

## Frozen/quarantined action policy

The following routes may contain working buttons but they are not authorized MVP work:

- Crew Chat;
- Event Chat;
- Crew Calendar;
- Crew Gallery;
- Crew Garage;
- Crew Polls;
- Event Gallery;
- Event Summary;
- Convoy Setup;
- Post Editor;
- Post Details where reachable only from frozen feed.

For each, Claude Code may:

- inspect imports and navigation;
- document actions and data dependencies;
- fix a compile/security regression that affects MVP;
- prevent an accidental entry from the MVP core flow.

Claude Code may not redesign, extend or promote these modules without an explicit product decision.

## Source-audit requirement

Before a wave changes a route, Claude Code must append or update a concise source audit containing:

- every `NoxaButton`/button-like component;
- every `Pressable`, `Touchable*`, row tap and map gesture;
- every `router.push`, `replace`, `back`, deep link and modal transition;
- every async mutation;
- every permission request;
- every destructive operation;
- every Supabase table/RPC/function used;
- every mock-data import;
- every loading/error/empty state currently present.

The audit may be generated by a script or written manually, but it must be checked against the actual branch. This register is the target contract; the source audit is the current implementation evidence.
