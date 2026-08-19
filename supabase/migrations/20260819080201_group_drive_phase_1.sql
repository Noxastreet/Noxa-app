-- NOXA Group Drive / Active Drive MVP — Phase 1 database contract.
--
-- This migration is a review draft only. Do not apply it to production as part
-- of Phase 1. Group Drive is intentionally isolated from personal Live Drive,
-- Events, Crew Convoy, and the Home/Map runtime.

create schema if not exists private;

create table public.drive_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  crew_id uuid references public.crews(id) on delete set null,
  status text not null default 'draft',
  scheduled_start_at timestamptz,
  started_at timestamptz,
  active_expires_at timestamptz,
  completed_at timestamptz,
  end_reason text,
  route_geometry jsonb,
  route_distance_meters numeric(12, 2),
  route_duration_seconds numeric(12, 2),
  route_provider text,
  route_calculated_at timestamptz,
  route_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drive_sessions_title_check check (
    char_length(btrim(title)) between 2 and 100
  ),
  constraint drive_sessions_description_check check (
    description is null or char_length(description) <= 1000
  ),
  constraint drive_sessions_status_check check (
    status in ('draft', 'scheduled', 'active', 'completed', 'cancelled')
  ),
  constraint drive_sessions_end_reason_check check (
    end_reason is null
    or end_reason in ('host_completed', 'host_cancelled', 'expired')
  ),
  constraint drive_sessions_route_payload_check check (
    (
      route_version = 0
      and route_geometry is null
      and route_distance_meters is null
      and route_duration_seconds is null
      and route_provider is null
      and route_calculated_at is null
    )
    or (
      route_version > 0
      and route_geometry is not null
      and jsonb_typeof(route_geometry) = 'object'
      and route_distance_meters is not null
      and route_distance_meters >= 0
      and route_duration_seconds is not null
      and route_duration_seconds >= 0
      and route_provider is not null
      and char_length(btrim(route_provider)) between 1 and 80
      and route_calculated_at is not null
    )
  ),
  constraint drive_sessions_state_timestamps_check check (
    (
      status = 'draft'
      and scheduled_start_at is null
      and started_at is null
      and active_expires_at is null
      and completed_at is null
      and end_reason is null
    )
    or (
      status = 'scheduled'
      and scheduled_start_at is not null
      and started_at is null
      and active_expires_at is null
      and completed_at is null
      and end_reason is null
    )
    or (
      status = 'active'
      and started_at is not null
      and active_expires_at is not null
      and active_expires_at > started_at
      and completed_at is null
      and end_reason is null
    )
    or (
      status = 'completed'
      and started_at is not null
      and active_expires_at is not null
      and active_expires_at > started_at
      and completed_at is not null
      and completed_at >= started_at
      and end_reason = 'host_completed'
    )
    or (
      status = 'cancelled'
      and completed_at is not null
      and end_reason in ('host_cancelled', 'expired')
      and (
        (
          end_reason = 'host_cancelled'
          and (
            (
              started_at is null
              and active_expires_at is null
            )
            or (
              started_at is not null
              and active_expires_at is not null
              and active_expires_at > started_at
              and completed_at >= started_at
            )
          )
        )
        or (
          end_reason = 'expired'
          and started_at is not null
          and active_expires_at is not null
          and active_expires_at > started_at
          and completed_at >= started_at
        )
      )
    )
  )
);

comment on table public.drive_sessions is
  'Invite-only Group Drive sessions. Separate from personal Live Drive, Events, and Crew Convoy.';
comment on column public.drive_sessions.crew_id is
  'Optional origin/context only. Crew membership never grants Group Drive access.';
comment on column public.drive_sessions.active_expires_at is
  'Server-owned hard cap, set to eight hours after an explicit host start.';
comment on column public.drive_sessions.route_geometry is
  'Stored route geometry for accepted participants; never exposed in invitation previews.';

create index drive_sessions_host_status_updated_idx
  on public.drive_sessions (host_id, status, updated_at desc);
create index drive_sessions_crew_status_idx
  on public.drive_sessions (crew_id, status)
  where crew_id is not null;
create index drive_sessions_active_expiry_idx
  on public.drive_sessions (active_expires_at)
  where status = 'active';

create table public.drive_stops (
  id uuid primary key default gen_random_uuid(),
  drive_session_id uuid not null
    references public.drive_sessions(id) on delete cascade,
  sequence integer not null,
  kind text not null,
  latitude double precision not null,
  longitude double precision not null,
  label text,
  constraint drive_stops_sequence_check check (sequence >= 0),
  constraint drive_stops_kind_check check (kind in ('start', 'stop', 'end')),
  constraint drive_stops_latitude_check check (latitude between -90 and 90),
  constraint drive_stops_longitude_check check (longitude between -180 and 180),
  constraint drive_stops_label_check check (
    label is null or char_length(label) <= 160
  ),
  constraint drive_stops_session_sequence_key
    unique (drive_session_id, sequence)
);

comment on table public.drive_stops is
  'Ordered Group Drive route points. Phase 1 RPCs write exactly start and end; the schema reserves stop for post-MVP UI.';

create unique index drive_stops_one_start_idx
  on public.drive_stops (drive_session_id)
  where kind = 'start';
create unique index drive_stops_one_end_idx
  on public.drive_stops (drive_session_id)
  where kind = 'end';

create table public.drive_participants (
  drive_session_id uuid not null
    references public.drive_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  status text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (drive_session_id, user_id),
  constraint drive_participants_role_check check (
    role in ('host', 'participant')
  ),
  constraint drive_participants_status_check check (
    status in ('accepted', 'active', 'left', 'removed')
  ),
  constraint drive_participants_lifecycle_check check (
    (
      status in ('accepted', 'active')
      and left_at is null
    )
    or (
      status in ('left', 'removed')
      and left_at is not null
    )
  ),
  constraint drive_participants_host_lifecycle_check check (
    role <> 'host' or status in ('accepted', 'active')
  )
);

comment on table public.drive_participants is
  'Current and historical Group Drive membership. Non-host rows are created only by invitation acceptance.';

create unique index drive_participants_one_host_idx
  on public.drive_participants (drive_session_id)
  where role = 'host';
create index drive_participants_user_status_idx
  on public.drive_participants (user_id, status, joined_at desc);

create table public.drive_invitations (
  id uuid primary key default gen_random_uuid(),
  drive_session_id uuid not null
    references public.drive_sessions(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  source_crew_id uuid references public.crews(id) on delete set null,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint drive_invitations_status_check check (
    status in ('invited', 'accepted', 'declined', 'cancelled')
  ),
  constraint drive_invitations_response_check check (
    (status = 'invited' and responded_at is null)
    or (status <> 'invited' and responded_at is not null)
  ),
  constraint drive_invitations_not_self_check check (
    invited_user_id <> invited_by
  )
);

comment on table public.drive_invitations is
  'One recipient per invitation. source_crew_id is audit context, never an access grant.';

create unique index drive_invitations_one_invited_idx
  on public.drive_invitations (drive_session_id, invited_user_id)
  where status = 'invited';
create index drive_invitations_recipient_status_idx
  on public.drive_invitations (invited_user_id, status, created_at desc);
create index drive_invitations_session_status_idx
  on public.drive_invitations (drive_session_id, status, created_at desc);
create index drive_invitations_source_crew_idx
  on public.drive_invitations (source_crew_id)
  where source_crew_id is not null;
create index drive_invitations_invited_by_idx
  on public.drive_invitations (invited_by);

create table public.drive_location_state (
  id uuid primary key default gen_random_uuid(),
  drive_session_id uuid not null,
  user_id uuid not null,
  latitude double precision not null,
  longitude double precision not null,
  heading double precision,
  status text not null,
  updated_at timestamptz not null default now(),
  constraint drive_location_state_session_user_key
    unique (drive_session_id, user_id),
  constraint drive_location_state_participant_fkey
    foreign key (drive_session_id, user_id)
    references public.drive_participants(drive_session_id, user_id)
    on delete cascade,
  constraint drive_location_state_latitude_check check (
    latitude between -90 and 90
  ),
  constraint drive_location_state_longitude_check check (
    longitude between -180 and 180
  ),
  constraint drive_location_state_heading_check check (
    heading is null or (heading >= 0 and heading < 360)
  ),
  constraint drive_location_state_status_check check (
    status in ('moving', 'stopped', 'arrived', 'stale')
  )
);

comment on table public.drive_location_state is
  'Ephemeral exact location for active participants in one active Group Drive. No speed or history is stored.';
comment on column public.drive_location_state.id is
  'Opaque Realtime deletion key. Prevents unfilterable DELETE events from exposing drive or participant identifiers.';

create index drive_location_state_session_updated_idx
  on public.drive_location_state (drive_session_id, updated_at desc);

-- Server-owned lifecycle invariants -------------------------------------------------

create or replace function private.noxa_prepare_drive_session_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.host_id is distinct from old.host_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Group Drive identity and host are immutable';
  end if;

  -- Preserve the crew_id ON DELETE SET NULL contract even after the drive becomes
  -- immutable. Crew context is optional provenance and must never block Crew
  -- deletion or account cleanup.
  if old.crew_id is not null
    and new.crew_id is null
    and new.title is not distinct from old.title
    and new.description is not distinct from old.description
    and new.status is not distinct from old.status
    and new.scheduled_start_at is not distinct from old.scheduled_start_at
    and new.started_at is not distinct from old.started_at
    and new.active_expires_at is not distinct from old.active_expires_at
    and new.completed_at is not distinct from old.completed_at
    and new.end_reason is not distinct from old.end_reason
    and new.route_geometry is not distinct from old.route_geometry
    and new.route_distance_meters is not distinct from old.route_distance_meters
    and new.route_duration_seconds is not distinct from old.route_duration_seconds
    and new.route_provider is not distinct from old.route_provider
    and new.route_calculated_at is not distinct from old.route_calculated_at
    and new.route_version is not distinct from old.route_version
  then
    new.updated_at := now();
    return new;
  end if;

  if old.status in ('completed', 'cancelled') then
    raise exception 'A terminal Group Drive is immutable';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status in ('scheduled', 'active', 'cancelled'))
    or (old.status = 'scheduled' and new.status in ('active', 'cancelled'))
    or (old.status = 'active' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'Invalid Group Drive state transition: % to %', old.status, new.status;
  end if;

  if new.status = old.status and (
    new.started_at is distinct from old.started_at
    or new.active_expires_at is distinct from old.active_expires_at
    or new.completed_at is distinct from old.completed_at
    or new.end_reason is distinct from old.end_reason
  ) then
    raise exception 'Server-owned Group Drive lifecycle timestamps are immutable';
  end if;

  if new.status = 'scheduled' and new.scheduled_start_at <= now() then
    raise exception 'A scheduled Group Drive must start in the future';
  end if;

  if new.status = 'active' and old.status in ('draft', 'scheduled') and not (
    new.started_at = now()
    and new.active_expires_at = new.started_at + interval '8 hours'
    and new.completed_at is null
    and new.end_reason is null
  ) then
    raise exception 'Group Drive active window must be server-owned and eight hours';
  end if;

  if new.status = 'cancelled' and old.status in ('draft', 'scheduled') and not (
    new.started_at is not distinct from old.started_at
    and new.active_expires_at is not distinct from old.active_expires_at
    and new.completed_at = now()
    and new.end_reason = 'host_cancelled'
  ) then
    raise exception 'Invalid pre-start Group Drive cancellation metadata';
  end if;

  if old.status = 'active' and new.status in ('completed', 'cancelled') and not (
    new.started_at is not distinct from old.started_at
    and new.active_expires_at is not distinct from old.active_expires_at
    and new.completed_at = now()
    and (
      (new.status = 'completed' and new.end_reason = 'host_completed')
      or (
        new.status = 'cancelled'
        and new.end_reason in ('host_cancelled', 'expired')
      )
    )
  ) then
    raise exception 'Invalid terminal Group Drive metadata';
  end if;

  if old.status = 'active' and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.crew_id is distinct from old.crew_id
    or new.scheduled_start_at is distinct from old.scheduled_start_at
    or new.route_geometry is distinct from old.route_geometry
    or new.route_distance_meters is distinct from old.route_distance_meters
    or new.route_duration_seconds is distinct from old.route_duration_seconds
    or new.route_provider is distinct from old.route_provider
    or new.route_calculated_at is distinct from old.route_calculated_at
    or new.route_version is distinct from old.route_version
  ) then
    raise exception 'An active Group Drive route and details are immutable';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.noxa_prepare_drive_session_update()
  from public, anon, authenticated, service_role;

