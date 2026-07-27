create schema if not exists private;

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  blocked_display_name text not null,
  blocked_username text,
  blocked_avatar_url text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

comment on table public.user_blocks is
  'User-managed safety blocks. Profile snapshot fields exist only so blockers can manage their own block list after RLS hides the blocked profile.';

create index user_blocks_blocked_id_idx
  on public.user_blocks (blocked_id, created_at desc);

alter table public.user_blocks enable row level security;

revoke all on table public.user_blocks from anon;
grant select, insert, delete on table public.user_blocks to authenticated;

create policy user_blocks_select_own
  on public.user_blocks
  for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy user_blocks_insert_own
  on public.user_blocks
  for insert
  to authenticated
  with check (
    blocker_id = (select auth.uid())
    and blocked_id <> (select auth.uid())
  );

create policy user_blocks_delete_own
  on public.user_blocks
  for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

create or replace function private.noxa_prepare_user_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.blocker_id is distinct from (select auth.uid()) then
    raise exception 'A block can only be created by the signed-in user';
  end if;

  select
    profiles.display_name,
    profiles.username,
    profiles.avatar_url
  into
    new.blocked_display_name,
    new.blocked_username,
    new.blocked_avatar_url
  from public.profiles
  where profiles.id = new.blocked_id;

  if new.blocked_display_name is null then
    raise exception 'The selected NOXA user does not exist';
  end if;

  delete from public.follows
  where
    (follower_id = new.blocker_id and following_id = new.blocked_id)
    or (follower_id = new.blocked_id and following_id = new.blocker_id);

  return new;
end;
$$;

revoke all on function private.noxa_prepare_user_block()
  from public, anon, authenticated, service_role;

create trigger noxa_prepare_user_block_trigger
  before insert on public.user_blocks
  for each row
  execute function private.noxa_prepare_user_block();

create or replace function private.noxa_users_blocked(
  first_user_id uuid,
  second_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    first_user_id is not null
    and second_user_id is not null
    and first_user_id <> second_user_id
    and exists (
      select 1
      from public.user_blocks
      where
        (blocker_id = first_user_id and blocked_id = second_user_id)
        or (blocker_id = second_user_id and blocked_id = first_user_id)
    );
$$;

revoke all on function private.noxa_users_blocked(uuid, uuid)
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.noxa_users_blocked(uuid, uuid)
  to authenticated;

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (
    target_type in (
      'profile',
      'post',
      'comment',
      'vehicle',
      'crew',
      'event',
      'crew_message',
      'event_message'
    )
  ),
  target_id uuid not null,
  reason text not null check (
    reason in (
      'harassment',
      'hate_speech',
      'dangerous_activity',
      'spam',
      'impersonation',
      'privacy',
      'illegal_content',
      'other'
    )
  ),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (
    status in ('open', 'reviewing', 'actioned', 'dismissed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_reports is
  'Safety reports submitted by authenticated users. Only the reporter can read the submitted record; moderation updates require a privileged backend.';

create unique index content_reports_one_open_target_idx
  on public.content_reports (reporter_id, target_type, target_id)
  where status in ('open', 'reviewing');

create index content_reports_status_created_at_idx
  on public.content_reports (status, created_at);

alter table public.content_reports enable row level security;

revoke all on table public.content_reports from anon;
grant select, insert on table public.content_reports to authenticated;

create policy content_reports_select_own
  on public.content_reports
  for select
  to authenticated
  using (reporter_id = (select auth.uid()));

create policy content_reports_insert_own
  on public.content_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
  );

create policy blocks_hide_profiles
  on public.profiles
  as restrictive
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), id)
  );

create policy blocks_hide_vehicles
  on public.vehicles
  as restrictive
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), owner_id)
  );

create policy blocks_hide_follows
  on public.follows
  as restrictive
  for select
  to authenticated
  using (
    not private.noxa_users_blocked((select auth.uid()), follower_id)
    and not private.noxa_users_blocked((select auth.uid()), following_id)
  );

create policy blocks_prevent_follows
  on public.follows
  as restrictive
  for insert
  to authenticated
  with check (
    not private.noxa_users_blocked(follower_id, following_id)
  );

create policy blocks_hide_posts
  on public.posts
  as restrictive
  for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), author_id)
  );

create policy blocks_hide_post_comments
  on public.post_comments
  as restrictive
  for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), author_id)
  );

create policy blocks_hide_post_likes
  on public.post_likes
  as restrictive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), user_id)
  );

create policy blocks_hide_post_comment_likes
  on public.post_comment_likes
  as restrictive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), user_id)
  );

create policy blocks_hide_events
  on public.events
  as restrictive
  for select
  to authenticated
  using (
    creator_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), creator_id)
  );

create policy blocks_hide_event_attendees
  on public.event_attendees
  as restrictive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), user_id)
  );

create policy blocks_hide_crews
  on public.crews
  as restrictive
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), owner_id)
  );

create policy blocks_hide_crew_members
  on public.crew_members
  as restrictive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), user_id)
  );

create policy blocks_hide_driver_locations
  on public.driver_locations
  as restrictive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), user_id)
  );

create policy blocks_hide_event_messages
  on public.event_messages
  as restrictive
  for select
  to authenticated
  using (
    sender_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), sender_id)
  );

create policy blocks_hide_event_gallery
  on public.event_gallery_items
  as restrictive
  for select
  to authenticated
  using (
    uploader_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), uploader_id)
  );

create policy blocks_hide_crew_messages
  on public.crew_messages
  as restrictive
  for select
  to authenticated
  using (
    sender_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), sender_id)
  );

create policy blocks_hide_crew_gallery
  on public.crew_gallery_items
  as restrictive
  for select
  to authenticated
  using (
    uploader_id = (select auth.uid())
    or not private.noxa_users_blocked((select auth.uid()), uploader_id)
  );
