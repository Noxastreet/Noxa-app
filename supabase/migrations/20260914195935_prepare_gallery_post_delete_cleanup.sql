-- Allow gallery storage cleanup to happen after the gallery metadata row is deleted.
-- This keeps user-visible metadata consistent even when Storage cleanup later fails.

-- Event gallery metadata must keep the canonical uploader/event path shape so the
-- event host can be authorized from the object path after the metadata row is gone.
drop policy if exists "NOXA event participants can add gallery items"
  on public.event_gallery_items;

create policy "NOXA event participants can add gallery items"
  on public.event_gallery_items
  for insert
  to authenticated
  with check (
    uploader_id = (select auth.uid())
    and split_part(object_path, '/', 1) = (select auth.uid())::text
    and split_part(object_path, '/', 2) = event_id::text
    and exists (
      select 1
      from public.event_attendees
      where event_attendees.event_id = event_gallery_items.event_id
        and event_attendees.user_id = (select auth.uid())
    )
  );

-- Uploaders keep ownership-based cleanup rights even after metadata deletion.
-- Event hosts can clean objects whose second path segment is an event they own.
drop policy if exists "noxa_event_gallery_delete_own_objects"
  on storage.objects;

create policy "noxa_event_gallery_delete_own_objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'event-gallery'
    and (
      (
        owner_id = (select auth.uid())::text
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      or exists (
        select 1
        from public.events
        where events.id::text = (storage.foldername(name))[2]
          and events.creator_id = (select auth.uid())
      )
    )
  );

-- Crew uploaders keep ownership-based cleanup rights after metadata deletion.
-- Crew managers can clean objects whose second path segment is a crew they manage.
drop policy if exists "noxa_crew_gallery_delete_member_objects"
  on storage.objects;

create policy "noxa_crew_gallery_delete_member_objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'crew-gallery'
    and (
      (
        owner_id = (select auth.uid())::text
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      or exists (
        select 1
        from public.crews
        where crews.id::text = (storage.foldername(name))[2]
          and public.noxa_is_crew_manager(crews.id)
      )
    )
  );
