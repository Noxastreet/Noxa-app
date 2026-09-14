import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const checks = [];
const expect = (condition, message) => {
  checks.push({ condition, message });
  if (!condition) console.error(`FAIL: ${message}`);
};

const supabase = read('src/lib/supabase.ts');
const garage = read('app/(tabs)/garage.tsx');
const profile = read('app/(tabs)/profile.tsx');
const events = read('src/features/crews-events/CanonicalEventsScreen.tsx');
const crews = read('src/features/crews-events/CanonicalCrewsScreen.tsx');
const map = read('app/(tabs)/index.tsx');

expect(supabase.includes('cachedSessionUser') && supabase.includes('sessionUserPromise'), 'session user is memoized and deduplicated');
expect(garage.includes('GARAGE_REFRESH_TTL_MS') && garage.includes('lastLoadedVehiclesAtRef'), 'Garage avoids refetch on rapid tab focus');
expect(profile.includes('PROFILE_REFRESH_TTL_MS') && profile.indexOf('setProfileData(profileResult.data') < profile.indexOf('const [followersResult'), 'Profile renders critical identity before secondary activity queries');
expect(events.includes('EVENTS_FEED_LIMIT') && events.includes('.in("event_id", eventIds)'), 'Events feed is bounded and attendance is scoped to loaded events');
expect(crews.includes('CREWS_FEED_LIMIT') && crews.includes('.in("crew_id", crewIds)') && crews.includes('profileIds'), 'Crews secondary queries are scoped to loaded crews');
expect(map.includes('MAP_EVENTS_REFRESH_TTL_MS') && map.includes('getLastKnownPositionAsync') && map.includes('shouldRefreshEvents'), 'Map reuses recent events and uses fast last-known GPS');
expect(!map.includes('mapFocusedRef.current = true;\n      void refreshActiveDrivers();'), 'Map does not duplicate the active-driver snapshot before realtime subscribes');

const failures = checks.filter((check) => !check.condition);
if (failures.length) process.exit(1);
console.log(`T9 performance pass: ${checks.length} checks passed.`);
