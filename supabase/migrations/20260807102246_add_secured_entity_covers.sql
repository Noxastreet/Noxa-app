-- Crew/Event cover images are intentionally managed through narrow RPCs.
-- Do not broaden generic UPDATE policies just to let Crew admins change artwork.

create or replace function public.noxa_set_crew_cover(
  target_crew_id uuid,
  target_cover_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or target_crew_id is null then
    raise exception 'not allowed';
  end if;

  if target_cover_url is not null and char_length(target_cover_url) > 2048 then
    raise exception 'cover url too long';
  end if;

  if not public.noxa_is_crew_manager(target_crew_id) then
    raise exception 'not allowed';
  end if;

  update public.crews
  set cover_image_url = nullif(btrim(target_cover_url), '')
  where id = target_crew_id;

  return found;
end;
$$;

create or replace function public.noxa_set_event_cover(
  target_event_id uuid,
  target_cover_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  event_creator uuid;
  event_crew uuid;
begin
  if actor is null or target_event_id is null then
    raise exception 'not allowed';
  end if;

  if target_cover_url is not null and char_length(target_cover_url) > 2048 then
    raise exception 'cover url too long';
  end if;

  select creator_id, crew_id
  into event_creator, event_crew
  from public.events
  where id = target_event_id;

  if event_creator is null then
    return false;
  end if;

  if actor <> event_creator
     and (event_crew is null or not public.noxa_is_crew_manager(event_crew)) then
    raise exception 'not allowed';
  end if;

  update public.events
  set
    cover_image_url = nullif(btrim(target_cover_url), ''),
    updated_at = now()
  where id = target_event_id;

  return found;
end;
$$;

-- Storage policies need a safe parser because object names are user-controlled.
create or replace function public.noxa_can_manage_entity_cover(
  target_kind text,
  target_id_text text
)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  entity_id uuid;
begin
  if actor is null or target_kind is null or target_id_text is null then
    return false;
  end if;

  begin
    entity_id := target_id_text::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if target_kind = 'crews' then
    return public.noxa_is_crew_manager(entity_id);
  end if;

  if target_kind = 'events' then
    return exists (
      select 1
      from public.events
      where events.id = entity_id
        and (
          events.creator_id = actor
          or (
            events.crew_id is not null
            and public.noxa_is_crew_manager(events.crew_id)
          )
        )
    );
  end if;

  return false;
end;
$$;

revoke all privileges on function public.noxa_set_crew_cover(uuid, text)
  from public, anon, authenticated;
revoke all privileges on function public.noxa_set_event_cover(uuid, text)
  from public, anon, authenticated;
revoke all privileges on function public.noxa_can_manage_entity_cover(text, text)
  from public, anon, authenticated;

grant execute on function public.noxa_set_crew_cover(uuid, text) to authenticated;
grant execute on function public.noxa_set_event_cover(uuid, text) to authenticated;
grant execute on function public.noxa_can_manage_entity_cover(text, text) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'entity-covers',
  'entity-covers',
  true,
  6291456,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "noxa_entity_covers_authenticated_read" on storage.objects;
drop policy if exists "noxa_entity_covers_manager_insert" on storage.objects;
drop policy if exists "noxa_entity_covers_manager_delete" on storage.objects;

create policy "noxa_entity_covers_authenticated_read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'entity-covers');

create policy "noxa_entity_covers_manager_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'entity-covers'
    and public.noxa_can_manage_entity_cover(
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

create policy "noxa_entity_covers_manager_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'entity-covers'
    and public.noxa_can_manage_entity_cover(
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );
