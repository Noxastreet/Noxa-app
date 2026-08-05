# NOXA — Group Drive / Live Drive Architecture

## Status

**Approved architecture and MVP scope. Documentation only.**

This document is the canonical specification for the Group Drive feature. No application code, no database migrations and no Supabase configuration have been created or changed as part of this document. Implementation proceeds only through the phased plan defined below, each phase as its own scoped, reviewed change.

## 1. Terminology

- **Group Drive** — the user-facing entity representing a planned or in-progress shared drive between multiple NOXA users. This is the product noun shown in UI copy and used for the data model (`drive_sessions` and related tables).
- **Live Drive (Group Drive context)** — the active runtime state of a Group Drive, i.e. the period during which `drive_sessions.status = 'active'` and participants broadcast realtime location to each other.
- **`crew_convoys`** — an existing, already-shipped V2/legacy entity (`supabase/migrations/20260714230525_add_crew_experience.sql`, `app/convoy-setup.tsx`) with its own `lobby → live → completed/cancelled` lifecycle. It is **not** extended, renamed or reused for Group Drive. It remains a separate, frozen, Crew-only coordination feature until a future decision explicitly changes that.

### Known naming collision — must be resolved before user-facing copy ships

"Live Drive" already has an established meaning in the shipped product: the personal 4-hour location-sharing session defined in `src/lib/liveDrive.ts` and surfaced in `app/(tabs)/index.tsx` (visibility modes `crew`/`friends`/`global`/`ghost`, the "Start a 4-hour Live Drive?" modal, `driver_locations`). This document reuses "Live Drive" for a structurally different concept (the active state of a Group Drive) because the task that produced this document specified that mapping. **This is a deliberate documentation decision, not a resolved product decision.** Before Phase 4 ships user-facing copy, product must confirm whether:

- both concepts keep the same name and are disambiguated only by context ("Live Drive" personal sharing vs. "Group Drive" plus "Live" status badge), or
- one of the two runtime states is renamed in-product to avoid confusing two unrelated 4-hour-session-shaped features.

Nothing about the existing personal Live Drive system (`src/lib/liveDrive.ts`, `driver_locations`) changes because of this document.

## 2. Relationship to existing systems

Group Drive is a **new, self-contained domain area**. The following existing systems are explicitly **not modified**:

- `driver_locations` (personal presence/visibility) — untouched. Group Drive introduces its own `drive_location_state` table instead of adding a fifth `visibility_mode`.
- `supabase/functions/event-route` (single origin→destination edge function used by Event routing on Home/Map) — untouched. Group Drive introduces its own `drive-route` Edge Function.
- `events` / `event_attendees` — not extended into a drive/session model. `events` remains the public afiche entity with RSVP semantics; Group Drive is a separate stateful, realtime, participant-scoped process. An optional `event_id` link is Post-MVP only (see §9) and requires a separate explicit product confirmation before implementation.
- `crew_convoys` / `crew_convoy_participants` — not extended. They remain the existing Crew-only, text-based (no geo, no live location, no route) coordination lobby.
- `NoxaFloatingCard`, `IdentityOrb`, `MapboxLiveMap.tsx`, the main Home/Map screen — untouched by this document and not wired to Group Drive at this stage.

This isolation is intentional: Group Drive's privacy model (visible only to accepted/active participants of one specific session) is structurally different from the general map's privacy model (Ghost/Friends/Crew/Global), and conflating the two tables or RLS surfaces would risk leaking one context's data into the other.

## 3. Domain architecture overview

```
drive_sessions            (1 session = 1 Group Drive)
 ├─ optional crew_id ────────────────────▶ crews            (existing, unmodified)
 ├─ drive_stops            (ordered route points, immutable once active)
 ├─ drive_participants     (host + accepted/active/left/removed members)
 ├─ drive_invitations      (per-user invitations, including crew-expanded ones)
 └─ drive_location_state   (realtime live position per active participant)

drive-route (new Edge Function)   — multi-point routing, independent of event-route
```

No table in this domain is shared with `events`, `driver_locations`, `crew_convoys`, or the social feed tables (`posts`, `crew_messages`, `event_messages`).

## 4. Data model

All fields below are a specification for future migrations. No migration exists yet.

