import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
  key: (index) => Array.from(storage.keys())[index] ?? null,
  get length() { return storage.size; },
};

let authUserId = 'user-b';
const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: authUserId ? { user: { id: authUserId } } : null },
      error: null,
    }),
  },
};

function compile(file, dependencies) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected test dependency: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

const legacyKey = 'noxa.group-drive-pending-server-action.v1';
const scopedKey = 'noxa.group-drive-pending-server-action.v2';
const driveSessionId = 'drive-shared';
const requestedAt = new Date().toISOString();

localStorage.setItem(legacyKey, JSON.stringify({
  kind: 'leave',
  driveSessionId,
  userId: 'user-a',
  requestedAt,
}));

const pending = compile('src/features/group-drive/runtime/pendingServerAction.ts', {
  '@/src/lib/supabase': { supabase },
});

const userA = pending.getPendingGroupDriveServerAction('user-a', driveSessionId);
assert.equal(userA?.kind, 'leave', 'legacy user A action must migrate into A account scope');
assert.equal(
  pending.getPendingGroupDriveServerAction('user-b', driveSessionId),
  null,
  'user B must not see user A pending action for the same drive',
);
assert.equal(localStorage.getItem(legacyKey), null, 'legacy singleton key must be removed after migration');

const migrated = JSON.parse(localStorage.getItem(scopedKey));
assert.equal(migrated['user-a']?.userId, 'user-a', 'migrated store must be keyed by user A');

const userBAction = await pending.stagePendingGroupDriveServerAction(
  'clear_location',
  driveSessionId,
);
assert.equal(userBAction?.userId, 'user-b', 'new action must bind to current auth user B');
assert.equal(
  pending.getPendingGroupDriveServerAction('user-a', driveSessionId)?.kind,
  'leave',
  'staging user B action must not overwrite user A pending action',
);
assert.equal(
  pending.getPendingGroupDriveServerAction('user-b', driveSessionId)?.kind,
  'clear_location',
  'user B must read only B pending action',
);

pending.clearPendingGroupDriveServerAction('user-b', 'clear_location', driveSessionId);
assert.equal(
  pending.getPendingGroupDriveServerAction('user-b', driveSessionId),
  null,
  'clearing B must remove B action',
);
assert.equal(
  pending.getPendingGroupDriveServerAction('user-a', driveSessionId)?.kind,
  'leave',
  'clearing B must not remove A action',
);

pending.clearPendingGroupDriveServerAction('user-a', 'leave', driveSessionId);
assert.equal(
  pending.getPendingGroupDriveServerAction('user-a', driveSessionId),
  null,
  'user A must be able to clear A action later',
);
assert.equal(localStorage.getItem(scopedKey), null, 'empty scoped store should be removed');

// No authenticated account must never create an unscoped record.
authUserId = null;
const stagedWithoutAuth = await pending.stagePendingGroupDriveServerAction('end', driveSessionId);
assert.equal(stagedWithoutAuth, null, 'pending action must fail closed without an account');
assert.equal(localStorage.getItem(scopedKey), null, 'failed staging must not create shared state');

console.log('Group Drive account-isolation deterministic smoke: PASS');
