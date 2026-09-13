import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly 1 match in ${path}, found ${matches}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceExact(
  'app/post-details.tsx',
  `{post ? (\n                <Pressable onPress={() => void loadPost(false)} style={styles.retryButton}>\n                  <Text style={styles.retryText}>RETRY</Text>\n                </Pressable>\n              ) : null}`,
  `{uuidPattern.test(postId) ? (\n                <Pressable onPress={() => void loadPost()} style={styles.retryButton}>\n                  <Text style={styles.retryText}>RETRY</Text>\n                </Pressable>\n              ) : null}`,
  'Post Detail first-load recovery',
);

replaceExact(
  'app/group-drives/invitation/[id].tsx',
  `        <NoxaEmptyState icon="mail-unread-outline" title="Invitation unavailable" body={error ?? 'This invitation can no longer be opened.'} />\n        <NoxaButton fullWidth onPress={() => router.replace('/group-drives')} title="Back to Group Drives" variant="secondary" />`,
  `        <NoxaEmptyState icon="mail-unread-outline" title="Invitation unavailable" body={error ?? 'This invitation can no longer be opened.'} />\n        {invitationId ? (\n          <NoxaButton fullWidth onPress={() => void load()} title="Retry" />\n        ) : null}\n        <NoxaButton fullWidth onPress={() => router.replace('/group-drives')} title="Back to Group Drives" variant="secondary" />`,
  'Group Drive invitation recovery',
);

const verifier = 'scripts/verify-t8-detail-retry.mjs';
replaceExact(
  verifier,
  `const vehicleDetail = fs.readFileSync('app/vehicle-details.tsx', 'utf8');`,
  `const vehicleDetail = fs.readFileSync('app/vehicle-details.tsx', 'utf8');\nconst postDetail = fs.readFileSync('app/post-details.tsx', 'utf8');\nconst groupDriveInvitation = fs.readFileSync('app/group-drives/invitation/[id].tsx', 'utf8');`,
  'extend verifier inputs',
);
replaceExact(
  verifier,
  `assert.ok(vehicleDetail.includes('onRetry={loadVehicle}'), 'Vehicle Details must retain its existing Retry recovery path.');\n\nconsole.log('T8 detail recovery contract: PASS (7 checks)');`,
  `assert.ok(vehicleDetail.includes('onRetry={loadVehicle}'), 'Vehicle Details must retain its existing Retry recovery path.');\nassert.ok(postDetail.includes('uuidPattern.test(postId) ? ('), 'Post Detail Retry must remain hidden for syntactically invalid post IDs.');\nassert.ok(postDetail.includes('onPress={() => void loadPost()}'), 'Post Detail first-load network errors must expose a full Retry path.');\nassert.ok(groupDriveInvitation.includes("{invitationId ? ("), 'Invitation Retry must not appear when the route has no invitation ID.');\nassert.ok(groupDriveInvitation.includes('onPress={() => void load()} title="Retry"'), 'Group Drive invitation errors must expose Retry through the existing load path.');\n\nconsole.log('T8 detail recovery contract: PASS (11 checks)');`,
  'extend recovery contract',
);

console.log('Applied T8 detail recovery v2 patch.');
