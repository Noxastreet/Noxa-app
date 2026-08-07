alter table public.vehicles
  add column if not exists vehicle_type text,
  add column if not exists catalog_make_id text,
  add column if not exists catalog_model_id text,
  add column if not exists catalog_generation_id text,
  add column if not exists color_hex text;

update public.vehicles
set vehicle_type = 'car'
where vehicle_type is null;

alter table public.vehicles
  alter column vehicle_type set default 'car',
  alter column vehicle_type set not null,
  alter column horsepower drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.vehicles'::regclass
      and conname = 'vehicles_vehicle_type_check'
  ) then
    alter table public.vehicles
      add constraint vehicles_vehicle_type_check
      check (vehicle_type in ('car', 'motorcycle'));
  end if;
end
$$;

create index if not exists vehicles_owner_type_created_idx
  on public.vehicles (owner_id, vehicle_type, created_at desc);

comment on column public.vehicles.vehicle_type is 'NOXA vehicle category: car or motorcycle.';
comment on column public.vehicles.catalog_make_id is 'Stable NOXA curated catalog make id; brand remains the display snapshot.';
comment on column public.vehicles.catalog_model_id is 'Stable NOXA curated catalog model id; model remains the display snapshot.';
comment on column public.vehicles.catalog_generation_id is 'Optional stable NOXA curated catalog generation id.';
comment on column public.vehicles.color_hex is 'Optional normalized display color selected from the NOXA picker.';
