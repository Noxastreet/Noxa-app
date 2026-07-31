begin;

-- Privacy by default: every sharing write must explicitly choose a non-Ghost
-- audience. Because visibility_mode is NOT NULL, omitting the field now fails
-- instead of silently becoming Global.
alter table public.driver_locations
  alter column visibility_mode drop default;

comment on column public.driver_locations.visibility_mode is
  'Explicit Live Drive audience: crew, friends, global, or ghost. No database default; sharing clients must choose an audience explicitly.';

-- Presence freshness must be based on trusted database time rather than a
-- timestamp supplied by a modified or malfunctioning client.
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
