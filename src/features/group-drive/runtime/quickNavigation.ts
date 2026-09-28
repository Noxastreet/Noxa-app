import type {
  DriveDestination,
  DriveRouteManeuver,
  DriveRouteResult,
} from '../types';
import {
  prepareDriveRoute,
  projectDriveLocation,
  type PreparedDriveRoute,
} from './routeProgress';

export const QUICK_DRIVE_ARRIVAL_METERS = 50;
export const QUICK_DRIVE_REROUTE_METERS = 65;
export const QUICK_DRIVE_REROUTE_CONFIRMATIONS = 2;
export const QUICK_DRIVE_REROUTE_COOLDOWN_MS = 8_000;

export type QuickNavigationLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
};

export type QuickNavigationProjection = {
  remainingDistanceMeters: number;
  distanceFromRouteMeters: number;
  progressFraction: number;
  arrived: boolean;
  nextManeuver: DriveRouteManeuver | null;
};

export type QuickRerouteState = {
  offRouteConfirmations: number;
  lastRerouteAtMs: number;
};

export function emptyQuickRerouteState(): QuickRerouteState {
  return { offRouteConfirmations: 0, lastRerouteAtMs: 0 };
}

export function prepareQuickRoute(route: DriveRouteResult): PreparedDriveRoute | null {
  return prepareDriveRoute(route.geometry, route.distanceMeters);
}

function maneuverProgress(
  route: PreparedDriveRoute,
  maneuver: DriveRouteManeuver,
) {
  return projectDriveLocation(route, maneuver.latitude, maneuver.longitude)?.progressFraction ?? null;
}

export function nextQuickDriveManeuver(
  route: PreparedDriveRoute,
  maneuvers: readonly DriveRouteManeuver[],
  progressFraction: number,
) {
  let candidate: { maneuver: DriveRouteManeuver; progress: number } | null = null;
  for (const maneuver of maneuvers) {
    const progress = maneuverProgress(route, maneuver);
    if (progress === null || progress + 0.002 < progressFraction) continue;
    if (!candidate || progress < candidate.progress) {
      candidate = { maneuver, progress };
    }
  }
  return candidate?.maneuver ?? null;
}

export function projectQuickNavigation(
  route: PreparedDriveRoute,
  maneuvers: readonly DriveRouteManeuver[],
  location: QuickNavigationLocation,
): QuickNavigationProjection | null {
  const projection = projectDriveLocation(
    route,
    location.latitude,
    location.longitude,
  );
  if (!projection) return null;

  return {
    remainingDistanceMeters: projection.remainingMeters,
    distanceFromRouteMeters: projection.distanceFromRouteMeters,
    progressFraction: projection.progressFraction,
    arrived: projection.remainingMeters <= QUICK_DRIVE_ARRIVAL_METERS,
    nextManeuver: nextQuickDriveManeuver(
      route,
      maneuvers,
      projection.progressFraction,
    ),
  };
}

export function updateQuickRerouteState(
  current: QuickRerouteState,
  distanceFromRouteMeters: number,
  nowMs: number,
) {
  const offRoute = distanceFromRouteMeters > QUICK_DRIVE_REROUTE_METERS;
  const offRouteConfirmations = offRoute
    ? current.offRouteConfirmations + 1
    : 0;
  const cooldownReady =
    nowMs - current.lastRerouteAtMs >= QUICK_DRIVE_REROUTE_COOLDOWN_MS;
  const shouldReroute =
    cooldownReady
    && offRouteConfirmations >= QUICK_DRIVE_REROUTE_CONFIRMATIONS;

  return {
    state: {
      offRouteConfirmations: shouldReroute ? 0 : offRouteConfirmations,
      lastRerouteAtMs: shouldReroute ? nowMs : current.lastRerouteAtMs,
    } satisfies QuickRerouteState,
    shouldReroute,
  };
}

export function destinationChanged(
  previous: DriveDestination | null,
  next: DriveDestination | null,
) {
  if (!previous || !next) return previous !== next;
  return previous.version !== next.version;
}

export function formatQuickRemainingDistance(meters: number | null) {
  if (meters === null || !Number.isFinite(meters)) return '—';
  if (meters <= QUICK_DRIVE_ARRIVAL_METERS) return 'ARRIVED';
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  const kilometers = meters / 1000;
  return `${kilometers.toFixed(kilometers < 10 ? 1 : 0)} km`;
}
