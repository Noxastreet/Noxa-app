create index if not exists crew_invitations_invited_by_idx
  on public.crew_invitations (invited_by);

create index if not exists crew_join_requests_reviewed_by_idx
  on public.crew_join_requests (reviewed_by);

drop policy if exists noxa_follows_owner_insert on public.follows;
create policy noxa_follows_owner_insert
  on public.follows
  for insert
  to authenticated
  with check (
    (select auth.uid()) = follower_id
    and follower_id <> following_id
  );

drop policy if exists noxa_follows_owner_delete on public.follows;
create policy noxa_follows_owner_delete
  on public.follows
  for delete
  to authenticated
  using ((select auth.uid()) = follower_id);
