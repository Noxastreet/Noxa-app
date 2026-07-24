-- Private crew polls with manager-controlled creation and anonymous result totals.

create table public.crew_polls (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  status text not null default 'open',
  closes_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crew_polls_question_check
    check (char_length(btrim(question)) between 5 and 180),
  constraint crew_polls_status_check
    check (status in ('open', 'closed')),
  constraint crew_polls_closes_at_check
    check (closes_at is null or closes_at > created_at),
  constraint crew_polls_closed_state_check
    check (
      (status = 'open' and closed_at is null)
      or (status = 'closed' and closed_at is not null)
    )
);

create index crew_polls_crew_id_created_at_idx
  on public.crew_polls (crew_id, created_at desc);
create index crew_polls_created_by_idx
  on public.crew_polls (created_by);

create table public.crew_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.crew_polls(id) on delete cascade,
  label text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  constraint crew_poll_options_label_check
    check (char_length(btrim(label)) between 1 and 100),
  constraint crew_poll_options_position_check
    check (position between 0 and 5),
  constraint crew_poll_options_poll_position_key unique (poll_id, position),
  constraint crew_poll_options_poll_id_id_key unique (poll_id, id)
);

create table public.crew_poll_votes (
  poll_id uuid not null references public.crew_polls(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  constraint crew_poll_votes_poll_option_fkey
    foreign key (poll_id, option_id)
    references public.crew_poll_options(poll_id, id)
    on delete cascade
);

create index crew_poll_votes_option_id_idx
  on public.crew_poll_votes (option_id);
create index crew_poll_votes_user_id_idx
  on public.crew_poll_votes (user_id);

alter table public.crew_polls enable row level security;
alter table public.crew_poll_options enable row level security;
alter table public.crew_poll_votes enable row level security;

revoke all on table public.crew_polls from anon, authenticated;
revoke all on table public.crew_poll_options from anon, authenticated;
revoke all on table public.crew_poll_votes from anon, authenticated;

grant select on table public.crew_polls to authenticated;
grant select on table public.crew_poll_options to authenticated;
grant select on table public.crew_poll_votes to authenticated;

create policy "NOXA crew members can read polls"
  on public.crew_polls
  for select
  to authenticated
  using (public.noxa_is_crew_member(crew_id));

create policy "NOXA crew members can read poll options"
  on public.crew_poll_options
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.crew_polls
      where public.crew_polls.id = crew_poll_options.poll_id
        and public.noxa_is_crew_member(public.crew_polls.crew_id)
    )
  );

create policy "NOXA users can read only their own poll votes"
  on public.crew_poll_votes
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.crew_polls
      where public.crew_polls.id = crew_poll_votes.poll_id
        and public.noxa_is_crew_member(public.crew_polls.crew_id)
    )
  );

