alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Existing accounts predate the explicit completion marker. Preserve their
-- returning-user experience; accounts created after this migration must finish
-- the actual onboarding flow before this field is populated.
update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed_at is null;

comment on column public.profiles.onboarding_completed_at is
  'Server-side proof that the user completed NOXA first-run onboarding.';
