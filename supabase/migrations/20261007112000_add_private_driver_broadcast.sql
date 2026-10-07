begin;

alter table public.driver_locations
  add column if not exists broadcast_key uuid;

update public.driver_locations
set broadcast_key = gen_random_uuid()
where broadcast_key is null;

alter table public.driver_locations
  alter column broadcast_key set default gen_random_uuid(),
  alter column broadcast_key set not null;

comment on column public.driver_locations.broadcast_key is
  'Rotating authorization key for private per-driver Realtime Broadcast topics.';

create or replace function private.noxa_guard_driver_broadcast_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.broadcast_key := gen_random_uuid();
    return new;
  end if;

  if new.visibility_mode is distinct from old.visibility_mode
     or (
       old.share_expires_at <= now()
       and new.share_expires_at > now()
     )
  then
    new.broadcast_key := gen_random_uuid();
    return new;
  end if;

  if new.broadcast_key is distinct from old.broadcast_key
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
  then
    new.broadcast_key := old.broadcast_key;
  end if;

  return new;
end;
$$;

revoke all privileges
  on function private.noxa_guard_driver_broadcast_key()
  from public, anon, authenticated, service_role;

drop trigger if exists driver_locations_broadcast_key_guard
  on public.driver_locations;
create trigger driver_locations_broadcast_key_guard
before insert or update on public.driver_locations
for each row execute function private.noxa_guard_driver_broadcast_key();

-- Preserve location freshness when an internal authorization-key rotation is
-- the only change. Ordinary client heartbeats still receive trusted server time.
create or replace function private.noxa_set_driver_location_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.broadcast_key is distinct from old.broadcast_key
     and new.user_id is not distinct from old.user_id
     and new.latitude is not distinct from old.latitude
     and new.longitude is not distinct from old.longitude
     and new.heading is not distinct from old.heading
     and new.speed_mps is not distinct from old.speed_mps
     and new.accuracy_meters is not distinct from old.accuracy_meters
     and new.visibility_mode is not distinct from old.visibility_mode
     and new.share_expires_at is not distinct from old.share_expires_at
     and new.share_started_at is not distinct from old.share_started_at
  then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all privileges
  on function private.noxa_set_driver_location_updated_at()
  from public, anon, authenticated, service_role;

