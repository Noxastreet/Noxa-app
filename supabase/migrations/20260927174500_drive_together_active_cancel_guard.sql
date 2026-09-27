-- Harden quick Drive Together against stale waiting UI.
-- A quick session that already became active must be ended, never cancelled
-- through the pre-start cancel action.

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

  if current_session.drive_mode = 'quick'
    and current_session.status = 'active'
  then
    raise exception 'Active Drive Together must be ended, not cancelled';
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
