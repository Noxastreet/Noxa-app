import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const source = fs.readFileSync('supabase/functions/delete-account/index.ts', 'utf8');

const planFn = source.indexOf('async function buildStorageCleanupPlan(');
const ownCleanupFn = source.indexOf('async function removeUserOwnedStorage(');
const relatedCleanupFn = source.indexOf(
  'async function removeRelatedGalleryStorageAfterAccountDeletion(',
);
const handler = source.indexOf('Deno.serve(async (req) => {');

assert(planFn >= 0, 'Deletion must build a complete Storage cleanup plan.');
assert(ownCleanupFn >= 0, 'Deletion must isolate account-owned Storage cleanup.');
assert(
  relatedCleanupFn >= 0,
  'Deletion must isolate related Event/Crew gallery cleanup.',
);
assert(handler >= 0, 'delete-account handler must exist.');
assert(
  !source.includes('async function removeAccountStorage('),
  'Legacy mixed pre-delete Storage cleanup must stay removed.',
);

const planCall = source.indexOf(
  'cleanupPlan = await buildStorageCleanupPlan(admin, user.id);',
  handler,
);
const ownCleanupCall = source.indexOf(
  'await removeUserOwnedStorage(admin, cleanupPlan);',
  handler,
);
const deleteUserCall = source.indexOf('admin.auth.admin.deleteUser(', handler);
const relatedCleanupCall = source.indexOf(
  'await removeRelatedGalleryStorageAfterAccountDeletion(admin, cleanupPlan);',
  handler,
);
const successReturn = source.indexOf('return response({ success: true });', handler);

assert(
  planCall > handler && ownCleanupCall > planCall,
  'All Storage reads must be planned before account-owned deletion starts.',
);
assert(
  deleteUserCall > ownCleanupCall,
  'Auth user deletion must happen only after account-owned Storage cleanup.',
);
assert(
  relatedCleanupCall > deleteUserCall,
  'Other uploaders’ related gallery files must not be deleted before auth deletion succeeds.',
);
assert(
  successReturn > relatedCleanupCall,
  'Successful response must follow the post-delete related cleanup attempt.',
);

const ownCleanupBody = source.slice(ownCleanupFn, relatedCleanupFn);
assert(
  ownCleanupBody.includes('await collectFolderFiles(admin, bucket, plan.userId)'),
  'Account-owned cleanup must re-list Storage after delete attempts.',
);
assert(
  ownCleanupBody.includes('if (remaining.length > 0)'),
  'Account-owned cleanup must fail closed when files remain.',
);
assert(
  !ownCleanupBody.includes('relatedEventGalleryPaths') &&
    !ownCleanupBody.includes('relatedCrewGalleryPaths'),
  'Pre-auth cleanup must not include gallery files owned by other uploaders.',
);

const relatedCleanupBody = source.slice(relatedCleanupFn, handler);
assert(
  relatedCleanupBody.includes('pathsOutsideUserFolder('),
  'Post-delete related cleanup must exclude the deleting user’s already-removed folder.',
);

const postDeleteCatch = source.indexOf(
  'NOXA post-delete related gallery cleanup failed.',
  relatedCleanupCall,
);
assert(
  postDeleteCatch > relatedCleanupCall && postDeleteCatch < successReturn,
  'Related gallery cleanup failure must be logged without turning a deleted account into a client-visible failure.',
);

if (!process.exitCode) {
  console.log('Delete Account storage-order contract passed.');
}
