import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly 1 match in ${path}, found ${matches}`);
  fs.writeFileSync(path, source.replace(from, to));
}

const crewsPath = 'src/features/crews-events/CanonicalCrewsScreen.tsx';
replaceExact(
  crewsPath,
  '{filter === "mine" ? "YOUR COMMUNITY" : "PEOPLE NEARBY"}',
  '{filter === "mine" ? "YOUR COMMUNITY" : "COMMUNITY PICKS"}',
  'Crews profile-strip proximity claim',
);
replaceExact(
  crewsPath,
  '  filterButton: {\n    minHeight: 42,',
  '  filterButton: {\n    minHeight: 44,',
  'Crews filter target',
);

const verifierPath = 'scripts/verify-t8-core-truth-accessibility.mjs';
replaceExact(
  verifierPath,
  "assert.ok(crews.includes('ACTIVE CREWS'), 'Crews discovery section must use truthful non-geographic wording.');",
  "assert.ok(crews.includes('ACTIVE CREWS'), 'Crews discovery section must use truthful non-geographic wording.');\nassert.equal(crews.includes('PEOPLE NEARBY'), false, 'Crews profile strip must not claim proximity for an unfiltered profile sample.');\nassert.ok(crews.includes('COMMUNITY PICKS'), 'Crews discovery profile strip must use non-geographic wording.');\nassert.ok(crews.includes('filterButton: {\\n    minHeight: 44,'), 'Crews Discover/My Crews controls must meet the 44px minimum target.');",
  'extend Crews truth/accessibility checks',
);
replaceExact(
  verifierPath,
  "console.log('T8 core truth/accessibility contract: PASS (15 checks)');",
  "console.log('T8 core truth/accessibility contract: PASS (18 checks)');",
  'update T8 check count',
);

console.log('Applied T8 Crews truth/accessibility follow-up.');
