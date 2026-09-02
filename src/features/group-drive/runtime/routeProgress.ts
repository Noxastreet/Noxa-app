import type { DriveLocationState, DriveRouteGeometry } from '../types';

const EARTH_RADIUS_METERS = 6_371_008.8;

export const GROUP_DRIVE_OFF_ROUTE_THRESHOLD_METERS = 250;
export const GROUP_DRIVE_STALE_AFTER_MS = 45_000;
export const GROUP_DRIVE_OFF_ROUTE_GRACE_UPDATES = 1;

type RouteCoordinate = readonly [longitude: number, latitude: number];

type PreparedRouteSegment = {
  start: RouteCoordinate;
  end: RouteCoordinate;
  lengthMeters: number;
  cumulativeStartMeters: number;
};

export type PreparedDriveRoute = {
  routeDistanceMeters: number;
  geometryDistanceMeters: number;
  segments: readonly PreparedRouteSegment[];
};

export type DriveRouteProjection = {
  progressFraction: number;
  remainingMeters: number;
  distanceFromRouteMeters: number;
};

export type DriveParticipantProgressStatus =
  | 'arrived'
  | 'fresh'
  | 'off_route'
  | 'stale'
  | 'unknown';

export type DriveParticipantProgress = {
  userId: string;
  locationId: string | null;
  status: DriveParticipantProgressStatus;
  remainingMeters: number | null;
  progressFraction: number | null;
  distanceFromRouteMeters: number | null;
  updatedAt: string | null;
  retainedFromLastStable: boolean;
};

export type GroupDriveProgressState = {
  driveSessionId: string;
  byUserId: Readonly<Record<string, DriveParticipantProgress>>;
  offRouteUpdatesByUserId: Readonly<Record<string, number>>;
  lastStableRemainingMetersByUserId: Readonly<Record<string, number>>;
  lastStableProgressFractionByUserId: Readonly<Record<string, number>>;
};

export type GroupDriveProgressOptions = {
  staleAfterMs?: number;
  offRouteThresholdMeters?: number;
  offRouteGraceUpdates?: number;
};

function toRadians(degrees: number) {
  return degrees * Math.PI / 180;
}

function normalizeLongitudeRadians(radians: number) {
  if (radians > Math.PI) return radians - Math.PI * 2;
  if (radians < -Math.PI) return radians + Math.PI * 2;
  return radians;
}

function nonNegativeOption(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function isCoordinate(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length < 2) return false;
  const [longitude, latitude] = value;
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -90
    && latitude <= 90;
}

function haversineMeters(start: RouteCoordinate, end: RouteCoordinate) {
  const latitudeDelta = toRadians(end[1] - start[1]);
  const longitudeDelta = normalizeLongitudeRadians(toRadians(end[0] - start[0]));
  const startLatitude = toRadians(start[1]);
  const endLatitude = toRadians(end[1]);
  const halfLatitude = Math.sin(latitudeDelta / 2);
  const halfLongitude = Math.sin(longitudeDelta / 2);
  const a = halfLatitude * halfLatitude
    + Math.cos(startLatitude) * Math.cos(endLatitude) * halfLongitude * halfLongitude;
  const safeA = Math.max(0, Math.min(1, a));
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA));
}

function projectToSegment(
  latitude: number,
  longitude: number,
  segment: PreparedRouteSegment,
) {
  const referenceLatitude = toRadians((segment.start[1] + segment.end[1]) / 2);
  const xScale = EARTH_RADIUS_METERS * Math.max(Math.cos(referenceLatitude), 0.000001);
  const yScale = EARTH_RADIUS_METERS;
  const segmentX = normalizeLongitudeRadians(toRadians(segment.end[0] - segment.start[0])) * xScale;
  const segmentY = toRadians(segment.end[1] - segment.start[1]) * yScale;
  const pointX = normalizeLongitudeRadians(toRadians(longitude - segment.start[0])) * xScale;
  const pointY = toRadians(latitude - segment.start[1]) * yScale;
  const squaredLength = segmentX * segmentX + segmentY * segmentY;
  const fraction = squaredLength === 0
    ? 0
    : Math.max(0, Math.min(1, (pointX * segmentX + pointY * segmentY) / squaredLength));
  const distanceX = pointX - segmentX * fraction;
  const distanceY = pointY - segmentY * fraction;
  return { fraction, distanceMeters: Math.hypot(distanceX, distanceY) };
}

