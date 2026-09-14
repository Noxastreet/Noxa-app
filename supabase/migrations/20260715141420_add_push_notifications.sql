create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  project_id text not null,
  app_id text not null default 'com.karaketidis.noxa',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_token_length_check
    check (char_length(expo_push_token) between 20 and 255),
  constraint push_devices_token_format_check
    check (
      expo_push_token like 'ExpoPushToken[%]'
      or expo_push_token like 'ExponentPushToken[%]'
    ),
  constraint push_devices_project_id_length_check
    check (char_length(btrim(project_id)) between 1 and 120),
  constraint push_devices_app_id_length_check
    check (char_length(btrim(app_id)) between 1 and 160)
);

comment on table public.push_devices is
  'Expo push tokens registered by signed-in NOXA users. A token is reassigned when the same physical device changes accounts.';

create index push_devices_user_enabled_idx
  on public.push_devices (user_id, enabled, last_seen_at desc);

alter table public.push_devices enable row level security;

revoke all on table public.push_devices from anon, authenticated;
grant select, insert, update, delete on table public.push_devices to authenticated;
grant select, insert, update, delete on table public.push_devices to service_role;

create policy push_devices_select_own
  on public.push_devices
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy push_devices_insert_own
  on public.push_devices
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy push_devices_update_own
  on public.push_devices
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_devices_delete_own
  on public.push_devices
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  social_enabled boolean not null default true,
  crews_enabled boolean not null default true,
  events_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Per-user notification choices. Category flags are ready for the next NOXA notification modules.';

alter table public.notification_preferences enable row level security;

revoke all on table public.notification_preferences from anon, authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;
grant select, insert, update on table public.notification_preferences to service_role;

