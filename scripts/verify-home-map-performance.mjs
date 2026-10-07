import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');

function requireText(text, message) {
  assert.ok(source.includes(text), message);
}

requireText(
  'updated_at: string;\n  broadcast_key: string;\n  profile: ProfileMarkerRow | null;',
  'Active driver state must preserve server measurement time and its private Broadcast key.',
);
requireText(
  'const DRIVER_LOCATION_MIN_WRITE_MS = 10_000;',
  'Personal Live Drive writes must be throttled to at least 10 seconds.',
);
requireText(
  'const DRIVER_LIST_REFRESH_MS = 15 * 1000;',
  'Focused Map reconciliation must use the bounded 15 second polling cadence.',
);
requireText(
  'const MAX_MAP_DRIVERS = 200;',
  'Home Map payload must have a hard driver cap.',
);
requireText(
  'function nearbyBounds(point: LatLng, radiusMeters: number)',
  'Home Map must derive a server-side geographic bounding box.',
);
requireText(
  '.gte("latitude", bounds.minLatitude)',
  'Home Map driver query must filter minimum latitude on the server.',
);
requireText(
  '.lte("latitude", bounds.maxLatitude)',
  'Home Map driver query must filter maximum latitude on the server.',
);
requireText(
  '.gte("longitude", bounds.minLongitude)',
  'Home Map driver query must filter minimum longitude on the server.',
);
requireText(
  '.lte("longitude", bounds.maxLongitude)',
  'Home Map driver query must filter maximum longitude on the server.',
);
requireText(
  '.limit(MAX_MAP_DRIVERS);',
  'Home Map driver query must cap returned rows.',
);
requireText(
  'if (isActive && isAppForegroundRef.current) void refreshActiveDrivers();',
  'Home Map polling must stop doing network work while the app is backgrounded.',
);
requireText(
  'activeDriversRequestIdRef.current += 1;',
  'Focused Map cleanup must invalidate an in-flight driver request.',
);

assert.equal(
  source.includes('table: "driver_locations"'),
  false,
  'Home Map must not subscribe globally to driver_locations Postgres Changes.',
);
assert.equal(
  source.includes('createDriverLocationsMapTopic'),
  false,
  'Home Map must not create a dedicated Realtime topic for the global driver table.',
);
requireText(
  'config: { private: true }',
  'Any Home Map Realtime channels must use private Broadcast authorization.',
);
requireText(
  'void supabase.removeChannel(channel);',
  'Private Home Map Broadcast channels must be explicitly removed on cleanup.',
);

console.log('Home / Map scaling contract: PASS (16 checks)');
