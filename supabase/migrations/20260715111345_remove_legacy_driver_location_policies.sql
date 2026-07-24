drop policy if exists "NOXA users can read permitted active driver locations"
on public.driver_locations;

drop policy if exists "Authenticated users can insert their own driver location"
on public.driver_locations;

drop policy if exists "Authenticated users can update their own driver location"
on public.driver_locations;
