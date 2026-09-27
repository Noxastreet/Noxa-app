-- Map-first Drive Together quick flow.
-- Adds a lightweight mode to the existing Group Drive domain instead of creating
-- a second set of tables or weakening the existing RLS model.

alter table public.drive_sessions
  add column if not exists drive_mode text not null default 'planned';

alter table public.drive_sessions
  drop constraint if exists drive_sessions_drive_mode_check;

alter table public.drive_sessions
  add constraint drive_sessions_drive_mode_check
  check (drive_mode in ('planned', 'quick'));

comment on column public.drive_sessions.drive_mode is
  'planned = existing multi-step Group Drive; quick = map-first Drive Together session with optional route/schedule.';

create or replace function public.noxa_create_quick_drive(
  target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  existing_drive_id uuid;
  existing_invitation_id uuid;
  existing_target_id uuid;
  conflicting_user_id uuid;
  created_drive_id uuid;
  created_invitation_id uuid;
begin
  if actor is null or target_user_id is null then
    raise exception 'Authentication required';
  end if;

  if target_user_id = actor then
    raise exception 'Choose another driver';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = target_user_id
  ) then
    raise exception 'NOXA profile not found';
  end if;

  if private.noxa_users_blocked(actor, target_user_id) then
    raise exception 'This user cannot be invited';
  end if;

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
    raise exception 'Drive Together requires a mutual friend';
  end if;

  -- Serialize quick-start eligibility around both identities before checking
  -- whether either driver is already active elsewhere.
  perform profiles.id
  from public.profiles
  where profiles.id in (actor, target_user_id)
  order by profiles.id
  for update;

  -- One pending quick invitation at a time keeps the map state deterministic.
  select
    drive_sessions.id,
    drive_invitations.id,
    drive_invitations.invited_user_id
  into
    existing_drive_id,
    existing_invitation_id,
    existing_target_id
  from public.drive_sessions
  join public.drive_invitations
    on drive_invitations.drive_session_id = drive_sessions.id
   and drive_invitations.status = 'invited'
  where drive_sessions.host_id = actor
    and drive_sessions.drive_mode = 'quick'
    and drive_sessions.status = 'draft'
  order by drive_sessions.created_at desc
  limit 1
  for update of drive_sessions, drive_invitations;

  if existing_drive_id is not null then
    if existing_target_id = target_user_id then
      return jsonb_build_object(
        'drive_session_id', existing_drive_id,
        'invitation_id', existing_invitation_id
      );
    end if;
    raise exception 'Finish or cancel the current Drive Together invitation first';
  end if;

  -- Neither driver may participate in another pending quick session. This also
  -- closes the reciprocal-invite race (A invites B while B invites A).
  if exists (
    select 1
    from public.drive_sessions as pending_session
    join public.drive_invitations as pending_invitation
      on pending_invitation.drive_session_id = pending_session.id
     and pending_invitation.status = 'invited'
    where pending_session.drive_mode = 'quick'
      and pending_session.status = 'draft'
      and (
        pending_session.host_id in (actor, target_user_id)
        or pending_invitation.invited_user_id in (actor, target_user_id)
      )
  ) then
    raise exception 'One of you already has a pending Drive Together invitation';
  end if;

  select active_participant.user_id
  into conflicting_user_id
  from public.drive_participants as active_participant
  join public.drive_sessions as active_session
    on active_session.id = active_participant.drive_session_id
  where active_participant.user_id in (actor, target_user_id)
    and active_participant.status = 'active'
    and active_session.status = 'active'
  order by active_participant.user_id
  limit 1;

  if conflicting_user_id is not null then
    raise exception 'A driver is already active in another Group Drive';
  end if;

  insert into public.drive_sessions (
    host_id,
    title,
    description,
    crew_id,
    drive_mode,
    status,
    scheduled_start_at
  ) values (
    actor,
    'Drive Together',
    null,
    null,
    'quick',
    'draft',
    null
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
  ) values (
    created_drive_id,
    target_user_id,
    null,
    actor
  )
  returning id into created_invitation_id;

  return jsonb_build_object(
    'drive_session_id', created_drive_id,
    'invitation_id', created_invitation_id
  );
end;
$$;

revoke all on function public.noxa_create_quick_drive(uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_create_quick_drive(uuid)
  to authenticated;

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
    'created_at', drive_invitations.created_at
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
    and drive_sessions.status = 'draft'
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
as $
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
    'created_at', drive_invitations.created_at
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
    and drive_sessions.status = 'draft'
    and not private.noxa_users_blocked(actor, drive_sessions.host_id);

  return result;
end;
$;

revoke all on function public.noxa_get_quick_drive_invitation(uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_get_quick_drive_invitation(uuid)
  to authenticated;

-- Preserve the existing planned invitation behavior. Quick Drive Together
-- invitations activate automatically on acceptance, with the same deterministic
-- identity locking and active-drive overlap protection used by Start Drive.
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

  if not accept_invitation then
    update public.drive_invitations
    set status = 'declined'
    where id = current_invitation.id;

    if current_session.drive_mode = 'quick' then
      update public.drive_sessions
      set
        status = 'cancelled',
        completed_at = now(),
        end_reason = 'host_cancelled'
      where id = current_session.id;
    end if;

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
    where active_participant.user_id in (current_session.host_id, actor)
      and active_participant.drive_session_id <> current_session.id
      and active_participant.status = 'active'
      and active_session.status = 'active'
    order by active_participant.user_id
    limit 1;

    if conflicting_user_id is not null then
      raise exception 'A driver is already active in another Group Drive';
    end if;
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

  if current_session.drive_mode = 'quick' then
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
end;
$$;

revoke all on function public.noxa_respond_to_drive_invitation(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.noxa_respond_to_drive_invitation(uuid, boolean)
  to authenticated;