export function prepareDriveRoute(
  geometry: DriveRouteGeometry | null,
  routeDistanceMeters: number | null,
): PreparedDriveRoute | null {
  if (geometry?.type !== 'LineString'
    || !Array.isArray(geometry.coordinates)
    || geometry.coordinates.length < 2
    || !Number.isFinite(routeDistanceMeters)
    || (routeDistanceMeters ?? 0) <= 0
    || !geometry.coordinates.every(isCoordinate)) {
    return null;
  }

  const segments: PreparedRouteSegment[] = [];
  let cumulativeStartMeters = 0;
  for (let index = 0; index < geometry.coordinates.length - 1; index += 1) {
    const start = geometry.coordinates[index] as RouteCoordinate;
    const end = geometry.coordinates[index + 1] as RouteCoordinate;
    const lengthMeters = haversineMeters(start, end);
    if (lengthMeters <= 0) continue;
    segments.push({ start, end, lengthMeters, cumulativeStartMeters });
    cumulativeStartMeters += lengthMeters;
  }

  if (!segments.length || cumulativeStartMeters <= 0) return null;
  return {
    routeDistanceMeters: routeDistanceMeters as number,
    geometryDistanceMeters: cumulativeStartMeters,
    segments,
  };
}

export function projectDriveLocation(
  route: PreparedDriveRoute,
  latitude: number,
  longitude: number,
): DriveRouteProjection | null {
  if (!Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180) {
    return null;
  }

  let nearest: { distanceMeters: number; alongRouteMeters: number } | null = null;
  for (const segment of route.segments) {
    const projection = projectToSegment(latitude, longitude, segment);
    const alongRouteMeters = segment.cumulativeStartMeters
      + segment.lengthMeters * projection.fraction;
    if (!nearest || projection.distanceMeters < nearest.distanceMeters) {
      nearest = { distanceMeters: projection.distanceMeters, alongRouteMeters };
    }
  }
  if (!nearest) return null;

  const progressFraction = Math.max(
    0,
    Math.min(1, nearest.alongRouteMeters / route.geometryDistanceMeters),
  );
  const remainingMeters = Math.max(
    0,
    Math.min(route.routeDistanceMeters, route.routeDistanceMeters * (1 - progressFraction)),
  );
  return {
    progressFraction,
    remainingMeters,
    distanceFromRouteMeters: nearest.distanceMeters,
  };
}

export function emptyGroupDriveProgressState(driveSessionId: string): GroupDriveProgressState {
  return {
    driveSessionId,
    byUserId: {},
    offRouteUpdatesByUserId: {},
    lastStableRemainingMetersByUserId: {},
    lastStableProgressFractionByUserId: {},
  };
}