### 4.1 `drive_sessions`

| Field | Notes |
|---|---|
| `id` | primary key |
| `host_id` | references `profiles`; immutable after creation (no host transfer in MVP) |
| `title` | required |
| `description` | optional |
| `crew_id` | **nullable** — optional Crew anchor; a Group Drive can exist with no Crew at all |
| `status` | `draft` \| `scheduled` \| `active` \| `completed` \| `cancelled` |
| `visibility` | **MVP: `invite_only` \| `crew` only.** No `open`/public discovery in MVP. |
| `scheduled_start_at` | nullable — null means "Start Now" intent, not yet scheduled |
| `started_at` | set when status transitions to `active` |
| `completed_at` | set when status transitions to `completed` or `cancelled` |
| `route_geometry` | `jsonb` — the calculated route geometry returned by `drive-route` |
| `route_distance_meters` | numeric |
| `route_duration_seconds` | numeric |
| `route_provider` | text — which routing provider produced the geometry (mirrors the transparency already present in `event-route`, which is OpenRouteService-backed) |
| `route_calculated_at` | timestamptz — when the stored route was last computed |
| `route_version` | integer — incremented every time the route is recalculated, so clients can detect a stale cached route without re-fetching geometry to compare |
| `created_at` / `updated_at` | standard |

`event_id` is **not** part of the MVP schema. It is Post-MVP and requires a separate explicit product confirmation (see §9 and the open decisions list) before any migration adds it.

### 4.2 `drive_stops`

| Field | Notes |
|---|---|
| `id` | primary key |
| `drive_session_id` | references `drive_sessions`, cascade delete |
| `sequence` | integer ordering |
| `kind` | `start` \| `stop` \| `end` |
| `latitude` / `longitude` | required |
| `label` | optional display text |

**Stops are immutable once `drive_sessions.status = 'active'`.** This mirrors the existing immutability pattern already enforced for `crew_convoys` (`private.noxa_prepare_crew_convoy_update` rejects route-field edits once a convoy leaves `lobby`). MVP UI only ever creates exactly two stops (`start`, `end`); multi-stop UI (`kind = 'stop'` rows beyond the pair) is schema-supported but **not built in MVP** (see §9).

### 4.3 `drive_participants`

| Field | Notes |
|---|---|
| `drive_session_id`, `user_id` | composite primary key — **one row per user per drive**, a user cannot join the same session twice |
| `role` | MVP: `host` \| `participant`. `moderator` is Post-MVP and must not be selectable in MVP UI or writable by MVP RPCs. |
| `status` | `accepted` \| `active` \| `left` \| `removed` |
| `joined_at` / `left_at` | standard |

Rules:
- The host row is created **atomically with the session** (same pattern as `noxa_insert_event_host_attendance` / `noxa_insert_crew_owner_membership`): `role = 'host'`, `status = 'accepted'`.
- **The host row can never be removed** and the host cannot leave without first cancelling or ending the drive (mirrors "cannot remove owner" / "cannot change owner" protections already enforced for Crews).
- A `drive_participants` row is only ever created as the result of a `drive_invitations` acceptance (or session creation, for the host). There is no direct insert path.

### 4.4 `drive_invitations`

| Field | Notes |
|---|---|
| `id` | primary key |
| `drive_session_id` | references `drive_sessions` |
| `invited_user_id` | **the only recipient concept** — every invitation always targets exactly one user |
| `source_crew_id` | nullable — records that this specific invitation was generated by a "invite this Crew" action, for UI/audit display only. It does not change how the invitation behaves. |
| `invited_by` | references `profiles` (host, or a future moderator) |
| `status` | `invited` \| `accepted` \| `declined` \| `cancelled` |
| `created_at` / `responded_at` | standard |

Rules:
- There is **no `invited_crew_id` recipient concept.** Inviting a Crew is a host-facing UI action, not a data-model recipient. When the host selects a Crew, the server (a `security definer` RPC, following the `noxa_invite_to_crew` pattern) expands that action into one individual `drive_invitations` row per user who is a member of that Crew **at the moment of invitation** — membership is snapshotted, not live-bound. Each invited user accepts or declines individually; there is no "accept on behalf of the Crew."
- A unique partial index prevents more than one `pending`-equivalent (`status = 'invited'`) row per `(drive_session_id, invited_user_id)`, mirroring `crew_invitations_one_pending_idx`.
- Accepting an invitation is the **only** path that creates a `drive_participants` row for a non-host user (`status = 'accepted'`), via a `security definer` RPC with a `for update` row lock, mirroring `noxa_respond_to_crew_invitation`.

