-- NOXA Communities data foundation.
-- Review-only migration: do not apply to production without hosted RLS/advisor verification.

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (char_length(slug) between 2 and 80)
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null
    check (char_length(btrim(name)) between 2 and 80),
  description text
    check (description is null or char_length(description) <= 1200),
  city text
    check (city is null or char_length(city) <= 80),
  region text
    check (region is null or char_length(region) <= 80),
  country_code text not null default 'GR'
    check (country_code ~ '^[A-Z]{2}$'),
  focus text not null default 'mixed'
    check (focus in ('car', 'moto', 'mixed')),
  scene_tags text[] not null default '{}'::text[]
    check (cardinality(scene_tags) <= 12),
  logo_url text
    check (logo_url is null or char_length(logo_url) <= 500),
  cover_image_url text
    check (cover_image_url is null or char_length(cover_image_url) <= 500),
  instagram_url text
    check (instagram_url is null or char_length(instagram_url) <= 500),
  website_url text
    check (website_url is null or char_length(website_url) <= 500),
  verified boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create index if not exists communities_public_country_city_idx
  on public.communities (country_code, city, name)
  where status = 'published';

create index if not exists communities_public_focus_idx
  on public.communities (focus, name)
  where status = 'published';

create table if not exists public.community_admins (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create unique index if not exists community_admins_one_owner_idx
  on public.community_admins (community_id)
  where role = 'owner';

create index if not exists community_admins_user_id_idx
  on public.community_admins (user_id);

alter table public.events
  add column if not exists community_id uuid references public.communities(id) on delete set null;

create index if not exists events_community_starts_at_idx
  on public.events (community_id, starts_at desc)
  where community_id is not null;

-- Keep policy helper functions outside the exposed public API schema so they cannot
-- accidentally become general-purpose RPC endpoints.
create or replace function private.noxa_is_community_manager(target_community_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.community_admins
    where public.community_admins.community_id = target_community_id
      and public.community_admins.user_id = (select auth.uid())
      and public.community_admins.role in ('owner', 'admin')
  );
$$;

create or replace function private.noxa_touch_community_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists noxa_touch_community_updated_at_trigger on public.communities;
create trigger noxa_touch_community_updated_at_trigger
  before update on public.communities
  for each row
  execute function private.noxa_touch_community_updated_at();

-- Public community rows intentionally contain no contact email, private admin data,
-- member lists, or other sensitive fields. Anonymous access is read-only and only
-- for explicitly published communities.
grant select on table public.communities to anon, authenticated;
grant select on table public.community_admins to authenticated;

revoke all on function private.noxa_is_community_manager(uuid) from public;
revoke all on function private.noxa_touch_community_updated_at() from public;
grant execute on function private.noxa_is_community_manager(uuid) to authenticated;

alter table public.communities enable row level security;
alter table public.community_admins enable row level security;

drop policy if exists "NOXA public can read published communities" on public.communities;
drop policy if exists "NOXA managers can read managed communities" on public.communities;
drop policy if exists "NOXA managers can read community admin roster" on public.community_admins;

create policy "NOXA public can read published communities"
  on public.communities
  for select
  to anon, authenticated
  using (status = 'published');

create policy "NOXA managers can read managed communities"
  on public.communities
  for select
  to authenticated
  using (private.noxa_is_community_manager(id));

create policy "NOXA managers can read community admin roster"
  on public.community_admins
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.noxa_is_community_manager(community_id)
  );

-- A normal event creator must not be able to attach an event to an established
-- Community they do not manage. Existing events remain unaffected because
-- community_id is nullable and defaults to null.
alter policy "NOXA users can create own events"
  on public.events
  with check (
    creator_id = (select auth.uid())
    and (crew_id is null or public.noxa_is_crew_manager(crew_id))
    and (community_id is null or private.noxa_is_community_manager(community_id))
  );

alter policy "NOXA users can update own events"
  on public.events
  using (creator_id = (select auth.uid()))
  with check (
    creator_id = (select auth.uid())
    and (crew_id is null or public.noxa_is_crew_manager(crew_id))
    and (community_id is null or private.noxa_is_community_manager(community_id))
  );

comment on table public.communities is
  'Public automotive/motorcycle organizations and established communities. Distinct from user-created crews.';

comment on table public.community_admins is
  'Private authenticated management mapping for public communities. Not exposed to anonymous clients.';

comment on column public.events.community_id is
  'Optional established-community organizer relation. Existing crew_id remains independent.';