create or replace function public.noxa_create_crew_poll(
  target_crew_id uuid,
  poll_question text,
  option_labels text[],
  closes_in_hours integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  created_poll_id uuid;
  normalized_question text := btrim(poll_question);
  normalized_option text;
  normalized_options text[] := '{}'::text[];
  seen_options text[] := '{}'::text[];
begin
  if actor is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  if not public.noxa_is_crew_manager(target_crew_id) then
    raise exception 'crew manager access required'
      using errcode = '42501';
  end if;

  if normalized_question is null
    or char_length(normalized_question) not between 5 and 180
  then
    raise exception 'poll question must contain 5 to 180 characters'
      using errcode = '22023';
  end if;

  if option_labels is null
    or coalesce(array_length(option_labels, 1), 0) not between 2 and 6
  then
    raise exception 'polls require 2 to 6 options'
      using errcode = '22023';
  end if;

  foreach normalized_option in array option_labels loop
    normalized_option := btrim(normalized_option);
    if normalized_option is null
      or char_length(normalized_option) not between 1 and 100
    then
      raise exception 'poll options must contain 1 to 100 characters'
        using errcode = '22023';
    end if;
    if lower(normalized_option) = any(seen_options) then
      raise exception 'poll options must be unique'
        using errcode = '22023';
    end if;
    normalized_options := array_append(normalized_options, normalized_option);
    seen_options := array_append(seen_options, lower(normalized_option));
  end loop;

  if closes_in_hours is not null and closes_in_hours not between 1 and 720 then
    raise exception 'poll duration must be between 1 hour and 30 days'
      using errcode = '22023';
  end if;

  insert into public.crew_polls (
    crew_id,
    created_by,
    question,
    closes_at
  )
  values (
    target_crew_id,
    actor,
    normalized_question,
    case
      when closes_in_hours is null then null
      else now() + make_interval(hours => closes_in_hours)
    end
  )
  returning id into created_poll_id;

  insert into public.crew_poll_options (poll_id, label, position)
  select
    created_poll_id,
    option_row.label,
    (option_row.ordinality - 1)::smallint
  from unnest(normalized_options) with ordinality
    as option_row(label, ordinality);

  return created_poll_id;
end;
$$;

create or replace function public.noxa_vote_crew_poll(
  target_poll_id uuid,
  target_option_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  poll_crew_id uuid;
  poll_status text;
  poll_closes_at timestamptz;
begin
  if actor is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  select
    public.crew_polls.crew_id,
    public.crew_polls.status,
    public.crew_polls.closes_at
  into poll_crew_id, poll_status, poll_closes_at
  from public.crew_polls
  where public.crew_polls.id = target_poll_id
  for update;

  if poll_crew_id is null then
    raise exception 'poll not found'
      using errcode = '22023';
  end if;

  if not public.noxa_is_crew_member(poll_crew_id) then
    raise exception 'crew membership required'
      using errcode = '42501';
  end if;

  if poll_status <> 'open'
    or (poll_closes_at is not null and poll_closes_at <= now())
  then
    raise exception 'poll is closed'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.crew_poll_options
    where public.crew_poll_options.poll_id = target_poll_id
      and public.crew_poll_options.id = target_option_id
  ) then
    raise exception 'poll option not found'
      using errcode = '22023';
  end if;

  insert into public.crew_poll_votes (
    poll_id,
    option_id,
    user_id
  )
  values (
    target_poll_id,
    target_option_id,
    actor
  )
  on conflict (poll_id, user_id) do update
  set
    option_id = excluded.option_id,
    updated_at = now();

  update public.crew_polls
  set updated_at = now()
  where id = target_poll_id;

  return true;
end;
$$;

create or replace function public.noxa_close_crew_poll(target_poll_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  poll_crew_id uuid;
begin
  if actor is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  select public.crew_polls.crew_id
  into poll_crew_id
  from public.crew_polls
  where public.crew_polls.id = target_poll_id
  for update;

  if poll_crew_id is null then
    raise exception 'poll not found'
      using errcode = '22023';
  end if;

  if not public.noxa_is_crew_manager(poll_crew_id) then
    raise exception 'crew manager access required'
      using errcode = '42501';
  end if;

  update public.crew_polls
  set
    status = 'closed',
    closed_at = coalesce(closed_at, now()),
    updated_at = now()
  where id = target_poll_id
    and status = 'open';

  return true;
end;
$$;

create or replace function public.noxa_get_crew_poll_results(target_crew_id uuid)
returns table (
  poll_id uuid,
  option_id uuid,
  vote_count bigint,
  is_selected boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  if not public.noxa_is_crew_member(target_crew_id) then
    raise exception 'crew membership required'
      using errcode = '42501';
  end if;

  return query
  select
    public.crew_poll_options.poll_id,
    public.crew_poll_options.id,
    count(public.crew_poll_votes.user_id),
    coalesce(
      bool_or(public.crew_poll_votes.user_id = actor),
      false
    )
  from public.crew_poll_options
  join public.crew_polls
    on public.crew_polls.id = public.crew_poll_options.poll_id
  left join public.crew_poll_votes
    on public.crew_poll_votes.poll_id = public.crew_poll_options.poll_id
    and public.crew_poll_votes.option_id = public.crew_poll_options.id
  where public.crew_polls.crew_id = target_crew_id
  group by public.crew_poll_options.poll_id, public.crew_poll_options.id;
end;
$$;

revoke all privileges on function public.noxa_create_crew_poll(
  uuid, text, text[], integer
) from public, anon, authenticated;
revoke all privileges on function public.noxa_vote_crew_poll(uuid, uuid)
  from public, anon, authenticated;
revoke all privileges on function public.noxa_close_crew_poll(uuid)
  from public, anon, authenticated;
revoke all privileges on function public.noxa_get_crew_poll_results(uuid)
  from public, anon, authenticated;

grant execute on function public.noxa_create_crew_poll(
  uuid, text, text[], integer
) to authenticated;
grant execute on function public.noxa_vote_crew_poll(uuid, uuid)
  to authenticated;
grant execute on function public.noxa_close_crew_poll(uuid)
  to authenticated;
grant execute on function public.noxa_get_crew_poll_results(uuid)
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crew_polls'
  ) then
    alter publication supabase_realtime add table public.crew_polls;
  end if;
end $$;