### 4.5 `drive_location_state`

| Field | Notes |
|---|---|
| `drive_session_id`, `user_id` | **composite primary key** |
| `latitude` / `longitude` | required |
| `heading` | nullable |
| `status` | `moving` \| `stopped` \| `arrived` \| `stale` |
| `speed_mps` | **nullable, not used in MVP.** The column exists in the schema to avoid a breaking migration when opt-in speed sharing ships Post-MVP, but no MVP client writes to it and no MVP UI reads it. |
| `updated_at` | standard |

Rules:
- **Entirely separate from `driver_locations`.** No shared table, no shared RLS policy, no shared `visibility_mode` enum.
- Readable only by participants whose own `drive_participants` row for that `drive_session_id` has `status IN ('accepted', 'active')`.
- **Rows are deleted when the session transitions to `completed` or `cancelled`, and when a participant's status becomes `left` or `removed`.** No historical precise-location trail survives a drive or a participant's membership in it. This is a deliberate correction of the pattern found in the existing `driver_locations` retention gap (SEC-1 in `docs/security/NOXA_LIVE_DRIVE_SECURITY_AUDIT_20260731.md`): deletion is part of the state-transition RPC itself, not a separate best-effort cleanup job that can silently fail. A safety-net scheduled cleanup for orphaned rows (sessions that never reach a terminal state cleanly) is still recommended hardening for Phase 3, in addition to — not instead of — synchronous deletion on transition.

### 4.6 Edge Function `drive-route`

A new, independent Edge Function. Accepts an ordered list of points (`start`, any `stop`s, `end`) rather than exactly two. Returns geometry, distance and duration in the same general response shape as `event-route`, so client-side rendering code can share patterns, but the function itself is a separate deployable unit. `event-route` is not modified, not renamed and not deprecated by this document.

## 5. State machines

### 5.1 `drive_sessions.status`

```
draft ──(host schedules)──▶ scheduled ──(host starts, any time)──▶ active ──(host ends)──▶ completed
  │                              │                                    │
  └──────(host cancels)──▶ cancelled ◀─────(host cancels)─────────────┘
                                                                       │
                                                          (host emergency-stops)──▶ cancelled
```

- `draft → scheduled`: host sets `scheduled_start_at`.
- `draft → active` / `scheduled → active`: host explicit "Start Now" or "Start" action; not automatic, not time-triggered.
- `draft|scheduled → cancelled`: host explicit cancel, any time before `active`.
- `active → completed`: host explicit "End Drive." Not automatic on reaching the last stop in MVP (see §9).
- `active → cancelled`: host emergency stop; behaves like `completed` for data-retention purposes (location state deleted), but is recorded as `cancelled` for honest reporting.
- Stops are immutable once `active` is reached (§4.2).

### 5.2 `drive_invitations.status` (per invited user)

```
invited ──(user accepts)──▶ accepted   [creates/activates the corresponding drive_participants row]
invited ──(user declines)──▶ declined
invited ──(host or session cancels before response)──▶ cancelled
```

### 5.3 `drive_participants.status`

```
(session creation)──▶ host row: status = accepted, role = host
(invitation accepted)──▶ status = accepted, role = participant
accepted ──(session becomes active)──▶ active
active ──(participant leaves)──▶ left
accepted|active ──(host removes)──▶ removed        [host row can never be removed]
```

## 6. Privacy

**A normal map browsing session and an Active Drive are separate privacy contexts.** Being an accepted or active participant in a Group Drive reveals identity, live location and route context **only within that specific drive's `drive_location_state`/`drive_participants` scope**. It does not change a participant's `is_relevant` status, friend/Crew relationship, or IdentityOrb-vs-avatar treatment on the general Home/Map — those remain governed entirely by the existing `follows`/`crew_members` model, untouched by this document.

### 6.1 Privacy matrix

