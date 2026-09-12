create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'noxa_push_webhook_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'noxa_push_webhook_secret',
      'Internal secret used only by Postgres to authenticate NOXA push dispatch requests.'
    );
  end if;
end
$$;

create or replace function public.noxa_get_push_webhook_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'noxa_push_webhook_secret'
  limit 1
$$;

revoke all on function public.noxa_get_push_webhook_secret() from public, anon, authenticated;
grant execute on function public.noxa_get_push_webhook_secret() to service_role;

create or replace function public.noxa_request_push_dispatch(target_notification_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
  request_id bigint;
begin
  select public.noxa_get_push_webhook_secret() into webhook_secret;

  if webhook_secret is null or webhook_secret = '' then
    update public.notifications
    set
      push_status = 'failed',
      push_error = 'Push webhook secret is missing.',
      updated_at = now()
    where id = target_notification_id
      and push_status in ('pending', 'failed', 'processing');
    return null;
  end if;

  select net.http_post(
    url := 'https://wzfpwuyyaotvofdijhin.supabase.co/functions/v1/push-notification',
    body := jsonb_build_object('notification_id', target_notification_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-noxa-push-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  ) into request_id;

  return request_id;
exception
  when others then
    update public.notifications
    set
      push_status = 'failed',
      push_error = left('Push dispatch queue failed: ' || sqlerrm, 500),
      updated_at = now()
    where id = target_notification_id
      and push_status in ('pending', 'failed', 'processing');
    return null;
end
$$;

revoke all on function public.noxa_request_push_dispatch(uuid) from public, anon, authenticated;
grant execute on function public.noxa_request_push_dispatch(uuid) to service_role;

create or replace function public.noxa_dispatch_new_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.noxa_request_push_dispatch(new.id);
  return new;
end
$$;

revoke all on function public.noxa_dispatch_new_notification() from public, anon, authenticated;

drop trigger if exists noxa_dispatch_notification_insert on public.notifications;
create trigger noxa_dispatch_notification_insert
after insert on public.notifications
for each row
execute function public.noxa_dispatch_new_notification();

create or replace function public.noxa_dispatch_pending_push_notifications(max_rows integer default 50)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_row record;
  dispatched integer := 0;
begin
  for notification_row in
    select id
    from public.notifications
    where push_attempts < 3
      and (
        push_status in ('pending', 'failed')
        or (
          push_status = 'processing'
          and updated_at < now() - interval '5 minutes'
        )
      )
    order by created_at asc
    limit greatest(1, least(coalesce(max_rows, 50), 200))
  loop
    perform public.noxa_request_push_dispatch(notification_row.id);
    dispatched := dispatched + 1;
  end loop;

  return dispatched;
end
$$;

revoke all on function public.noxa_dispatch_pending_push_notifications(integer) from public, anon, authenticated;
grant execute on function public.noxa_dispatch_pending_push_notifications(integer) to service_role;

create or replace function public.noxa_enqueue_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  actor_id uuid;
  notification_kind text;
  notification_category text;
  notification_title text;
  notification_body text;
  notification_data jsonb := '{}'::jsonb;
  notification_dedupe_key text;
  actor_label text;
  crew_label text;
  related_post_id uuid;
begin
  if tg_table_name = 'follows' then
    actor_id := new.follower_id;
    recipient_id := new.following_id;
    notification_kind := 'follow';
    notification_category := 'social';
    notification_title := 'New follower';
    notification_dedupe_key := format(
      'follow:%s:%s:%s',
      new.follower_id,
      new.following_id,
      to_char(new.created_at, 'YYYYMMDDHH24MISSUS')
    );
    notification_data := jsonb_build_object('actor_id', actor_id);

  elsif tg_table_name = 'crew_invitations' then
    if new.status <> 'pending' then
      return new;
    end if;
    actor_id := new.invited_by;
    recipient_id := new.invited_user_id;
    notification_kind := 'crew_invite';
    notification_category := 'crews';
    notification_title := 'Crew invitation';
    notification_dedupe_key := 'crew_invite:' || new.id::text;
    notification_data := jsonb_build_object(
      'crew_id', new.crew_id,
      'actor_id', actor_id
    );

  elsif tg_table_name = 'post_comments' then
    actor_id := new.author_id;
    related_post_id := new.post_id;
    if new.reply_to_user_id is not null and new.reply_to_user_id <> actor_id then
      recipient_id := new.reply_to_user_id;
      notification_kind := 'post_reply';
      notification_title := 'New reply';
    else
      select author_id into recipient_id
      from public.posts
      where id = new.post_id;
      notification_kind := 'post_comment';
      notification_title := 'New comment';
    end if;
    notification_category := 'social';
    notification_dedupe_key := notification_kind || ':' || new.id::text;
    notification_data := jsonb_build_object(
      'post_id', related_post_id,
      'actor_id', actor_id
    );

  elsif tg_table_name = 'post_likes' then
    actor_id := new.user_id;
    related_post_id := new.post_id;
    select author_id into recipient_id
    from public.posts
    where id = new.post_id;
    notification_kind := 'post_like';
    notification_category := 'social';
    notification_title := 'New like';
    notification_dedupe_key := format(
      'post_like:%s:%s:%s',
      new.post_id,
      new.user_id,
      to_char(new.created_at, 'YYYYMMDDHH24MISSUS')
    );
    notification_data := jsonb_build_object(
      'post_id', related_post_id,
      'actor_id', actor_id
    );

  elsif tg_table_name = 'post_comment_likes' then
    actor_id := new.user_id;
    select author_id, post_id into recipient_id, related_post_id
    from public.post_comments
    where id = new.comment_id;
    notification_kind := 'comment_like';
    notification_category := 'social';
    notification_title := 'New like';
    notification_dedupe_key := format(
      'comment_like:%s:%s:%s',
      new.comment_id,
      new.user_id,
      to_char(new.created_at, 'YYYYMMDDHH24MISSUS')
    );
    notification_data := jsonb_build_object(
      'post_id', related_post_id,
      'actor_id', actor_id
    );
  else
    return new;
  end if;

  if recipient_id is null or actor_id is null or recipient_id = actor_id then
    return new;
  end if;

  select coalesce(
    nullif(btrim(display_name), ''),
    nullif(btrim(username), ''),
    'Someone'
  )
  into actor_label
  from public.profiles
  where id = actor_id;

  actor_label := coalesce(actor_label, 'Someone');

  if notification_kind = 'follow' then
    notification_body := actor_label || ' started following you.';
  elsif notification_kind = 'crew_invite' then
    select coalesce(nullif(btrim(name), ''), 'a crew')
    into crew_label
    from public.crews
    where id = new.crew_id;
    notification_body := actor_label || ' invited you to join ' || coalesce(crew_label, 'a crew') || '.';
  elsif notification_kind = 'post_comment' then
    notification_body := actor_label || ' commented on your post.';
  elsif notification_kind = 'post_reply' then
    notification_body := actor_label || ' replied to your comment.';
  elsif notification_kind = 'post_like' then
    notification_body := actor_label || ' liked your post.';
  elsif notification_kind = 'comment_like' then
    notification_body := actor_label || ' liked your comment.';
  else
    return new;
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
    recipient_id,
    actor_id,
    notification_kind,
    notification_category,
    notification_title,
    notification_body,
    notification_data,
    notification_dedupe_key
  )
  on conflict (dedupe_key) do nothing;

  return new;
end
$$;

revoke all on function public.noxa_enqueue_activity_notification() from public, anon, authenticated;

drop trigger if exists noxa_notify_follow_insert on public.follows;
create trigger noxa_notify_follow_insert
after insert on public.follows
for each row execute function public.noxa_enqueue_activity_notification();

drop trigger if exists noxa_notify_crew_invitation_insert on public.crew_invitations;
create trigger noxa_notify_crew_invitation_insert
after insert on public.crew_invitations
for each row execute function public.noxa_enqueue_activity_notification();

drop trigger if exists noxa_notify_post_comment_insert on public.post_comments;
create trigger noxa_notify_post_comment_insert
after insert on public.post_comments
for each row execute function public.noxa_enqueue_activity_notification();

drop trigger if exists noxa_notify_post_like_insert on public.post_likes;
create trigger noxa_notify_post_like_insert
after insert on public.post_likes
for each row execute function public.noxa_enqueue_activity_notification();

drop trigger if exists noxa_notify_comment_like_insert on public.post_comment_likes;
create trigger noxa_notify_comment_like_insert
after insert on public.post_comment_likes
for each row execute function public.noxa_enqueue_activity_notification();

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'noxa-push-retry'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'noxa-push-retry',
    '* * * * *',
    'select public.noxa_dispatch_pending_push_notifications(50);'
  );
end
$$;
