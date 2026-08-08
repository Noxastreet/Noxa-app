alter table public.profiles
  add column if not exists country_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_country_code_check'
  ) then
    alter table public.profiles
      add constraint profiles_country_code_check
      check (country_code is null or country_code ~ '^[A-Z]{2}$');
  end if;
end
$$;

comment on column public.profiles.country_code is 'Optional ISO 3166-1 alpha-2 uppercase country code selected from the NOXA Country Picker.';
