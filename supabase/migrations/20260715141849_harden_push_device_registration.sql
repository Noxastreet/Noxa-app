drop function if exists public.noxa_register_push_device(text, text, text, text);
drop function if exists public.noxa_unregister_push_device(text);

create index notifications_actor_id_idx
  on public.notifications (actor_id)
  where actor_id is not null;
