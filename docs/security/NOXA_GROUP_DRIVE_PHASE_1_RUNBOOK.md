# NOXA Group Drive Phase 1 Review and Deployment Runbook

Date: 2026-08-19

Issue: #189

Canonical contract: `docs/GROUP_DRIVE.md`

Draft migration: `supabase/migrations/20260819080201_group_drive_phase_1.sql`

## Status

**Review draft only — not authorized for production.**

Phase 1 creates the additive database contract for Group Drive. The migration
must remain unapplied until the Product Owner gives a separate, explicit
production approval after PR review and all preflight requirements below pass.

## Scope

The draft adds five isolated tables:

- `drive_sessions`;
- `drive_stops`;
- `drive_participants`;
- `drive_invitations`;
- `drive_location_state`.

It also adds:

- private RLS authorization helpers;
- authenticated RPCs for create/edit/route, invitation, session transition,
  participant transition, invitation preview, list, and terminal summary flows;
- state-transition triggers that synchronously delete exact locations;
- a private eight-hour expiry primitive for a later scheduled server job;
- Realtime publication membership for `drive_location_state`.

## Intentional non-goals

This phase does not:

- apply any migration to production;
- schedule the expiry function or enable `pg_cron`;
- add the `drive-route` Edge Function;
- add application screens, navigation, background tasks, or Mapbox layers;
- change `driver_locations` or personal Live Drive semantics;
- change Events, `event-route`, Crew Convoy, Home/Map, auth, or Group Drive UI;
- add public/open discovery, late join, exact speed, telemetry, chat, multi-stop
  UI, Event linking, host transfer, or host Leave.

## Security contract

| Surface | Before acceptance | Accepted, not active | Active | Left/removed/terminal |
|---|---|---|---|---|
| Invitation preview | limited RPC fields only | n/a | cancelled at start | unavailable |
| Raw session and stops | denied | allowed | allowed | denied; summary RPC only |
| Participant list | denied | allowed | allowed | own row only |
| Exact location read | denied | denied | allowed for active participants | denied |
| Exact location write | denied | denied | own row only | denied |
| Exact location retention | none | none | one current row per participant | synchronously deleted |

Additional invariants:

- Crew context is never an access grant; Crew invitation expands to individual
  invitations at the time of the action.
- Individual invitations require mutual friendship; Crew-sourced invitations
  require current shared Crew membership.
- Blocking is checked by invitation RPCs and restrictive SELECT policies.
- The host participant row is atomic with session creation and cannot leave or
  be removed.
- Starting requires the host plus at least one accepted participant and a
  calculated start/end route.
- Start atomically changes every accepted participant to active and cancels all
  outstanding invitations.
- No invitation can be accepted after start.
- Active sessions receive a server-owned eight-hour expiry.
- `drive_location_state` has no speed column and overwrites `updated_at` with
  database time.
- Leave, Remove, End, Cancel, and Expire delete affected exact locations in the
  same transaction.

## Phase 1 static verification

Run from the repository root:

```bash
npm run verify:group-drive-phase-1
git diff --check
```

The verifier confirms the five-table isolation boundary, RLS enablement,
reviewed RPC surface, restrictive blocking policies, absence of speed storage,
absence of existing-domain mutations, atomic location deletion markers, and no
Phase 1 cron schedule.

The migration must also parse with a PostgreSQL-compatible parser before review.
This is a syntax check, not a substitute for applying the migration to an
isolated Supabase preview database and running the behavioral matrix below.

## Production preflight

Run these read-only checks before any future production application.

### 1. Confirm no Group Drive objects exist

```sql
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'drive_sessions',
    'drive_stops',
    'drive_participants',
    'drive_invitations',
    'drive_location_state'
  )
order by tablename;
```

Expected before deployment: zero rows.

```sql
select n.nspname as function_schema, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname like 'noxa_%drive%'
order by n.nspname, p.proname;
```

Review any result. The new Group Drive names must not collide with an existing
function.

### 2. Confirm required dependencies

```sql
select
  to_regclass('public.profiles') as profiles,
  to_regclass('public.crews') as crews,
  to_regclass('public.crew_members') as crew_members,
  to_regclass('public.follows') as follows,
  to_regclass('public.user_blocks') as user_blocks;
```

