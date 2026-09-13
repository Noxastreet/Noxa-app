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
  `    if (!hero) {\n      return (\n        <View style={styles.stateCard}>`,
  `    if (error && !hero) {\n      return (\n        <View style={styles.stateCard}>\n          <Ionicons name="cloud-offline-outline" size={36} color={colors.primary} />\n          <Text style={styles.stateTitle}>Crews unavailable</Text>\n          <Text style={styles.stateText}>NOXA could not load Crew discovery.</Text>\n          <CanonicalPrimaryButton\n            label="TRY AGAIN"\n            variant="surface"\n            onPress={() => void load()}\n          />\n        </View>\n      );\n    }\n\n    if (!hero) {\n      return (\n        <View style={styles.stateCard}>`,
  'Crew error state before empty state',
);

const verifier = 'scripts/verify-t8-core-truth-accessibility.mjs';
replaceExact(
  verifier,
  `assert.ok(crews.includes('filterButton: {\\n    minHeight: 44,'), 'Crews Discover/My Crews controls must meet the 44px minimum target.');`,
  `assert.ok(crews.includes('filterButton: {\\n    minHeight: 44,'), 'Crews Discover/My Crews controls must meet the 44px minimum target.');\nassert.ok(crews.includes('if (error && !hero) {'), 'Crews must distinguish first-load errors from a genuinely empty list.');\nassert.ok(crews.includes('Crews unavailable'), 'Crews first-load error state must be explicit.');\nassert.ok(crews.includes('label="TRY AGAIN"'), 'Crews first-load error state must expose Retry.');\nassert.ok(crews.indexOf('if (error && !hero) {') < crews.indexOf('if (!hero) {'), 'Crews error state must be evaluated before the empty-state branch.');`,
  'extend Crew error-state contract',
);
replaceExact(
  verifier,
  `console.log('T8 core truth/accessibility contract: PASS (22 checks)');`,
  `console.log('T8 core truth/accessibility contract: PASS (26 checks)');`,
  'contract count',
);

console.log('Applied T8 Crews error-state follow-up.');
