import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected 1 match in ${path}, found ${matches}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceExact(
  'src/features/crews-events/CanonicalCrewsScreen.tsx',
  '{filter === "mine" ? "No crews yet" : "Nothing nearby yet"}',
  '{filter === "mine" ? "No crews yet" : "Nothing to discover yet"}',
  'Crews empty-state proximity claim',
);
replaceExact(
  'src/features/crews-events/CanonicalCrewsScreen.tsx',
  'title={filter === "mine" ? "MORE OF YOUR CREWS" : "ACTIVE NEAR YOU"}',
  'title={filter === "mine" ? "MORE OF YOUR CREWS" : "ACTIVE CREWS"}',
  'Crews section proximity claim',
);

const verifier = 'scripts/verify-t8-core-truth-accessibility.mjs';
replaceExact(
  verifier,
  "assert.ok(crews.includes('createButton: {\\n    minHeight: 44,'), 'Crews Create control must meet the 44px minimum target.');",
  "assert.ok(crews.includes('createButton: {\\n    minHeight: 44,'), 'Crews Create control must meet the 44px minimum target.');\nassert.equal(crews.includes('Nothing nearby yet'), false, 'Crews must not claim nearby discovery without location/distance evidence.');\nassert.equal(crews.includes('ACTIVE NEAR YOU'), false, 'Crews must not claim proximity without location/distance evidence.');\nassert.ok(crews.includes('Nothing to discover yet'), 'Crews empty state must use non-geographic discovery wording.');\nassert.ok(crews.includes('ACTIVE CREWS'), 'Crews discovery section must use truthful non-geographic wording.');",
  'extend T8 Crews truthfulness contract',
);
replaceExact(
  verifier,
  "console.log('T8 core truth/accessibility contract: PASS (11 checks)');",
  "console.log('T8 core truth/accessibility contract: PASS (15 checks)');",
  'update T8 check count',
);

console.log('T8 Crews truthfulness patch applied.');
