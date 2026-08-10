# NOXA — Group Drive / Live Drive Architecture

## Status

**Approved architecture and MVP scope. Documentation only.**

This document is the canonical specification for the Group Drive feature. No application code, no database migrations and no Supabase configuration have been created or changed as part of this document. Implementation proceeds only through the phased plan defined below, each phase as its own scoped, reviewed change.

**Provenance note:** this document was authored on the `feat/home-map-floating-card-foundation` integration branch (PR #135) and is imported into `main` here, classified **STILL VALID**, by the Stage 0 Visual Architecture V2 reconciliation (see `docs/audit/PR135_CONTRACT_RECONCILIATION.md`). It describes a domain that does not exist in application code on `main` at all, so nothing here is superseded by runtime evidence — it remains the target architecture, unchanged, except for two additions: §13.1's "single long-lived branch" delivery process is no longer how this repository ships work (see the reconciliation doc) and is superseded by whatever branch/PR strategy is current when Group Drive implementation is actually scheduled; and §14 below, which imports the still-valid Group Drive rows of PR #135's `docs/MVP_SCREEN_ACTION_REGISTER.md` so the per-screen action/state contract isn't lost. Two items remain explicitly **open, unresolved product decisions** — flagged inline at §1 (the "Live Drive" naming collision) and in the reconciliation doc (whether Group Drive is MVP-required or Post-MVP/V2, which `docs/ai-design-library/04-mvp-v2-boundary.md` and `docs/ai-design-library/07-mvp-screen-plan.md` on `main` do not currently resolve in Group Drive's favor).

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
| `crew_id` | **nullable** — optional Crew context/origin only (see below); a Group Drive can exist with no Crew at all |
| `status` | `draft` \| `scheduled` \| `active` \| `completed` \| `cancelled` |
| `scheduled_start_at` | nullable — null means "Start Now" intent, not yet scheduled |
| `started_at` | set when status transitions to `active` |
| `active_expires_at` | **nullable** timestamptz — hard server-set cap on how long a session may remain `active` (§5.4) |
| `completed_at` | set when status transitions to `completed` or `cancelled` |
| `end_reason` | **nullable** — `host_completed` \| `host_cancelled` \| `expired` (§5.4) |
| `route_geometry` | `jsonb` — the calculated route geometry returned by `drive-route` |
| `route_distance_meters` | numeric |
| `route_duration_seconds` | numeric |
| `route_provider` | text — which routing provider produced the geometry (mirrors the transparency already present in `event-route`, which is OpenRouteService-backed) |
| `route_calculated_at` | timestamptz — when the stored route was last computed |
| `route_version` | integer — incremented every time the route is recalculated, so clients can detect a stale cached route without re-fetching geometry to compare |
| `created_at` / `updated_at` | standard |

**No `visibility`/access enum in MVP.** Every MVP Group Drive behaves identically: access is invite-only, with no exception. The only way to become a participant is to accept a `drive_invitations` row (§4.4) — there is no schema-level "who can see/join this drive" toggle to encode, so no enum column is added for a single constant value. `public`/`open` discovery and any `crew`-discoverable access mode are Post-MVP and require their own migration adding the enum at that time (see §9).

**`crew_id` is context/origin only, never an access grant.** Setting `crew_id` on a `drive_sessions` row records "this drive originated from/relates to this Crew" for UI and audit purposes. It does **not** give Crew members any automatic visibility or join right. The only way any user — Crew member or not — gains access is through an individual `drive_invitations` row (§4.4); selecting a Crew in the host's UI is an *invitation-authoring shortcut* that expands into individual invitations, not a data-model recipient or a standing grant.

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

**Raw `drive_stops` rows — including exact coordinates — are visible only to the host and to participants whose own `drive_participants.status` is `accepted` or `active`.** A user who only has a pending (`invited`) `drive_invitations` row has **no RLS SELECT access to `drive_stops` at all**, raw or otherwise. Before responding to an invitation, the only information available to them is the deliberately-limited set returned by the `get_drive_invitation_preview` RPC (§4.7) — never a direct table read.

### 4.3 `drive_participants`

| Field | Notes |
|---|---|
| `drive_session_id`, `user_id` | composite primary key — **one row per user per drive**, a user cannot join the same session twice |
| `role` | MVP: `host` \| `participant`. `moderator` is Post-MVP and must not be selectable in MVP UI or writable by MVP RPCs. |
| `status` | `accepted` \| `active` \| `left` \| `removed` |
| `joined_at` / `left_at` | standard |

Rules:
- The host row is created **atomically with the session** (same pattern as `noxa_insert_event_host_attendance` / `noxa_insert_crew_owner_membership`): `role = 'host'`, `status = 'accepted'`.
- **The host row can never be removed** and **the host cannot leave without first cancelling or ending the drive** (mirrors "cannot remove owner" / "cannot change owner" protections already enforced for Crews). This is the MVP contract in full: a participant's destructive action is **Leave Drive**; the host's destructive action is **End Drive**; there is no "host leaves" path in MVP. Any future host-transfer or host-leave capability is a Post-MVP product decision, not part of the present runtime contract.
- A `drive_participants` row is only ever created as the result of a `drive_invitations` acceptance (or session creation, for the host). There is no direct insert path.
- **No late join in MVP.** When `drive_sessions.status` transitions to `active`, all current `accepted` rows transition to `active` atomically in the same operation, and every remaining `drive_invitations` row with `status = 'invited'` for that session transitions to `cancelled` in the same transaction (§5.2, §5.4). A `respond_to_drive_invitation(accept)` call against a session that is already `active` is rejected server-side — there is no accept path once the drive has started. Adding participants during an active drive is Post-MVP (§9).
- **Access does not survive `left`/`removed`.** The moment a participant's own row transitions to `left` or `removed`, their RLS access to every other participant's row, to `drive_location_state`, and to exact `drive_stops` coordinates / `route_geometry` for that session is revoked immediately — re-derived from their *current* status on every query, never cached from an earlier `accepted`/`active` state. Their own row remains readable to themselves as a historical record, but that alone must not be used to grant broader access (§7 spells out why an existence-only check on "do I have *a* row" is insufficient and must not be implemented).

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
- **The accept RPC checks `drive_sessions.status` before creating the `drive_participants` row.** If the session is already `active` (or `completed`/`cancelled`), the RPC rejects the accept — it does not silently succeed and does not create a late-joining participant. This is the enforcement point for the "no late join" rule in §4.3/§5.4, not merely a client-side UI restriction.

### 4.7 RPC `get_drive_invitation_preview`

A pending invitation (`drive_invitations.status = 'invited'`) never grants raw table access. Before an invited user responds, they can call `get_drive_invitation_preview(invitation_id)` — a `security definer` RPC (name illustrative) that returns exactly:

- `drive_session_id`;
- `title`;
- host's display-safe identity (nickname, not a raw `profiles` row);
- `scheduled_start_at`;
- `route_distance_meters`;
- `route_duration_seconds`;
- an **approximate destination label** — sourced from the `end` stop's `label` text field, never derived from its coordinates. If no `label` was set, the preview shows a generic non-precise placeholder rather than reverse-geocoding or otherwise deriving one from `latitude`/`longitude`.

It never returns: exact `start`/`end` coordinates, `route_geometry`, the participant list, any live location data, or the host's full `profiles` row. This RPC is the *only* source of pre-acceptance information — `drive_sessions` and `drive_stops` grant no raw RLS SELECT to a merely-invited user (§7).

### 4.5 `drive_location_state`

| Field | Notes |
|---|---|
| `drive_session_id`, `user_id` | **composite primary key** |
| `latitude` / `longitude` | required |
| `heading` | nullable |
| `status` | `moving` \| `stopped` \| `arrived` \| `stale` |
| `updated_at` | standard |

**`speed_mps` is not part of the MVP schema.** It is not merely unused — it does not exist as a column in MVP. MVP does not collect, transmit or store exact speed in any form. Approximate movement `status` (above) is the only motion signal. Exact speed may be added **only Post-MVP**, via its own separate, explicitly-approved migration, and that addition requires: opt-in consent (default `off`), a dedicated privacy review, and its own Definition of Done — none of which is authorized by this document.

Rules:
- **Entirely separate from `driver_locations`.** No shared table, no shared RLS policy, no shared `visibility_mode` enum.
- **`SELECT`, `INSERT` and `UPDATE` all require both conditions simultaneously: `drive_sessions.status = 'active'` *and* the caller's own `drive_participants.status = 'active'` for that `drive_session_id`.** `accepted` status alone — before the session actually starts — grants **no** location access: a participant cannot write their location, cannot read anyone else's, and cannot subscribe to the realtime channel for it while only `accepted`. This is stricter than the earlier `IN ('accepted', 'active')` framing and is the authoritative rule.
- Because Supabase Realtime's Postgres Changes stream is itself governed by the table's RLS `SELECT` policy, a participant whose status is not currently `active` receives no realtime events for this table by construction — there is no separate "unsubscribe" step required, and no client-side-only gate is sufficient on its own.
- At the moment `drive_sessions.status` becomes `active`, every `accepted` participant's row is atomically flipped to `active` (§4.3, §5.4) — this is what turns on their location read/write eligibility; there is no separate "join the active session" action.
- **Rows are deleted when the session transitions to `completed` or `cancelled` (including `end_reason = 'expired'`, §5.4), and when a participant's status becomes `left` or `removed`.** No historical precise-location trail survives a drive or a participant's membership in it. This is a deliberate correction of the pattern found in the existing `driver_locations` retention gap (SEC-1 in `docs/security/NOXA_LIVE_DRIVE_SECURITY_AUDIT_20260731.md`): deletion is part of the state-transition RPC itself, not a separate best-effort cleanup job that can silently fail. The same scheduled cleanup job that enforces the `active_expires_at` hard cap (§5.4) also acts as the safety net for any session that fails to reach a terminal state cleanly — in addition to, not instead of, synchronous deletion on every explicit transition.

### 4.6 Edge Function `drive-route`

A new, independent Edge Function. Accepts an ordered list of points (`start`, any `stop`s, `end`) rather than exactly two. Returns geometry, distance and duration in the same general response shape as `event-route`, so client-side rendering code can share patterns, but the function itself is a separate deployable unit. `event-route` is not modified, not renamed and not deprecated by this document.

## 5. State machines

### 5.1 `drive_sessions.status`

```
draft ──(host schedules)──▶ scheduled ──(host starts, any time)──▶ active ──(host ends)──▶ completed
  │                              │                                    │
  └──────(host cancels)──▶ cancelled ◀─────(host cancels)─────────────┤
                                                                       ├──(host emergency-stops)──▶ cancelled
                                                                       └──(active_expires_at reached)──▶ cancelled  [end_reason = expired]
```

- `draft → scheduled`: host sets `scheduled_start_at`.
- `draft → active` / `scheduled → active`: host explicit "Start Now" or "Start" action; not automatic, not time-triggered. `end_reason` is set only on a terminal transition, not here.
- `draft|scheduled → cancelled`: host explicit cancel, any time before `active`; `end_reason = 'host_cancelled'`.
- `active → completed`: host explicit **"End Drive"**; `end_reason = 'host_completed'`. This is the host's only MVP action for ending their own participation in an active drive — there is no `active → completed`/`cancelled` transition triggered by a host "leaving." Not automatic on reaching the last stop in MVP (see §9).
- `active → cancelled` (emergency stop): host explicit cancel while active; `end_reason = 'host_cancelled'`. Behaves like `completed` for data-retention purposes (location state deleted), but is recorded as `cancelled` for honest reporting.
- `active → cancelled` (expiry): the scheduled cleanup procedure, not the host, performs this transition when `now() >= active_expires_at`; `end_reason = 'expired'` (§5.4).
- Stops are immutable once `active` is reached (§4.2).

### 5.2 `drive_invitations.status` (per invited user)

```
invited ──(user accepts, session not yet active)──▶ accepted   [creates/activates the corresponding drive_participants row]
invited ──(user declines)──▶ declined
invited ──(host cancels invite before response)──▶ cancelled
invited ──(session transitions to active)──▶ cancelled          [atomic, applies to every remaining invited row — §4.3, §5.4]
invited ──(user attempts to accept after session is active)──▶ rejected by server, no state change   [§4.4]
```

### 5.3 `drive_participants.status`

```
(session creation)──▶ host row: status = accepted, role = host
(invitation accepted, session not yet active)──▶ status = accepted, role = participant
[session becomes active]──▶ every accepted row (host + participants) transitions to active atomically, in the same operation
active ──(participant leaves)──▶ left            [MVP: non-host participants only — see §4.3]
accepted|active ──(host removes)──▶ removed        [host row can never be removed]
```

No row transitions `accepted → active` individually or lazily — it happens once, for every currently-`accepted` row, at the single moment the session starts. A user who was never `accepted` before that moment cannot join afterward in MVP (§4.3). The host's own row never transitions to `left` in MVP — the host's only path out of an active drive is the `drive_sessions.status: active → completed/cancelled` transition above (host "End Drive"), which is a session-level state change, not a `drive_participants` row change for the host.

### 5.4 Active-session timeout

Every session that becomes `active` receives a server-set hard cap, mirroring the already-shipped pattern for personal Live Drive sessions (`driver_locations.share_expires_at`, enforced server-side by `private.noxa_enforce_live_drive_window` — see `supabase/migrations/20260715110614_add_live_drive_session_expiry.sql`):

- on the `→ active` transition, the server sets `active_expires_at = now() + interval '8 hours'`;
- the client cannot read, write or extend `active_expires_at` beyond what the server set — the same "server owns the clock" principle already established for the 4-hour personal Live Drive window;
- a scheduled cleanup procedure (the same job responsible for the `drive_location_state` safety net, §4.5) periodically finds sessions where `status = 'active'` and `now() >= active_expires_at`, and for each one:
  1. transitions `drive_sessions.status` to `cancelled`;
  2. sets `completed_at = now()`;
  3. sets `end_reason = 'expired'`;
  4. deletes all `drive_location_state` rows for that session;
  5. cancels any remaining `drive_invitations` rows with `status = 'invited'` (defensive — under §4.3/§5.2 these should already be `cancelled` from the earlier `→ active` transition, but the cleanup procedure does not assume that invariant held).
- the host may always end the drive earlier through the normal `active → completed`/`cancelled` paths; the 8-hour cap is a ceiling, not a target duration.

## 6. Privacy

**A normal map browsing session and an Active Drive are separate privacy contexts.** Being an accepted or active participant in a Group Drive reveals identity, live location and route context **only within that specific drive's `drive_location_state`/`drive_participants` scope**. It does not change a participant's `is_relevant` status, friend/Crew relationship, or IdentityOrb-vs-avatar treatment on the general Home/Map — those remain governed entirely by the existing `follows`/`crew_members` model, untouched by this document.

### 6.1 Privacy matrix

| Context | Name | Avatar | IdentityOrb | Vehicle | Realtime location | Exact speed | Approx. status (moving/stopped/arrived) | Route | Participant list |
|---|---|---|---|---|---|---|---|---|---|
| Stranger on public map (outside any drive) | ❌ | ❌ | ✅ | — | ❌ | ❌ | ❌ | ❌ | ❌ |
| Friend / Crew member (outside any drive) | ✅ | ✅ if `is_relevant` | — | ✅ | via existing `driver_locations`, unaffected by this doc | ❌ | ❌ | ❌ | ❌ |
| Invited user (`drive_invitations.status = invited`, not yet responded) | 🟡 host name only, via `get_drive_invitation_preview` (§4.7) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | 🟡 `route_distance_meters`/`route_duration_seconds` and an approximate destination label only — **no raw `drive_stops` SELECT, no exact coordinates, no `route_geometry`** (§4.2, §4.7, §7) | ❌ |
| Accepted participant, drive not yet active | ✅ (other accepted participants) | ✅ | — | ✅ | ❌ — `accepted` alone grants no location read/write/subscribe (§4.5) | ❌ (not in MVP schema at all — §4.5) | ❌ (only `active` participants get live status) | ✅ raw `drive_stops`/`route_geometry` | ✅ (accepted participants) |
| Active participant (`drive_participants.status = active`, and `drive_sessions.status = active`) | ✅ | ✅ | — | ✅ | ✅ via `drive_location_state`, scoped to this session only, gated on both statuses being `active` simultaneously (§4.5) | ❌ (not in MVP schema at all — §4.5) | ✅ | ✅ | ✅ |
| Host | same as active participant, plus visibility into `invited`/`declined`/`cancelled` invitation rows | | | | | | | | ✅ including pending invitations |
| Moderator (Post-MVP, not in MVP schema writes) | not applicable in MVP | | | | | | | | |
| User after `left`/`removed` | ❌ (all live fields) | ❌ | — | — | ❌ — access revoked immediately, `drive_location_state` row deleted synchronously | ❌ | ❌ | ❌ raw `drive_stops`/`route_geometry`; 🟡 only what a post-completion summary RPC discloses, once the drive is `completed`/`cancelled` | 🟡 only via the post-completion summary RPC — never via raw `drive_participants` SELECT, which is denied the instant their own status becomes `left`/`removed` (§7) |

Rules made explicit by this document:
- **There is no `visibility`/access-context row in this matrix** because MVP has exactly one access model (invite-only) for every session; `crew_id` on a session is provenance, not a grant (§4.1).
- **Exact speed is not part of the MVP schema at all** — `speed_mps` does not exist as a column in MVP (§4.5); there is nothing to gate by opt-in yet. Post-MVP addition requires its own migration, opt-in default `off`, privacy review, and its own Definition of Done.
- **`status` (moving/stopped/arrived/stale) is gated the same way as location itself** — visible only to participants whose own row is currently `active` in an `active` session, not to merely-`accepted` participants and not by a separate, looser consent bar than exact position.
- **Leaving a drive revokes live-location and participant-list access immediately** — a `left` or `removed` transition deletes the user's `drive_location_state` row in the same transaction as the status change, and the RLS predicate on every affected table re-checks the caller's *current* status on every query, so no cached or existence-only check can keep granting access after the transition (§4.3, §7).

## 7. RLS requirements

No RLS policies are created by this document — this section defines what future migrations must implement, following the existing project's `security definer` RPC + narrow RLS pattern (see `noxa_respond_to_crew_invitation`, `noxa_review_crew_join_request`, `private.noxa_prepare_crew_convoy_update`). All examples below are **illustrative requirements, not executable migrations.**

- `drive_sessions`: `select` — **raw row** access only for the host and for users whose own `drive_participants.status` for that session is `accepted` or `active`. A user who only has a pending (`invited`) `drive_invitations` row gets **no raw RLS SELECT on `drive_sessions`** — their only access is `get_drive_invitation_preview` (§4.7), which is a `security definer` RPC, not a relaxed RLS policy. `insert` — `host_id = auth.uid()`; `update` — no direct client update of status/host/route/`active_expires_at`/`end_reason` fields — all mutations go through `security definer` RPCs that also enforce the state machine in §5.
- `drive_stops`: `select` — same restriction as `drive_sessions` above (host + `accepted`/`active` participants only; **no access for merely-invited users**, §4.2); `insert`/`update`/`delete` — host/RPC only, blocked once `drive_sessions.status = 'active'`.
- `drive_participants`: `select` — **the RLS predicate must check the caller's own row's *current* `status`, not merely that a row exists for them.** A correct predicate looks like: the caller may see all `drive_participants` rows for a `drive_session_id` where `exists (select 1 from drive_participants self where self.drive_session_id = drive_participants.drive_session_id and self.user_id = auth.uid() and self.status in ('accepted', 'active'))`. **An existence-only check (e.g. "a row exists for `auth.uid()` on this session," without a status condition) is explicitly wrong** — it would keep granting full participant-list visibility to a user after they transition to `left` or `removed`, since their row still exists, just with a different status. The one exception: a caller can always see their *own* single row regardless of its status (for their own history), which is a different, narrower condition than seeing the whole list. `insert` — only via the invitation-acceptance RPC (which itself checks `drive_sessions.status` is not yet `active`, §4.4) and the host-creation trigger, never a direct client insert; `update` (role/status) — host-only RPC, with the "host row is immutable/unremovable" guard enforced server-side, not just client-side.
- `drive_invitations`: `select` — `invited_user_id = auth.uid()` or host; `insert`/`update` — `security definer` RPCs only (`invite_user`, `invite_crew` which expands to individual rows, `respond_to_drive_invitation` — rejecting accepts once the session is `active`, §4.4 — `cancel_drive_invitation`), each with a `for update` row lock on the target invitation, mirroring `noxa_respond_to_crew_invitation`. The session's `→ active` transition RPC additionally bulk-transitions every remaining `invited` row to `cancelled` in the same transaction (§4.3, §5.2).
- `drive_location_state`: `select`/`insert`/`update` — **all three require, simultaneously, `drive_sessions.status = 'active'` for the row's session *and* the caller's own `drive_participants.status = 'active'` for that same session** (§4.5) — `accepted` does not qualify for any of the three operations; `delete` — automatic via the state-transition RPCs (§4.5, §5.4), not exposed as a general client delete path. Because this table's RLS also governs its Postgres Changes realtime stream, the same guard is what stops delivery the instant a participant's status changes — no separate unsubscribe logic is a substitute for correct RLS here.
- A **post-completion summary RPC** (name illustrative, e.g. `get_drive_summary`) is the only way a `left`/`removed` participant — or anyone else who was ever a participant — reads anything about a `completed`/`cancelled` session afterward: final distance/duration and the final participant list, never live location state (already deleted) and never raw mid-session internals. This is distinct from, and does not reopen, the raw-table RLS restrictions above.
- Blocking: the existing `blocks_hide_*` RESTRICTIVE-policy pattern (from `20260715131402_add_moderation_and_blocks.sql`) must be extended to `drive_participants`/`drive_invitations`/`drive_location_state` so a blocked user cannot be discovered or invited through Group Drive, consistent with how blocking already restricts `driver_locations`, `crew_members`, `event_attendees`, etc.

## 8. Retention requirements

- `drive_location_state`: no retained history — rows exist only while a participant's own status is `active` in an `active` session (`accepted` alone never qualifies, §4.5), deleted synchronously on every relevant state transition (§4.5, §6). The same scheduled job that enforces the `active_expires_at` 8-hour cap (§5.4) also acts as the safety-net cleanup for orphaned rows in Phase 3, in addition to synchronous deletion, not a substitute for it.
- `drive_sessions`, `drive_stops`, `drive_participants`, `drive_invitations`: retained indefinitely as historical/product records, same durability expectation as `events`/`event_attendees`. `route_geometry` on a completed session is historical trip data, not live tracking data, and is treated like the existing `crew_convoys` completion record, not like `driver_locations`.
- No production migration, cleanup job, or retention change described here is applied by this document. Any future cleanup job for `drive_location_state` follows the same production-change rule already established in `docs/security/NOXA_LIVE_DRIVE_MIGRATION_A_RUNBOOK.md`: reviewed migration, documented rollback, explicit owner approval, post-deployment verification.

## 9. MVP scope

### In MVP

- Any authenticated user can create a Group Drive — creation is not restricted to Crew owners/admins.
- A Group Drive can exist with no Crew and no Event.
- Primary entry point is the Map (see §10).
- **Access model: invite-only, unconditionally — there is no visibility choice to make (§4.1).**
- Host can invite individual friends and/or a Crew (Crew invites expand server-side into individual `drive_invitations`, §4.4, §4.1).
- Route: exactly `start` + `end` (no multi-stop UI).
- Invitation, Join/Decline, gated by a pre-acceptance preview only (§4.7) — never raw stop/route access.
- `scheduled_start_at` or immediate "Start Now."
- Active Drive Map with realtime participant locations, available only once both the session and the participant's own row are `active` (§4.5).
- Participant `status`: `moving` / `stopped` / `arrived` / `stale`.
- A hard 8-hour `active_expires_at` cap with server-driven expiry cleanup (§5.4).
- Explicit host-driven **"End Drive."** No host "Leave Drive" path exists in MVP (§4.3, §5.1, §5.3).
- Basic Completed Drive summary (distance, duration, final participant list — no shareable card format), served through a dedicated summary RPC, not raw table reads (§7).

### Not in MVP

- Public/open discovery, or any `crew`-discoverable access mode — MVP has no `visibility`/access enum at all (§4.1); adding one is a Post-MVP migration.
- Exact speed collection/UI — `speed_mps` is not part of the MVP schema (§4.5); Post-MVP addition requires its own migration, opt-in consent default `off`, a privacy review, and its own Definition of Done.
- `moderator` role.
- Drive chat (`drive_messages`).
- `drive_alerts` (host→participants notices).
- Multi-stop UI (schema supports it, UI does not expose it).
- **Late join — adding a participant to a drive that is already `active` (§4.3, §5.2, §5.4).**
- Automatic rerouting.
- Turn-by-turn navigation.
- Event linking (`event_id` on `drive_sessions`).
- Shareable summary.
- CarPlay/Android Auto.
- **Host transfer or a host "Leave Drive" path** — the host's only destructive action in MVP is "End Drive" (§4.3, §5.1). This is not merely unbuilt UI; it is not part of the MVP data model or state machine.

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
| Privacy and Schedule | confirm invite-only access (no toggle — §4.1), schedule or Start Now | Review Route | no `visibility` selector in MVP; this step is scheduling only |
| Route Review | confirm distance/duration via `drive-route` | Create Drive / Start Now | loading/error/retry states mirror the existing `RouteCard` pattern |
| Invitation Detail | accept/decline | Join / Decline | shows only the `get_drive_invitation_preview` (§4.7) fields — no raw stops/route/participant list until accepted |
| Active Drive Map | live participant map | Leave Drive (participant) / End Drive (host) as secondary action | fullscreen, separate route — see §14 for the full per-screen action contract |
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
- Starting a drive (`Start Now` and scheduled) atomically transitions every `accepted` participant to `active` and begins location broadcast **only** for participants now `active` — an `accepted`-only participant (should not exist post-start, but verify) has no location read/write ability.
- Starting a drive cancels every remaining `invited` invitation in the same action — attempt to accept one of those invitations afterward from a second test account and confirm the server rejects it (§4.4, §5.2).
- Active Drive Map shows live positions only for the current session's `active` participants — verify a second, unrelated drive's participants are never visible.
- Participant `status` (`moving`/`stopped`/`arrived`/`stale`) updates correctly and without flicker.
- Leaving a drive immediately removes that user from other participants' Active Drive Map, stops their location broadcast, and — from that user's own account — confirm they can no longer read the participant list or anyone's location (not just that the UI hides it; verify the underlying request is actually denied).
- Removing a participant (host action) produces the same immediate access revocation as leaving, verified from the removed user's account.
- Host "End Drive" transitions status to `completed`, stops all location broadcast, and deletes all `drive_location_state` rows for that session (verify via a follow-up query/observation, not just UI). Confirm there is no "Leave Drive" control available to the host account anywhere in the runtime.
- `active_expires_at` is present and set to a server time roughly 8 hours after start; confirm the client cannot alter it. (Full 8-hour expiry is impractical to wait out manually — verify the cleanup logic against a shortened test window in a non-production check instead of waiting real-time in this checklist.)
- A completed/cancelled/expired session's participants and any `left`/`removed` former participant can only retrieve final drive info through the summary RPC — confirm a direct attempt to read raw `drive_location_state`/`drive_stops`/full `drive_participants` for that session fails for a `left`/`removed` account.
- No regression: existing Home/Map GPS, personal Live Drive (start/stop/visibility), Mapbox rendering, Follow, and Route-to-Event all behave exactly as before this feature exists.
- Background/process-kill behavior during an active drive is at least as robust as the existing personal Live Drive background task (no worse regression than the known, already-documented limitations of that system).

## 13. Phased implementation plan

### 13.1 Delivery process

**Superseded note:** the paragraph below describes the delivery process as it stood on PR #135 (a single long-lived integration branch/PR accumulating every phase). That is no longer how this repository ships work — recent history on `main` shows many independent `feat/*` branches merged through their own individual PRs (see `docs/audit/PR135_CONTRACT_RECONCILIATION.md`). Whichever branch/PR strategy is current when Group Drive implementation is actually scheduled applies instead; the phase boundaries, commit-per-step discipline, and Definition-of-Done gating below remain valid regardless of branch strategy.

Group Drive implementation accumulates on the single existing integration branch `feat/home-map-floating-card-foundation`, tracked through the single existing draft PR #135, rather than a new branch/PR per phase. Within that arrangement:

- every phase, and every distinct logical step within a phase, is its own commit;
- each commit is its own review checkpoint, assessed on its own contents rather than deferred to a later "final" review of the whole branch;
- the PR is not marked ready for review, and is not merged, until Android runtime validation has been recorded for the phase(s) it contains (§11, §12);
- applying any resulting migration to production Supabase still requires a separate, explicit owner approval and a `docs/security/NOXA_LIVE_DRIVE_MIGRATION_A_RUNBOOK.md`-style runbook — accumulating phases on one branch does not shorten or bypass that gate;
- sharing one branch and one PR does **not** waive the Definition of Done (§11) for any individual phase — each phase must independently satisfy it before the next phase begins, exactly as if it were its own branch.

### 13.2 Phases

- **Phase 0 — Documentation and architecture.** This document. No code, no migrations.
- **Phase 1 — Database schema and RLS.** Draft migrations for `drive_sessions`, `drive_stops`, `drive_participants`, `drive_invitations`, `drive_location_state` and their RLS policies/RPCs, reviewed in a PR. **Not applied to production** as part of this phase — production application follows the explicit approval gate in `docs/security/NOXA_LIVE_DRIVE_MIGRATION_A_RUNBOOK.md`-style process.
- **Phase 2 — Create/Invitation flows.** Drive Details, Route Builder, Add Participants, Privacy and Schedule, Route Review, My Group Drives, Invitation Detail, Drive Details screens. `drive-route` Edge Function. No live-location code yet.
- **Phase 3 — Active Drive background location and realtime.** `drive_location_state` writes, background task for active participants, realtime subscription plumbing, safety-net cleanup job for orphaned rows.
- **Phase 4 — Active Drive Map.** Fullscreen map route consuming Phase 3's realtime data; Map entry point added to Home/Map (isolated, reviewed change to `app/(tabs)/index.tsx`, not part of this document).
- **Phase 5 — Completion and summary.** End Drive flow, Completed Drive Summary screen, final retention verification.

Each phase is its own PR with its own Android runtime evidence, per §11 and §12. No phase is started before the previous phase's Definition of Done is met or an explicit exception is approved.

## 14. MVP screen/action contract (imported from PR #135's `docs/MVP_SCREEN_ACTION_REGISTER.md`)

The rows below are the Group-Drive-specific entries of PR #135's per-action state matrix — classified **STILL VALID** by the Stage 0 reconciliation because they describe screens/actions that don't exist anywhere else in `main`'s documentation. Non-Group-Drive rows of that source document were not imported (see `docs/audit/PR135_CONTRACT_RECONCILIATION.md`).

| Surface | Primary action | Secondary/contextual actions | Consent/destructive actions | Required states |
|---|---|---|---|---|
| My Group Drives | Resume Active Drive when one exists; otherwise Create | Open scheduled/invited/completed item; Create remains secondary during active drive; back to Map | Cancel scheduled drive through detail confirmation | loading, empty, error, invited, scheduled, active, completed |
| Group Drive Details | Continue/Edit according to creation state | Back, edit title/description | Cancel draft/scheduled drive with confirmation | draft, scheduled, active read-only, completed |
| Group Drive Route Builder | Continue after start and destination | Set/edit start, set/edit destination, back | Location permission in context | empty, start only, both set, permission denied; no route line |
| Add Participants | Continue | Search/select friend, select Crew to expand server-side, remove selection | Sending invitations is explicit | loading, empty contacts, selected, duplicate/already invited, error |
| Group Drive Scheduling | Continue | Start now, choose date/time, back | None | immediate, scheduled, invalid/past time |
| Group Drive Route Review | Start Drive or Schedule Drive | Back to edit; Retry route | Starting commits session state; no second equal CTA | loading, calculated immediate, calculated scheduled, error |
| Invitation Detail | Join Drive | Decline opens confirmation, close | Decline confirmation | loading, default limited preview, expired/cancelled, declined, server-rejected late accept |
| Active Drive Map | Map is content; Resume state | Minimize to My Group Drives, participant sheet, recenter | **Participant: Leave confirmation. Host: End confirmation. The host does not have a Leave control in MVP** (§4.3, §9) | moving, stopped, arrived, stale, offline, participants sheet, host controls |
| Group Drive Participants | Close/return | View approximate statuses | Participant Leave; host remove participant only if MVP contract allows | loading, active list, stale rows, empty impossible state |
| Group Drive Host Controls | Return/close | Allowed host management only | **End Drive confirmation only — there is no host "Leave" action** | active, operation failure |
| Completed Drive Summary | Done / return to My Group Drives | Limited summary details | None | loading, completed, cancelled/expired, former participant limited view |