create trigger drive_sessions_prepare_update
  before update on public.drive_sessions
  for each row
  execute function private.noxa_prepare_drive_session_update();

create or replace function private.noxa_protect_drive_stop_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_drive_session_id uuid;
  session_status text;
begin
  if tg_op = 'DELETE' then
    target_drive_session_id := old.drive_session_id;
  else
    target_drive_session_id := new.drive_session_id;
  end if;

  select drive_sessions.status
  into session_status
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id;

  if session_status is null and tg_op = 'DELETE' then
    -- The parent session has already been removed by ON DELETE CASCADE. Allow
    -- account/session deletion to remove its stops regardless of prior status.
    return old;
  end if;

  if session_status is null then
    raise exception 'Group Drive not found';
  end if;

  if session_status not in ('draft', 'scheduled') then
    raise exception 'Group Drive stops are immutable after the drive starts';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.noxa_protect_drive_stop_mutation()
  from public, anon, authenticated, service_role;

create trigger drive_stops_protect_mutation
  before insert or update or delete on public.drive_stops
  for each row
  execute function private.noxa_protect_drive_stop_mutation();

create or replace function private.noxa_prepare_drive_participant_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_host_id uuid;
  session_status text;
begin
  select
    drive_sessions.host_id,
    drive_sessions.status
  into
    session_host_id,
    session_status
  from public.drive_sessions
  where drive_sessions.id = new.drive_session_id;

  if session_host_id is null or session_status not in ('draft', 'scheduled') then
    raise exception 'Participants can be added only before a Group Drive starts';
  end if;

  if new.role = 'host' and not (
    new.user_id = session_host_id
    and new.status = 'accepted'
  ) then
    raise exception 'The Group Drive host participant must match the session host';
  end if;

  if new.role = 'participant' and not (
    new.user_id <> session_host_id
    and new.status = 'accepted'
    and exists (
      select 1
      from public.drive_invitations
      where drive_invitations.drive_session_id = new.drive_session_id
        and drive_invitations.invited_user_id = new.user_id
        and drive_invitations.status in ('invited', 'accepted')
    )
  ) then
    raise exception 'A Group Drive participant requires an accepted invitation path';
  end if;

  new.joined_at := now();
  new.left_at := null;
  return new;
end;
$$;

revoke all on function private.noxa_prepare_drive_participant_insert()
  from public, anon, authenticated, service_role;

create trigger drive_participants_prepare_insert
  before insert on public.drive_participants
  for each row
  execute function private.noxa_prepare_drive_participant_insert();

create or replace function private.noxa_prepare_drive_participant_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.drive_session_id is distinct from old.drive_session_id
    or new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.joined_at is distinct from old.joined_at
  then
    raise exception 'Group Drive participant identity and role are immutable';
  end if;

  if old.status in ('left', 'removed') and new.status is distinct from old.status then
    raise exception 'A former Group Drive participant cannot rejoin in MVP';
  end if;

  if old.status = 'accepted' and new.status = 'active' and not exists (
    select 1
    from public.drive_sessions
    where drive_sessions.id = new.drive_session_id
      and drive_sessions.status = 'active'
  ) then
    raise exception 'A participant becomes active only with the Group Drive';
  end if;

  if new.status in ('left', 'removed') and not exists (
    select 1
    from public.drive_sessions
    where drive_sessions.id = new.drive_session_id
      and drive_sessions.status in ('draft', 'scheduled', 'active')
  ) then
    raise exception 'A participant cannot transition after the Group Drive ends';
  end if;

  if old.role = 'host' and not (
    new.status = old.status
    or (old.status = 'accepted' and new.status = 'active')
  ) then
    raise exception 'The Group Drive host cannot leave or be removed';
  end if;

  if old.role = 'participant' and new.status is distinct from old.status and not (
    (old.status = 'accepted' and new.status in ('active', 'left', 'removed'))
    or (old.status = 'active' and new.status in ('left', 'removed'))
  ) then
    raise exception 'Invalid Group Drive participant transition: % to %', old.status, new.status;
  end if;

  if new.status in ('left', 'removed') then
    new.left_at := coalesce(old.left_at, now());
  else
    new.left_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.noxa_prepare_drive_participant_update()
  from public, anon, authenticated, service_role;

create trigger drive_participants_prepare_update
  before update on public.drive_participants
  for each row
  execute function private.noxa_prepare_drive_participant_update();

create or replace function private.noxa_prepare_drive_invitation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.drive_session_id is distinct from old.drive_session_id
    or new.invited_user_id is distinct from old.invited_user_id
    or (
      new.source_crew_id is distinct from old.source_crew_id
      and not (old.source_crew_id is not null and new.source_crew_id is null)
    )
    or new.invited_by is distinct from old.invited_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Group Drive invitation identity is immutable';
  end if;

  if old.status <> 'invited' and new.status is distinct from old.status then
    raise exception 'A responded Group Drive invitation is immutable';
  end if;

  if new.status is distinct from old.status
    and new.status not in ('accepted', 'declined', 'cancelled')
  then
    raise exception 'Invalid Group Drive invitation transition';
  end if;

  if new.status = 'accepted' and not exists (
    select 1
    from public.drive_sessions
    where drive_sessions.id = new.drive_session_id
      and drive_sessions.status in ('draft', 'scheduled')
  ) then
    raise exception 'A Group Drive invitation cannot be accepted after start';
  end if;

  if new.status = 'invited' then
    new.responded_at := null;
  else
    new.responded_at := coalesce(old.responded_at, now());
  end if;

  return new;
end;
$$;

revoke all on function private.noxa_prepare_drive_invitation_update()
  from public, anon, authenticated, service_role;

create trigger drive_invitations_prepare_update
  before update on public.drive_invitations
  for each row
  execute function private.noxa_prepare_drive_invitation_update();

create or replace function private.noxa_prepare_drive_location_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.drive_session_id is distinct from old.drive_session_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Group Drive location identity is immutable';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.noxa_prepare_drive_location_state()
  from public, anon, authenticated, service_role;

create trigger drive_location_state_set_server_updated_at
  before insert or update on public.drive_location_state
  for each row
  execute function private.noxa_prepare_drive_location_state();

