alter table public.events
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'noxa_events_coordinates_pair_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint noxa_events_coordinates_pair_check
      check (
        (
          latitude is null
          and longitude is null
        )
        or
        (
          latitude is not null
          and longitude is not null
          and latitude between -90 and 90
          and longitude between -180 and 180
        )
      );
  end if;
end $$;
