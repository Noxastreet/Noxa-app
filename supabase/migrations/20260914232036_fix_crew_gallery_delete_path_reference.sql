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
        and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
      )
      or exists (
        select 1
        from public.crews
        where crews.id::text = (storage.foldername(storage.objects.name))[2]
          and public.noxa_is_crew_manager(crews.id)
      )
    )
  );
