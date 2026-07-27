alter table public.driver_locations
  add column if not exists share_expires_at timestamptz;

update public.driver_locations
set share_expires_at = least(
  coalesce(share_expires_at, updated_at + interval '2 minutes'),
  now() + interval '4 hours'
)
where share_expires_at is null
   or share_expires_at > now() + interval '4 hours';

alter table public.driver_locations
  alter column share_expires_at set default (now() + interval '4 hours'),
  alter column share_expires_at set not null;

comment on column public.driver_locations.share_expires_at is
  'Hard expiry for a Live Drive sharing session. Clients may not extend it beyond four hours per session.';

drop policy if exists driver_locations_select_visible on public.driver_locations;
drop policy if exists "NOXA users can read permitted active driver locations" on public.driver_locations;
create policy driver_locations_select_visible
on public.driver_locations
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (
    updated_at >= now() - interval '2 minutes'
    and share_expires_at > now()
    and private.noxa_can_view_driver_location(user_id, visibility_mode)
  )
);

drop policy if exists driver_locations_insert_self on public.driver_locations;
drop policy if exists "Authenticated users can insert their own driver location" on public.driver_locations;
create policy driver_locations_insert_self
on public.driver_locations
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and share_expires_at > now() - interval '10 minutes'
  and share_expires_at <= now() + interval '4 hours 10 minutes'
);

drop policy if exists driver_locations_update_self on public.driver_locations;
drop policy if exists "Authenticated users can update their own driver location" on public.driver_locations;
create policy driver_locations_update_self
on public.driver_locations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and share_expires_at > now() - interval '10 minutes'
  and share_expires_at <= now() + interval '4 hours 10 minutes'
);
