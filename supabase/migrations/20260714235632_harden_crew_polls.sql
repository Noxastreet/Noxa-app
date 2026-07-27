create index if not exists crew_poll_votes_poll_id_option_id_idx
  on public.crew_poll_votes (poll_id, option_id);