create or replace function private.noxa_apply_drive_session_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status <> 'active' then
    update public.drive_participants
    set status = 'active'
    where drive_session_id = new.id
      and status = 'accepted';

    update public.drive_invitations
    set status = 'cancelled'
    where drive_session_id = new.id
      and status = 'invited';
  elsif new.status in ('completed', 'cancelled')
    and old.status not in ('completed', 'cancelled')
  then
    delete from public.drive_location_state
    where drive_session_id = new.id;

    update public.drive_invitations
    set status = 'cancelled'
    where drive_session_id = new.id
      and status = 'invited';
  end if;

  return new;
end;
$$;

revoke all on function private.noxa_apply_drive_session_transition()
  from public, anon, authenticated, service_role;

create trigger drive_sessions_apply_transition
  after update of status on public.drive_sessions
  for each row
  when (new.status is distinct from old.status)
  execute function private.noxa_apply_drive_session_transition();

create or replace function private.noxa_delete_drive_location_on_participant_exit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('left', 'removed')
    and old.status not in ('left', 'removed')
  then
    delete from public.drive_location_state
    where drive_session_id = new.drive_session_id
      and user_id = new.user_id;
  end if;

  return new;
end;
$$;

revoke all on function private.noxa_delete_drive_location_on_participant_exit()
  from public, anon, authenticated, service_role;

create trigger drive_participants_delete_location_on_exit
  after update of status on public.drive_participants
  for each row
  when (new.status is distinct from old.status)
  execute function private.noxa_delete_drive_location_on_participant_exit();

-- Private authorization helpers ----------------------------------------------------

create or replace function private.noxa_is_drive_host(
  target_drive_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.drive_sessions
      where drive_sessions.id = target_drive_session_id
        and drive_sessions.host_id = (select auth.uid())
    );
$$;

create or replace function private.noxa_can_read_drive_raw(
  target_drive_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.drive_sessions
      where drive_sessions.id = target_drive_session_id
        and drive_sessions.status in ('draft', 'scheduled', 'active')
        and (
          drive_sessions.host_id = (select auth.uid())
          or exists (
            select 1
            from public.drive_participants
            where drive_participants.drive_session_id = target_drive_session_id
              and drive_participants.user_id = (select auth.uid())
              and drive_participants.status in ('accepted', 'active')
          )
        )
        and (
          drive_sessions.host_id = (select auth.uid())
          or not private.noxa_users_blocked(
            (select auth.uid()),
            drive_sessions.host_id
          )
        )
    );
$$;

create or replace function private.noxa_is_active_drive_participant(
  target_drive_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.drive_sessions
      join public.drive_participants
        on drive_participants.drive_session_id = drive_sessions.id
      where drive_sessions.id = target_drive_session_id
        and drive_sessions.status = 'active'
        and drive_sessions.active_expires_at > now()
        and drive_participants.user_id = (select auth.uid())
        and drive_participants.status = 'active'
        and (
          drive_sessions.host_id = (select auth.uid())
          or not private.noxa_users_blocked(
            (select auth.uid()),
            drive_sessions.host_id
          )
        )
    );
$$;

revoke all on function private.noxa_is_drive_host(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.noxa_can_read_drive_raw(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.noxa_is_active_drive_participant(uuid)
  from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;
grant execute on function private.noxa_is_drive_host(uuid) to authenticated;
grant execute on function private.noxa_can_read_drive_raw(uuid) to authenticated;
grant execute on function private.noxa_is_active_drive_participant(uuid)
  to authenticated;

-- Table privileges are deliberately narrower than the RLS surface. All durable
-- writes use reviewed RPCs, including ephemeral own-location upserts.

revoke all on table public.drive_sessions from anon, authenticated;
revoke all on table public.drive_stops from anon, authenticated;
revoke all on table public.drive_participants from anon, authenticated;
revoke all on table public.drive_invitations from anon, authenticated;
revoke all on table public.drive_location_state from anon, authenticated;

grant select on table public.drive_sessions to authenticated;
grant select on table public.drive_stops to authenticated;
grant select on table public.drive_participants to authenticated;
grant select on table public.drive_invitations to authenticated;
grant select on table public.drive_location_state to authenticated;

alter table public.drive_sessions enable row level security;
alter table public.drive_stops enable row level security;
alter table public.drive_participants enable row level security;
alter table public.drive_invitations enable row level security;
alter table public.drive_location_state enable row level security;

create policy drive_sessions_select_current_members
  on public.drive_sessions
  for select
  to authenticated
  using (private.noxa_can_read_drive_raw(id));

create policy drive_stops_select_current_members
  on public.drive_stops
  for select
  to authenticated
  using (private.noxa_can_read_drive_raw(drive_session_id));

create policy drive_participants_select_current_members_or_self
  on public.drive_participants
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.noxa_can_read_drive_raw(drive_session_id)
  );

create policy drive_participants_blocks_hide
  on public.drive_participants
  as restrictive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), user_id)
  );

create policy drive_invitations_select_recipient_or_host
  on public.drive_invitations
  for select
  to authenticated
  using (
    invited_user_id = (select auth.uid())
    or private.noxa_is_drive_host(drive_session_id)
  );

create policy drive_invitations_blocks_hide
  on public.drive_invitations
  as restrictive
  for select
  to authenticated
  using (
    (
      invited_user_id = (select auth.uid())
      and not private.noxa_users_blocked((select auth.uid()), invited_by)
    )
    or (
      invited_by = (select auth.uid())
      and not private.noxa_users_blocked((select auth.uid()), invited_user_id)
    )
  );

create policy drive_location_state_select_active_members
  on public.drive_location_state
  for select
  to authenticated
  using (private.noxa_is_active_drive_participant(drive_session_id));

create policy drive_location_state_blocks_hide
  on public.drive_location_state
  as restrictive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), user_id)
  );

-- Intentional authenticated RPC surface -------------------------------------------

