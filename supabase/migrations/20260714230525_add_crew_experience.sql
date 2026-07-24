-- Crew Chat, Crew Gallery, and private Crew Convoy experience.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.crew_messages (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint crew_messages_body_check
    check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists crew_messages_crew_id_created_at_idx
  on public.crew_messages (crew_id, created_at);
create index if not exists crew_messages_sender_id_idx
  on public.crew_messages (sender_id);

alter table public.crew_messages enable row level security;
revoke all on table public.crew_messages from anon, authenticated;
grant select, insert, delete on table public.crew_messages to authenticated;

drop policy if exists "NOXA crew members can read messages" on public.crew_messages;
drop policy if exists "NOXA crew members can send messages" on public.crew_messages;
drop policy if exists "NOXA users can delete own crew messages" on public.crew_messages;

create policy "NOXA crew members can read messages"
  on public.crew_messages
  for select
  to authenticated
  using (public.noxa_is_crew_member(crew_id));

create policy "NOXA crew members can send messages"
  on public.crew_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.noxa_is_crew_member(crew_id)
  );

create policy "NOXA users can delete own crew messages"
  on public.crew_messages
  for delete
  to authenticated
  using (
    sender_id = (select auth.uid())
    and public.noxa_is_crew_member(crew_id)
  );

create table if not exists public.crew_gallery_items (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  caption text,
  created_at timestamptz not null default now(),
  constraint crew_gallery_items_object_path_check
    check (char_length(btrim(object_path)) between 3 and 500),
  constraint crew_gallery_items_caption_check
    check (caption is null or char_length(caption) <= 500)
);

create index if not exists crew_gallery_items_crew_id_created_at_idx
  on public.crew_gallery_items (crew_id, created_at desc);
create index if not exists crew_gallery_items_uploader_id_idx
  on public.crew_gallery_items (uploader_id);

alter table public.crew_gallery_items enable row level security;
revoke all on table public.crew_gallery_items from anon, authenticated;
grant select, insert, delete on table public.crew_gallery_items to authenticated;

drop policy if exists "NOXA crew gallery is readable by members" on public.crew_gallery_items;
drop policy if exists "NOXA crew members can add gallery items" on public.crew_gallery_items;
drop policy if exists "NOXA uploaders and crew managers can remove gallery items" on public.crew_gallery_items;

create policy "NOXA crew gallery is readable by members"
  on public.crew_gallery_items
  for select
  to authenticated
  using (public.noxa_is_crew_member(crew_id));

create policy "NOXA crew members can add gallery items"
  on public.crew_gallery_items
  for insert
  to authenticated
  with check (
    uploader_id = (select auth.uid())
    and split_part(object_path, '/', 1) = (select auth.uid())::text
    and split_part(object_path, '/', 2) = crew_id::text
    and public.noxa_is_crew_member(crew_id)
  );

create policy "NOXA uploaders and crew managers can remove gallery items"
  on public.crew_gallery_items
  for delete
  to authenticated
  using (
    uploader_id = (select auth.uid())
    or public.noxa_is_crew_manager(crew_id)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crew-gallery',
  'crew-gallery',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "noxa_crew_gallery_insert_member_folder" on storage.objects;
drop policy if exists "noxa_crew_gallery_read_member_items" on storage.objects;
drop policy if exists "noxa_crew_gallery_delete_member_objects" on storage.objects;

create policy "noxa_crew_gallery_insert_member_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'crew-gallery'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.crew_members
      where public.crew_members.crew_id::text = (storage.foldername(name))[2]
        and public.crew_members.user_id = (select auth.uid())
    )
  );

create policy "noxa_crew_gallery_read_member_items"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'crew-gallery'
    and exists (
      select 1
      from public.crew_gallery_items
      where public.crew_gallery_items.object_path = storage.objects.name
        and public.noxa_is_crew_member(public.crew_gallery_items.crew_id)
    )
  );

