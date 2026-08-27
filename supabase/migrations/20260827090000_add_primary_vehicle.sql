-- MVP Completion: one explicit primary vehicle per owner.
-- Additive and reversible; this migration is NOT applied to production by this PR.

alter table public.vehicles
  add column if not exists is_primary boolean not null default false;

-- Pick one deterministic existing vehicle for owners that do not yet have a primary.
with ranked as (
  select
    id,
    row_number() over (
      partition by owner_id
      order by created_at desc, id
    ) as position
  from public.vehicles
), owners_without_primary as (
  select distinct v.owner_id
  from public.vehicles v
  where not exists (
    select 1
    from public.vehicles existing
    where existing.owner_id = v.owner_id
      and existing.is_primary = true
  )
)
update public.vehicles vehicle
set is_primary = true
from ranked
where ranked.id = vehicle.id
  and ranked.position = 1
  and vehicle.owner_id in (select owner_id from owners_without_primary);

-- Repair any pre-index duplicates defensively, then enforce the invariant.
with ranked_primary as (
  select
    id,
    row_number() over (
      partition by owner_id
      order by updated_at desc, created_at desc, id
    ) as position
  from public.vehicles
  where is_primary = true
)
update public.vehicles vehicle
set is_primary = false
from ranked_primary
where ranked_primary.id = vehicle.id
  and ranked_primary.position > 1;

create unique index if not exists vehicles_one_primary_per_owner_idx
  on public.vehicles (owner_id)
  where is_primary = true;

create or replace function public.noxa_set_primary_vehicle(target_vehicle_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_owner uuid;
begin
  if actor is null or target_vehicle_id is null then
    raise exception 'authentication required';
  end if;

  select public.vehicles.owner_id
  into target_owner
  from public.vehicles
  where public.vehicles.id = target_vehicle_id
  for update;

  if target_owner is null or target_owner <> actor then
    raise exception 'vehicle unavailable';
  end if;

  -- Clear first, then set exactly one primary in the same transaction.
  update public.vehicles
  set is_primary = false,
      updated_at = now()
  where public.vehicles.owner_id = actor
    and public.vehicles.is_primary = true
    and public.vehicles.id <> target_vehicle_id;

  update public.vehicles
  set is_primary = true,
      updated_at = now()
  where public.vehicles.id = target_vehicle_id
    and public.vehicles.owner_id = actor;

  return found;
end;
$$;

create or replace function private.noxa_assign_primary_vehicle_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.vehicles
    where public.vehicles.owner_id = new.owner_id
      and public.vehicles.is_primary = true
  ) then
    update public.vehicles
    set is_primary = true,
        updated_at = now()
    where public.vehicles.id = new.id;
  end if;

  return new;
end;
$$;

create or replace function private.noxa_reassign_primary_vehicle_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  replacement_id uuid;
begin
  if old.is_primary is not true then
    return old;
  end if;

  select public.vehicles.id
  into replacement_id
  from public.vehicles
  where public.vehicles.owner_id = old.owner_id
  order by public.vehicles.created_at desc, public.vehicles.id
  limit 1;

  if replacement_id is not null then
    update public.vehicles
    set is_primary = true,
        updated_at = now()
    where public.vehicles.id = replacement_id;
  end if;

  return old;
end;
$$;

drop trigger if exists noxa_vehicles_assign_primary_after_insert on public.vehicles;
create trigger noxa_vehicles_assign_primary_after_insert
after insert on public.vehicles
for each row
execute function private.noxa_assign_primary_vehicle_after_insert();

drop trigger if exists noxa_vehicles_reassign_primary_after_delete on public.vehicles;
create trigger noxa_vehicles_reassign_primary_after_delete
after delete on public.vehicles
for each row
execute function private.noxa_reassign_primary_vehicle_after_delete();

revoke all privileges on function public.noxa_set_primary_vehicle(uuid) from public, anon, authenticated;
grant execute on function public.noxa_set_primary_vehicle(uuid) to authenticated;