create or replace function public.noxa_create_drive_session(
  drive_title text,
  drive_description text default null,
  context_crew_id uuid default null,
  drive_scheduled_start_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  created_drive_session_id uuid;
  initial_status text := case
    when drive_scheduled_start_at is null then 'draft'
    else 'scheduled'
  end;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if drive_title is null
    or char_length(btrim(drive_title)) not between 2 and 100
  then
    raise exception 'Group Drive title must contain 2 to 100 characters';
  end if;

  if drive_description is not null
    and char_length(drive_description) > 1000
  then
    raise exception 'Group Drive description is too long';
  end if;

  if drive_scheduled_start_at is not null
    and drive_scheduled_start_at <= now()
  then
    raise exception 'A scheduled Group Drive must start in the future';
  end if;

  if context_crew_id is not null and not exists (
    select 1
    from public.crew_members
    where crew_members.crew_id = context_crew_id
      and crew_members.user_id = actor
  ) then
    raise exception 'Crew context is available only to a current Crew member';
  end if;

  insert into public.drive_sessions (
    host_id,
    title,
    description,
    crew_id,
    status,
    scheduled_start_at
  ) values (
    actor,
    btrim(drive_title),
    nullif(btrim(drive_description), ''),
    context_crew_id,
    initial_status,
    drive_scheduled_start_at
  )
  returning id into created_drive_session_id;

  insert into public.drive_participants (
    drive_session_id,
    user_id,
    role,
    status
  ) values (
    created_drive_session_id,
    actor,
    'host',
    'accepted'
  );

  return created_drive_session_id;
end;
$$;

create or replace function public.noxa_update_drive_details(
  target_drive_session_id uuid,
  drive_title text,
  drive_description text default null,
  context_crew_id uuid default null,
  drive_scheduled_start_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_session public.drive_sessions%rowtype;
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
    raise exception 'Only the Group Drive host can edit details';
  end if;

  if current_session.status not in ('draft', 'scheduled') then
    raise exception 'Group Drive details are immutable after start';
  end if;

  if drive_title is null
    or char_length(btrim(drive_title)) not between 2 and 100
  then
    raise exception 'Group Drive title must contain 2 to 100 characters';
  end if;

  if drive_description is not null
    and char_length(drive_description) > 1000
  then
    raise exception 'Group Drive description is too long';
  end if;

  if drive_scheduled_start_at is not null
    and drive_scheduled_start_at <= now()
  then
    raise exception 'A scheduled Group Drive must start in the future';
  end if;

  if current_session.status = 'scheduled'
    and drive_scheduled_start_at is null
  then
    raise exception 'A scheduled Group Drive cannot return to draft in MVP';
  end if;

  if context_crew_id is not null and not exists (
    select 1
    from public.crew_members
    where crew_members.crew_id = context_crew_id
      and crew_members.user_id = actor
  ) then
    raise exception 'Crew context is available only to a current Crew member';
  end if;

  update public.drive_sessions
  set
    title = btrim(drive_title),
    description = nullif(btrim(drive_description), ''),
    crew_id = context_crew_id,
    scheduled_start_at = drive_scheduled_start_at,
    status = case
      when drive_scheduled_start_at is null then 'draft'
      else 'scheduled'
    end
  where id = current_session.id;

  return true;
end;
$$;

create or replace function public.noxa_set_drive_route(
  target_drive_session_id uuid,
  start_latitude double precision,
  start_longitude double precision,
  start_label text,
  end_latitude double precision,
  end_longitude double precision,
  end_label text,
  calculated_route_geometry jsonb,
  calculated_distance_meters numeric,
  calculated_duration_seconds numeric,
  calculated_route_provider text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_session public.drive_sessions%rowtype;
  next_route_version integer;
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
    raise exception 'Group Drive not found';
  end if;

  if current_session.host_id <> actor then
    raise exception 'Only the Group Drive host can set the route';
  end if;

  if current_session.status not in ('draft', 'scheduled') then
    raise exception 'Group Drive route is immutable after start';
  end if;

  if start_latitude is null or start_latitude not between -90 and 90
    or end_latitude is null or end_latitude not between -90 and 90
    or start_longitude is null or start_longitude not between -180 and 180
    or end_longitude is null or end_longitude not between -180 and 180
  then
    raise exception 'Invalid Group Drive coordinates';
  end if;

  if calculated_route_geometry is null
    or jsonb_typeof(calculated_route_geometry) <> 'object'
  then
    raise exception 'A calculated route geometry object is required';
  end if;

  if calculated_distance_meters is null or calculated_distance_meters < 0
    or calculated_duration_seconds is null or calculated_duration_seconds < 0
  then
    raise exception 'Calculated distance and duration must be non-negative';
  end if;

  if calculated_route_provider is null
    or char_length(btrim(calculated_route_provider)) not between 1 and 80
  then
    raise exception 'A route provider is required';
  end if;

  if start_label is not null and char_length(start_label) > 160
    or end_label is not null and char_length(end_label) > 160
  then
    raise exception 'A Group Drive stop label is too long';
  end if;

  delete from public.drive_stops
  where drive_session_id = current_session.id;

  insert into public.drive_stops (
    drive_session_id,
    sequence,
    kind,
    latitude,
    longitude,
    label
  ) values
    (
      current_session.id,
      0,
      'start',
      start_latitude,
      start_longitude,
      nullif(btrim(start_label), '')
    ),
    (
      current_session.id,
      1,
      'end',
      end_latitude,
      end_longitude,
      nullif(btrim(end_label), '')
    );

  next_route_version := current_session.route_version + 1;

  update public.drive_sessions
  set
    route_geometry = calculated_route_geometry,
    route_distance_meters = calculated_distance_meters,
    route_duration_seconds = calculated_duration_seconds,
    route_provider = btrim(calculated_route_provider),
    route_calculated_at = now(),
    route_version = next_route_version
  where id = current_session.id;

  return next_route_version;
end;
$$;

create or replace function public.noxa_invite_user_to_drive(
  target_drive_session_id uuid,
  target_user_id uuid,
  invitation_source_crew_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_session public.drive_sessions%rowtype;
  existing_invitation_id uuid;
  created_invitation_id uuid;
begin
  if actor is null
    or target_drive_session_id is null
    or target_user_id is null
  then
    raise exception 'Authentication required';
  end if;

  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  if current_session.id is null then
    raise exception 'Group Drive not found';
  end if;

  if current_session.host_id <> actor then
    raise exception 'Only the Group Drive host can invite participants';
  end if;

  if current_session.status not in ('draft', 'scheduled') then
    raise exception 'Participants cannot be invited after the drive starts';
  end if;

  if target_user_id = actor then
    raise exception 'The Group Drive host is already a participant';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = target_user_id
  ) then
    raise exception 'NOXA profile not found';
  end if;

  if private.noxa_users_blocked(actor, target_user_id) then
    raise exception 'This user cannot be invited';
  end if;

  if exists (
    select 1
    from public.drive_participants
    where drive_participants.drive_session_id = current_session.id
      and drive_participants.user_id = target_user_id
  ) then
    raise exception 'This user already has a Group Drive participant record';
  end if;

  if invitation_source_crew_id is null then
    if not (
      exists (
        select 1
        from public.follows
        where follows.follower_id = actor
          and follows.following_id = target_user_id
      )
      and exists (
        select 1
        from public.follows
        where follows.follower_id = target_user_id
          and follows.following_id = actor
      )
    ) then
      raise exception 'Individual Group Drive invitations require a mutual friend';
    end if;
  elsif not (
    exists (
      select 1
      from public.crew_members
      where crew_members.crew_id = invitation_source_crew_id
        and crew_members.user_id = actor
    )
    and exists (
      select 1
      from public.crew_members
      where crew_members.crew_id = invitation_source_crew_id
        and crew_members.user_id = target_user_id
    )
  ) then
    raise exception 'Crew invitation source requires current shared membership';
  end if;

  select drive_invitations.id
  into existing_invitation_id
  from public.drive_invitations
  where drive_invitations.drive_session_id = current_session.id
    and drive_invitations.invited_user_id = target_user_id
    and drive_invitations.status = 'invited';

  if existing_invitation_id is not null then
    return existing_invitation_id;
  end if;

  insert into public.drive_invitations (
    drive_session_id,
    invited_user_id,
    source_crew_id,
    invited_by
  ) values (
    current_session.id,
    target_user_id,
    invitation_source_crew_id,
    actor
  )
  returning id into created_invitation_id;

  return created_invitation_id;
end;
$$;

create or replace function public.noxa_invite_crew_to_drive(
  target_drive_session_id uuid,
  invitation_source_crew_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_session public.drive_sessions%rowtype;
  inserted_count integer;
begin
  if actor is null
    or target_drive_session_id is null
    or invitation_source_crew_id is null
  then
    raise exception 'Authentication required';
  end if;

  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  if current_session.id is null then
    raise exception 'Group Drive not found';
  end if;

  if current_session.host_id <> actor then
    raise exception 'Only the Group Drive host can invite a Crew';
  end if;

  if current_session.status not in ('draft', 'scheduled') then
    raise exception 'Participants cannot be invited after the drive starts';
  end if;

  if not exists (
    select 1
    from public.crew_members
    where crew_members.crew_id = invitation_source_crew_id
      and crew_members.user_id = actor
  ) then
    raise exception 'The host must be a current member of the selected Crew';
  end if;

  insert into public.drive_invitations (
    drive_session_id,
    invited_user_id,
    source_crew_id,
    invited_by
  )
  select
    current_session.id,
    crew_members.user_id,
    invitation_source_crew_id,
    actor
  from public.crew_members
  where crew_members.crew_id = invitation_source_crew_id
    and crew_members.user_id <> actor
    and not private.noxa_users_blocked(actor, crew_members.user_id)
    and not exists (
      select 1
      from public.drive_participants
      where drive_participants.drive_session_id = current_session.id
        and drive_participants.user_id = crew_members.user_id
    )
    and not exists (
      select 1
      from public.drive_invitations
      where drive_invitations.drive_session_id = current_session.id
        and drive_invitations.invited_user_id = crew_members.user_id
        and drive_invitations.status = 'invited'
    )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.noxa_respond_to_drive_invitation(
  target_invitation_id uuid,
  accept_invitation boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_drive_session_id uuid;
  current_session public.drive_sessions%rowtype;
  current_invitation public.drive_invitations%rowtype;
begin
  if actor is null
    or target_invitation_id is null
    or accept_invitation is null
  then
    raise exception 'Authentication required';
  end if;

  select drive_invitations.drive_session_id
  into target_drive_session_id
  from public.drive_invitations
  where drive_invitations.id = target_invitation_id;

  if target_drive_session_id is null then
    return false;
  end if;

  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  select *
  into current_invitation
  from public.drive_invitations
  where drive_invitations.id = target_invitation_id
  for update;

  if current_invitation.id is null
    or current_invitation.drive_session_id <> current_session.id
    or current_invitation.invited_user_id <> actor
    or current_invitation.status <> 'invited'
  then
    return false;
  end if;

  if current_session.status not in ('draft', 'scheduled') then
    raise exception 'This Group Drive invitation can no longer be accepted or declined';
  end if;

  if private.noxa_users_blocked(actor, current_session.host_id) then
    raise exception 'This Group Drive invitation is unavailable';
  end if;

  if accept_invitation then
    insert into public.drive_participants (
      drive_session_id,
      user_id,
      role,
      status
    ) values (
      current_session.id,
      actor,
      'participant',
      'accepted'
    );

    update public.drive_invitations
    set status = 'accepted'
    where id = current_invitation.id;
  else
    update public.drive_invitations
    set status = 'declined'
    where id = current_invitation.id;
  end if;

  return true;
end;
$$;

create or replace function public.noxa_cancel_drive_invitation(
  target_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_drive_session_id uuid;
  current_session public.drive_sessions%rowtype;
  current_invitation public.drive_invitations%rowtype;
begin
  if actor is null or target_invitation_id is null then
    raise exception 'Authentication required';
  end if;

  select drive_invitations.drive_session_id
  into target_drive_session_id
  from public.drive_invitations
  where drive_invitations.id = target_invitation_id;

  if target_drive_session_id is null then
    return false;
  end if;

  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  select *
  into current_invitation
  from public.drive_invitations
  where drive_invitations.id = target_invitation_id
  for update;

  if current_invitation.id is null
    or current_invitation.drive_session_id <> current_session.id
    or current_invitation.status <> 'invited'
  then
    return false;
  end if;

  if current_session.host_id <> actor then
    raise exception 'Only the Group Drive host can cancel an invitation';
  end if;

  update public.drive_invitations
  set status = 'cancelled'
  where id = current_invitation.id;

  return true;
end;
$$;

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

create or replace function public.noxa_cancel_drive(
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
    raise exception 'Only the Group Drive host can cancel the drive';
  end if;

  if current_session.status not in ('draft', 'scheduled', 'active') then
    return false;
  end if;

  update public.drive_sessions
  set
    status = 'cancelled',
    completed_at = now(),
    end_reason = 'host_cancelled'
  where id = current_session.id;

  return true;
end;
$$;

create or replace function public.noxa_end_drive(
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
    raise exception 'Only the Group Drive host can end the drive';
  end if;

  if current_session.status <> 'active' then
    return false;
  end if;

  update public.drive_sessions
  set
    status = 'completed',
    completed_at = now(),
    end_reason = 'host_completed'
  where id = current_session.id;

  return true;
end;
$$;

create or replace function public.noxa_leave_drive(
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
  current_participant public.drive_participants%rowtype;
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

  select *
  into current_participant
  from public.drive_participants
  where drive_participants.drive_session_id = current_session.id
    and drive_participants.user_id = actor
  for update;

  if current_participant.user_id is null
    or current_participant.status not in ('accepted', 'active')
  then
    return false;
  end if;

  if current_participant.role = 'host' then
    raise exception 'The Group Drive host must cancel or end the drive';
  end if;

  if current_session.status not in ('draft', 'scheduled', 'active') then
    return false;
  end if;

  update public.drive_participants
  set status = 'left'
  where drive_session_id = current_session.id
    and user_id = actor;

  return true;
end;
$$;

create or replace function public.noxa_remove_drive_participant(
  target_drive_session_id uuid,
  target_user_id uuid
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
    or target_user_id is null
  then
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
    raise exception 'Only the Group Drive host can remove a participant';
  end if;

  if target_user_id = actor then
    raise exception 'The Group Drive host cannot be removed';
  end if;

  if current_session.status not in ('draft', 'scheduled', 'active') then
    return false;
  end if;

  select *
  into current_participant
  from public.drive_participants
  where drive_participants.drive_session_id = current_session.id
    and drive_participants.user_id = target_user_id
  for update;

  if current_participant.user_id is null
    or current_participant.role = 'host'
    or current_participant.status not in ('accepted', 'active')
  then
    return false;
  end if;

  update public.drive_participants
  set status = 'removed'
  where drive_session_id = current_session.id
    and user_id = target_user_id;

  return true;
end;
$$;

create or replace function public.noxa_upsert_drive_location(
  target_drive_session_id uuid,
  location_latitude double precision,
  location_longitude double precision,
  location_heading double precision,
  location_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  session_status text;
  session_active_expires_at timestamptz;
  session_host_id uuid;
  participant_status text;
  location_state_id uuid;
begin
  if actor is null or target_drive_session_id is null then
    raise exception 'Authentication required';
  end if;

  if location_latitude is null or location_latitude not between -90 and 90
    or location_longitude is null or location_longitude not between -180 and 180
    or location_heading is not null
      and (location_heading < 0 or location_heading >= 360)
    or location_status is null
    or location_status not in ('moving', 'stopped', 'arrived', 'stale')
  then
    raise exception 'Invalid Group Drive location state';
  end if;

  -- Locks are acquired in the same session -> participant order as every lifecycle
  -- RPC. A concurrent Leave, Remove, End, Cancel, or Expire must therefore wait for
  -- this upsert to commit before its synchronous location cleanup runs.
  select
    drive_sessions.status,
    drive_sessions.active_expires_at,
    drive_sessions.host_id
  into
    session_status,
    session_active_expires_at,
    session_host_id
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for share;

  if session_status is distinct from 'active'
    or session_active_expires_at is null
    or session_active_expires_at <= now()
  then
    raise exception 'Group Drive location is available only during an active session';
  end if;

  select drive_participants.status
  into participant_status
  from public.drive_participants
  where drive_participants.drive_session_id = target_drive_session_id
    and drive_participants.user_id = actor
  for share;

  if participant_status is distinct from 'active' then
    raise exception 'Only an active Group Drive participant can publish location';
  end if;

  if private.noxa_users_blocked(actor, session_host_id) then
    raise exception 'This Group Drive is unavailable';
  end if;

  insert into public.drive_location_state (
    drive_session_id,
    user_id,
    latitude,
    longitude,
    heading,
    status
  ) values (
    target_drive_session_id,
    actor,
    location_latitude,
    location_longitude,
    location_heading,
    location_status
  )
  on conflict (drive_session_id, user_id) do update
  set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    heading = excluded.heading,
    status = excluded.status
  returning id into location_state_id;

  return location_state_id;
end;
$$;

create or replace function public.noxa_get_drive_invitation_preview(
  target_invitation_id uuid
)
returns table (
  drive_session_id uuid,
  title text,
  host_display_name text,
  scheduled_start_at timestamptz,
  route_distance_meters numeric,
  route_duration_seconds numeric,
  approximate_destination_label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or target_invitation_id is null then
    return;
  end if;

  return query
  select
    drive_sessions.id,
    drive_sessions.title,
    profiles.display_name,
    drive_sessions.scheduled_start_at,
    drive_sessions.route_distance_meters,
    drive_sessions.route_duration_seconds,
    coalesce(
      nullif(btrim(destination.label), ''),
      'Destination shared after joining'
    )
  from public.drive_invitations
  join public.drive_sessions
    on drive_sessions.id = drive_invitations.drive_session_id
  join public.profiles
    on profiles.id = drive_sessions.host_id
  left join public.drive_stops as destination
    on destination.drive_session_id = drive_sessions.id
    and destination.kind = 'end'
  where drive_invitations.id = target_invitation_id
    and drive_invitations.invited_user_id = actor
    and drive_invitations.status = 'invited'
    and drive_sessions.status in ('draft', 'scheduled')
    and not private.noxa_users_blocked(actor, drive_sessions.host_id);
end;
$$;

create or replace function public.noxa_list_my_group_drives()
returns table (
  drive_session_id uuid,
  title text,
  session_status text,
  my_role text,
  my_participant_status text,
  my_invitation_status text,
  scheduled_start_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  route_distance_meters numeric,
  route_duration_seconds numeric,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    return;
  end if;

  return query
  select
    drive_sessions.id,
    drive_sessions.title,
    drive_sessions.status,
    drive_participants.role,
    drive_participants.status,
    current_invitation.status,
    drive_sessions.scheduled_start_at,
    drive_sessions.started_at,
    drive_sessions.completed_at,
    drive_sessions.route_distance_meters,
    drive_sessions.route_duration_seconds,
    drive_sessions.updated_at
  from public.drive_sessions
  left join public.drive_participants
    on drive_participants.drive_session_id = drive_sessions.id
    and drive_participants.user_id = actor
  left join lateral (
    select drive_invitations.status
    from public.drive_invitations
    where drive_invitations.drive_session_id = drive_sessions.id
      and drive_invitations.invited_user_id = actor
      and drive_invitations.status = 'invited'
    order by drive_invitations.created_at desc
    limit 1
  ) as current_invitation on true
  where (
    drive_sessions.host_id = actor
    or (
      drive_participants.user_id = actor
      and (
        drive_participants.status in ('accepted', 'active')
        or drive_sessions.status in ('completed', 'cancelled')
      )
    )
    or current_invitation.status = 'invited'
  )
    and (
      drive_sessions.host_id = actor
      or not private.noxa_users_blocked(actor, drive_sessions.host_id)
    )
  order by
    case drive_sessions.status
      when 'active' then 0
      when 'scheduled' then 1
      when 'draft' then 2
      else 3
    end,
    drive_sessions.updated_at desc;
end;
$$;

create or replace function public.noxa_get_drive_summary(
  target_drive_session_id uuid
)
returns table (
  drive_session_id uuid,
  title text,
  session_status text,
  end_reason text,
  completed_at timestamptz,
  route_distance_meters numeric,
  route_duration_seconds numeric,
  participants jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or target_drive_session_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.drive_sessions
    where drive_sessions.id = target_drive_session_id
      and drive_sessions.status in ('completed', 'cancelled')
      and (
        drive_sessions.host_id = actor
        or not private.noxa_users_blocked(actor, drive_sessions.host_id)
      )
      and (
        drive_sessions.host_id = actor
        or exists (
          select 1
          from public.drive_participants
          where drive_participants.drive_session_id = target_drive_session_id
            and drive_participants.user_id = actor
        )
      )
  ) then
    return;
  end if;

  return query
  select
    drive_sessions.id,
    drive_sessions.title,
    drive_sessions.status,
    drive_sessions.end_reason,
    drive_sessions.completed_at,
    drive_sessions.route_distance_meters,
    drive_sessions.route_duration_seconds,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', summary_participants.user_id,
            'display_name', profiles.display_name,
            'role', summary_participants.role,
            'status', summary_participants.status
          )
          order by
            case summary_participants.role when 'host' then 0 else 1 end,
            summary_participants.joined_at
        )
        from public.drive_participants as summary_participants
        join public.profiles
          on profiles.id = summary_participants.user_id
        where summary_participants.drive_session_id = drive_sessions.id
          and (
            summary_participants.user_id = actor
            or not private.noxa_users_blocked(
              actor,
              summary_participants.user_id
            )
          )
      ),
      '[]'::jsonb
    )
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
    and drive_sessions.status in ('completed', 'cancelled');
end;
$$;

-- Phase 1 creates the narrowly-scoped expiry primitive but does not schedule it.
-- Phase 3 must add the reviewed server-side cadence and verify its retention gate.
create or replace function private.noxa_expire_group_drives()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  with expired_sessions as (
    select drive_sessions.id
    from public.drive_sessions
    where drive_sessions.status = 'active'
      and drive_sessions.active_expires_at <= now()
    for update skip locked
  ), updated_sessions as (
    update public.drive_sessions
    set
      status = 'cancelled',
      completed_at = now(),
      end_reason = 'expired'
    where drive_sessions.id in (
      select expired_sessions.id from expired_sessions
    )
    returning drive_sessions.id
  )
  select count(*)::integer
  into expired_count
  from updated_sessions;

  return expired_count;
end;
$$;

revoke all on function private.noxa_expire_group_drives()
  from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.noxa_expire_group_drives() to service_role;

-- Explicitly revoke default PUBLIC execution before granting the reviewed client API.

revoke all on function public.noxa_create_drive_session(text, text, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.noxa_update_drive_details(uuid, text, text, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.noxa_set_drive_route(uuid, double precision, double precision, text, double precision, double precision, text, jsonb, numeric, numeric, text)
  from public, anon, authenticated;
revoke all on function public.noxa_invite_user_to_drive(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.noxa_invite_crew_to_drive(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.noxa_respond_to_drive_invitation(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.noxa_cancel_drive_invitation(uuid)
  from public, anon, authenticated;
revoke all on function public.noxa_start_drive(uuid)
  from public, anon, authenticated;
revoke all on function public.noxa_cancel_drive(uuid)
  from public, anon, authenticated;
revoke all on function public.noxa_end_drive(uuid)
  from public, anon, authenticated;
revoke all on function public.noxa_leave_drive(uuid)
  from public, anon, authenticated;
revoke all on function public.noxa_remove_drive_participant(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.noxa_upsert_drive_location(uuid, double precision, double precision, double precision, text)
  from public, anon, authenticated;
revoke all on function public.noxa_get_drive_invitation_preview(uuid)
  from public, anon, authenticated;
revoke all on function public.noxa_list_my_group_drives()
  from public, anon, authenticated;
revoke all on function public.noxa_get_drive_summary(uuid)
  from public, anon, authenticated;

grant execute on function public.noxa_create_drive_session(text, text, uuid, timestamptz)
  to authenticated;
grant execute on function public.noxa_update_drive_details(uuid, text, text, uuid, timestamptz)
  to authenticated;
grant execute on function public.noxa_set_drive_route(uuid, double precision, double precision, text, double precision, double precision, text, jsonb, numeric, numeric, text)
  to authenticated;
grant execute on function public.noxa_invite_user_to_drive(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.noxa_invite_crew_to_drive(uuid, uuid)
  to authenticated;
grant execute on function public.noxa_respond_to_drive_invitation(uuid, boolean)
  to authenticated;
grant execute on function public.noxa_cancel_drive_invitation(uuid)
  to authenticated;
grant execute on function public.noxa_start_drive(uuid)
  to authenticated;
grant execute on function public.noxa_cancel_drive(uuid)
  to authenticated;
grant execute on function public.noxa_end_drive(uuid)
  to authenticated;
grant execute on function public.noxa_leave_drive(uuid)
  to authenticated;
grant execute on function public.noxa_remove_drive_participant(uuid, uuid)
  to authenticated;
grant execute on function public.noxa_upsert_drive_location(uuid, double precision, double precision, double precision, text)
  to authenticated;
grant execute on function public.noxa_get_drive_invitation_preview(uuid)
  to authenticated;
grant execute on function public.noxa_list_my_group_drives()
  to authenticated;
grant execute on function public.noxa_get_drive_summary(uuid)
  to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'drive_location_state'
  ) then
    alter publication supabase_realtime
      add table public.drive_location_state;
  end if;
end;
$$;
