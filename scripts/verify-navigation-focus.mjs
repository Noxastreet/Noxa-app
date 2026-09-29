#!/usr/bin/env node

import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const home = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const mapTypes = fs.readFileSync('src/features/mapbox/types.ts', 'utf8');
const mapRuntime = fs.readFileSync('src/features/mapbox/MapboxLiveMap.tsx', 'utf8');
const eventRoute = fs.readFileSync('supabase/functions/event-route/index.ts', 'utf8');
const crews = fs.readFileSync('src/features/crews-events/CanonicalCrewsScreen.tsx', 'utf8');
const profile = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');

assert(
  /onUserLocationChange\?: \(point: LatLng\) => void/.test(mapTypes)
    && /onUserLocationUpdate=\{\(location\) =>/.test(mapRuntime)
    && /onUserLocationChange\(\{ latitude, longitude \}\)/.test(mapRuntime),
  'Route progress must use the existing Mapbox user-location stream.',
);

assert(
  !/watchPositionAsync|startLocationUpdatesAsync|TaskManager\.defineTask/.test(home),
  'Home route navigation must not create a second GPS watcher, background task, or native location pipeline.',
);

assert(
  /prepareDriveRoute/.test(home)
    && /projectDriveLocation/.test(home)
    && /routeRemainingDistanceMeters/.test(home)
    && /routeRemainingDurationSeconds/.test(home)
    && /onUserLocationChange=\{handleMapboxUserLocation\}/.test(home),
  'Remaining route distance and ETA must derive from live GPS progress along the current route.',
);

assert(
  /remainingDistanceMeters=\{routeRemainingDistanceMeters\}/.test(home)
    && /remainingDurationSeconds=\{routeRemainingDurationSeconds\}/.test(home),
  'The pre-navigation RouteCard must display live remaining metrics instead of frozen initial totals.',
);

assert(
  /const \[isRouteFocusMode, setIsRouteFocusMode\] = useState\(false\)/.test(home)
    && /setIsRouteFocusMode\(true\)[\s\S]{0,100}setIsRouteFollowing\(true\)/.test(home)
    && /tabBarStyle: hideRootTabs \? \{ display: "none" \} : undefined/.test(home),
  'Following must enter Navigation Focus Mode and hide the root tabs.',
);

assert(
  /function RouteFocusOverlay/.test(home)
    && /routeFocusTop/.test(home)
    && /routeFocusBottom/.test(home)
    && /ETA /.test(home)
    && /Resume route following/.test(home),
  'Navigation Focus Mode must move guidance and trip metrics to compact map-edge overlays.',
);

assert(
  /!isRouteFocusMode && !driveTogetherPanelVisible/.test(home)
    && /!isRouteFocusMode && !driveTogetherPanelVisible && !driveTogetherNavigation && selectedEvent/.test(home),
  'Normal map chrome and the old RouteCard/EventCard must stay out of Navigation Focus Mode.',
);

assert(
  /steps: "true"/.test(eventRoute)
    && /maneuvers: RouteManeuver\[\]/.test(eventRoute)
    && /instruction/.test(eventRoute),
  'event-route must add turn-by-turn maneuvers without replacing its existing route contract.',
);

assert(
  !/accessibilityLabel="Quick Connect"/.test(crews)
    && /accessibilityLabel="Quick Connect"/.test(profile)
    && /pathname: '\/quick-connect'/.test(profile),
  'Quick Connect must be a global social action, not Crew-specific chrome.',
);

if (!process.exitCode) {
  console.log('Navigation focus and live progress contract passed.');
}
