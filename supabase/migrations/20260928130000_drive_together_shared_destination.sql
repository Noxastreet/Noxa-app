-- Drive Together v2: one shared destination, 2-8 drivers, per-device routes.
-- Planned Group Drive behavior remains unchanged. Quick mode gains destination
-- proposals, late join, per-driver remaining distance, automatic arrival cleanup,
-- and no retained quick-drive history after termination.

alter table public.drive_sessions
  add column if not exists destination_latitude double precision,
  add column if not exists destination_longitude double precision,
  add column if not exists destination_label text,
  add column if not exists destination_version integer not null default 0,
  add column if not exists destination_updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists destination_updated_at timestamptz,
  add column if not exists proposed_destination_latitude double precision,
  add column if not exists proposed_destination_longitude double precision,
  add column if not exists proposed_destination_label text,
  add column if not exists proposed_destination_by uuid references public.profiles(id) on delete set null,
  add column if not exists proposed_destination_at timestamptz;

alter table public.drive_sessions
  drop constraint if exists drive_sessions_destination_coordinates_check;
alter table public.drive_sessions
  add constraint drive_sessions_destination_coordinates_check check (
    (
      destination_latitude is null
      and destination_longitude is null
    )
    or (
      destination_latitude between -90 and 90
      and destination_longitude between -180 and 180
    )
  );

alter table public.drive_sessions
  drop constraint if exists drive_sessions_destination_version_check;
alter table public.drive_sessions
  add constraint drive_sessions_destination_version_check check (
    destination_version >= 0
    and (
      destination_version = 0
      or (
        destination_latitude is not null
        and destination_longitude is not null
      )
    )
  );

alter table public.drive_sessions
  drop constraint if exists drive_sessions_destination_label_check;
alter table public.drive_sessions
  add constraint drive_sessions_destination_label_check check (
    destination_label is null or char_length(destination_label) <= 160
  );

alter table public.drive_sessions
  drop constraint if exists drive_sessions_destination_audit_check;
alter table public.drive_sessions
  add constraint drive_sessions_destination_audit_check check (
    (
      destination_version = 0
      and destination_updated_at is null
    )
    or (
      destination_version > 0
      and destination_updated_at is not null
    )
  );

alter table public.drive_sessions
  drop constraint if exists drive_sessions_destination_proposal_check;
alter table public.drive_sessions
  add constraint drive_sessions_destination_proposal_check check (
    (
      proposed_destination_latitude is null
      and proposed_destination_longitude is null
      and proposed_destination_label is null
      and proposed_destination_by is null
      and proposed_destination_at is null
    )
    or (
      proposed_destination_latitude between -90 and 90
      and proposed_destination_longitude between -180 and 180
      and proposed_destination_by is not null
      and proposed_destination_at is not null
      and (
        proposed_destination_label is null
        or char_length(proposed_destination_label) <= 160
      )
    )
  );

alter table public.drive_location_state
  add column if not exists remaining_distance_meters numeric,
  add column if not exists route_destination_version integer;

alter table public.drive_location_state
  drop constraint if exists drive_location_state_remaining_distance_check;
alter table public.drive_location_state
  add constraint drive_location_state_remaining_distance_check check (
    remaining_distance_meters is null or remaining_distance_meters >= 0
  );

alter table public.drive_location_state
  drop constraint if exists drive_location_state_destination_version_check;
alter table public.drive_location_state
  add constraint drive_location_state_destination_version_check check (
    route_destination_version is null or route_destination_version >= 0
  );

comment on column public.drive_sessions.destination_latitude is
  'Canonical shared destination latitude for quick Drive Together. Each participant calculates their own route locally.';
comment on column public.drive_sessions.destination_version is
  'Monotonic shared destination version. Per-driver progress is displayed only when it matches this version.';
comment on column public.drive_sessions.proposed_destination_by is
  'Latest destination proposer for a quick Drive Together. Host approval commits the proposal.';
