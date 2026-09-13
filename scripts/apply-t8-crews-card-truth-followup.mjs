import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly 1 match, found ${matches}`);
  fs.writeFileSync(path, source.replace(from, to));
}

const crewsPath = 'src/features/crews-events/CanonicalCrewsScreen.tsx';
replaceExact(
  crewsPath,
  `            label={crew.isCurrentUserMember ? "YOUR CREW" : "NEARBY"}`,
  `            label={crew.isCurrentUserMember ? "YOUR CREW" : "DISCOVER"}`,
  'Hero Crew discovery label',
);
replaceExact(
  crewsPath,
  `            label={crew.isCurrentUserMember ? "YOURS" : "NEARBY"}`,
  `            label={crew.isCurrentUserMember ? "YOURS" : "DISCOVER"}`,
  'Compact Crew discovery label',
);

const verifier = 'scripts/verify-t8-core-truth-accessibility.mjs';
replaceExact(
  verifier,
  `assert.ok(crews.includes('COMMUNITY PICKS'), 'Crews discovery profile strip must use non-geographic wording.');\nassert.ok(crews.includes('filterButton: {\\n    minHeight: 44,'), 'Crews Discover/My Crews controls must meet the 44px minimum target.');`,
  `assert.ok(crews.includes('COMMUNITY PICKS'), 'Crews discovery profile strip must use non-geographic wording.');\nassert.equal(crews.includes('? "YOUR CREW" : "NEARBY"'), false, 'Hero Crew card must not label unfiltered discovery as nearby.');\nassert.equal(crews.includes('? "YOURS" : "NEARBY"'), false, 'Compact Crew card must not label unfiltered discovery as nearby.');\nassert.ok(crews.includes('? "YOUR CREW" : "DISCOVER"'), 'Hero Crew card must use truthful discovery wording.');\nassert.ok(crews.includes('? "YOURS" : "DISCOVER"'), 'Compact Crew card must use truthful discovery wording.');\nassert.ok(crews.includes('filterButton: {\\n    minHeight: 44,'), 'Crews Discover/My Crews controls must meet the 44px minimum target.');`,
  'extend Crew card truth contract',
);
replaceExact(
  verifier,
  `console.log('T8 core truth/accessibility contract: PASS (18 checks)');`,
  `console.log('T8 core truth/accessibility contract: PASS (22 checks)');`,
  'contract count',
);

console.log('Applied T8 Crew card truth follow-up.');
