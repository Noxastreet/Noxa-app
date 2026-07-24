alter table public.driver_locations
  add column if not exists visibility_mode text not null default 'global';

alter table public.driver_locations
  drop constraint if exists driver_locations_visibility_mode_check;

alter table public.driver_locations
  add constraint driver_locations_visibility_mode_check
  check (visibility_mode in ('crew', 'friends', 'global', 'ghost'));

create schema if not exists private;

create or replace function private.noxa_can_view_driver_location(
  target_user_id uuid,
  target_visibility_mode text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when target_user_id = (select auth.uid()) then true
    when target_visibility_mode = 'global' then true
    when target_visibility_mode = 'friends' then
      exists (
        select 1
        from public.follows as viewer_follows_driver
        where viewer_follows_driver.follower_id = (select auth.uid())
          and viewer_follows_driver.following_id = target_user_id
      )
      and exists (
        select 1
        from public.follows as driver_follows_viewer
        where driver_follows_viewer.follower_id = target_user_id
          and driver_follows_viewer.following_id = (select auth.uid())
      )
    when target_visibility_mode = 'crew' then
      exists (
        select 1
        from public.crew_members as viewer_membership
        join public.crew_members as driver_membership
          on driver_membership.crew_id = viewer_membership.crew_id
        where viewer_membership.user_id = (select auth.uid())
          and driver_membership.user_id = target_user_id
      )
    else false
  end;
$$;

revoke all privileges on function private.noxa_can_view_driver_location(uuid, text)
  from public, anon, service_role;
grant execute on function private.noxa_can_view_driver_location(uuid, text)
  to authenticated;

drop policy if exists "Authenticated users can read active driver locations"
  on public.driver_locations;

create policy "NOXA users can read permitted active driver locations"
  on public.driver_locations
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      updated_at >= now() - interval '2 minutes'
      and (select private.noxa_can_view_driver_location(user_id, visibility_mode))
    )
  );
