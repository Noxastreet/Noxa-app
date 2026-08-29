-- MVP Completion privacy gate: active Group Drives must not remain active forever
-- when every client disappears. Supabase Cron executes the existing expiry
-- transition, whose session-status trigger deletes exact drive_location_state rows.

create extension if not exists pg_cron;

select cron.schedule(
  'noxa-expire-group-drives',
  '* * * * *',
  $$select private.noxa_expire_group_drives();$$
);
