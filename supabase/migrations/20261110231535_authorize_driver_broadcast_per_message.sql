-- PROPOSED ONLY. Apply after reviewed backup, staging acceptance and explicit
-- approval. Companion client must use the RPC; direct GPS Broadcast is denied.
begin;

create or replace function private.noxa_broadcast_my_driver_location(
  expected_user_id uuid,
  sample_latitude double precision,
  sample_longitude double precision
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  active_location public.driver_locations%rowtype;
  sent_at timestamptz;
begin
  if actor is null then raise exception 'authentication required'; end if;
  if expected_user_id is null or expected_user_id <> actor then
    raise exception 'location account changed';
  end if;
  if sample_latitude is null or sample_longitude is null
     or not (sample_latitude between -90 and 90)
     or not (sample_longitude between -180 and 180)
  then
    raise exception 'invalid location sample';
  end if;

  -- Hold the current key stable until realtime.send has completed. Block/friend/
  -- crew key rotation and Stop's DELETE serialize against this row lock. Once
  -- revocation commits, subsequent messages cannot choose the old topic.
  select * into active_location
  from public.driver_locations
  where user_id = actor
  for share;
  if not found then return false; end if;

  -- clock_timestamp is intentional: a lock wait must not reuse a transaction's
  -- earlier timestamp to authorize a session which expired while waiting.
  sent_at := clock_timestamp();
  if active_location.visibility_mode not in ('global', 'friends', 'crew')
     or active_location.visibility_mode is null
     or active_location.broadcast_key is null
     or active_location.share_expires_at is null
     or active_location.share_expires_at <= sent_at
     or active_location.updated_at is null
     or active_location.updated_at < sent_at - interval '2 minutes'
  then
    return false;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'user_id', actor,
      'latitude', sample_latitude,
      'longitude', sample_longitude,
      'updated_at', sent_at
    ),
    'location',
    private.noxa_driver_broadcast_topic(actor, active_location.broadcast_key),
    true
  );
  return true;
end;
$$;

revoke all on function private.noxa_broadcast_my_driver_location(uuid, double precision, double precision)
  from public, anon, authenticated, service_role;
grant execute on function private.noxa_broadcast_my_driver_location(uuid, double precision, double precision)
  to authenticated;

-- Thin API wrapper has no elevated privilege. The private implementation binds
-- the actor, session and topic on every invocation; caller supplies only a point.
create or replace function public.noxa_broadcast_my_driver_location(
  expected_user_id uuid,
  sample_latitude double precision,
  sample_longitude double precision
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.noxa_broadcast_my_driver_location(expected_user_id, sample_latitude, sample_longitude);
$$;

revoke all on function public.noxa_broadcast_my_driver_location(uuid, double precision, double precision)
  from public, anon, authenticated, service_role;
grant execute on function public.noxa_broadcast_my_driver_location(uuid, double precision, double precision)
  to authenticated;

drop policy if exists noxa_driver_broadcast_send on realtime.messages;
-- Also protect against a future permissive generic Broadcast-send policy.
create policy noxa_driver_broadcast_server_only
on realtime.messages as restrictive
for insert to authenticated
with check (coalesce((select realtime.topic()), '') !~ '^noxa-driver:');

comment on function public.noxa_broadcast_my_driver_location(uuid, double precision, double precision) is
  'Publishes a point only for the caller active Live Drive, on its locked current private topic; does not start or persist a location session.';

commit;