| Context | Name | Avatar | IdentityOrb | Vehicle | Realtime location | Exact speed | Approx. status (moving/stopped/arrived) | Route | Participant list |
|---|---|---|---|---|---|---|---|---|---|
| Stranger on public map (outside any drive) | ❌ | ❌ | ✅ | — | ❌ | ❌ | ❌ | ❌ | ❌ |
| Friend / Crew member (outside any drive) | ✅ | ✅ if `is_relevant` | — | ✅ | via existing `driver_locations`, unaffected by this doc | ❌ | ❌ | ❌ | ❌ |
| Invited user (`drive_invitations.status = invited`, not yet responded) | 🟡 host name only, in the invitation preview | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | 🟡 optional summary (distance/duration) may be shown; exact stop coordinates are a product decision, not fixed by this document | ❌ |
| Accepted participant, drive not yet active | ✅ (other accepted participants) | ✅ | — | ✅ | ❌ (not active yet) | ❌ | ❌ | ✅ | ✅ (accepted participants) |
| Active participant (`drive_participants.status = active`) | ✅ | ✅ | — | ✅ | ✅ via `drive_location_state`, scoped to this session only | ❌ (not in MVP — see §4.5) | ✅ | ✅ | ✅ |
| Host | same as active participant, plus visibility into `invited`/`declined` rows | | | | | | | | ✅ including pending invitations |
| Moderator (Post-MVP, not in MVP schema writes) | not applicable in MVP | | | | | | | | |
| User after `left`/`removed` | ❌ (all live fields) | ❌ | — | — | ❌ — access revoked immediately, `drive_location_state` row deleted synchronously | ❌ | ❌ | 🟡 static summary only, if a Completed Summary exists and the user is included in it | 🟡 archival record of past participation only |

Rules made explicit by this document:
- **Exact speed is not part of MVP at all** — not gated by opt-in, simply not collected, not transmitted, not displayed. `speed_mps` opt-in (default `off`) is Post-MVP.
- **`status` (moving/stopped/arrived/stale) is not gated by the same consent bar as exact speed** — it does not expose precise telemetry and is visible to any active/accepted participant of the same session, same as live position.
- **Leaving a drive revokes live-location access immediately** — a `left` or `removed` transition deletes the user's `drive_location_state` row in the same transaction as the status change, and RLS additionally ensures a non-`accepted`/`active` participant can read no other participant's `drive_location_state` row regardless of row lifecycle timing.

## 7. RLS requirements

No RLS policies are created by this document — this section defines what future migrations must implement, following the existing project's `security definer` RPC + narrow RLS pattern (see `noxa_respond_to_crew_invitation`, `noxa_review_crew_join_request`, `private.noxa_prepare_crew_convoy_update`). All examples below are **illustrative requirements, not executable migrations.**

- `drive_sessions`: `select` — host, accepted/active participants, and users with a pending `drive_invitations` row for that session (limited columns via a view or RPC, not the raw row, to satisfy the "invited user" row in the privacy matrix); `insert` — `host_id = auth.uid()`; `update` — no direct client update of status/host/route fields — all mutations go through `security definer` RPCs that also enforce the state machine in §5.
- `drive_stops`: `select` — same visibility as the parent `drive_sessions`; `insert`/`update`/`delete` — host/RPC only, blocked once `drive_sessions.status = 'active'`.
- `drive_participants`: `select` — a user sees only rows for sessions where they themselves have a `drive_participants` row; `insert` — only via the invitation-acceptance RPC and the host-creation trigger, never a direct client insert; `update` (role/status) — host-only RPC, with the "host row is immutable/unremovable" guard enforced server-side, not just client-side.
- `drive_invitations`: `select` — `invited_user_id = auth.uid()` or host; `insert`/`update` — `security definer` RPCs only (`invite_user`, `invite_crew` which expands to individual rows, `respond_to_drive_invitation`, `cancel_drive_invitation`), each with a `for update` row lock on the target invitation, mirroring `noxa_respond_to_crew_invitation`.
- `drive_location_state`: `select` — restricted to users whose own `drive_participants.status` for that `drive_session_id` is `accepted` or `active`; `insert`/`update` — `user_id = auth.uid()` and the same accepted/active condition; `delete` — automatic via the state-transition RPCs (§4.5), not exposed as a general client delete path.
- Blocking: the existing `blocks_hide_*` RESTRICTIVE-policy pattern (from `20260715131402_add_moderation_and_blocks.sql`) must be extended to `drive_participants`/`drive_invitations`/`drive_location_state` so a blocked user cannot be discovered or invited through Group Drive, consistent with how blocking already restricts `driver_locations`, `crew_members`, `event_attendees`, etc.

