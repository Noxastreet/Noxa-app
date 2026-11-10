-- Proposed only. Supabase read authorization inserts a probe containing topic
-- and extension, without setting the messages.private flag. Requiring that flag
-- rejects legitimate read-only subscriptions even when the audience check passes.
begin;

drop policy if exists noxa_driver_broadcast_read on realtime.messages;
create policy noxa_driver_broadcast_read
on realtime.messages
for select to authenticated
using (
  extension = 'broadcast'
  and topic = (select realtime.topic())
  and private.noxa_can_read_driver_broadcast((select realtime.topic()))
);

-- Publication remains private: realtime.send(..., true) chooses the protected
-- server-owned topic; #394's restrictive INSERT policy denies direct driver
-- sends. Audience, active session, freshness and blocks stay in the helper.
commit;
