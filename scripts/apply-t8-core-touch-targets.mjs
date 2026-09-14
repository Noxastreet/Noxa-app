import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly 1 match in ${path}, found ${matches}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceExact(
  'src/components/ui/NoxaButton.tsx',
  `      disabled={isDisabled}\n      onPress={onPress}`,
  `      disabled={isDisabled}\n      hitSlop={size === 'sm' ? 6 : undefined}\n      onPress={onPress}`,
  'shared small-button hit area',
);
replaceExact(
  'src/features/crews-events/CanonicalPrimitives.tsx',
  `  primaryButtonCompact: {\n    minHeight: 40,`,
  `  primaryButtonCompact: {\n    minHeight: 44,`,
  'canonical compact primary target',
);
replaceExact(
  'src/features/crews-events/CanonicalCrewDetailScreen.tsx',
  `  headerButton: {\n    width: 42,\n    height: 42,`,
  `  headerButton: {\n    width: 44,\n    height: 44,`,
  'Crew Detail header target',
);
replaceExact(
  'src/features/crews-events/CanonicalCrewDetailScreen.tsx',
  `  tab: {\n    flex: 1,\n    minWidth: 0,\n    minHeight: 40,`,
  `  tab: {\n    flex: 1,\n    minWidth: 0,\n    minHeight: 44,`,
  'Crew Detail tab target',
);
replaceExact(
  'app/(tabs)/profile.tsx',
  `  iconButton: {\n    width: 40,\n    height: 40,`,
  `  iconButton: {\n    width: 44,\n    height: 44,`,
  'Profile settings target',
);
replaceExact(
  'app/(tabs)/profile.tsx',
  `  editButton: {\n    minHeight: 42,`,
  `  editButton: {\n    minHeight: 44,`,
  'Edit Profile target',
);
replaceExact(
  'app/driver-profile/[id].tsx',
  `  headerAction: {\n    width: 40,\n    height: 40,`,
  `  headerAction: {\n    width: 44,\n    height: 44,`,
  'Driver Profile header target',
);
replaceExact(
  'app/driver-profile/[id].tsx',
  `  followButton: { minHeight: 42,`,
  `  followButton: { minHeight: 44,`,
  'Driver Profile Follow target',
);
replaceExact(
  'app/vehicle-details.tsx',
  `  headerButton: {\n    width: 40,\n    height: 40,`,
  `  headerButton: {\n    width: 44,\n    height: 44,`,
  'Vehicle Detail header target',
);
replaceExact(
  'app/event-editor.tsx',
  `  backButton: {\n    width: 40,\n    height: 40,`,
  `  backButton: {\n    width: 44,\n    height: 44,`,
  'Event Editor Back target',
);
replaceExact(
  'app/event-editor.tsx',
  `  categoryOption: {\n    minHeight: 42,`,
  `  categoryOption: {\n    minHeight: 44,`,
  'Event category target',
);
replaceExact(
  'app/vehicle-editor.tsx',
  `  backButton: {\n    width: 40,\n    height: 40,`,
  `  backButton: {\n    width: 44,\n    height: 44,`,
  'Vehicle Editor Back target',
);
replaceExact(
  'app/vehicle-editor.tsx',
  `  coverActionButton: {\n    minHeight: 42,`,
  `  coverActionButton: {\n    minHeight: 44,`,
  'Vehicle cover action target',
);
replaceExact(
  'package.json',
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n`,
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n    "verify:t8-core-touch-targets": "node ./scripts/verify-t8-core-touch-targets.mjs",\n`,
  'package verifier script',
);

console.log('Applied T8 core touch-target patch.');
