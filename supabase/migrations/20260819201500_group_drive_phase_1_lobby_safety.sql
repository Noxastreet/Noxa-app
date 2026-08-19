-- NOXA Group Drive / Active Drive MVP — Phase 1 lobby safety amendment.
--
-- Review draft only. Do not apply to production without the existing Phase 1
-- hosted-preview, rollback, advisor, two-account, and Product Owner gates.
--
-- This amendment adds coordination-only Lobby readiness and hardens Start so
-- one user cannot be active in two Group Drives at once. It does not change
-- personal Live Drive, Events, Crew Convoy, Home/Map, Mapbox, or auth.

alter table public.drive_participants
  add column ready_at timestamptz;

comment on column public.drive_participants.ready_at is
  'Coordination-only Lobby readiness. Never location consent. Cleared on plan/lifecycle changes.';

alter table public.drive_participants
  add constraint drive_participants_ready_lifecycle_check check (
    ready_at is null
    or (
      role = 'participant'
      and status = 'accepted'
    )
  );

create or replace function private.noxa_normalize_drive_participant_readiness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'host' or new.status <> 'accepted' then
    new.ready_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.noxa_normalize_drive_participant_readiness()
  from public, anon, authenticated, service_role;

create trigger drive_participants_normalize_readiness
  before insert or update on public.drive_participants
  for each row
  execute function private.noxa_normalize_drive_participant_readiness();

create or replace function private.noxa_reset_drive_readiness_on_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scheduled_start_at is distinct from old.scheduled_start_at
    or new.route_version is distinct from old.route_version
  then
    update public.drive_participants
    set ready_at = null
    where drive_session_id = new.id
      and role = 'participant'
      and status = 'accepted'
      and ready_at is not null;
  end if;

  return new;
end;
$$;

revoke all on function private.noxa_reset_drive_readiness_on_plan_change()
  from public, anon, authenticated, service_role;

create trigger drive_sessions_reset_readiness_on_plan_change
  after update of scheduled_start_at, route_version on public.drive_sessions
  for each row
  when (
    new.scheduled_start_at is distinct from old.scheduled_start_at
    or new.route_version is distinct from old.route_version
  )
  execute function private.noxa_reset_drive_readiness_on_plan_change();

create or replace function public.noxa_set_drive_ready(
  target_drive_session_id uuid,
  ready_state boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_session public.drive_sessions%rowtype;
  current_participant public.drive_participants%rowtype;
begin
  if actor is null
    or target_drive_session_id is null
    or ready_state is null
  then
    raise exception 'Authentication required';
  end if;

  -- Serialize readiness changes with Start/Cancel and other session lifecycle
  -- operations. Ready is coordination only and never location consent.
  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  if current_session.id is null then
    return false;
  end if;

  if current_session.status not in ('draft', 'scheduled') then
    raise exception 'Lobby readiness is available only before the Group Drive starts';
  end if;

  if private.noxa_users_blocked(actor, current_session.host_id) then
    raise exception 'This Group Drive is unavailable';
  end if;

  select *
  into current_participant
  from public.drive_participants
  where drive_participants.drive_session_id = current_session.id
    and drive_participants.user_id = actor
  for update;

  if current_participant.user_id is null
    or current_participant.status <> 'accepted'
  then
    return false;
  end if;

  if current_participant.role = 'host' then
    raise exception 'The Group Drive host controls Start and does not use Ready';
  end if;

  update public.drive_participants
  set ready_at = case when ready_state then now() else null end
  where drive_session_id = current_session.id
    and user_id = actor;

  return true;
end;
$$;

revoke all on function public.noxa_set_drive_ready(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.noxa_set_drive_ready(uuid, boolean)
  to authenticated;

-- Replace only the Start RPC. All existing lifecycle, RLS, privacy, and exact
-- location behavior remains owned by the Phase 1 base migration.
create or replace function public.noxa_start_drive(
  target_drive_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_session public.drive_sessions%rowtype;
  accepted_participant_count integer;
  conflicting_user_id uuid;
begin
  if actor is null or target_drive_session_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  if current_session.id is null then
    return false;
  end if;

  if current_session.host_id <> actor then
    raise exception 'Only the Group Drive host can start the drive';
  end if;

  if current_session.status not in ('draft', 'scheduled') then
    raise exception 'This Group Drive cannot be started';
  end if;

  if current_session.route_version < 1
    or current_session.route_geometry is null
    or not exists (
      select 1
      from public.drive_stops
      where drive_stops.drive_session_id = current_session.id
        and drive_stops.kind = 'start'
    )
    or not exists (
      select 1
      from public.drive_stops
      where drive_stops.drive_session_id = current_session.id
        and drive_stops.kind = 'end'
    )
  then
    raise exception 'A calculated start-to-end route is required before start';
  end if;

  select count(*)::integer
  into accepted_participant_count
  from public.drive_participants
  where drive_participants.drive_session_id = current_session.id
    and drive_participants.status = 'accepted';

  if accepted_participant_count < 2 then
    raise exception 'A Group Drive requires the host and at least one accepted participant';
  end if;

  -- Lock every accepted participant identity in deterministic UUID order.
  -- Concurrent starts with any shared participant therefore serialize before
  -- either session can become active. This is intentionally based on profiles,
  -- because participant rows belong to different sessions and cannot otherwise
  -- provide a shared row lock.
  perform profiles.id
  from public.profiles
  join public.drive_participants
    on drive_participants.user_id = profiles.id
  where drive_participants.drive_session_id = current_session.id
    and drive_participants.status = 'accepted'
  order by profiles.id
  for update of profiles;

  select candidate.user_id
  into conflicting_user_id
  from public.drive_participants as candidate
  where candidate.drive_session_id = current_session.id
    and candidate.status = 'accepted'
    and exists (
      select 1
      from public.drive_participants as active_participant
      join public.drive_sessions as active_session
        on active_session.id = active_participant.drive_session_id
      where active_participant.user_id = candidate.user_id
        and active_participant.drive_session_id <> current_session.id
        and active_participant.status = 'active'
        and active_session.status = 'active'
    )
  order by candidate.user_id
  limit 1;

  if conflicting_user_id is not null then
    raise exception 'A participant is already active in another Group Drive';
  end if;

  update public.drive_sessions
  set
    status = 'active',
    started_at = now(),
    active_expires_at = now() + interval '8 hours',
    completed_at = null,
    end_reason = null
  where id = current_session.id;

  return true;
end;
$$;

revoke all on function public.noxa_start_drive(uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_start_drive(uuid)
  to authenticated;
