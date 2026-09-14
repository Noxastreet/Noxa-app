create table if not exists public.prelaunch_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  city text,
  interests text[] not null default '{}',
  consent boolean not null default false,
  consented_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referrer text,
  locale text not null default 'el',
  created_at timestamptz not null default now(),
  constraint prelaunch_waitlist_email_format check (
    email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint prelaunch_waitlist_consent_required check (
    consent = true and consented_at is not null
  ),
  constraint prelaunch_waitlist_interests_allowed check (
    interests <@ array['Car Meets','Crews','Convoy','Χάρτης οδηγών']::text[]
  )
);

create unique index if not exists prelaunch_waitlist_email_lower_uidx
  on public.prelaunch_waitlist (lower(email));

alter table public.prelaunch_waitlist enable row level security;

revoke all on table public.prelaunch_waitlist from anon, authenticated;
grant insert on table public.prelaunch_waitlist to anon, authenticated;

create policy "public_can_join_prelaunch_waitlist"
  on public.prelaunch_waitlist
  for insert
  to anon, authenticated
  with check (
    consent = true
    and consented_at is not null
    and locale in ('el', 'en')
    and interests <@ array['Car Meets','Crews','Convoy','Χάρτης οδηγών']::text[]
  );

comment on table public.prelaunch_waitlist is
  'Private pre-launch signup data. Client roles can insert only; no public select/update/delete access.';