Every value must be non-null.

```sql
select
  n.nspname as function_schema,
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname = 'noxa_users_blocked';
```

Expected: one private SECURITY DEFINER function with an empty fixed
`search_path`.

### 3. Confirm Realtime publication

```sql
select pubname
from pg_publication
where pubname = 'supabase_realtime';
```

Expected: one row.

### 4. Confirm current production checkpoint

Before deployment, record:

- production project health;
- current migration history;
- current `main` and migration PR commit SHAs;
- a current database backup/checkpoint;
- Supabase security and performance advisor output.

## Production deployment gate

Do not apply until all conditions are true:

- the draft PR is reviewed and GitHub Quality passes;
- an isolated preview database successfully applies the full migration chain;
- the two-account authorization matrix passes in the preview environment;
- rollback is rehearsed in the preview environment;
- no regression is found in existing personal Live Drive, Events, Crews, or
  Crew Convoy database behavior;
- Phase 2 API consumers are aligned with the final RPC signatures;
- production backup/current schema checkpoint is confirmed;
- the Product Owner explicitly approves production application.

Merging the Phase 1 draft PR does not satisfy this production approval gate.

## Post-migration catalog verification

### Tables, RLS, and exact schema boundary

```sql
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'drive_sessions',
    'drive_stops',
    'drive_participants',
    'drive_invitations',
    'drive_location_state'
  )
order by c.relname;
```

Expected: exactly five rows, all with RLS enabled.

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'drive_location_state'
order by ordinal_position;
```

Expected columns only: session/user identity, latitude, longitude, heading,
approximate movement status, and server-owned `updated_at`. There must be no
`speed_mps`, accuracy, telemetry, or history column.

### Policies

```sql
select
  tablename,
  policyname,
  permissive,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename like 'drive_%'
order by tablename, policyname;
```

Confirm:

- no insert/update/delete policy exists on durable Group Drive tables;
- participant, invitation, and location block policies are `RESTRICTIVE`;
- location SELECT/INSERT/UPDATE all call the active-participant helper;
- location INSERT/UPDATE additionally require `user_id = auth.uid()`;
- no location DELETE policy exists.

### Table privileges

```sql
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'drive_%'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

Expected:

- no `anon` privileges;
- authenticated users have SELECT only on durable tables;
- authenticated users have SELECT/INSERT/UPDATE, but not DELETE, on
  `drive_location_state`.

### Function hardening

```sql
select
  n.nspname as function_schema,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname like 'noxa_%drive%'
order by n.nspname, p.proname, arguments;
```

Confirm:

- every SECURITY DEFINER function has `search_path=""`;
- `public` and `anon` have no EXECUTE grants;
- only intentional public action/read RPCs are executable by `authenticated`;
- trigger helpers are not client-executable;
- the private expiry primitive is executable only by `service_role` and is not
  scheduled in Phase 1.

### Realtime

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'drive_location_state';
```

Expected: one row. Realtime delivery must still be proven to obey RLS in the
two-account preview test.

## Isolated two-account behavioral matrix

Use disposable host and participant accounts in a preview database. Also keep a
third unrelated account for negative reads.

1. Create a draft and confirm the host participant row is created atomically.
2. Confirm direct inserts into every durable table fail for authenticated users.
3. Invite one mutual friend and confirm a non-friend invite fails.
4. Invite a Crew and confirm individual invitations are created only for the
   current Crew-member snapshot; blocked users are excluded.
5. Before acceptance, confirm the invitee can call only the limited preview and
   cannot read raw session, stops, participants, or location.
6. Accept and confirm one `accepted` participant row is created. Confirm accepted
   still cannot read or write exact location.
7. Decline another invitation and confirm no participant row is created.
8. Set a two-point route, then start. Confirm accepted rows become active and all
   outstanding invitations become cancelled in the same transaction.
9. Attempt late acceptance after start and confirm the server rejects it.
10. Confirm `active_expires_at` is server time approximately eight hours after
    `started_at` and cannot be extended by a client.
11. Confirm active participants can read the current drive only, write only their
    own location row, and cannot see an unrelated drive.
12. Forge a future `updated_at`; confirm the stored timestamp is database time.
13. Confirm blocked participants are hidden through restrictive policies and a
    blocked invite cannot be created or previewed.
14. Leave as participant. Confirm the precise row is deleted immediately, raw
    session/stops/participant-list access is revoked, and only the caller's own
    participant row remains readable.
15. Remove a participant as host and confirm the same immediate deletion and
    access revocation.
16. Confirm the host cannot Leave and cannot be removed.
17. End as host. Confirm the session becomes completed and every exact-location
    row is deleted synchronously.
18. Cancel both a pre-start and active drive. Confirm the correct terminal reason,
    cancelled invitations, and zero location rows.
19. In preview only, shorten the test expiry or set an already-due active expiry
    through an administrative fixture; invoke the private expiry primitive and
    confirm terminal state plus exact-location deletion.
20. Confirm terminal/left/removed users receive only the limited summary RPC,
    never raw route geometry, stops, or exact location.

## Advisor gate

After preview application and after any future production application, run both
Supabase security and performance advisors. Resolve new Group Drive findings or
document a precise accepted limitation before continuing.

## Emergency rollback

The migration is additive and contains no production data rewrite. Rehearse this
rollback in the isolated preview environment before production approval.

```sql
begin;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'drive_location_state'
  ) then
    alter publication supabase_realtime
      drop table public.drive_location_state;
  end if;
