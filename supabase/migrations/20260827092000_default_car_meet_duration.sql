-- MVP Completion: canonical Car Meet duration is three hours when the creator
-- does not explicitly choose an end time.

update public.events
set ends_at = starts_at + interval '3 hours'
where category = 'meet'
  and ends_at is null;

create or replace function private.noxa_default_car_meet_duration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category = 'meet' and new.ends_at is null then
    new.ends_at := new.starts_at + interval '3 hours';
  end if;

  return new;
end;
$$;

drop trigger if exists noxa_events_default_car_meet_duration on public.events;
create trigger noxa_events_default_car_meet_duration
before insert or update of category, starts_at, ends_at on public.events
for each row
execute function private.noxa_default_car_meet_duration();
