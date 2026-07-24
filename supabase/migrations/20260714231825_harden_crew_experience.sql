create unique index if not exists crew_convoys_one_active_per_crew_idx
  on public.crew_convoys (crew_id)
  where status in ('lobby', 'live');

create or replace function private.noxa_prepare_crew_convoy_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  participant_count integer;
  ready_count integer;
begin
  if new.crew_id is distinct from old.crew_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'immutable convoy fields cannot be changed'
      using errcode = '23514';
  end if;

  if old.status <> 'lobby' and (
    new.name is distinct from old.name
    or new.meeting_point is distinct from old.meeting_point
    or new.destination is distinct from old.destination
    or new.starts_at is distinct from old.starts_at
    or new.max_slots is distinct from old.max_slots
    or new.safety_note is distinct from old.safety_note
  ) then
    raise exception 'active or finished convoys cannot be edited'
      using errcode = '23514';
  end if;

  if new.max_slots is distinct from old.max_slots then
    select count(*)::integer
    into participant_count
    from public.crew_convoy_participants
    where public.crew_convoy_participants.convoy_id = old.id;

    if new.max_slots < participant_count then
      raise exception 'max slots cannot be lower than participant count'
        using errcode = '23514';
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'lobby' and new.status = 'live' then
      select
        count(*)::integer,
        count(*) filter (where public.crew_convoy_participants.ready)::integer
      into participant_count, ready_count
      from public.crew_convoy_participants
      where public.crew_convoy_participants.convoy_id = old.id;

      if participant_count < 2 or ready_count <> participant_count then
        raise exception 'at least two ready participants are required'
          using errcode = '23514';
      end if;

      new.started_at = coalesce(old.started_at, now());
    elsif old.status = 'live' and new.status = 'completed' then
      new.completed_at = now();
    elsif old.status in ('lobby', 'live') and new.status = 'cancelled' then
      new.completed_at = now();
    else
      raise exception 'invalid convoy status transition'
        using errcode = '23514';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all privileges on function private.noxa_prepare_crew_convoy_update()
  from public, anon, authenticated;
