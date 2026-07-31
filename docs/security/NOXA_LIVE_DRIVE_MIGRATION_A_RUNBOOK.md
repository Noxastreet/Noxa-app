# NOXA Live Drive Migration A Runbook

Date: 2026-07-31  
Issue: #122  
Audit: `docs/security/NOXA_LIVE_DRIVE_SECURITY_AUDIT_20260731.md`

## Scope

Migration A contains two hardening changes only:

1. Remove the `global` database default from `public.driver_locations.visibility_mode`.
2. Make `public.driver_locations.updated_at` server-owned through a PostgreSQL trigger.

It does **not**:

- delete existing `driver_locations` rows;
- add scheduled cleanup;
- change visibility RLS;
- change the four-hour session trigger;
- move Crew helper functions;
- modify Auth settings;
- modify application code or PR #118.

## Expected compatibility

The current NOXA client explicitly supplies:

- `visibility_mode` on foreground and background upserts;
- `updated_at` in the payload.

After Migration A:

- explicit `visibility_mode` values continue to work;
- an omitted visibility mode fails because the column is `NOT NULL` and has no default;
- client-supplied `updated_at` remains accepted syntactically but is replaced by database `now()` before the row is written.

## Preflight checks

Run these read-only queries before applying the migration.

```sql
select
  column_name,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'driver_locations'
  and column_name in ('visibility_mode', 'updated_at')
order by column_name;
```

Expected before Migration A:

- `visibility_mode` is `NOT NULL`;
- its current default is `global`;
- `updated_at` is `NOT NULL`.

```sql
select
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'driver_locations'
order by trigger_name, event_manipulation;
```

Confirm the existing four-hour trigger is present and record all trigger names. Migration A uses the distinct trigger name:

```text
driver_locations_set_server_updated_at
```

```sql
select
  count(*) as total_rows,
  count(*) filter (where share_expires_at <= now()) as expired_rows,
  count(*) filter (where updated_at < now() - interval '2 minutes') as stale_rows
from public.driver_locations;
```

This is observation only. Migration A must not change these counts by itself.

## Deployment gate

Do not apply to production until all conditions are met:

- the migration PR is reviewed;
- GitHub Quality is PASS;
- a current production schema/backup checkpoint is confirmed;
- PR #118 remains unchanged;
- a test account and post-deployment checks are ready;
- the project owner gives explicit approval to apply the migration.

## Post-migration catalog verification

```sql
select
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'driver_locations'
  and column_name = 'visibility_mode';
```

Expected:

```text
column_default = NULL
is_nullable = NO
```

```sql
select
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'driver_locations'
  and trigger_name = 'driver_locations_set_server_updated_at'
order by event_manipulation;
```

Expected: BEFORE INSERT and BEFORE UPDATE behavior through the new trigger.

```sql
select
  n.nspname as function_schema,
  p.proname as function_name,
  p.prosecdef as security_definer,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname = 'noxa_set_driver_location_updated_at';
```

Expected:

- schema is `private`;
- `security_definer = false`;
- `search_path` is fixed to an empty path.

```sql
select
  count(*) as unexpected_client_execute_grants
from information_schema.routine_privileges
where routine_schema = 'private'
  and routine_name = 'noxa_set_driver_location_updated_at'
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role');
```

Expected: `0`.

## Behavioral verification

Use a disposable authenticated test account on a native build or through an authenticated Supabase client.

### Test 1 — explicit audience remains functional

Upsert the test user's own row with an explicit non-Ghost mode such as `global`. Confirm the write succeeds and existing RLS still allows only the intended audience.

### Test 2 — omitted audience fails safely

Attempt to insert the test user's own row without `visibility_mode`.

Expected: the write fails due to the missing required value. It must not become Global automatically.

### Test 3 — future freshness timestamp is ignored

Send an upsert containing:

```text
updated_at = a timestamp far in the future
```

Immediately read the user's own row and compare it with database time:

```sql
select
  user_id,
  updated_at,
  now() as database_now,
  abs(extract(epoch from (now() - updated_at))) as timestamp_delta_seconds
from public.driver_locations
where user_id = '<TEST_USER_UUID>'::uuid;
```

Expected: `timestamp_delta_seconds` is small. The stored value must not remain the client-provided future timestamp.

### Test 4 — four-hour behavior is unchanged

Start or update a normal Live Drive session and confirm:

- `share_started_at` is server-controlled;
- `share_expires_at` remains clamped to four hours;
- updating the row does not extend an active session;
- Global/Friends/Crew visibility behavior remains unchanged.

## Data verification

Migration A must not delete or rewrite existing rows.

Compare the preflight and post-migration values:

```sql
select
  count(*) as total_rows,
  count(*) filter (where share_expires_at <= now()) as expired_rows
from public.driver_locations;
```

Any cleanup is Migration B and requires separate approval.

## Emergency rollback

The following rollback restores the previous schema behavior. It reintroduces the previous `global` default and therefore reduces privacy safety. Use only if the current app fails after Migration A and an immediate application fix is not possible.

```sql
begin;

drop trigger if exists driver_locations_set_server_updated_at
  on public.driver_locations;

drop function if exists private.noxa_set_driver_location_updated_at();

alter table public.driver_locations
  alter column visibility_mode set default 'global';

comment on column public.driver_locations.visibility_mode is
  'Live Drive audience: crew, friends, global, or ghost.';

commit;
```

After rollback:

1. rerun the preflight catalog queries;
2. confirm normal Live Drive writes work;
3. create a follow-up incident note explaining the failure;
4. do not treat rollback as completion of SEC-2 or SEC-3.

## Success criteria

Migration A is complete only when:

- `visibility_mode` has no database default;
- omission fails safely;
- `updated_at` always reflects server time;
- the four-hour trigger remains active;
- existing visibility RLS remains unchanged;
- no row is deleted by this migration;
- two-account visibility checks continue to pass;
- the result is recorded in Issue #122.