create policy "noxa_crew_gallery_delete_member_objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'crew-gallery'
    and exists (
      select 1
      from public.crew_gallery_items
      where public.crew_gallery_items.object_path = storage.objects.name
        and (
          public.crew_gallery_items.uploader_id = (select auth.uid())
          or public.noxa_is_crew_manager(public.crew_gallery_items.crew_id)
        )
    )
  );

create table if not exists public.crew_convoys (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  meeting_point text not null,
  destination text not null,
  starts_at timestamptz not null,
  max_slots integer not null default 10,
  safety_note text,
  status text not null default 'lobby',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crew_convoys_name_check
    check (char_length(btrim(name)) between 2 and 80),
  constraint crew_convoys_meeting_point_check
    check (char_length(btrim(meeting_point)) between 2 and 160),
  constraint crew_convoys_destination_check
    check (char_length(btrim(destination)) between 2 and 160),
  constraint crew_convoys_max_slots_check
    check (max_slots between 2 and 20),
  constraint crew_convoys_safety_note_check
    check (safety_note is null or char_length(safety_note) <= 500),
  constraint crew_convoys_status_check
    check (status in ('lobby', 'live', 'completed', 'cancelled'))
);

create index if not exists crew_convoys_crew_status_starts_at_idx
  on public.crew_convoys (crew_id, status, starts_at desc);
create index if not exists crew_convoys_created_by_idx
  on public.crew_convoys (created_by);

create table if not exists public.crew_convoy_participants (
  convoy_id uuid not null references public.crew_convoys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (convoy_id, user_id)
);

create index if not exists crew_convoy_participants_user_id_idx
  on public.crew_convoy_participants (user_id);

alter table public.crew_convoys enable row level security;
alter table public.crew_convoy_participants enable row level security;

revoke all on table public.crew_convoys from anon, authenticated;
grant select, insert, delete on table public.crew_convoys to authenticated;
grant update (name, meeting_point, destination, starts_at, max_slots, safety_note, status)
  on table public.crew_convoys to authenticated;

revoke all on table public.crew_convoy_participants from anon, authenticated;
grant select, insert, delete on table public.crew_convoy_participants to authenticated;
grant update (ready) on table public.crew_convoy_participants to authenticated;

drop policy if exists "NOXA crew members can read convoys" on public.crew_convoys;
drop policy if exists "NOXA crew managers can create convoys" on public.crew_convoys;
drop policy if exists "NOXA crew managers can update convoys" on public.crew_convoys;
drop policy if exists "NOXA crew managers can delete convoys" on public.crew_convoys;

create policy "NOXA crew members can read convoys"
  on public.crew_convoys
  for select
  to authenticated
  using (public.noxa_is_crew_member(crew_id));

create policy "NOXA crew managers can create convoys"
  on public.crew_convoys
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.noxa_is_crew_manager(crew_id)
  );

create policy "NOXA crew managers can update convoys"
  on public.crew_convoys
  for update
  to authenticated
  using (public.noxa_is_crew_manager(crew_id))
  with check (public.noxa_is_crew_manager(crew_id));

create policy "NOXA crew managers can delete convoys"
  on public.crew_convoys
  for delete
  to authenticated
  using (public.noxa_is_crew_manager(crew_id));

drop policy if exists "NOXA crew members can read convoy participants" on public.crew_convoy_participants;
drop policy if exists "NOXA crew members can join convoys" on public.crew_convoy_participants;
drop policy if exists "NOXA convoy participants can update readiness" on public.crew_convoy_participants;
drop policy if exists "NOXA participants or managers can leave convoys" on public.crew_convoy_participants;

create policy "NOXA crew members can read convoy participants"
  on public.crew_convoy_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.crew_convoys
      where public.crew_convoys.id = crew_convoy_participants.convoy_id
        and public.noxa_is_crew_member(public.crew_convoys.crew_id)
    )
  );

create policy "NOXA crew members can join convoys"
  on public.crew_convoy_participants
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.crew_convoys
      where public.crew_convoys.id = crew_convoy_participants.convoy_id
        and public.noxa_is_crew_member(public.crew_convoys.crew_id)
    )
  );

