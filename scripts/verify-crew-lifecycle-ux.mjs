import fs from 'node:fs';

const manage = fs.readFileSync('app/crew-manage.tsx', 'utf8');
const detail = fs.readFileSync(
  'src/features/crews-events/CanonicalCrewDetailScreen.tsx',
  'utf8',
);
const publicError = fs.readFileSync('src/lib/publicError.ts', 'utf8');
const deleteCrew = fs.readFileSync('supabase/functions/delete-crew/index.ts', 'utf8');

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(
  manage.includes("from('follows').select('following_id')") &&
    manage.includes("from('follows').select('follower_id')"),
  'Crew friend picker must derive mutual follows in both directions.',
);
expect(
  manage.includes("from('crew_invitations')") &&
    manage.includes("candidate.state === 'pending'"),
  'Crew friend picker must represent pending invitations.',
);
expect(
  manage.includes("candidate.state === 'member'") &&
    manage.includes("noxa_invite_to_crew"),
  'Crew friend picker must disable members and reuse canonical invite RPC.',
);
expect(
  manage.includes("role !== 'owner'") &&
    manage.includes("functions.invoke<{") &&
    manage.includes("}>('delete-crew'") &&
    manage.includes("router.replace('/(tabs)/crews')"),
  'Delete Crew must be owner-only, server-backed, and return to Crews after deletion.',
);
expect(
  deleteCrew.includes('crew.owner_id !== user.id') &&
    deleteCrew.includes('.from("crews")') &&
    deleteCrew.includes('.delete()') &&
    deleteCrew.includes('crew_gallery_items') &&
    deleteCrew.includes('entity-covers') &&
    deleteCrew.includes('crew-gallery'),
  'Delete Crew Edge Function must verify ownership, delete the Crew, and clean Crew media.',
);
expect(
  detail.includes('publicErrorMessage') && manage.includes('publicErrorMessage'),
  'Crew detail and management must normalize backend errors.',
);
expect(
  publicError.includes('html|head|body|title|pre') &&
    /502|503|504/.test(publicError),
  'Public error normalization must reject HTML and gateway failures.',
);
expect(
  detail.includes('accessibilityLabel="Retry crew loading"') &&
    detail.includes('onPress={() => void load()}'),
  'Crew degraded-state banner must provide a retry action.',
);

if (failures.length) {
  console.error('Crew lifecycle UX contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Crew lifecycle UX contract passed.');
