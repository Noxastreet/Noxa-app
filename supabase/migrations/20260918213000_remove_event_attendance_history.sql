-- Remove persistent event attendance history while preserving live/upcoming RSVP behavior.

create or replace function public.noxa_purge_event_attendance_history()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.event_attendees as event_attendees
  using public.events as events
  where events.id = event_attendees.event_id
    and (
      events.status in ('completed', 'cancelled')
      or (events.ends_at is not null and events.ends_at <= now())
      or (
        events.ends_at is null
        and events.starts_at + interval '24 hours' <= now()
      )
    );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.noxa_purge_event_attendance_history()
from public, anon, authenticated;

create or replace function public.noxa_purge_event_attendance_on_event_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.status in ('completed', 'cancelled')
    or (new.ends_at is not null and new.ends_at <= now())
    or (
      new.ends_at is null
      and new.starts_at + interval '24 hours' <= now()
    )
  ) then
    delete from public.event_attendees
    where event_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.noxa_purge_event_attendance_on_event_end()
from public, anon, authenticated;

drop trigger if exists noxa_purge_event_attendance_on_event_end_trigger on public.events;

create trigger noxa_purge_event_attendance_on_event_end_trigger
after update of status, starts_at, ends_at on public.events
for each row
execute function public.noxa_purge_event_attendance_on_event_end();

drop policy if exists "NOXA attendees readable for accessible events" on public.event_attendees;

create policy "NOXA attendees readable for accessible events"
  on public.event_attendees
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = event_attendees.event_id
        and not (
          events.status in ('completed', 'cancelled')
          or (events.ends_at is not null and events.ends_at <= now())
          or (
            events.ends_at is null
            and events.starts_at + interval '24 hours' <= now()
          )
        )
        and (
          events.is_public = true
          or events.creator_id = (select auth.uid())
          or (
            events.crew_id is not null
            and public.noxa_is_crew_member(events.crew_id)
          )
        )
    )
  );

drop policy if exists "NOXA users can join accessible events" on public.event_attendees;
drop policy if exists "NOXA users can join accessible public events" on public.event_attendees;

create policy "NOXA users can join accessible events"
  on public.event_attendees
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.events
      where events.id = event_attendees.event_id
        and events.status = 'scheduled'
        and not (
          events.ends_at is not null and events.ends_at <= now()
        )
        and not (
          events.ends_at is null
          and events.starts_at + interval '24 hours' <= now()
        )
        and (
          events.is_public = true
          or (
            events.crew_id is not null
            and public.noxa_is_crew_member(events.crew_id)
          )
        )
    )
  );

drop policy if exists "NOXA users can update own event response" on public.event_attendees;

create policy "NOXA users can update own event response"
  on public.event_attendees
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and not exists (
      select 1
      from public.events
      where events.id = event_attendees.event_id
        and events.creator_id = event_attendees.user_id
    )
  )
  with check (
    user_id = (select auth.uid())
    and response in ('going', 'maybe')
    and exists (
      select 1
      from public.events
      where events.id = event_attendees.event_id
        and events.status = 'scheduled'
        and not (
          events.ends_at is not null and events.ends_at <= now()
        )
        and not (
          events.ends_at is null
          and events.starts_at + interval '24 hours' <= now()
        )
        and (
          events.is_public = true
          or (
            events.crew_id is not null
            and public.noxa_is_crew_member(events.crew_id)
          )
        )
    )
  );

select public.noxa_purge_event_attendance_history();

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'noxa-purge-event-attendance-history'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'noxa-purge-event-attendance-history',
    '*/5 * * * *',
    'select public.noxa_purge_event_attendance_history();'
  );
end
$$;
