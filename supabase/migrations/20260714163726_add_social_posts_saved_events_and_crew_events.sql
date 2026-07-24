alter table public.events
  add column if not exists crew_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_crew_id_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_crew_id_fkey
      foreign key (crew_id) references public.crews(id) on delete set null;
  end if;
end $$;

create index if not exists events_crew_id_starts_at_idx
  on public.events (crew_id, starts_at)
  where crew_id is not null;

create table if not exists public.saved_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists saved_events_event_id_idx
  on public.saved_events (event_id);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  image_url text not null,
  caption text,
  location_name text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint posts_image_url_length_check
    check (char_length(btrim(image_url)) between 1 and 4000),
  constraint posts_caption_length_check
    check (caption is null or char_length(caption) <= 2200),
  constraint posts_location_name_length_check
    check (location_name is null or char_length(location_name) <= 160)
);

create index if not exists posts_author_id_created_at_idx
  on public.posts (author_id, created_at desc);
create index if not exists posts_public_created_at_idx
  on public.posts (created_at desc)
  where is_public = true;
create index if not exists posts_vehicle_id_idx
  on public.posts (vehicle_id)
  where vehicle_id is not null;

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  reply_to_user_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint post_comments_body_length_check
    check (char_length(btrim(body)) between 1 and 1000)
);

create index if not exists post_comments_post_id_created_at_idx
  on public.post_comments (post_id, created_at);
create index if not exists post_comments_author_id_idx
  on public.post_comments (author_id);
create index if not exists post_comments_reply_to_user_id_idx
  on public.post_comments (reply_to_user_id)
  where reply_to_user_id is not null;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_id_idx
  on public.post_likes (user_id);

create table if not exists public.post_comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists post_comment_likes_user_id_idx
  on public.post_comment_likes (user_id);

create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists saved_posts_post_id_idx
  on public.saved_posts (post_id);

grant select, insert, delete on table public.saved_events to authenticated;
grant select, insert, update, delete on table public.posts to authenticated;
grant select, insert, update, delete on table public.post_comments to authenticated;
grant select, insert, delete on table public.post_likes to authenticated;
grant select, insert, delete on table public.post_comment_likes to authenticated;
grant select, insert, delete on table public.saved_posts to authenticated;

alter table public.saved_events enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comment_likes enable row level security;
alter table public.saved_posts enable row level security;

drop policy if exists "NOXA events are readable when public or owned" on public.events;
drop policy if exists "NOXA events readable when accessible" on public.events;
drop policy if exists "NOXA users can create own events" on public.events;
drop policy if exists "NOXA users can update own events" on public.events;

create policy "NOXA events readable when accessible"
  on public.events
  for select
  to authenticated
  using (
    is_public = true
    or creator_id = (select auth.uid())
    or (crew_id is not null and public.noxa_is_crew_member(crew_id))
  );

create policy "NOXA users can create own events"
  on public.events
  for insert
  to authenticated
  with check (
    creator_id = (select auth.uid())
    and (crew_id is null or public.noxa_is_crew_manager(crew_id))
  );

create policy "NOXA users can update own events"
  on public.events
  for update
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (
    creator_id = (select auth.uid())
    and (crew_id is null or public.noxa_is_crew_manager(crew_id))
  );

drop policy if exists "NOXA attendees readable for accessible events" on public.event_attendees;
drop policy if exists "NOXA users can join accessible public events" on public.event_attendees;

create policy "NOXA attendees readable for accessible events"
  on public.event_attendees
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = event_attendees.event_id
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
        and (
          events.is_public = true
          or (
            events.crew_id is not null
            and public.noxa_is_crew_member(events.crew_id)
          )
        )
    )
  );

drop policy if exists "NOXA users can read saved events" on public.saved_events;
drop policy if exists "NOXA users can save visible events" on public.saved_events;
drop policy if exists "NOXA users can remove saved events" on public.saved_events;

create policy "NOXA users can read saved events"
  on public.saved_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "NOXA users can save visible events"
  on public.saved_events
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.events
      where events.id = saved_events.event_id
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

create policy "NOXA users can remove saved events"
  on public.saved_events
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "NOXA posts readable when public or owned" on public.posts;
drop policy if exists "NOXA users can create own posts" on public.posts;
drop policy if exists "NOXA users can update own posts" on public.posts;
drop policy if exists "NOXA users can delete own posts" on public.posts;

