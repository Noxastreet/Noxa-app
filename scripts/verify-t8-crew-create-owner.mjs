import fs from 'node:fs';

const source = fs.readFileSync('src/features/crews-events/CanonicalCrewsScreen.tsx', 'utf8');

const duplicateOwnerInsert = [
  '.from("crew_members")',
  '.insert({ crew_id: data.id, user_id: userId, role: "owner" })',
];

if (duplicateOwnerInsert.every((snippet) => source.includes(snippet))) {
  console.error('T8 crew creation contract: FAIL — Create Crew still inserts owner membership twice.');
  process.exit(1);
}

for (const snippet of [
  'noxa_insert_crew_owner_membership_trigger',
  'setCreateVisible(false);',
  'setFilter("mine");',
  'router.push({ pathname: "/crew/[id]", params: { id: data.id } });',
]) {
  if (!source.includes(snippet)) {
    console.error(`T8 crew creation contract: FAIL — missing ${snippet}`);
    process.exit(1);
  }
}

console.log('T8 crew creation contract: PASS');
