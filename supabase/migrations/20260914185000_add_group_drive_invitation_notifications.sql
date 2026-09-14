alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (
    kind in (
      'follow',
      'crew_invite',
      'drive_invite',
      'post_comment',
      'post_reply',
      'post_like',
      'comment_like'
    )
  );

create or replace function private.noxa_notify_drive_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
  drive_title text;
begin
  if new.status <> 'invited' then
    return new;
  end if;

  select coalesce(
    nullif(btrim(display_name), ''),
    nullif(btrim(username), ''),
    'A NOXA driver'
  )
  into actor_name
  from public.profiles
  where id = new.invited_by;

  select coalesce(nullif(btrim(title), ''), 'a Group Drive')
  into drive_title
  from public.drive_sessions
  where id = new.drive_session_id;

  perform private.noxa_enqueue_notification(
    new.invited_user_id,
    new.invited_by,
    'drive_invite',
    'crews',
    'Group Drive invitation',
    coalesce(actor_name, 'A NOXA driver') || ' invited you to ' ||
      coalesce(drive_title, 'a Group Drive') || '.',
    jsonb_build_object(
      'drive_invitation_id', new.id,
      'drive_session_id', new.drive_session_id
    ),
    'drive_invite:' || new.id::text
  );

  return new;
end;
$$;

revoke all on function private.noxa_notify_drive_invitation()
  from public, anon, authenticated, service_role;

drop trigger if exists noxa_notify_drive_invitation_trigger
  on public.drive_invitations;

create trigger noxa_notify_drive_invitation_trigger
  after insert on public.drive_invitations
  for each row execute function private.noxa_notify_drive_invitation();
