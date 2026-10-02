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

  select coalesce(nullif(btrim(title), ''), 'Drive Together')
  into drive_title
  from public.drive_sessions
  where id = new.drive_session_id;

  perform private.noxa_enqueue_notification(
    new.invited_user_id,
    new.invited_by,
    'drive_invite',
    'crews',
    'Drive Together invitation',
    coalesce(actor_name, 'A NOXA driver') || ' invited you to ' ||
      coalesce(drive_title, 'Drive Together') || '.',
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
