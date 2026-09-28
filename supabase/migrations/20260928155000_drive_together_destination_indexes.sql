-- Cover Drive Together destination actor foreign keys used by room sync/audit lookups.
create index if not exists drive_sessions_destination_updated_by_idx
  on public.drive_sessions(destination_updated_by)
  where destination_updated_by is not null;

create index if not exists drive_sessions_proposed_destination_by_idx
  on public.drive_sessions(proposed_destination_by)
  where proposed_destination_by is not null;
