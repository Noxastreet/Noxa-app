-- Keep the local migration version aligned with the applied Supabase migration.
revoke update on table public.event_attendees from authenticated;
grant update (response) on table public.event_attendees to authenticated;

create or replace function public.noxa_enforce_event_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  event_capacity integer;
  confirmed_count integer;
begin
  if new.response <> 'going' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.response = 'going' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.event_id::text, 0));

  select public.events.capacity
  into event_capacity
  from public.events
  where public.events.id = new.event_id;

  if event_capacity is null then
    return new;
  end if;

  select count(*)::integer
  into confirmed_count
  from public.event_attendees
  where public.event_attendees.event_id = new.event_id
    and public.event_attendees.response = 'going';

  if confirmed_count >= event_capacity then
    raise exception 'event capacity reached'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all privileges on function public.noxa_enforce_event_capacity()
  from public, anon, authenticated;

drop trigger if exists noxa_enforce_event_capacity_trigger
  on public.event_attendees;

create trigger noxa_enforce_event_capacity_trigger
  before insert or update of response
  on public.event_attendees
  for each row
  execute function public.noxa_enforce_event_capacity();