create policy "NOXA convoy participants can update readiness"
  on public.crew_convoy_participants
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "NOXA participants or managers can leave convoys"
  on public.crew_convoy_participants
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.crew_convoys
      where public.crew_convoys.id = crew_convoy_participants.convoy_id
        and public.noxa_is_crew_manager(public.crew_convoys.crew_id)
    )
  );

create or replace function private.noxa_prepare_crew_convoy_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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

  if new.status is distinct from old.status then
    if old.status = 'lobby' and new.status = 'live' then
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

drop trigger if exists noxa_prepare_crew_convoy_update_trigger
  on public.crew_convoys;
create trigger noxa_prepare_crew_convoy_update_trigger
  before update
  on public.crew_convoys
  for each row
  execute function private.noxa_prepare_crew_convoy_update();

create or replace function private.noxa_enforce_crew_convoy_capacity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  convoy_crew_id uuid;
  convoy_status text;
  convoy_capacity integer;
  participant_count integer;
begin
  if new.user_id <> (select auth.uid()) then
    raise exception 'participants can only join themselves'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.convoy_id::text, 0));

  select
    public.crew_convoys.crew_id,
    public.crew_convoys.status,
    public.crew_convoys.max_slots
  into convoy_crew_id, convoy_status, convoy_capacity
  from public.crew_convoys
  where public.crew_convoys.id = new.convoy_id;

  if convoy_crew_id is null then
    raise exception 'convoy not found'
      using errcode = '23503';
  end if;

  if not public.noxa_is_crew_member(convoy_crew_id) then
    raise exception 'crew membership required'
      using errcode = '42501';
  end if;

  if convoy_status <> 'lobby' then
    raise exception 'convoy lobby is closed'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into participant_count
  from public.crew_convoy_participants
  where public.crew_convoy_participants.convoy_id = new.convoy_id;

  if participant_count >= convoy_capacity then
    raise exception 'convoy capacity reached'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all privileges on function private.noxa_enforce_crew_convoy_capacity()
  from public, anon, authenticated;

drop trigger if exists noxa_enforce_crew_convoy_capacity_trigger
  on public.crew_convoy_participants;
create trigger noxa_enforce_crew_convoy_capacity_trigger
  before insert
  on public.crew_convoy_participants
  for each row
  execute function private.noxa_enforce_crew_convoy_capacity();

create or replace function public.noxa_create_crew_convoy(
  target_crew_id uuid,
  convoy_name text,
  convoy_meeting_point text,
  convoy_destination text,
  convoy_starts_at timestamptz,
  convoy_max_slots integer,
  convoy_safety_note text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  convoy_id uuid;
begin
  if actor is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  insert into public.crew_convoys (
    crew_id,
    created_by,
    name,
    meeting_point,
    destination,
    starts_at,
    max_slots,
    safety_note
  )
  values (
    target_crew_id,
    actor,
    btrim(convoy_name),
    btrim(convoy_meeting_point),
    btrim(convoy_destination),
    convoy_starts_at,
    convoy_max_slots,
    nullif(btrim(convoy_safety_note), '')
  )
  returning id into convoy_id;

  insert into public.crew_convoy_participants (convoy_id, user_id, ready)
  values (convoy_id, actor, true);

  return convoy_id;
end;
$$;

revoke all privileges on function public.noxa_create_crew_convoy(
  uuid, text, text, text, timestamptz, integer, text
) from public, anon, authenticated;
grant execute on function public.noxa_create_crew_convoy(
  uuid, text, text, text, timestamptz, integer, text
) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crew_messages'
  ) then
    alter publication supabase_realtime add table public.crew_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crew_convoys'
  ) then
    alter publication supabase_realtime add table public.crew_convoys;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crew_convoy_participants'
  ) then
    alter publication supabase_realtime add table public.crew_convoy_participants;
  end if;
end $$;