create policy notification_preferences_select_own
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy notification_preferences_insert_own
  on public.notification_preferences
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy notification_preferences_update_own
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (
    kind in (
      'follow',
      'crew_invite',
      'post_comment',
      'post_reply',
      'post_like',
      'comment_like'
    )
  ),
  category text not null check (category in ('social', 'crews', 'events', 'messages')),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 280),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  dedupe_key text not null unique check (char_length(dedupe_key) between 1 and 220),
  read_at timestamptz,
  push_status text not null default 'pending' check (
    push_status in ('pending', 'processing', 'sent', 'skipped', 'failed')
  ),
  push_attempts integer not null default 0 check (push_attempts between 0 and 3),
  push_ticket_ids jsonb not null default '[]'::jsonb check (
    jsonb_typeof(push_ticket_ids) = 'array'
  ),
  push_error text check (push_error is null or char_length(push_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notifications is
  'Server-owned notification outbox and in-app history. Authenticated clients can only read their own rows and update read_at.';

create index notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);
create index notifications_pending_created_at_idx
  on public.notifications (created_at)
  where push_status in ('pending', 'failed');

alter table public.notifications enable row level security;

revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant select, insert, update, delete on table public.notifications to service_role;

create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own_read_state
  on public.notifications
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function private.noxa_touch_push_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.noxa_touch_push_updated_at()
  from public, anon, authenticated, service_role;

create trigger push_devices_touch_updated_at
  before update on public.push_devices
  for each row execute function private.noxa_touch_push_updated_at();

create trigger notification_preferences_touch_updated_at
  before update on public.notification_preferences
  for each row execute function private.noxa_touch_push_updated_at();

create or replace function public.noxa_register_push_device(
  target_expo_push_token text,
  target_platform text,
  target_project_id text,
  target_app_id text default 'com.karaketidis.noxa'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  clean_token text := btrim(target_expo_push_token);
  clean_platform text := lower(btrim(target_platform));
  clean_project_id text := btrim(target_project_id);
  clean_app_id text := btrim(target_app_id);
  device_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if char_length(clean_token) not between 20 and 255
     or not (
       clean_token like 'ExpoPushToken[%]'
       or clean_token like 'ExponentPushToken[%]'
     ) then
    raise exception 'Invalid Expo push token';
  end if;

  if clean_platform not in ('ios', 'android') then
    raise exception 'Unsupported push platform';
  end if;

  if char_length(clean_project_id) not between 1 and 120 then
    raise exception 'Invalid Expo project ID';
  end if;

  if clean_app_id <> 'com.karaketidis.noxa' then
    raise exception 'Invalid NOXA application ID';
  end if;

  insert into public.push_devices (
    user_id,
    expo_push_token,
    platform,
    project_id,
    app_id,
    enabled,
    last_seen_at
  )
  values (
    actor,
    clean_token,
    clean_platform,
    clean_project_id,
    clean_app_id,
    true,
    now()
  )
  on conflict (expo_push_token) do update
  set
    user_id = excluded.user_id,
    platform = excluded.platform,
    project_id = excluded.project_id,
    app_id = excluded.app_id,
    enabled = true,
    last_seen_at = now()
  returning id into device_id;

  insert into public.notification_preferences (user_id, push_enabled)
  values (actor, true)
  on conflict (user_id) do update
  set push_enabled = true;

  return device_id;
end;
$$;

revoke all on function public.noxa_register_push_device(text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.noxa_register_push_device(text, text, text, text)
  to authenticated;

create or replace function public.noxa_unregister_push_device(
  target_expo_push_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  affected_rows integer;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  update public.push_devices
  set enabled = false,
      last_seen_at = now()
  where user_id = actor
    and expo_push_token = btrim(target_expo_push_token);

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.noxa_unregister_push_device(text)
  from public, anon, authenticated, service_role;
grant execute on function public.noxa_unregister_push_device(text)
  to authenticated;

create or replace function public.noxa_claim_push_notification(
  target_notification_id uuid
)
returns setof public.notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.notifications
  set
    push_status = 'processing',
    push_attempts = push_attempts + 1,
    push_error = null,
    updated_at = now()
  where id = target_notification_id
    and push_attempts < 3
    and (
      push_status in ('pending', 'failed')
      or (
        push_status = 'processing'
        and updated_at < now() - interval '5 minutes'
      )
    )
  returning *;
end;
$$;

revoke all on function public.noxa_claim_push_notification(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.noxa_claim_push_notification(uuid)
  to service_role;

create or replace function private.noxa_enqueue_notification(
  target_user_id uuid,
  source_actor_id uuid,
  notification_kind text,
  notification_category text,
  notification_title text,
  notification_body text,
  notification_data jsonb,
  notification_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_id uuid;
begin
  if target_user_id is null
     or source_actor_id is null
     or target_user_id = source_actor_id then
    return null;
  end if;

  if exists (
    select 1
    from public.user_blocks
    where
      (blocker_id = target_user_id and blocked_id = source_actor_id)
      or (blocker_id = source_actor_id and blocked_id = target_user_id)
  ) then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    kind,
    category,
    title,
    body,
    data,
    dedupe_key
  )
  values (
    target_user_id,
    source_actor_id,
    notification_kind,
    notification_category,
    left(notification_title, 80),
    left(notification_body, 280),
    coalesce(notification_data, '{}'::jsonb),
    notification_dedupe_key
  )
  on conflict (dedupe_key) do nothing
  returning id into notification_id;

  return notification_id;
end;
$$;

revoke all on function private.noxa_enqueue_notification(
  uuid, uuid, text, text, text, text, jsonb, text
) from public, anon, authenticated, service_role;

create or replace function private.noxa_notify_new_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
begin
  select coalesce(
    nullif(btrim(display_name), ''),
    nullif(btrim(username), ''),
    'A NOXA driver'
  )
  into actor_name
  from public.profiles
  where id = new.follower_id;

  perform private.noxa_enqueue_notification(
    new.following_id,
    new.follower_id,
    'follow',
    'social',
    'New follower',
    coalesce(actor_name, 'A NOXA driver') || ' started following you.',
    jsonb_build_object('actorId', new.follower_id),
    'follow:' || new.follower_id::text || ':' || new.following_id::text
  );

  return new;
end;
$$;

revoke all on function private.noxa_notify_new_follow()
  from public, anon, authenticated, service_role;

create trigger noxa_notify_new_follow_trigger
  after insert on public.follows
  for each row execute function private.noxa_notify_new_follow();

create or replace function private.noxa_notify_crew_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
  crew_name text;
begin
  select coalesce(
    nullif(btrim(display_name), ''),
    nullif(btrim(username), ''),
    'A crew manager'
  )
  into actor_name
  from public.profiles
  where id = new.invited_by;

  select coalesce(nullif(btrim(name), ''), 'a NOXA crew')
  into crew_name
  from public.crews
  where id = new.crew_id;

  perform private.noxa_enqueue_notification(
    new.invited_user_id,
    new.invited_by,
    'crew_invite',
    'crews',
    'Crew invitation',
    coalesce(actor_name, 'A crew manager') || ' invited you to ' ||
      coalesce(crew_name, 'a NOXA crew') || '.',
    jsonb_build_object('crewId', new.crew_id, 'invitationId', new.id),
    'crew_invite:' || new.id::text
  );

  return new;
end;
$$;

revoke all on function private.noxa_notify_crew_invitation()
  from public, anon, authenticated, service_role;

create trigger noxa_notify_crew_invitation_trigger
  after insert on public.crew_invitations
  for each row execute function private.noxa_notify_crew_invitation();

create or replace function private.noxa_notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
  post_owner_id uuid;
begin
  select coalesce(
    nullif(btrim(display_name), ''),
    nullif(btrim(username), ''),
    'A NOXA driver'
  )
  into actor_name
  from public.profiles
  where id = new.author_id;

  select author_id
  into post_owner_id
  from public.posts
  where id = new.post_id;

  if new.reply_to_user_id is not null then
    perform private.noxa_enqueue_notification(
      new.reply_to_user_id,
      new.author_id,
      'post_reply',
      'social',
      'New reply',
      coalesce(actor_name, 'A NOXA driver') || ' replied to your comment.',
      jsonb_build_object('postId', new.post_id, 'commentId', new.id),
      'post_comment:' || new.id::text || ':' || new.reply_to_user_id::text
    );
  end if;

  if post_owner_id is not null
     and post_owner_id is distinct from new.reply_to_user_id then
    perform private.noxa_enqueue_notification(
      post_owner_id,
      new.author_id,
      'post_comment',
      'social',
      'New comment',
      coalesce(actor_name, 'A NOXA driver') || ' commented on your post.',
      jsonb_build_object('postId', new.post_id, 'commentId', new.id),
      'post_comment:' || new.id::text || ':' || post_owner_id::text
    );
  end if;

  return new;
end;
$$;

revoke all on function private.noxa_notify_post_comment()
  from public, anon, authenticated, service_role;

create trigger noxa_notify_post_comment_trigger
  after insert on public.post_comments
  for each row execute function private.noxa_notify_post_comment();

create or replace function private.noxa_notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
  post_owner_id uuid;
begin
  select coalesce(
    nullif(btrim(display_name), ''),
    nullif(btrim(username), ''),
    'A NOXA driver'
  )
  into actor_name
  from public.profiles
  where id = new.user_id;

  select author_id
  into post_owner_id
  from public.posts
  where id = new.post_id;

  perform private.noxa_enqueue_notification(
    post_owner_id,
    new.user_id,
    'post_like',
    'social',
    'New like',
    coalesce(actor_name, 'A NOXA driver') || ' liked your post.',
    jsonb_build_object('postId', new.post_id),
    'post_like:' || new.post_id::text || ':' || new.user_id::text
  );

  return new;
end;
$$;

revoke all on function private.noxa_notify_post_like()
  from public, anon, authenticated, service_role;

create trigger noxa_notify_post_like_trigger
  after insert on public.post_likes
  for each row execute function private.noxa_notify_post_like();

create or replace function private.noxa_notify_comment_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
  comment_owner_id uuid;
  target_post_id uuid;
begin
  select coalesce(
    nullif(btrim(display_name), ''),
    nullif(btrim(username), ''),
    'A NOXA driver'
  )
  into actor_name
  from public.profiles
  where id = new.user_id;

  select author_id, post_id
  into comment_owner_id, target_post_id
  from public.post_comments
  where id = new.comment_id;

  perform private.noxa_enqueue_notification(
    comment_owner_id,
    new.user_id,
    'comment_like',
    'social',
    'Comment liked',
    coalesce(actor_name, 'A NOXA driver') || ' liked your comment.',
    jsonb_build_object('postId', target_post_id, 'commentId', new.comment_id),
    'comment_like:' || new.comment_id::text || ':' || new.user_id::text
  );

  return new;
end;
$$;

revoke all on function private.noxa_notify_comment_like()
  from public, anon, authenticated, service_role;

create trigger noxa_notify_comment_like_trigger
  after insert on public.post_comment_likes
  for each row execute function private.noxa_notify_comment_like();
