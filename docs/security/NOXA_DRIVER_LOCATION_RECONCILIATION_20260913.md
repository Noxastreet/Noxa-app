# NOXA Driver Location Reconciliation — 2026-09-13

## Scope

This runbook implements unified audit **T2 / F4** only. It reconciles production `public.driver_locations` with the already-reviewed repository hardening in `20260731014500_harden_driver_location_defaults_and_freshness.sql`.

It does **not** decide F3 / Issue #196 (exact Global Live Drive privacy), remove Global mode, change Live Drive audiences, delete location rows, or modify Group Drive.

## Verified production state

Project: `Noxa` (`wzfpwuyyaotvofdijhin`), region `eu-west-1`, Postgres 17, `ACTIVE_HEALTHY`.

Read-only verification on 2026-09-13 found:

- current connector transaction mode: `transaction_read_only = on`;
- `public.driver_locations.visibility_mode` is `NOT NULL` with database default `'global'`;
- `public.driver_locations.updated_at` is `NOT NULL` with default `now()`;
- trigger `driver_locations_enforce_live_drive_window` exists and enforces the existing four-hour session window;
- trigger `driver_locations_set_server_updated_at` is absent;
- migration history contains the July visibility/session migrations but no application of repository migration `20260731014500_harden_driver_location_defaults_and_freshness`;
- current `driver_locations` row count was `0` at verification time.

The current client explicitly sends `visibility_mode` on Live Drive presence writes, so removing the database default is compatible with the reviewed client path. The current Home writer also sends `updated_at`; after reconciliation the database trigger will accept the payload but replace it with database time.

## Why a reconciliation migration is required

Do **not** mark the historical repository migration as applied or replay migration history blindly. Hosted production migration timestamps/names differ from repository history in several places. Create a new migration from the current repository head and apply only the two intended DDL changes below.

Create the migration file with the Supabase CLI:

```bash
npx supabase migration new reconcile_driver_location_defaults_and_freshness
```

Then place the following SQL into the generated file.

## Proposed migration SQL

```sql
begin;

-- Privacy by default: callers must explicitly choose the Live Drive audience.
alter table public.driver_locations
  alter column visibility_mode drop default;

comment on column public.driver_locations.visibility_mode is
  'Explicit Live Drive audience: crew, friends, global, or ghost. No database default; sharing clients must choose an audience explicitly.';

create schema if not exists private;

-- Freshness must use trusted database time, not a client-supplied timestamp.
create or replace function private.noxa_set_driver_location_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all privileges
  on function private.noxa_set_driver_location_updated_at()
  from public, anon, authenticated, service_role;

comment on function private.noxa_set_driver_location_updated_at() is
  'Assigns server time to driver_locations.updated_at on every insert and update.';

drop trigger if exists driver_locations_set_server_updated_at
  on public.driver_locations;

create trigger driver_locations_set_server_updated_at
before insert or update on public.driver_locations
for each row
execute function private.noxa_set_driver_location_updated_at();

comment on trigger driver_locations_set_server_updated_at
  on public.driver_locations is
  'Prevents clients from controlling presence freshness timestamps.';

commit;
```

## Preflight

Run before applying:

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

select
  trigger_name,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'driver_locations'
  and not t.tgisinternal
order by trigger_name;

select
  count(*) as total_rows,
  count(*) filter (where share_expires_at <= now()) as expired_rows,
  count(*) filter (where updated_at < now() - interval '2 minutes') as stale_rows
from public.driver_locations;
```

Expected before reconciliation: `visibility_mode` default is `'global'`; the four-hour trigger exists; the server-updated-at trigger does not.

## Post-apply catalog verification

```sql
select
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'driver_locations'
  and column_name = 'visibility_mode';

select
  n.nspname as function_schema,
  p.proname as function_name,
  p.prosecdef as security_definer,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname = 'noxa_set_driver_location_updated_at';

select
  tgname,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'driver_locations'
  and not t.tgisinternal
order by tgname;
```

Expected:

- `visibility_mode.column_default IS NULL`;
- `visibility_mode.is_nullable = 'NO'`;
- `private.noxa_set_driver_location_updated_at` exists with `security_definer = false` and fixed empty `search_path`;
- `driver_locations_set_server_updated_at` exists as a BEFORE INSERT OR UPDATE trigger;
- `driver_locations_enforce_live_drive_window` still exists.

## Behavioral verification

Use a disposable authenticated test account after deployment.

1. Start Live Drive with an explicit supported audience and verify a location row is written.
2. Verify a write that omits `visibility_mode` cannot silently become Global.
3. Send a future `updated_at`; read the row immediately and verify stored `updated_at` is close to database `now()`.
4. Verify `share_started_at` / `share_expires_at` are still constrained by the existing four-hour protection.
5. Verify Ghost/stop removes the presence row as before.

Do not use service-role behavior as proof of authenticated-client behavior.

## Emergency rollback

Rollback restores the previous schema behavior and therefore reduces privacy safety. Use only if the deployed app fails and an immediate client fix is not possible.

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

After rollback, repeat the catalog preflight and verify normal Live Drive writes.

## Deployment gate

Do not apply this migration to production until:

- the generated migration file is committed and reviewed;
- GitHub Quality is green;
- production preflight still matches this runbook;
- a disposable authenticated test account is ready;
- rollback SQL is immediately available;
- Product Owner explicitly approves the production apply step.

## Status

- Production drift: **VERIFIED / STILL_PRESENT**.
- Reconciliation SQL and rollback: **PREPARED**.
- Migration file: **BLOCKED only on CLI-generated filename**; do not invent a migration filename.
- Production apply: **NOT PERFORMED**.
- Runtime verification after apply: **NOT VERIFIED**.