## 8. Retention requirements

- `drive_location_state`: no retained history — rows exist only while a participant is `accepted`/`active` in an `active` session, deleted synchronously on every relevant state transition (§4.5, §6). A scheduled safety-net cleanup for orphaned rows is required hardening in Phase 3, in addition to synchronous deletion, not a substitute for it.
- `drive_sessions`, `drive_stops`, `drive_participants`, `drive_invitations`: retained indefinitely as historical/product records, same durability expectation as `events`/`event_attendees`. `route_geometry` on a completed session is historical trip data, not live tracking data, and is treated like the existing `crew_convoys` completion record, not like `driver_locations`.
- No production migration, cleanup job, or retention change described here is applied by this document. Any future cleanup job for `drive_location_state` follows the same production-change rule already established in `docs/security/NOXA_LIVE_DRIVE_MIGRATION_A_RUNBOOK.md`: reviewed migration, documented rollback, explicit owner approval, post-deployment verification.

## 9. MVP scope

### In MVP

- Any authenticated user can create a Group Drive — creation is not restricted to Crew owners/admins.
- A Group Drive can exist with no Crew and no Event.
- Primary entry point is the Map (see §10).
- Visibility: `invite_only` or `crew`.
- Host can invite individual friends and/or a Crew (Crew invites expand server-side into individual `drive_invitations`, §4.4).
- Route: exactly `start` + `end` (no multi-stop UI).
- Invitation, Join/Decline.
- `scheduled_start_at` or immediate "Start Now."
- Active Drive Map with realtime participant locations.
- Participant `status`: `moving` / `stopped` / `arrived` / `stale`.
- Explicit host-driven "End Drive."
- Basic Completed Drive summary (distance, duration, final participant list — no shareable card format).

### Not in MVP

- Public/open discovery (`visibility = 'open'` does not exist in the MVP schema).
- Exact speed UI (schema field exists per §4.5, unused).
- `moderator` role.
- Drive chat (`drive_messages`).
- `drive_alerts` (host→participants notices).
- Multi-stop UI (schema supports it, UI does not expose it).
- Automatic rerouting.
- Turn-by-turn navigation.
- Event linking (`event_id` on `drive_sessions`).
- Shareable summary.
- CarPlay/Android Auto.

## 10. Navigation

- **Group Drives do not get a bottom tab.** The canonical five-tab bottom navigation (`Crews / Events / Map / Garage / Profile`, per `AGENTS.md` §5) is not changed by this feature.
- The primary entry point is on **Map** (an entry control on the existing Home/Map screen; exact placement is a UI-implementation decision for Phase 4, not fixed here, and must not be added to `app/(tabs)/index.tsx` before Phase 4 review — this document does not authorize that change).
- **My Group Drives** is a separate route/screen (list of drives the user hosts, participates in, or has a pending invitation to), not folded into an existing tab's list.
- **Active Drive Map is a separate, fullscreen route** — it does not modify or replace the general Home Map screen, its state, or its Mapbox layers. This keeps Phase 4 fully isolated from `app/(tabs)/index.tsx` and `MapboxLiveMap.tsx`.
- **Event Detail integration is Post-MVP** — no entry point from `app/event-details.tsx` / `CanonicalEventDetailScreen.tsx` is added in MVP.

### Screen flow (MVP)

