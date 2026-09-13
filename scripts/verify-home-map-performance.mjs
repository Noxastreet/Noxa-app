import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');

function requireText(text, message) {
  assert.ok(source.includes(text), message);
}

requireText(
  'updated_at: string;\n  profile: ProfileMarkerRow | null;',
  'Active driver state must preserve server measurement time for ordering/race protection.',
);
requireText(
  'const activeDriversRef = useRef<ActiveDriver[]>([]);',
  'Realtime location updates must have a current driver snapshot without forcing a SELECT.',
);
requireText(
  'mapFocusedRef.current = true;',
  'driver_locations subscription must be scoped to focused Map lifecycle.',
);
requireText(
  'mapFocusedRef.current = false;',
  'focused Map lifecycle must be cleared on blur/unmount.',
);
requireText(
  'if (userId === currentUserIdRef.current) return;',
  'own Live Drive writes must not trigger map driver list refetches.',
);
requireText(
  'if (payload.eventType === "DELETE")',
  'Realtime deletes must update the local driver list directly.',
);
requireText(
  'nextDrivers[driverIndex] = {',
  'known Realtime driver updates must update local state directly.',
);
requireText(
  'nextUpdatedAt <= currentUpdatedAt',
  'older/out-of-order Realtime driver updates must not replace a newer marker.',
);
requireText(
  'status === "SUBSCRIBED" && isActive',
  'Map must close the initial snapshot-to-subscription gap once.',
);
requireText(
  '}, DRIVER_LIST_REFRESH_MS);',
  'periodic safety reconciliation must remain in place while Map is focused.',
);

assert.equal(
  source.includes(
    '{ event: "*", schema: "public", table: "driver_locations" },\n      () => {\n        if (isActive) void refreshActiveDrivers();',
  ),
  false,
  'Do not restore full driver SELECT on every driver_locations event.',
);

const channelCall = source.indexOf('const channel = supabase.channel(createDriverLocationsMapTopic());');
const focusedLifecycle = source.lastIndexOf('useFocusEffect(', channelCall);
assert.ok(channelCall >= 0 && focusedLifecycle >= 0, 'driver_locations channel must live inside useFocusEffect.');

console.log('Home / Map F12 performance contract: PASS (12 checks)');
