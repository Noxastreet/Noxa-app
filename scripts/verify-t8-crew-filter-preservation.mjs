import assert from 'node:assert/strict';
import fs from 'node:fs';

const crews = fs.readFileSync('src/features/crews-events/CanonicalCrewsScreen.tsx', 'utf8');
const crewDetail = fs.readFileSync('src/features/crews-events/CanonicalCrewDetailScreen.tsx', 'utf8');

assert.ok(
  crews.includes('const isInitialLoad = !hasLoadedRef.current;'),
  'Crew reload must know whether it is the first load.',
);
assert.ok(
  crews.includes('if (isInitialLoad) setFilter("discover");'),
  'Base Crew load may reset Discover only on the first load.',
);
assert.ok(
  crews.includes('if (isInitialLoad) {\n        setFilter(models.some((crew) => crew.isCurrentUserMember) ? "mine" : "discover");\n      }'),
  'Membership enrichment may auto-select the initial filter only once.',
);
assert.ok(
  crews.includes('useFocusEffect(\n    useCallback(() => {\n      void load(!hasLoadedRef.current);'),
  'Crew list must still refresh when it regains focus.',
);
assert.ok(
  crews.includes('router.push({ pathname: "/crew/[id]", params: { id: crew.id } })'),
  'Crew list must continue pushing Crew Detail onto the stack.',
);
assert.ok(
  crewDetail.includes('onPress={() => router.back()}'),
  'Crew Detail must continue returning through the navigation stack.',
);
assert.equal(
  crews.includes('\n    setFilter("discover");\n    setLoading(false);'),
  false,
  'Focus reload must not unconditionally force Discover.',
);

console.log('T8 Crew filter preservation contract: PASS (7 checks)');
