-- NOXA usernames are chosen once by the account owner.
-- Existing profiles with username IS NULL may claim one username.
-- After the first non-null value is stored, authenticated clients cannot change or clear it.
-- service_role remains able to perform an explicit support/admin correction when required.

create or replace function public.noxa_lock_profile_username_once()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.username is not null
     and new.username is distinct from old.username
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'NOXA username is locked after initial setup.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.noxa_lock_profile_username_once() from public, anon, authenticated;

drop trigger if exists noxa_lock_profile_username_once on public.profiles;
create trigger noxa_lock_profile_username_once
  before update of username on public.profiles
  for each row
  execute function public.noxa_lock_profile_username_once();
