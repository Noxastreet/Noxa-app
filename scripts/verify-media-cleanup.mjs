import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const vehicle = fs.readFileSync('app/vehicle-details.tsx', 'utf8');
const post = fs.readFileSync('app/post-details.tsx', 'utf8');
const eventGallery = fs.readFileSync('app/event-gallery.tsx', 'utf8');
const crewGallery = fs.readFileSync('app/crew-gallery.tsx', 'utf8');
const galleryPolicy = fs.readFileSync(
  'supabase/migrations/20260914195935_prepare_gallery_post_delete_cleanup.sql',
  'utf8',
);
const crewGalleryPolicyFix = fs.readFileSync(
  'supabase/migrations/20260914200015_fix_crew_gallery_storage_delete_path.sql',
  'utf8',
);

assert(vehicle.includes("const vehicleImagesBucket = 'vehicle-images';"), 'Vehicle cleanup must target the canonical vehicle-images bucket.');
assert(vehicle.includes('function getOwnedVehicleImagePath'), 'Vehicle cleanup must parse an owned Storage path before removal.');
assert(vehicle.includes("return path.split('/')[0] === userId ? path : null;"), 'Vehicle cleanup must refuse paths outside the current user folder.');

const vehicleDeleteIndex = vehicle.indexOf(".from('vehicles')");
const vehicleCleanupIndex = vehicle.indexOf('getOwnedVehicleImagePath(vehicle.cover_image_url, currentUser.id)');
const vehicleStorageRemoveIndex = vehicle.indexOf('supabase.storage.from(vehicleImagesBucket).remove([imagePath])');
assert(vehicleDeleteIndex >= 0 && vehicleCleanupIndex > vehicleDeleteIndex, 'Vehicle DB deletion must happen before cover cleanup.');
assert(vehicleStorageRemoveIndex > vehicleCleanupIndex, 'Vehicle cover removal must only happen after an owned path is resolved.');

const postDeleteIndex = post.indexOf('.from("posts")');
const postCleanupIndex = post.indexOf('ownedPostImagePath(post.image_url, currentUserId)');
const postStorageRemoveIndex = post.indexOf('supabase.storage.from(postImagesBucket).remove([imagePath])');
assert(postDeleteIndex >= 0 && postCleanupIndex > postDeleteIndex, 'Post DB deletion must remain before image cleanup.');
assert(postStorageRemoveIndex > postCleanupIndex, 'Post image removal must remain scoped through its owned-path helper.');

for (const [label, source, table, bucket] of [
  ['Event gallery', eventGallery, 'event_gallery_items', 'eventGalleryBucket'],
  ['Crew gallery', crewGallery, 'crew_gallery_items', 'crewGalleryBucket'],
]) {
  const rowDeleteIndex = source.indexOf(`.from("${table}")`, source.indexOf('const confirmDelete'));
  const rowDeleteSelectIndex = source.indexOf('.select("id")', rowDeleteIndex);
  const storageRemoveIndex = source.indexOf(`.from(${bucket})`, rowDeleteSelectIndex);
  const localRemovalIndex = source.indexOf('setItems((current) => current.filter', rowDeleteIndex);
  assert(rowDeleteIndex >= 0, `${label} must delete its metadata row.`);
  assert(rowDeleteSelectIndex > rowDeleteIndex, `${label} must verify that a metadata row was actually deleted.`);
  assert(localRemovalIndex > rowDeleteSelectIndex, `${label} must remove the deleted item from local UI state after metadata deletion.`);
  assert(storageRemoveIndex > rowDeleteSelectIndex, `${label} Storage cleanup must happen after confirmed metadata deletion.`);
}

assert(
  /split_part\(object_path, '\/', 2\) = event_id::text/.test(galleryPolicy),
  'Event gallery uploads must preserve uploader/event path shape for post-delete cleanup.',
);
assert(
  /storage\.foldername\(storage\.objects\.name\)/.test(crewGalleryPolicyFix),
  'Crew gallery cleanup policy must reference storage.objects.name explicitly.',
);

if (!process.exitCode) {
  console.log('Owned media cleanup contract passed.');
}
