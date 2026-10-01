create or replace function private.noxa_prepare_drive_location_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  session_drive_mode text;
  session_destination_latitude double precision;
  session_destination_longitude double precision;
  session_destination_version integer;
  direct_destination_meters double precision;
  haversine_a double precision;
begin
  if tg_op = 'UPDATE' and (
    new.drive_session_id is distinct from old.drive_session_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Group Drive location identity is immutable';
  end if;

  if new.status = 'arrived' then
    select
      drive_mode,
      destination_latitude,
      destination_longitude,
      destination_version
    into
      session_drive_mode,
      session_destination_latitude,
      session_destination_longitude,
      session_destination_version
    from public.drive_sessions
    where id = new.drive_session_id;

    if session_drive_mode = 'quick'
      and new.route_destination_version is not distinct from session_destination_version
    then
      if session_destination_latitude is null
        or session_destination_longitude is null
      then
        new.status := 'moving';
      else
        haversine_a :=
          power(
            sin(radians(session_destination_latitude - new.latitude) / 2),
            2
          )
          + cos(radians(new.latitude))
            * cos(radians(session_destination_latitude))
            * power(
                sin(radians(session_destination_longitude - new.longitude) / 2),
                2
              );

        direct_destination_meters :=
          2 * 6371008.8
          * asin(sqrt(least(1.0, greatest(0.0, haversine_a))));

        if direct_destination_meters > 75 then
          new.status := 'moving';
          new.remaining_distance_meters := greatest(
            coalesce(new.remaining_distance_meters, 0),
            direct_destination_meters
          );
        end if;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.noxa_prepare_drive_location_state()
  from public, anon, authenticated, service_role;