comment on column public.drive_location_state.remaining_distance_meters is
  'Participant-published remaining road distance for the current shared destination. Route geometry is never shared.';
comment on column public.drive_location_state.route_destination_version is
  'Destination version used to calculate remaining_distance_meters.';

-- Quick mode may add invited participants after the room is already active.
create or replace function private.noxa_prepare_drive_participant_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_host_id uuid;
  session_status text;
  session_drive_mode text;
begin
  select
    drive_sessions.host_id,
    drive_sessions.status,
    drive_sessions.drive_mode
  into
    session_host_id,
    session_status,
    session_drive_mode
  from public.drive_sessions
  where drive_sessions.id = new.drive_session_id;

  if session_host_id is null then
    raise exception 'Group Drive not found';
  end if;

  if session_drive_mode = 'planned' and session_status not in ('draft', 'scheduled') then
    raise exception 'Participants can be added only before a Group Drive starts';
  end if;

  if session_drive_mode = 'quick' and session_status not in ('draft', 'active') then
    raise exception 'Drive Together is no longer available';
  end if;

  if new.role = 'host' and not (
    new.user_id = session_host_id
    and new.status = 'accepted'
    and session_status = 'draft'
  ) then
    raise exception 'The Group Drive host participant must match the session host';
  end if;

  if new.role = 'participant' and not (
    new.user_id <> session_host_id
    and (
      (
        session_drive_mode = 'planned'
        and session_status in ('draft', 'scheduled')
        and new.status = 'accepted'
      )
      or (
        session_drive_mode = 'quick'
        and (
          (session_status = 'draft' and new.status = 'accepted')
          or (session_status = 'active' and new.status = 'active')
        )
      )
    )
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

-- Planned invitations still stop at start. Quick invitations remain valid for
-- late join while the shared room is active.
create or replace function private.noxa_prepare_drive_invitation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  session_status text;
  session_drive_mode text;
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

  if new.status = 'accepted' then
    select drive_sessions.status, drive_sessions.drive_mode
    into session_status, session_drive_mode
    from public.drive_sessions
    where drive_sessions.id = new.drive_session_id;

    if session_status is null
      or (
        session_drive_mode = 'planned'
        and session_status not in ('draft', 'scheduled')
      )
      or (
        session_drive_mode = 'quick'
        and session_status not in ('draft', 'active')
      )
    then
      raise exception 'A Group Drive invitation cannot be accepted after start';
    end if;
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

-- Starting a planned Group Drive still cancels pending invitations. Quick rooms
-- deliberately keep them so invited drivers can join later.
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

    if new.drive_mode = 'planned' then
      update public.drive_invitations
      set status = 'cancelled'
      where drive_session_id = new.id
        and status = 'invited';
    end if;
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

-- Create a quick room only after the shared destination is chosen. One to seven
-- mutual friends may be invited, producing a 2-8 driver room including host.
create or replace function public.noxa_create_quick_drive_with_destination(
  target_user_ids uuid[],
  destination_latitude double precision,
  destination_longitude double precision,
  destination_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  normalized_targets uuid[];
  target_count integer;
  created_drive_id uuid;
  invitation_ids uuid[];
  target_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if destination_latitude is null
    or destination_longitude is null
    or destination_latitude < -90
    or destination_latitude > 90
    or destination_longitude < -180
    or destination_longitude > 180
  then
    raise exception 'A valid destination is required';
  end if;

  if destination_label is not null and char_length(btrim(destination_label)) > 160 then
    raise exception 'Destination label is too long';
  end if;

  select coalesce(
    array_agg(distinct candidate.target_user_id order by candidate.target_user_id),
    array[]::uuid[]
  )
  into normalized_targets
  from unnest(coalesce(target_user_ids, array[]::uuid[]))
    as candidate(target_user_id)
  where candidate.target_user_id is not null;

  target_count := cardinality(normalized_targets);
  if target_count < 1 or target_count > 7 then
    raise exception 'Drive Together supports 2 to 8 drivers';
  end if;

  if actor = any(normalized_targets) then
    raise exception 'Choose other drivers';
  end if;

  if (
    select count(*) from public.profiles
    where profiles.id = any(normalized_targets)
  ) <> target_count then
    raise exception 'NOXA profile not found';
  end if;

  foreach target_id in array normalized_targets loop
    if private.noxa_users_blocked(actor, target_id) then
      raise exception 'This user cannot be invited';
    end if;

    if not (
      exists (
        select 1 from public.follows
        where follows.follower_id = actor
          and follows.following_id = target_id
      )
      and exists (
        select 1 from public.follows
        where follows.follower_id = target_id
          and follows.following_id = actor
      )
    ) then
      raise exception 'Drive Together requires mutual friends';
    end if;
  end loop;

  -- Deterministic identity locks serialize overlapping room creation.
  perform profiles.id
  from public.profiles
  where profiles.id = actor or profiles.id = any(normalized_targets)
  order by profiles.id
  for update;

  if exists (
    select 1
    from public.drive_participants
    join public.drive_sessions
      on drive_sessions.id = drive_participants.drive_session_id
    where drive_participants.user_id = actor
      and drive_participants.status = 'active'
      and drive_sessions.status = 'active'
  ) then
    raise exception 'You are already active in another Group Drive';
  end if;

  if exists (
    select 1
    from public.drive_participants
    join public.drive_sessions
      on drive_sessions.id = drive_participants.drive_session_id
    where drive_participants.user_id = any(normalized_targets)
      and drive_participants.status = 'active'
      and drive_sessions.status = 'active'
  ) then
    raise exception 'A driver is already active in another Group Drive';
  end if;

  if exists (
    select 1
    from public.drive_sessions as pending_session
    left join public.drive_invitations as pending_invitation
      on pending_invitation.drive_session_id = pending_session.id
     and pending_invitation.status = 'invited'
    where pending_session.drive_mode = 'quick'
      and pending_session.status in ('draft', 'active')
      and (
        pending_session.host_id = actor
        or pending_session.host_id = any(normalized_targets)
        or pending_invitation.invited_user_id = actor
      )
  ) then
    raise exception 'Finish the current Drive Together room first';
  end if;

  insert into public.drive_sessions (
    host_id,
    title,
    description,
    crew_id,
    drive_mode,
    status,
    scheduled_start_at,
    destination_latitude,
    destination_longitude,
    destination_label,
    destination_version,
    destination_updated_by,
    destination_updated_at
  ) values (
    actor,
    'Drive Together',
    null,
    null,
    'quick',
    'draft',
    null,
    destination_latitude,
    destination_longitude,
    nullif(btrim(destination_label), ''),
    1,
    actor,
    now()
  )
  returning id into created_drive_id;

  insert into public.drive_participants (
    drive_session_id,
    user_id,
    role,
    status
  ) values (
    created_drive_id,
    actor,
    'host',
    'accepted'
  );

  insert into public.drive_invitations (
    drive_session_id,
    invited_user_id,
    source_crew_id,
    invited_by
  )
  select created_drive_id, invited.target_user_id, null, actor
  from unnest(normalized_targets) as invited(target_user_id);

  select array_agg(id order by created_at, id)
  into invitation_ids
  from public.drive_invitations
  where drive_session_id = created_drive_id
    and status = 'invited';

  return jsonb_build_object(
    'drive_session_id', created_drive_id,
    'invitation_ids', to_jsonb(coalesce(invitation_ids, array[]::uuid[]))
  );
end;
$$;

revoke all on function public.noxa_create_quick_drive_with_destination(
  uuid[], double precision, double precision, text
) from public, anon, authenticated;
grant execute on function public.noxa_create_quick_drive_with_destination(
  uuid[], double precision, double precision, text
) to authenticated;

-- Host-only late invite for an active or waiting quick room.
create or replace function public.noxa_invite_quick_drive_user(
  target_drive_session_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_session public.drive_sessions%rowtype;
  occupied_slots integer;
  invitation_id uuid;
begin
  if actor is null or target_drive_session_id is null or target_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  if current_session.id is null
    or current_session.drive_mode <> 'quick'
    or current_session.status not in ('draft', 'active')
  then
    raise exception 'Drive Together is unavailable';
  end if;

  if current_session.host_id <> actor then
    raise exception 'Only the Drive Together host can invite another driver';
  end if;

  if target_user_id = actor then
    raise exception 'Choose another driver';
  end if;

  if current_session.destination_version <= 0
    or current_session.destination_latitude is null
    or current_session.destination_longitude is null
  then
    raise exception 'Choose a destination before inviting drivers';
  end if;

  perform profiles.id
  from public.profiles
  where profiles.id in (actor, target_user_id)
  order by profiles.id
  for update;

  if not exists (select 1 from public.profiles where profiles.id = target_user_id) then
    raise exception 'NOXA profile not found';
  end if;

  if private.noxa_users_blocked(actor, target_user_id) then
    raise exception 'This user cannot be invited';
  end if;

  if not (
    exists (
      select 1 from public.follows
      where follows.follower_id = actor
        and follows.following_id = target_user_id
    )
    and exists (
      select 1 from public.follows
      where follows.follower_id = target_user_id
        and follows.following_id = actor
    )
  ) then
    raise exception 'Drive Together requires mutual friends';
  end if;

  if exists (
    select 1 from public.drive_participants
    where drive_session_id = current_session.id
      and user_id = target_user_id
      and status in ('accepted', 'active')
  ) or exists (
    select 1 from public.drive_invitations
    where drive_session_id = current_session.id
      and invited_user_id = target_user_id
      and status = 'invited'
  ) then
    raise exception 'This driver is already in the room or invited';
  end if;

  if exists (
    select 1
    from public.drive_participants
    join public.drive_sessions
      on drive_sessions.id = drive_participants.drive_session_id
    where drive_participants.user_id = target_user_id
      and drive_participants.status = 'active'
      and drive_sessions.status = 'active'
      and drive_sessions.id <> current_session.id
  ) then
    raise exception 'A driver is already active in another Group Drive';
  end if;

  select
    (
      select count(*) from public.drive_participants
      where drive_session_id = current_session.id
        and status in ('accepted', 'active')
    )
    + (
      select count(*) from public.drive_invitations
      where drive_session_id = current_session.id
        and status = 'invited'
    )
  into occupied_slots;

  if occupied_slots >= 8 then
    raise exception 'Drive Together supports up to 8 drivers';
  end if;

  insert into public.drive_invitations (
    drive_session_id,
    invited_user_id,
    source_crew_id,
    invited_by
  ) values (
    current_session.id,
    target_user_id,
    null,
    actor
  )
  returning id into invitation_id;

  return invitation_id;
end;
$$;

revoke all on function public.noxa_invite_quick_drive_user(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_invite_quick_drive_user(uuid, uuid)
  to authenticated;

-- Quick invitation response supports first acceptance and late join. Planned
-- behavior remains pre-start only.
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
  conflicting_user_id uuid;
  participant_count integer;
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

  if (
    current_session.drive_mode = 'planned'
    and current_session.status not in ('draft', 'scheduled')
  ) or (
    current_session.drive_mode = 'quick'
    and current_session.status not in ('draft', 'active')
  ) then
    raise exception 'This Group Drive invitation can no longer be accepted or declined';
  end if;

  if private.noxa_users_blocked(actor, current_session.host_id) then
    raise exception 'This Group Drive invitation is unavailable';
  end if;

  if not accept_invitation then
    update public.drive_invitations
    set status = 'declined'
    where id = current_invitation.id;
    return true;
  end if;

  if current_session.drive_mode = 'quick' then
    perform profiles.id
    from public.profiles
    where profiles.id in (current_session.host_id, actor)
    order by profiles.id
    for update;

    select active_participant.user_id
    into conflicting_user_id
    from public.drive_participants as active_participant
    join public.drive_sessions as active_session
      on active_session.id = active_participant.drive_session_id
    where active_participant.user_id = actor
      and active_participant.drive_session_id <> current_session.id
      and active_participant.status = 'active'
      and active_session.status = 'active'
    limit 1;

    if conflicting_user_id is not null then
      raise exception 'A driver is already active in another Group Drive';
    end if;

    select count(*) into participant_count
    from public.drive_participants
    where drive_session_id = current_session.id
      and status in ('accepted', 'active');

    if participant_count >= 8 then
      raise exception 'Drive Together supports up to 8 drivers';
    end if;

    insert into public.drive_participants (
      drive_session_id,
      user_id,
      role,
      status
    ) values (
      current_session.id,
      actor,
      'participant',
      case when current_session.status = 'active' then 'active' else 'accepted' end
    );

    update public.drive_invitations
    set status = 'accepted'
    where id = current_invitation.id;

    if current_session.status = 'draft' then
      update public.drive_sessions
      set
        status = 'active',
        started_at = now(),
        active_expires_at = now() + interval '8 hours',
        completed_at = null,
        end_reason = null
      where id = current_session.id;
    end if;

    return true;
  end if;

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

  return true;
end;
$$;

revoke all on function public.noxa_respond_to_drive_invitation(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.noxa_respond_to_drive_invitation(uuid, boolean)
  to authenticated;

-- Pending quick invitations may target a room that is already active.
create or replace function public.noxa_get_my_pending_quick_drive_invitation()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  result jsonb;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'invitation_id', drive_invitations.id,
    'drive_session_id', drive_sessions.id,
    'host_id', drive_sessions.host_id,
    'host_display_name', coalesce(nullif(btrim(profiles.display_name), ''), nullif(btrim(profiles.username), ''), 'NOXA driver'),
    'host_avatar_url', profiles.avatar_url,
    'created_at', drive_invitations.created_at,
    'destination_latitude', drive_sessions.destination_latitude,
    'destination_longitude', drive_sessions.destination_longitude,
    'destination_label', drive_sessions.destination_label,
    'destination_version', drive_sessions.destination_version
  )
  into result
  from public.drive_invitations
  join public.drive_sessions
    on drive_sessions.id = drive_invitations.drive_session_id
  join public.profiles
    on profiles.id = drive_sessions.host_id
  where drive_invitations.invited_user_id = actor
    and drive_invitations.status = 'invited'
    and drive_sessions.drive_mode = 'quick'
    and drive_sessions.status in ('draft', 'active')
    and not private.noxa_users_blocked(actor, drive_sessions.host_id)
  order by drive_invitations.created_at desc
  limit 1;

  return result;
end;
$$;

revoke all on function public.noxa_get_my_pending_quick_drive_invitation()
  from public, anon, authenticated;
grant execute on function public.noxa_get_my_pending_quick_drive_invitation()
  to authenticated;

create or replace function public.noxa_get_quick_drive_invitation(
  target_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  result jsonb;
begin
  if actor is null or target_invitation_id is null then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'invitation_id', drive_invitations.id,
    'drive_session_id', drive_sessions.id,
    'host_id', drive_sessions.host_id,
    'host_display_name', coalesce(nullif(btrim(profiles.display_name), ''), nullif(btrim(profiles.username), ''), 'NOXA driver'),
    'host_avatar_url', profiles.avatar_url,
    'created_at', drive_invitations.created_at,
    'destination_latitude', drive_sessions.destination_latitude,
    'destination_longitude', drive_sessions.destination_longitude,
    'destination_label', drive_sessions.destination_label,
    'destination_version', drive_sessions.destination_version
  )
  into result
  from public.drive_invitations
  join public.drive_sessions
    on drive_sessions.id = drive_invitations.drive_session_id
  join public.profiles
    on profiles.id = drive_sessions.host_id
  where drive_invitations.id = target_invitation_id
    and drive_invitations.invited_user_id = actor
    and drive_invitations.status = 'invited'
    and drive_sessions.drive_mode = 'quick'
    and drive_sessions.status in ('draft', 'active')
    and not private.noxa_users_blocked(actor, drive_sessions.host_id);

  return result;
end;
$$;

revoke all on function public.noxa_get_quick_drive_invitation(uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_get_quick_drive_invitation(uuid)
  to authenticated;

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
    case
      when drive_sessions.drive_mode = 'quick'
        then coalesce(nullif(btrim(drive_sessions.destination_label), ''), 'Shared destination')
      else coalesce(nullif(btrim(destination.label), ''), 'Destination shared after joining')
    end
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
    and (
      (
        drive_sessions.drive_mode = 'planned'
        and drive_sessions.status in ('draft', 'scheduled')
      )
      or (
        drive_sessions.drive_mode = 'quick'
        and drive_sessions.status in ('draft', 'active')
      )
    )
    and not private.noxa_users_blocked(actor, drive_sessions.host_id);
end;
$$;

revoke all on function public.noxa_get_drive_invitation_preview(uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_get_drive_invitation_preview(uuid)
  to authenticated;

-- Any active participant can submit the latest proposal. Host changes are
-- committed immediately because the host is the approver.
create or replace function public.noxa_propose_quick_drive_destination(
  target_drive_session_id uuid,
  destination_latitude double precision,
  destination_longitude double precision,
  destination_label text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_session public.drive_sessions%rowtype;
  actor_role text;
begin
  if actor is null or target_drive_session_id is null then
    raise exception 'Authentication required';
  end if;

  if destination_latitude is null
    or destination_longitude is null
    or destination_latitude < -90
    or destination_latitude > 90
    or destination_longitude < -180
    or destination_longitude > 180
  then
    raise exception 'A valid destination is required';
  end if;

  if destination_label is not null and char_length(btrim(destination_label)) > 160 then
    raise exception 'Destination label is too long';
  end if;

  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  if current_session.id is null
    or current_session.drive_mode <> 'quick'
    or current_session.status <> 'active'
  then
    raise exception 'Drive Together is unavailable';
  end if;

  select role
  into actor_role
  from public.drive_participants
  where drive_session_id = current_session.id
    and user_id = actor
    and status = 'active';

  if actor_role is null then
    raise exception 'Only an active Drive Together participant can change the destination';
  end if;

  if actor_role = 'host' then
    update public.drive_sessions
    set
      destination_latitude = noxa_propose_quick_drive_destination.destination_latitude,
      destination_longitude = noxa_propose_quick_drive_destination.destination_longitude,
      destination_label = nullif(btrim(noxa_propose_quick_drive_destination.destination_label), ''),
      destination_version = current_session.destination_version + 1,
      destination_updated_by = actor,
      destination_updated_at = now(),
      proposed_destination_latitude = null,
      proposed_destination_longitude = null,
      proposed_destination_label = null,
      proposed_destination_by = null,
      proposed_destination_at = null
    where id = current_session.id;
  else
    update public.drive_sessions
    set
      proposed_destination_latitude = noxa_propose_quick_drive_destination.destination_latitude,
      proposed_destination_longitude = noxa_propose_quick_drive_destination.destination_longitude,
      proposed_destination_label = nullif(btrim(noxa_propose_quick_drive_destination.destination_label), ''),
      proposed_destination_by = actor,
      proposed_destination_at = now()
    where id = current_session.id;
  end if;

  return true;
end;
$$;

revoke all on function public.noxa_propose_quick_drive_destination(
  uuid, double precision, double precision, text
) from public, anon, authenticated;
grant execute on function public.noxa_propose_quick_drive_destination(
  uuid, double precision, double precision, text
) to authenticated;

create or replace function public.noxa_respond_quick_drive_destination_proposal(
  target_drive_session_id uuid,
  accept_proposal boolean
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
  if actor is null
    or target_drive_session_id is null
    or accept_proposal is null
  then
    raise exception 'Authentication required';
  end if;

  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  if current_session.id is null
    or current_session.drive_mode <> 'quick'
    or current_session.status <> 'active'
  then
    raise exception 'Drive Together is unavailable';
  end if;

  if current_session.host_id <> actor then
    raise exception 'Only the Drive Together host can approve a destination';
  end if;

  if current_session.proposed_destination_by is null
    or current_session.proposed_destination_latitude is null
    or current_session.proposed_destination_longitude is null
  then
    return false;
  end if;

  if accept_proposal then
    update public.drive_sessions
    set
      destination_latitude = current_session.proposed_destination_latitude,
      destination_longitude = current_session.proposed_destination_longitude,
      destination_label = current_session.proposed_destination_label,
      destination_version = current_session.destination_version + 1,
      destination_updated_by = current_session.proposed_destination_by,
      destination_updated_at = now(),
      proposed_destination_latitude = null,
      proposed_destination_longitude = null,
      proposed_destination_label = null,
      proposed_destination_by = null,
      proposed_destination_at = null
    where id = current_session.id;
  else
    update public.drive_sessions
    set
      proposed_destination_latitude = null,
      proposed_destination_longitude = null,
      proposed_destination_label = null,
      proposed_destination_by = null,
      proposed_destination_at = null
    where id = current_session.id;
  end if;

  return true;
end;
$$;

revoke all on function public.noxa_respond_quick_drive_destination_proposal(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.noxa_respond_quick_drive_destination_proposal(uuid, boolean)
  to authenticated;

-- Foreground navigation publishes only its own remaining distance for the
-- current destination. The per-driver route geometry never leaves the device.
create or replace function public.noxa_upsert_quick_drive_navigation_progress(
  target_drive_session_id uuid,
  location_latitude double precision,
  location_longitude double precision,
  location_heading double precision,
  target_destination_version integer,
  remaining_distance_meters numeric,
  navigation_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_session public.drive_sessions%rowtype;
  active_count integer;
  all_arrived boolean;
begin
  if actor is null or target_drive_session_id is null then
    raise exception 'Authentication required';
  end if;

  if location_latitude is null
    or location_longitude is null
    or location_latitude < -90
    or location_latitude > 90
    or location_longitude < -180
    or location_longitude > 180
  then
    raise exception 'Invalid location';
  end if;

  if location_heading is not null
    and (location_heading < 0 or location_heading >= 360)
  then
    raise exception 'Invalid heading';
  end if;

  if remaining_distance_meters is null or remaining_distance_meters < 0 then
    raise exception 'Invalid remaining distance';
  end if;

  if navigation_status not in ('moving', 'arrived') then
    raise exception 'Invalid navigation status';
  end if;

  select *
  into current_session
  from public.drive_sessions
  where drive_sessions.id = target_drive_session_id
  for update;

  if current_session.id is null
    or current_session.drive_mode <> 'quick'
    or current_session.status <> 'active'
  then
    raise exception 'Drive Together is unavailable';
  end if;

  if target_destination_version <> current_session.destination_version then
    raise exception 'Destination changed; recalculate the route';
  end if;

  if not exists (
    select 1 from public.drive_participants
    where drive_session_id = current_session.id
      and user_id = actor
      and status = 'active'
  ) then
    raise exception 'Only an active Drive Together participant can publish navigation progress';
  end if;

  if navigation_status = 'arrived' and remaining_distance_meters > 75 then
    raise exception 'Arrival requires being near the destination';
  end if;

  insert into public.drive_location_state (
    drive_session_id,
    user_id,
    latitude,
    longitude,
    heading,
    status,
    remaining_distance_meters,
    route_destination_version
  ) values (
    current_session.id,
    actor,
    location_latitude,
    location_longitude,
    location_heading,
    navigation_status,
    remaining_distance_meters,
    target_destination_version
  )
  on conflict (drive_session_id, user_id)
  do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    heading = excluded.heading,
    status = excluded.status,
    remaining_distance_meters = excluded.remaining_distance_meters,
    route_destination_version = excluded.route_destination_version;

  select count(*)
  into active_count
  from public.drive_participants
  where drive_session_id = current_session.id
    and status = 'active';

  select
    active_count >= 2
    and not exists (
      select 1
      from public.drive_participants as active_participant
      left join public.drive_location_state as progress
        on progress.drive_session_id = active_participant.drive_session_id
       and progress.user_id = active_participant.user_id
      where active_participant.drive_session_id = current_session.id
        and active_participant.status = 'active'
        and (
          progress.user_id is null
          or progress.status <> 'arrived'
          or progress.route_destination_version is distinct from current_session.destination_version
        )
    )
  into all_arrived;

  if all_arrived then
    -- Quick trips have no History. Parent deletion cascades location,
    -- invitations, participants, and stops.
    delete from public.drive_sessions
    where id = current_session.id;

    return jsonb_build_object('ended', true);
  end if;

  return jsonb_build_object('ended', false);
end;
$$;

revoke all on function public.noxa_upsert_quick_drive_navigation_progress(
  uuid, double precision, double precision, double precision, integer, numeric, text
) from public, anon, authenticated;
grant execute on function public.noxa_upsert_quick_drive_navigation_progress(
  uuid, double precision, double precision, double precision, integer, numeric, text
) to authenticated;

-- Quick rooms are ephemeral. Cancel/end/delete rather than retaining history.
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

  if current_session.drive_mode = 'quick' then
    if current_session.status = 'active' then
      raise exception 'Active Drive Together must be ended, not cancelled';
    end if;
    if current_session.status = 'draft' then
      delete from public.drive_sessions where id = current_session.id;
      return true;
    end if;
    return false;
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

revoke all on function public.noxa_cancel_drive(uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_cancel_drive(uuid)
  to authenticated;

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

  if current_session.drive_mode = 'quick' then
    delete from public.drive_sessions where id = current_session.id;
    return true;
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

revoke all on function public.noxa_end_drive(uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_end_drive(uuid)
  to authenticated;

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
  remaining_active integer;
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

  if current_session.drive_mode = 'quick'
    and current_session.status = 'active'
  then
    select count(*)
    into remaining_active
    from public.drive_participants
    where drive_session_id = current_session.id
      and status = 'active';

    if remaining_active < 2 then
      delete from public.drive_sessions where id = current_session.id;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.noxa_leave_drive(uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_leave_drive(uuid)
  to authenticated;

-- Expired quick rooms are deleted; planned sessions retain the historical
-- terminal state expected by the legacy flow.
create or replace function private.noxa_expire_group_drives()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_quick integer := 0;
  expired_planned integer := 0;
begin
  with deleted_quick as (
    delete from public.drive_sessions
    where drive_sessions.drive_mode = 'quick'
      and drive_sessions.status = 'active'
      and drive_sessions.active_expires_at <= now()
    returning id
  )
  select count(*)::integer into expired_quick from deleted_quick;

  with expired_sessions as (
    select drive_sessions.id
    from public.drive_sessions
    where drive_sessions.drive_mode = 'planned'
      and drive_sessions.status = 'active'
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
  select count(*)::integer into expired_planned
  from updated_sessions;

  return expired_quick + expired_planned;
end;
$$;

revoke all on function private.noxa_expire_group_drives()
  from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.noxa_expire_group_drives() to service_role;

-- Remove retained quick-drive terminal rows from earlier pair-only builds.
delete from public.drive_sessions
where drive_mode = 'quick'
  and status in ('completed', 'cancelled');
