import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const vehicle = fs.readFileSync('app/vehicle-details.tsx', 'utf8');
const post = fs.readFileSync('app/post-details.tsx', 'utf8');

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

if (!process.exitCode) {
  console.log('Owned media cleanup contract passed.');
}
