revoke insert, update, delete on table public.push_devices from authenticated;

drop policy if exists push_devices_insert_own on public.push_devices;
drop policy if exists push_devices_update_own on public.push_devices;
drop policy if exists push_devices_delete_own on public.push_devices;
