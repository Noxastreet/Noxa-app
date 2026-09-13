import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly 1 match, found ${matches}`);
  fs.writeFileSync(path, source.replace(from, to));
}

const path = 'src/features/crews-events/CanonicalCrewsScreen.tsx';
replaceExact(
  path,
  `  const load = useCallback(async (showSpinner = true) => {\n    if (showSpinner) setLoading(true);`,
  `  const load = useCallback(async (showSpinner = true) => {\n    const isInitialLoad = !hasLoadedRef.current;\n    if (showSpinner) setLoading(true);`,
  'initial load marker',
);
replaceExact(
  path,
  `    setCrews(baseModels);\n    setEvents([]);\n    setProfiles([]);\n    setFilter("discover");\n    setLoading(false);`,
  `    setCrews(baseModels);\n    setEvents([]);\n    setProfiles([]);\n    if (isInitialLoad) setFilter("discover");\n    setLoading(false);`,
  'base filter reset',
);
replaceExact(
  path,
  `      setFilter(models.some((crew) => crew.isCurrentUserMember) ? "mine" : "discover");`,
  `      if (isInitialLoad) {\n        setFilter(models.some((crew) => crew.isCurrentUserMember) ? "mine" : "discover");\n      }`,
  'membership filter reset',
);

replaceExact(
  'package.json',
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n`,
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n    "verify:t8-crew-filter-preservation": "node ./scripts/verify-t8-crew-filter-preservation.mjs",\n`,
  'package verifier script',
);

console.log('Applied T8 Crew filter preservation patch.');