export function deriveGroupDriveParticipantProgress(
  driveSessionId: string,
  route: PreparedDriveRoute | null,
  participantUserIds: readonly string[],
  locations: readonly DriveLocationState[],
  previous = emptyGroupDriveProgressState(driveSessionId),
  now = new Date(),
  options: GroupDriveProgressOptions = {},
): GroupDriveProgressState {
  const safePrevious = previous.driveSessionId === driveSessionId
    ? previous
    : emptyGroupDriveProgressState(driveSessionId);
  const staleAfterMs = nonNegativeOption(options.staleAfterMs, GROUP_DRIVE_STALE_AFTER_MS);
  const offRouteThresholdMeters = nonNegativeOption(
    options.offRouteThresholdMeters,
    GROUP_DRIVE_OFF_ROUTE_THRESHOLD_METERS,
  );
  const offRouteGraceUpdates = Math.floor(nonNegativeOption(
    options.offRouteGraceUpdates,
    GROUP_DRIVE_OFF_ROUTE_GRACE_UPDATES,
  ));
  const latestLocationByUserId = new Map<string, DriveLocationState>();
  for (const location of locations) {
    if (location.driveSessionId !== driveSessionId) continue;
    const existing = latestLocationByUserId.get(location.userId);
    const locationTime = Date.parse(location.updatedAt);
    const existingTime = existing ? Date.parse(existing.updatedAt) : -Infinity;
    if (!existing
      || (Number.isFinite(locationTime) && !Number.isFinite(existingTime))
      || locationTime > existingTime) {
      latestLocationByUserId.set(location.userId, location);
    }
  }

  const byUserId: Record<string, DriveParticipantProgress> = {};
  const offRouteUpdatesByUserId: Record<string, number> = {};
  const lastStableRemainingMetersByUserId: Record<string, number> = {};
  const lastStableProgressFractionByUserId: Record<string, number> = {};

  for (const userId of [...new Set(participantUserIds)]) {
    const location = latestLocationByUserId.get(userId);
    const base = {
      userId,
      locationId: location?.id ?? null,
      updatedAt: location?.updatedAt ?? null,
      retainedFromLastStable: false,
    };
    const previousStableRemaining = safePrevious.lastStableRemainingMetersByUserId[userId];
    const previousStableProgress = safePrevious.lastStableProgressFractionByUserId[userId];
    if (previousStableRemaining !== undefined) {
      lastStableRemainingMetersByUserId[userId] = previousStableRemaining;
    }
    if (previousStableProgress !== undefined) {
      lastStableProgressFractionByUserId[userId] = previousStableProgress;
    }

    if (!location) {
      byUserId[userId] = {
        ...base,
        status: 'unknown',
        remainingMeters: null,
        progressFraction: null,
        distanceFromRouteMeters: null,
      };
      continue;
    }

    if (location.status === 'arrived') {
      byUserId[userId] = {
        ...base,
        status: 'arrived',
        remainingMeters: 0,
        progressFraction: 1,
        distanceFromRouteMeters: null,
      };
      lastStableRemainingMetersByUserId[userId] = 0;
      lastStableProgressFractionByUserId[userId] = 1;
      continue;
    }

    const updatedAtMs = Date.parse(location.updatedAt);
    const nowMs = now.getTime();
    const rowAgeMs = Number.isFinite(updatedAtMs) && Number.isFinite(nowMs)
      ? Math.max(0, nowMs - updatedAtMs)
      : Infinity;
    if (location.status === 'stale' || rowAgeMs > staleAfterMs) {
      byUserId[userId] = {
        ...base,
        status: 'stale',
        remainingMeters: null,
        progressFraction: null,
        distanceFromRouteMeters: null,
      };
      continue;
    }

    const projection = route
      ? projectDriveLocation(route, location.latitude, location.longitude)
      : null;
    if (!projection) {
      byUserId[userId] = {
        ...base,
        status: 'unknown',
        remainingMeters: null,
        progressFraction: null,
        distanceFromRouteMeters: null,
      };
      continue;
    }

    if (projection.distanceFromRouteMeters > offRouteThresholdMeters) {
      const offRouteUpdates = (safePrevious.offRouteUpdatesByUserId[userId] ?? 0) + 1;
      offRouteUpdatesByUserId[userId] = offRouteUpdates;
      const canRetain = offRouteUpdates <= offRouteGraceUpdates
        && previousStableRemaining !== undefined
        && previousStableProgress !== undefined;
      byUserId[userId] = {
        ...base,
        status: 'off_route',
        remainingMeters: canRetain ? previousStableRemaining : null,
        progressFraction: canRetain ? previousStableProgress : null,
        distanceFromRouteMeters: projection.distanceFromRouteMeters,
        retainedFromLastStable: canRetain,
      };
      continue;
    }

    byUserId[userId] = {
      ...base,
      status: 'fresh',
      remainingMeters: projection.remainingMeters,
      progressFraction: projection.progressFraction,
      distanceFromRouteMeters: projection.distanceFromRouteMeters,
    };
    lastStableRemainingMetersByUserId[userId] = projection.remainingMeters;
    lastStableProgressFractionByUserId[userId] = projection.progressFraction;
  }

  return {
    driveSessionId,
    byUserId,
    offRouteUpdatesByUserId,
    lastStableRemainingMetersByUserId,
    lastStableProgressFractionByUserId,
  };
}
