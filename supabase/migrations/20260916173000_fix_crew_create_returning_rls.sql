-- Allow an owner to read the row they are creating during INSERT ... RETURNING.
-- noxa_can_view_crew() is STABLE and reads public.crews, so within the same
-- INSERT statement it can miss the just-inserted row and make PostgREST's
-- .insert(...).select(...) fail RLS even when owner_id = auth.uid().

drop policy if exists "NOXA crews are readable when visible" on public.crews;

create policy "NOXA crews are readable when visible"
  on public.crews
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or noxa_can_view_crew(id)
  );
