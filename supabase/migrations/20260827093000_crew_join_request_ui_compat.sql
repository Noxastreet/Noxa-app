-- MVP Completion compatibility for the already-shipped canonical Crew UI.
-- The UI creates/cancels only the current user's pending approval request.
-- Keep the surface narrow: column-level INSERT + row-level DELETE, no UPDATE.

revoke insert, delete on table public.crew_join_requests from authenticated;
grant insert (crew_id, user_id, status) on table public.crew_join_requests to authenticated;
grant delete on table public.crew_join_requests to authenticated;

drop policy if exists "NOXA users can create own approval join request" on public.crew_join_requests;
create policy "NOXA users can create own approval join request"
on public.crew_join_requests
for insert
to authenticated
with check (
  public.crew_join_requests.user_id = (select auth.uid())
  and public.crew_join_requests.status = 'pending'
  and exists (
    select 1
    from public.crews
    where public.crews.id = public.crew_join_requests.crew_id
      and public.crews.is_public = true
      and public.crews.join_policy = 'approval'
  )
  and not exists (
    select 1
    from public.crew_members
    where public.crew_members.crew_id = public.crew_join_requests.crew_id
      and public.crew_members.user_id = (select auth.uid())
  )
);

drop policy if exists "NOXA users can cancel own pending join request" on public.crew_join_requests;
create policy "NOXA users can cancel own pending join request"
on public.crew_join_requests
for delete
to authenticated
using (
  public.crew_join_requests.user_id = (select auth.uid())
  and public.crew_join_requests.status = 'pending'
);