| Screen | Job | Primary CTA | Notes |
|---|---|---|---|
| My Group Drives | see drives you host/join/are invited to | Create Group Drive | empty state, no fake activity |
| Create — Drive Details | title, description | Continue | |
| Route Builder | pick start + end on map | Continue | reuses existing Mapbox picker patterns (`MapboxEventLocationPicker`), start/end only in MVP |
| Add Participants | pick friends and/or a Crew | Continue | Crew selection previews the resulting individual invitations, not a single "invite Crew" black box |
| Privacy and Schedule | `invite_only`/`crew`, schedule or Start Now | Review Route | |
| Route Review | confirm distance/duration via `drive-route` | Create Drive / Start Now | loading/error/retry states mirror the existing `RouteCard` pattern |
| Invitation Detail | accept/decline | Join / Decline | privacy-matrix-limited preview for `invited` status |
| Active Drive Map | live participant map | (Leave Drive as secondary action) | fullscreen, separate route |
| Drive Details | static session info before/after active | contextual (Join/Start/Open Active Map) | |
| Completed Drive Summary | honest post-drive result | Done | basic only in MVP |

## 11. Definition of Done

Following the pattern in `docs/ROADMAP.md`, a Group Drive phase is **Done** only when:

1. implementation for that phase is complete;
2. TypeScript passes;
3. ESLint passes;
4. required GitHub Quality and Expo Doctor checks pass;
5. the flow is validated in a native Android development build with at least two real accounts (host + participant);
6. no regression in existing Map, GPS, Live Drive (personal), Mapbox, Crews, or Events behavior;
7. code is merged into `main`;
8. any schema change is independently verified against production Supabase, following the same production-change rule as `docs/security/NOXA_LIVE_DRIVE_MIGRATION_A_RUNBOOK.md`.

Otherwise the phase is `Implemented`, `Testing`, `In progress`, or `PASS WITH LIMITATIONS` — never `Done` from code presence alone.

## 12. Android runtime checklist

To be executed per relevant phase, on a physical Android device or native development build, with at least two authenticated test accounts:

- Creating a Group Drive with only `start`/`end` stops produces a valid route via `drive-route`.
- Inviting an individual friend and inviting a Crew both produce correct, individually-actionable `drive_invitations` rows (crew expansion verified against actual current membership at invite time).
- Accept/Decline correctly create/skip a `drive_participants` row and are reflected in real time to the host.
- Starting a drive (`Start Now` and scheduled) transitions status correctly and begins location broadcast only for `accepted` participants.
- Active Drive Map shows live positions only for the current session's `accepted`/`active` participants — verify a second, unrelated drive's participants are never visible.
- Participant `status` (`moving`/`stopped`/`arrived`/`stale`) updates correctly and without flicker.
- Leaving a drive immediately removes that user from other participants' Active Drive Map and stops their location broadcast.
- Host "End Drive" transitions status to `completed`, stops all location broadcast, and deletes all `drive_location_state` rows for that session (verify via a follow-up query/observation, not just UI).
- No regression: existing Home/Map GPS, personal Live Drive (start/stop/visibility), Mapbox rendering, Follow, and Route-to-Event all behave exactly as before this feature exists.
- Background/process-kill behavior during an active drive is at least as robust as the existing personal Live Drive background task (no worse regression than the known, already-documented limitations of that system).

## 13. Phased implementation plan

- **Phase 0 — Documentation and architecture.** This document. No code, no migrations.
- **Phase 1 — Database schema and RLS.** Draft migrations for `drive_sessions`, `drive_stops`, `drive_participants`, `drive_invitations`, `drive_location_state` and their RLS policies/RPCs, reviewed in a PR. **Not applied to production** as part of this phase — production application follows the explicit approval gate in `docs/security/NOXA_LIVE_DRIVE_MIGRATION_A_RUNBOOK.md`-style process.
- **Phase 2 — Create/Invitation flows.** Drive Details, Route Builder, Add Participants, Privacy and Schedule, Route Review, My Group Drives, Invitation Detail, Drive Details screens. `drive-route` Edge Function. No live-location code yet.
- **Phase 3 — Active Drive background location and realtime.** `drive_location_state` writes, background task for active participants, realtime subscription plumbing, safety-net cleanup job for orphaned rows.
- **Phase 4 — Active Drive Map.** Fullscreen map route consuming Phase 3's realtime data; Map entry point added to Home/Map (isolated, reviewed change to `app/(tabs)/index.tsx`, not part of this document).
- **Phase 5 — Completion and summary.** End Drive flow, Completed Drive Summary screen, final retention verification.

Each phase is its own PR with its own Android runtime evidence, per §11 and §12. No phase is started before the previous phase's Definition of Done is met or an explicit exception is approved.