create or replace function private.noxa_driver_broadcast_topic(
  target_user_id uuid,
  target_broadcast_key uuid
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select 'noxa-driver:' || target_user_id::text || ':' || target_broadcast_key::text;
$$;

revoke all privileges
  on function private.noxa_driver_broadcast_topic(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.noxa_can_read_driver_broadcast(topic_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  target_user_id uuid;
  target_broadcast_key uuid;
  target_visibility text;
  target_updated_at timestamptz;
  target_expires_at timestamptz;
begin
  if viewer_id is null
     or topic_name !~ '^noxa-driver:[0-9a-fA-F-]{36}:[0-9a-fA-F-]{36}$'
  then
    return false;
  end if;

  begin
    target_user_id := split_part(topic_name, ':', 2)::uuid;
    target_broadcast_key := split_part(topic_name, ':', 3)::uuid;
  exception when others then
    return false;
  end;

  select
    driver_locations.visibility_mode,
    driver_locations.updated_at,
    driver_locations.share_expires_at
  into
    target_visibility,
    target_updated_at,
    target_expires_at
  from public.driver_locations
  where driver_locations.user_id = target_user_id
    and driver_locations.broadcast_key = target_broadcast_key;

  if not found
     or target_updated_at < now() - interval '2 minutes'
     or target_expires_at <= now()
  then
    return false;
  end if;

  if private.noxa_users_blocked(viewer_id, target_user_id) then
    return false;
  end if;

  return private.noxa_can_view_driver_location(
    target_user_id,
    target_visibility
  );
end;
$$;

create or replace function private.noxa_can_send_driver_broadcast(
  topic_name text,
  message_payload jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_user_id uuid;
  target_broadcast_key uuid;
  payload_user_id uuid;
  payload_latitude double precision;
  payload_longitude double precision;
  payload_updated_at timestamptz;
  active_row boolean;
begin
  if actor_id is null
     or topic_name !~ '^noxa-driver:[0-9a-fA-F-]{36}:[0-9a-fA-F-]{36}$'
  then
    return false;
  end if;

  begin
    target_user_id := split_part(topic_name, ':', 2)::uuid;
    target_broadcast_key := split_part(topic_name, ':', 3)::uuid;
    payload_user_id := (message_payload ->> 'user_id')::uuid;
    payload_latitude := (message_payload ->> 'latitude')::double precision;
    payload_longitude := (message_payload ->> 'longitude')::double precision;
    payload_updated_at := (message_payload ->> 'updated_at')::timestamptz;
  exception when others then
    return false;
  end;

  if target_user_id <> actor_id
     or payload_user_id <> actor_id
     or payload_latitude < -90
     or payload_latitude > 90
     or payload_longitude < -180
     or payload_longitude > 180
     or payload_updated_at < now() - interval '30 seconds'
     or payload_updated_at > now() + interval '30 seconds'
  then
    return false;
  end if;

  select exists (
    select 1
    from public.driver_locations
    where driver_locations.user_id = actor_id
      and driver_locations.broadcast_key = target_broadcast_key
      and driver_locations.visibility_mode <> 'ghost'
      and driver_locations.share_expires_at > now()
      and driver_locations.updated_at >= now() - interval '2 minutes'
  )
  into active_row;

  return coalesce(active_row, false);
end;
$$;

revoke all privileges
  on function private.noxa_can_read_driver_broadcast(text)
  from public, anon, authenticated, service_role;
revoke all privileges
  on function private.noxa_can_send_driver_broadcast(text, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function private.noxa_can_read_driver_broadcast(text)
  to authenticated;
grant execute on function private.noxa_can_send_driver_broadcast(text, jsonb)
  to authenticated;

drop policy if exists noxa_driver_broadcast_read
  on realtime.messages;
create policy noxa_driver_broadcast_read
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.messages.private is true
    and private.noxa_can_read_driver_broadcast((select realtime.topic()))
  );

drop policy if exists noxa_driver_broadcast_send
  on realtime.messages;
create policy noxa_driver_broadcast_send
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.messages.private is true
    and realtime.messages.event = 'location'
    and private.noxa_can_send_driver_broadcast(
      (select realtime.topic()),
      realtime.messages.payload
    )
  );

create or replace function private.noxa_broadcast_driver_location_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_topic text;
  new_topic text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_topic := private.noxa_driver_broadcast_topic(
      old.user_id,
      old.broadcast_key
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_topic := private.noxa_driver_broadcast_topic(
      new.user_id,
      new.broadcast_key
    );
  end if;

  if tg_op = 'DELETE'
     or (
       tg_op = 'UPDATE'
       and old.broadcast_key is distinct from new.broadcast_key
     )
  then
    perform realtime.send(
      jsonb_build_object(
        'user_id', old.user_id,
        'updated_at', now()
      ),
      'leave',
      old_topic,
      true
    );
  end if;

  if tg_op <> 'DELETE'
     and new.visibility_mode <> 'ghost'
     and new.share_expires_at > now()
     and new.updated_at >= now() - interval '2 minutes'
  then
    perform realtime.send(
      jsonb_build_object(
        'user_id', new.user_id,
        'latitude', new.latitude,
        'longitude', new.longitude,
        'updated_at', new.updated_at
      ),
      'location',
      new_topic,
      true
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all privileges
  on function private.noxa_broadcast_driver_location_change()
  from public, anon, authenticated, service_role;

drop trigger if exists driver_locations_broadcast_change
  on public.driver_locations;
create trigger driver_locations_broadcast_change
after insert or update or delete on public.driver_locations
for each row execute function private.noxa_broadcast_driver_location_change();

create or replace function private.noxa_rotate_relation_driver_broadcast_keys()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_user_id uuid;
  second_user_id uuid;
begin
  if tg_table_name = 'follows' then
    if tg_op = 'DELETE' then
      first_user_id := old.follower_id;
      second_user_id := old.following_id;
    else
      first_user_id := new.follower_id;
      second_user_id := new.following_id;
    end if;
  elsif tg_table_name = 'user_blocks' then
    if tg_op = 'DELETE' then
      first_user_id := old.blocker_id;
      second_user_id := old.blocked_id;
    else
      first_user_id := new.blocker_id;
      second_user_id := new.blocked_id;
    end if;
  else
    return coalesce(new, old);
  end if;

  update public.driver_locations
  set broadcast_key = gen_random_uuid()
  where user_id in (first_user_id, second_user_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all privileges
  on function private.noxa_rotate_relation_driver_broadcast_keys()
  from public, anon, authenticated, service_role;

drop trigger if exists follows_rotate_driver_broadcast_keys
  on public.follows;
create trigger follows_rotate_driver_broadcast_keys
after insert or delete on public.follows
for each row execute function private.noxa_rotate_relation_driver_broadcast_keys();

drop trigger if exists user_blocks_rotate_driver_broadcast_keys
  on public.user_blocks;
create trigger user_blocks_rotate_driver_broadcast_keys
after insert or delete on public.user_blocks
for each row execute function private.noxa_rotate_relation_driver_broadcast_keys();

create or replace function private.noxa_rotate_crew_driver_broadcast_keys()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_crew_id uuid;
  new_crew_id uuid;
  old_user_id uuid;
  new_user_id uuid;
begin
  if tg_op = 'INSERT' then
    new_crew_id := new.crew_id;
    new_user_id := new.user_id;
  elsif tg_op = 'DELETE' then
    old_crew_id := old.crew_id;
    old_user_id := old.user_id;
  else
    old_crew_id := old.crew_id;
    old_user_id := old.user_id;
    new_crew_id := new.crew_id;
    new_user_id := new.user_id;
  end if;

  update public.driver_locations
  set broadcast_key = gen_random_uuid()
  where user_id in (
    select crew_members.user_id
    from public.crew_members
    where crew_members.crew_id = old_crew_id
       or crew_members.crew_id = new_crew_id
    union
    select old_user_id where old_user_id is not null
    union
    select new_user_id where new_user_id is not null
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all privileges
  on function private.noxa_rotate_crew_driver_broadcast_keys()
  from public, anon, authenticated, service_role;

drop trigger if exists crew_members_rotate_driver_broadcast_keys
  on public.crew_members;
create trigger crew_members_rotate_driver_broadcast_keys
after insert or delete or update of crew_id, user_id on public.crew_members
for each row execute function private.noxa_rotate_crew_driver_broadcast_keys();

commit;
