alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (
    kind in (
      'follow',
      'crew_invite',
      'drive_invite',
      'event_chat_message',
      'post_comment',
      'post_reply',
      'post_like',
      'comment_like'
    )
  );

create or replace function private.noxa_notify_event_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
  event_title text;
  message_excerpt text;
  recipient record;
begin
  select coalesce(
    nullif(btrim(display_name), ''),
    nullif(btrim(username), ''),
    'A NOXA driver'
  )
  into actor_name
  from public.profiles
  where id = new.sender_id;

  select coalesce(nullif(btrim(title), ''), 'NOXA event')
  into event_title
  from public.events
  where id = new.event_id;

  message_excerpt := left(
    regexp_replace(btrim(new.body), '[[:space:]]+', ' ', 'g'),
    140
  );

  for recipient in
    select event_attendees.user_id
    from public.event_attendees
    where event_attendees.event_id = new.event_id
      and event_attendees.user_id <> new.sender_id
  loop
    perform private.noxa_enqueue_notification(
      recipient.user_id,
      new.sender_id,
      'event_chat_message',
      'messages',
      coalesce(event_title, 'NOXA event'),
      coalesce(actor_name, 'A NOXA driver') || ': ' || message_excerpt,
      jsonb_build_object(
        'event_chat_id', new.event_id,
        'event_id', new.event_id,
        'message_id', new.id,
        'sender_id', new.sender_id
      ),
      'event_chat_message:' || new.id::text || ':' || recipient.user_id::text
    );
  end loop;

  return new;
end;
$$;

revoke all on function private.noxa_notify_event_chat_message()
  from public, anon, authenticated, service_role;

drop trigger if exists noxa_notify_event_chat_message_trigger
  on public.event_messages;

create trigger noxa_notify_event_chat_message_trigger
  after insert on public.event_messages
  for each row execute function private.noxa_notify_event_chat_message();
