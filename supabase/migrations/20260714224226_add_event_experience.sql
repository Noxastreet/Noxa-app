-- Keep the local migration version aligned with the applied Supabase migration.
alter table public.events
  add column if not exists category text not null default 'meet',
  add column if not exists capacity integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_category_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_category_check
      check (category in ('meet', 'drive', 'track', 'social'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_capacity_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_capacity_check
      check (capacity is null or capacity between 2 and 5000);
  end if;
end $$;

alter table public.event_attendees
  add column if not exists response text not null default 'going';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_attendees_response_check'
      and conrelid = 'public.event_attendees'::regclass
  ) then
    alter table public.event_attendees
      add constraint event_attendees_response_check
      check (response in ('going', 'maybe'));
  end if;
end $$;

grant update on table public.event_attendees to authenticated;

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
        and (
          events.is_public = true
          or (
            events.crew_id is not null
            and public.noxa_is_crew_member(events.crew_id)
          )
        )
    )
  );

create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint event_messages_body_check
    check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists event_messages_event_id_created_at_idx
  on public.event_messages (event_id, created_at);
create index if not exists event_messages_sender_id_idx
  on public.event_messages (sender_id);

grant select, insert, delete on table public.event_messages to authenticated;
alter table public.event_messages enable row level security;

drop policy if exists "NOXA event participants can read messages" on public.event_messages;
drop policy if exists "NOXA event participants can send messages" on public.event_messages;
drop policy if exists "NOXA users can delete own event messages" on public.event_messages;

create policy "NOXA event participants can read messages"
  on public.event_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_attendees
      where event_attendees.event_id = event_messages.event_id
        and event_attendees.user_id = (select auth.uid())
    )
  );

create policy "NOXA event participants can send messages"
  on public.event_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.event_attendees
      where event_attendees.event_id = event_messages.event_id
        and event_attendees.user_id = (select auth.uid())
    )
  );

create policy "NOXA users can delete own event messages"
  on public.event_messages
  for delete
  to authenticated
  using (sender_id = (select auth.uid()));

create table if not exists public.event_gallery_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  caption text,
  created_at timestamptz not null default now(),
  constraint event_gallery_items_object_path_check
    check (char_length(btrim(object_path)) between 3 and 500),
  constraint event_gallery_items_caption_check
    check (caption is null or char_length(caption) <= 500)
);

create index if not exists event_gallery_items_event_id_created_at_idx
  on public.event_gallery_items (event_id, created_at desc);
create index if not exists event_gallery_items_uploader_id_idx
  on public.event_gallery_items (uploader_id);

grant select, insert, delete on table public.event_gallery_items to authenticated;
alter table public.event_gallery_items enable row level security;

drop policy if exists "NOXA gallery readable for accessible events" on public.event_gallery_items;
drop policy if exists "NOXA event participants can add gallery items" on public.event_gallery_items;
drop policy if exists "NOXA uploaders and hosts can remove gallery items" on public.event_gallery_items;

create policy "NOXA gallery readable for accessible events"
  on public.event_gallery_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = event_gallery_items.event_id
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

create policy "NOXA event participants can add gallery items"
  on public.event_gallery_items
  for insert
  to authenticated
  with check (
    uploader_id = (select auth.uid())
    and split_part(object_path, '/', 1) = (select auth.uid())::text
    and exists (
      select 1
      from public.event_attendees
      where event_attendees.event_id = event_gallery_items.event_id
        and event_attendees.user_id = (select auth.uid())
    )
  );

create policy "NOXA uploaders and hosts can remove gallery items"
  on public.event_gallery_items
  for delete
  to authenticated
  using (
    uploader_id = (select auth.uid())
    or exists (
      select 1
      from public.events
      where events.id = event_gallery_items.event_id
        and events.creator_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-gallery',
  'event-gallery',
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

drop policy if exists "noxa_event_gallery_insert_own_folder" on storage.objects;
drop policy if exists "noxa_event_gallery_read_accessible_items" on storage.objects;
drop policy if exists "noxa_event_gallery_delete_own_objects" on storage.objects;

create policy "noxa_event_gallery_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'event-gallery'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "noxa_event_gallery_read_accessible_items"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'event-gallery'
    and exists (
      select 1
      from public.event_gallery_items
      where event_gallery_items.object_path = storage.objects.name
    )
  );

create policy "noxa_event_gallery_delete_own_objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'event-gallery'
    and (
      (
        owner_id = (select auth.uid())::text
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      or exists (
        select 1
        from public.event_gallery_items
        join public.events
          on events.id = event_gallery_items.event_id
        where event_gallery_items.object_path = storage.objects.name
          and events.creator_id = (select auth.uid())
      )
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_messages'
  ) then
    alter publication supabase_realtime add table public.event_messages;
  end if;
end $$;