create policy "NOXA posts readable when public or owned"
  on public.posts
  for select
  to authenticated
  using (is_public = true or author_id = (select auth.uid()));

create policy "NOXA users can create own posts"
  on public.posts
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      vehicle_id is null
      or exists (
        select 1
        from public.vehicles
        where vehicles.id = posts.vehicle_id
          and vehicles.owner_id = (select auth.uid())
      )
    )
  );

create policy "NOXA users can update own posts"
  on public.posts
  for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and (
      vehicle_id is null
      or exists (
        select 1
        from public.vehicles
        where vehicles.id = posts.vehicle_id
          and vehicles.owner_id = (select auth.uid())
      )
    )
  );

create policy "NOXA users can delete own posts"
  on public.posts
  for delete
  to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "NOXA comments readable for visible posts" on public.post_comments;
drop policy if exists "NOXA users can comment on visible posts" on public.post_comments;
drop policy if exists "NOXA users can update own comments" on public.post_comments;
drop policy if exists "NOXA users can delete own comments or comments on own posts" on public.post_comments;

create policy "NOXA comments readable for visible posts"
  on public.post_comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts
      where posts.id = post_comments.post_id
        and (posts.is_public = true or posts.author_id = (select auth.uid()))
    )
  );

create policy "NOXA users can comment on visible posts"
  on public.post_comments
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.posts
      where posts.id = post_comments.post_id
        and (posts.is_public = true or posts.author_id = (select auth.uid()))
    )
  );

create policy "NOXA users can update own comments"
  on public.post_comments
  for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "NOXA users can delete own comments or comments on own posts"
  on public.post_comments
  for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1
      from public.posts
      where posts.id = post_comments.post_id
        and posts.author_id = (select auth.uid())
    )
  );

drop policy if exists "NOXA post likes readable for visible posts" on public.post_likes;
drop policy if exists "NOXA users can like visible posts" on public.post_likes;
drop policy if exists "NOXA users can remove own post likes" on public.post_likes;

create policy "NOXA post likes readable for visible posts"
  on public.post_likes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts
      where posts.id = post_likes.post_id
        and (posts.is_public = true or posts.author_id = (select auth.uid()))
    )
  );

create policy "NOXA users can like visible posts"
  on public.post_likes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.posts
      where posts.id = post_likes.post_id
        and (posts.is_public = true or posts.author_id = (select auth.uid()))
    )
  );

create policy "NOXA users can remove own post likes"
  on public.post_likes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "NOXA comment likes readable for visible posts" on public.post_comment_likes;
drop policy if exists "NOXA users can like comments on visible posts" on public.post_comment_likes;
drop policy if exists "NOXA users can remove own comment likes" on public.post_comment_likes;

create policy "NOXA comment likes readable for visible posts"
  on public.post_comment_likes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.post_comments
      join public.posts on posts.id = post_comments.post_id
      where post_comments.id = post_comment_likes.comment_id
        and (posts.is_public = true or posts.author_id = (select auth.uid()))
    )
  );

create policy "NOXA users can like comments on visible posts"
  on public.post_comment_likes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.post_comments
      join public.posts on posts.id = post_comments.post_id
      where post_comments.id = post_comment_likes.comment_id
        and (posts.is_public = true or posts.author_id = (select auth.uid()))
    )
  );

create policy "NOXA users can remove own comment likes"
  on public.post_comment_likes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "NOXA users can read saved posts" on public.saved_posts;
drop policy if exists "NOXA users can save visible posts" on public.saved_posts;
drop policy if exists "NOXA users can remove saved posts" on public.saved_posts;

create policy "NOXA users can read saved posts"
  on public.saved_posts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "NOXA users can save visible posts"
  on public.saved_posts
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.posts
      where posts.id = saved_posts.post_id
        and (posts.is_public = true or posts.author_id = (select auth.uid()))
    )
  );

create policy "NOXA users can remove saved posts"
  on public.saved_posts
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
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

drop policy if exists "noxa_post_images_authenticated_insert_own_folder" on storage.objects;
drop policy if exists "noxa_post_images_authenticated_delete_own_object" on storage.objects;

create policy "noxa_post_images_authenticated_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "noxa_post_images_authenticated_delete_own_object"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-images'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
