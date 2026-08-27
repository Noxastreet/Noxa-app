-- MVP Completion privacy gate: allow an authenticated driver to clear only
-- their own exact Group Drive location before local sign-out.
-- This does not end or leave the Group Drive and cannot touch another user.

create or replace function public.noxa_clear_my_drive_location(target_drive_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'authentication required';
  end if;

  if target_drive_session_id is null then
    return true;
  end if;

  delete from public.drive_location_state
  where public.drive_location_state.drive_session_id = target_drive_session_id
    and public.drive_location_state.user_id = actor;

  return true;
end;
$$;

revoke all privileges on function public.noxa_clear_my_drive_location(uuid) from public, anon, authenticated;
grant execute on function public.noxa_clear_my_drive_location(uuid) to authenticated;