end;
$$;

drop function if exists public.noxa_get_drive_summary(uuid);
drop function if exists public.noxa_list_my_group_drives();
drop function if exists public.noxa_get_drive_invitation_preview(uuid);
drop function if exists public.noxa_remove_drive_participant(uuid, uuid);
drop function if exists public.noxa_leave_drive(uuid);
drop function if exists public.noxa_end_drive(uuid);
drop function if exists public.noxa_cancel_drive(uuid);
drop function if exists public.noxa_start_drive(uuid);
drop function if exists public.noxa_cancel_drive_invitation(uuid);
drop function if exists public.noxa_respond_to_drive_invitation(uuid, boolean);
drop function if exists public.noxa_invite_crew_to_drive(uuid, uuid);
drop function if exists public.noxa_invite_user_to_drive(uuid, uuid, uuid);
drop function if exists public.noxa_set_drive_route(
  uuid,
  double precision,
  double precision,
  text,
  double precision,
  double precision,
  text,
  jsonb,
  numeric,
  numeric,
  text
);
drop function if exists public.noxa_update_drive_details(
  uuid,
  text,
  text,
  uuid,
  timestamptz
);
drop function if exists public.noxa_create_drive_session(
  text,
  text,
  uuid,
  timestamptz
);

drop function if exists private.noxa_expire_group_drives();
drop table if exists public.drive_location_state;
drop table if exists public.drive_invitations;
drop table if exists public.drive_participants;
drop table if exists public.drive_stops;
drop table if exists public.drive_sessions;
drop function if exists private.noxa_delete_drive_location_on_participant_exit();
drop function if exists private.noxa_apply_drive_session_transition();
drop function if exists private.noxa_prepare_drive_location_state();
drop function if exists private.noxa_prepare_drive_invitation_update();
drop function if exists private.noxa_prepare_drive_participant_update();
drop function if exists private.noxa_prepare_drive_participant_insert();
drop function if exists private.noxa_protect_drive_stop_mutation();
drop function if exists private.noxa_prepare_drive_session_update();
drop function if exists private.noxa_is_active_drive_participant(uuid);
drop function if exists private.noxa_can_read_drive_raw(uuid);
drop function if exists private.noxa_is_drive_host(uuid);

commit;
```

Do not drop the `private` schema: it predates Group Drive and contains existing
NOXA security helpers.

After rollback:

1. rerun the preflight object query and expect zero Group Drive tables;
2. confirm existing Live Drive, Crew invitation, Event, and Crew Convoy queries
   behave exactly as before;
3. rerun security and performance advisors;
4. record the incident and do not proceed to Phase 2.

## Phase 1 acceptance

Phase 1 may be called **reviewed** only when the draft PR and static checks pass.
It may be called **production-applied** only after the separate production gate,
preview rehearsal, post-deployment catalog checks, advisors, and two-account
authorization matrix all pass. It is never `Done` from file presence alone.
