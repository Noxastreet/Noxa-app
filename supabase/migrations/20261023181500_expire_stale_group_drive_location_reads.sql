begin;

-- A stopped device can lose connectivity before it can delete its last
-- Group Drive location. Keep active sessions working in the background, but
-- never allow another participant to query a stale location indefinitely.
-- Existing RLS still enforces active membership and bidirectional blocks.
alter table public.drive_location_state enable row level security;

drop policy if exists drive_location_state_fresh_for_viewers
  on public.drive_location_state;

create policy drive_location_state_fresh_for_viewers
  on public.drive_location_state
  as restrictive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or updated_at >= now() - interval '2 minutes'
  );

comment on policy drive_location_state_fresh_for_viewers
  on public.drive_location_state
  is 'Other participants can read only recently updated Group Drive coordinates; stale records become invisible after network loss or force quit.';

commit;
