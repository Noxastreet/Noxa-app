# NOXA Live Drive / Visibility Security Audit

Date: 2026-07-31
Scope: production Supabase project `Noxa`, Live Drive, Ghost, Global, Friends, Crew, blocking, Crew RPC authorization, and current Release Candidate behavior.
Status: Audit complete; no production mutation performed.

## Executive result

**PASS WITH REQUIRED HARDENING**

No direct authorization bypass was found for writing another user's location or administering another Crew. The core RLS and four-hour enforcement model is structurally sound. However, data-retention and hardening work is required before wider testing.

## Verified controls

### Driver location RLS

- RLS is enabled on `driver_locations`.
- Anonymous users have no applicable RLS policy.
- INSERT requires `auth.uid() = user_id`.
- UPDATE and DELETE require ownership of the row.
- INSERT and UPDATE reject `ghost` rows.
- Visible rows must be both recent (two-minute freshness window) and unexpired.
- Global visibility is available to signed-in, non-blocked users.
- Friends visibility requires mutual follows.
- Crew visibility requires a shared Crew membership.
- Blocking is implemented with a RESTRICTIVE SELECT policy and therefore combines with the visibility policy through `AND`.

### Four-hour enforcement

The database trigger `private.noxa_enforce_live_drive_window()`:

- replaces client-provided `share_started_at` with server `now()` on insert;
- preserves the original start and expiry while an active session exists;
- prevents extending an active session;
- clamps expiration to no more than four hours from the server-defined start.

The current production rows do not exceed the four-hour limit and do not contain a future forged start time.

### Live Drive client behavior

- Background sharing uses a native Expo Location task.
- Session state is stored through the `expo-sqlite/localStorage/install` React Native storage implementation.
- The client requests foreground and background permissions before starting.
- Ghost attempts to stop native updates and delete the user's row.
- Expired local sessions stop native updates and attempt row deletion.
- The map subscribes to `driver_locations` through Supabase Realtime and refreshes through RLS-protected queries.

### Crew action RPC

Reviewed RPC include invitations, join requests, member removal, role changes, Crew polls, voting, and poll results.

Verified properties:

- anonymous EXECUTE is not granted;
- all client-callable action RPC use `auth.uid()`;
- owner/admin/member checks are performed server-side;
- target invitation/request/poll rows are locked where concurrent modification matters;
- input roles and poll inputs are constrained;
- all reviewed SECURITY DEFINER functions set an empty fixed `search_path`.

No direct Crew privilege-escalation path was found in the reviewed functions.

## Findings

### SEC-1 — Expired exact coordinates remain stored

**Severity: High (privacy / data minimization), not an active visibility bypass**

Production currently contains two `driver_locations` rows that are stale and expired. RLS hides them from other users because they fail the freshness/expiry checks, but no database cleanup job or cleanup function exists.

Risk:

- exact coordinates remain stored indefinitely if a device is offline, killed, uninstalled, or cannot send the final DELETE;
- the product promise that location is removed after the session is stronger than the current server guarantee;
- future policy regressions would expose retained historical rows.

Required remediation:

1. Add server-side cleanup independent of the device.
2. Delete rows when `share_expires_at <= now()` or when `updated_at` exceeds the approved retention window.
3. Run cleanup on a defined cadence through Supabase Cron or a scheduled server mechanism.
4. Add a one-time cleanup for existing expired rows after approval.
5. Add a production assertion/monitor for expired row count.

### SEC-2 — Database default is Global

**Severity: Medium (privacy by default)**

`driver_locations.visibility_mode` currently defaults to `global`.

The application explicitly supplies a mode and the INSERT policy rejects `ghost`, so normal current behavior is controlled. However, an accidental insert that omits the field becomes globally visible rather than failing safely.

Required remediation:

- change the database default to `ghost` or remove the default;
- retain a policy that prevents storing a Ghost row;
- require every sharing insert to state the non-Ghost audience explicitly.

Preferred behavior: omission fails instead of becoming Global.

### SEC-3 — Freshness timestamp is client writable

**Severity: Medium (integrity)**

`updated_at` is supplied by the client. A modified client can provide a future timestamp and keep its row inside the two-minute freshness condition until the four-hour expiry.

This does not expose another user's data and cannot extend beyond the server-clamped session, but it can make a driver appear live when updates have stopped.

Required remediation:

- add a BEFORE INSERT/UPDATE trigger that always sets `updated_at = now()`;
- do not trust a client timestamp for presence freshness.

### SEC-4 — Internal helper functions remain exposed as public RPC

**Severity: Low/Medium (attack-surface hardening)**

Supabase security advisors warn that the following public SECURITY DEFINER helpers can be invoked by authenticated clients:

- `noxa_can_view_crew`
- `noxa_is_crew_member`
- `noxa_is_crew_manager`
- `noxa_is_crew_public`

They are authorization helpers, not user actions. Their current definitions are constrained and do not provide an obvious privilege escalation, but they unnecessarily expand the public RPC surface and keep the advisor warning active.

Required remediation:

- move policy-only helpers into the `private` schema;
- update policies and action RPC to call `private.*` helpers;
- keep intentional user-action RPC in `public`;
- rerun Supabase security advisors after migration.

Do not blindly revoke every SECURITY DEFINER function: Crew action RPC are intentionally invoked by authenticated clients and enforce their own authorization.

### SEC-5 — Leaked password protection disabled

**Severity: Medium (account security)**

Supabase Auth leaked-password protection is disabled.

Required remediation:

- enable compromised-password checking in Supabase Auth settings;
- verify sign-up and password-change flows afterward.

## Non-findings / corrected hypothesis

An initial broad policy listing did not clearly expose the `PERMISSIVE` / `RESTRICTIVE` attribute and suggested that `blocks_hide_*` could combine through `OR`. A targeted catalog query confirmed the block policies are RESTRICTIVE. They correctly narrow the corresponding permissive visibility policies.

Therefore there is no confirmed RLS bypass from policy composition in the audited tables.

## Recommended delivery order

1. **SEC-1** server cleanup and one-time expired-row cleanup.
2. **SEC-2** safe visibility default.
3. **SEC-3** server-owned `updated_at`.
4. **SEC-4** private helper migration.
5. **SEC-5** Auth setting change.
6. Rerun security advisors.
7. Execute two-account authorization tests for Global, Friends, Crew, Ghost, and blocking.
8. Complete native Release Candidate test issue #120.

## Production change rule

No migration, DELETE, Auth configuration change, or policy replacement should be applied without:

- a committed migration in GitHub;
- review of rollback behavior;
- a backup/current schema snapshot;
- explicit owner approval;
- post-migration advisor and two-account runtime evidence.
