import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly 1 match in ${path}, found ${matches}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceExact(
  'src/features/crews-events/CanonicalEventDetailScreen.tsx',
  `          <NoxaButton\n            title="Go back"\n            variant="secondary"\n            onPress={() => router.back()}\n          />`,
  `          {uuidPattern.test(eventId) ? (\n            <NoxaButton\n              title="Retry"\n              onPress={() => void load()}\n            />\n          ) : null}\n          <NoxaButton\n            title="Go back"\n            variant="secondary"\n            onPress={() => router.back()}\n          />`,
  'Event Detail unavailable recovery',
);

replaceExact(
  'src/features/crews-events/CanonicalCrewDetailScreen.tsx',
  `          <CanonicalPrimaryButton\n            label="GO BACK"\n            variant="surface"\n            onPress={() => router.back()}\n          />`,
  `          {uuidPattern.test(crewId) ? (\n            <CanonicalPrimaryButton\n              label="RETRY"\n              onPress={() => void load()}\n            />\n          ) : null}\n          <CanonicalPrimaryButton\n            label="GO BACK"\n            variant="surface"\n            onPress={() => router.back()}\n          />`,
  'Crew Detail unavailable recovery',
);

replaceExact(
  'package.json',
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",`,
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n    "verify:t8-detail-retry": "node ./scripts/verify-t8-detail-retry.mjs",`,
  'T8 detail retry package script',
);

console.log('Applied T8 detail retry patch.');
