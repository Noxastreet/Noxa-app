alter table public.driver_locations
  add column if not exists visibility_mode text not null default 'global',
  add column if not exists share_expires_at timestamptz,
  add column if not exists share_started_at timestamptz;

update public.driver_locations
set visibility_mode = case lower(visibility_mode)
  when 'crew' then 'crew'
  when 'friends' then 'friends'
  when 'global' then 'global'
  else 'ghost'
end;

alter table public.driver_locations
  drop constraint if exists driver_locations_visibility_mode_check;

alter table public.driver_locations
  add constraint driver_locations_visibility_mode_check
  check (visibility_mode in ('crew', 'friends', 'global', 'ghost'));

update public.driver_locations
set share_expires_at = least(
  coalesce(share_expires_at, updated_at + interval '2 minutes'),
  now() + interval '4 hours'
)
where share_expires_at is null
   or share_expires_at > now() + interval '4 hours';

update public.driver_locations
set share_started_at = coalesce(
  share_started_at,
  least(updated_at, share_expires_at, now())
);

alter table public.driver_locations
  alter column visibility_mode set default 'global',
  alter column visibility_mode set not null,
  alter column share_expires_at set default (now() + interval '4 hours'),
  alter column share_expires_at set not null,
  alter column share_started_at set default now(),
  alter column share_started_at set not null;

comment on column public.driver_locations.visibility_mode is
  'Audience for an active Go Live session: shared crew, mutual friends, all authenticated users, or nobody.';
comment on column public.driver_locations.share_expires_at is
  'Hard expiry for a user-started Go Live session. Clients cannot extend one session beyond four hours.';
comment on column public.driver_locations.share_started_at is
  'Server-controlled start time for the current Go Live session.';

create schema if not exists private;

create or replace function private.noxa_enforce_live_drive_window()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.share_started_at := now();
  elsif old.share_expires_at > now() then
    new.share_started_at := old.share_started_at;
    new.share_expires_at := least(new.share_expires_at, old.share_expires_at);
  else
    new.share_started_at := now();
  end if;

  new.share_expires_at := least(
    coalesce(new.share_expires_at, new.share_started_at + interval '4 hours'),
    new.share_started_at + interval '4 hours'
  );
  return new;
end;
$$;

revoke all privileges
  on function private.noxa_enforce_live_drive_window()
  from public, anon, authenticated, service_role;

drop trigger if exists driver_locations_enforce_live_drive_window
  on public.driver_locations;
create trigger driver_locations_enforce_live_drive_window
  before insert or update of share_started_at, share_expires_at
  on public.driver_locations
  for each row
  execute function private.noxa_enforce_live_drive_window();

create index if not exists driver_locations_active_visibility_idx
  on public.driver_locations (visibility_mode, share_expires_at, updated_at desc);

grant usage on schema private to authenticated;

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

revoke all privileges
  on function private.noxa_can_view_driver_location(uuid, text)
  from public, anon, authenticated, service_role;
grant execute
  on function private.noxa_can_view_driver_location(uuid, text)
  to authenticated;

grant select, insert, update, delete on public.driver_locations to authenticated;
alter table public.driver_locations enable row level security;

drop policy if exists "Authenticated users can read active driver locations"
  on public.driver_locations;
drop policy if exists "NOXA users can read permitted active driver locations"
  on public.driver_locations;
drop policy if exists driver_locations_select_visible
  on public.driver_locations;

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

drop policy if exists blocks_hide_driver_locations
  on public.driver_locations;

do $$
begin
  if to_regprocedure('private.noxa_users_blocked(uuid,uuid)') is not null then
    execute $policy$
      create policy blocks_hide_driver_locations
        on public.driver_locations
        as restrictive
        for select
        to authenticated
        using (
          user_id = (select auth.uid())
          or not private.noxa_users_blocked((select auth.uid()), user_id)
        )
    $policy$;
  end if;
end;
$$;

drop policy if exists "Authenticated users can insert their own driver location"
  on public.driver_locations;
drop policy if exists driver_locations_insert_self
  on public.driver_locations;

create policy driver_locations_insert_self
  on public.driver_locations
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and visibility_mode <> 'ghost'
    and share_expires_at > now()
    and share_expires_at <= share_started_at + interval '4 hours'
  );

drop policy if exists "Authenticated users can update their own driver location"
  on public.driver_locations;
drop policy if exists driver_locations_update_self
  on public.driver_locations;

create policy driver_locations_update_self
  on public.driver_locations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and visibility_mode <> 'ghost'
    and share_expires_at > now()
    and share_expires_at <= share_started_at + interval '4 hours'
  );

drop policy if exists "Authenticated users can delete their own driver location"
  on public.driver_locations;
drop policy if exists driver_locations_delete_self
  on public.driver_locations;

create policy driver_locations_delete_self
  on public.driver_locations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
