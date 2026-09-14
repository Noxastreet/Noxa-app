import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { supabase } from '@/src/lib/supabase';

export const LIVE_DRIVE_TASK_NAME = 'noxa-live-drive-location-v1';
export const LIVE_DRIVE_DURATION_MS = 4 * 60 * 60 * 1000;

const LIVE_DRIVE_SESSION_KEY = 'noxa.live-drive-session.v1';
const PENDING_LIVE_DRIVE_CLEANUP_KEY = 'noxa.live-drive-pending-cleanup.v1';
const PRECISE_LOCATION_MAX_ACCURACY_METERS = 1000;
const PENDING_CLEANUP_RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;

export type LiveDriveVisibilityMode = 'crew' | 'friends' | 'global';

export type LiveDriveSession = {
  userId: string;
  visibilityMode: LiveDriveVisibilityMode;
  expiresAt: string;
};

type PendingLiveDriveCleanup = {
  userId: string;
  shareExpiresAt: string;
};

type LiveDriveTaskData = {
  locations?: Location.LocationObject[];
};

let pendingCleanupTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCleanupRetryIndex = 0;

function readStoredSession(): LiveDriveSession | null {
  try {
    const raw = localStorage.getItem(LIVE_DRIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveDriveSession>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.expiresAt !== 'string' ||
      !['crew', 'friends', 'global'].includes(parsed.visibilityMode ?? '')
    ) {
      localStorage.removeItem(LIVE_DRIVE_SESSION_KEY);
      return null;
    }
    return parsed as LiveDriveSession;
  } catch {
    localStorage.removeItem(LIVE_DRIVE_SESSION_KEY);
    return null;
  }
}

function storeSession(session: LiveDriveSession | null) {
  if (session) {
    localStorage.setItem(LIVE_DRIVE_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(LIVE_DRIVE_SESSION_KEY);
  }
}

function readPendingCleanup(): PendingLiveDriveCleanup | null {
  try {
    const raw = localStorage.getItem(PENDING_LIVE_DRIVE_CLEANUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingLiveDriveCleanup>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.shareExpiresAt !== 'string' ||
      !Number.isFinite(Date.parse(parsed.shareExpiresAt))
    ) {
      localStorage.removeItem(PENDING_LIVE_DRIVE_CLEANUP_KEY);
      return null;
    }
    return parsed as PendingLiveDriveCleanup;
  } catch {
    localStorage.removeItem(PENDING_LIVE_DRIVE_CLEANUP_KEY);
    return null;
  }
}

function storePendingCleanup(cleanup: PendingLiveDriveCleanup | null) {
  if (cleanup) {
    localStorage.setItem(PENDING_LIVE_DRIVE_CLEANUP_KEY, JSON.stringify(cleanup));
  } else {
    localStorage.removeItem(PENDING_LIVE_DRIVE_CLEANUP_KEY);
  }
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hasPreciseForegroundPermission(
  permission: Location.LocationPermissionResponse,
) {
  if (permission.status !== Location.PermissionStatus.GRANTED) return false;
  const androidAccuracy = permission.android?.accuracy;
  return androidAccuracy !== 'coarse' && androidAccuracy !== 'none';
}

function hasPreciseLocationSample(coords: Location.LocationObjectCoords) {
  const accuracy = finiteOrNull(coords.accuracy);
  return (
    accuracy !== null &&
    accuracy >= 0 &&
    accuracy < PRECISE_LOCATION_MAX_ACCURACY_METERS
  );
}

function buildPresencePayload(
  session: LiveDriveSession,
  coords: Location.LocationObjectCoords,
) {
  if (!hasPreciseLocationSample(coords)) return null;

  const latitude = finiteOrNull(coords.latitude);
  const longitude = finiteOrNull(coords.longitude);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const heading = finiteOrNull(coords.heading);
  const speed = finiteOrNull(coords.speed);
  const accuracy = finiteOrNull(coords.accuracy);

  return {
    latitude,
    longitude,
    heading: heading !== null && heading >= 0 && heading < 360 ? heading : null,
    speed_mps: speed !== null && speed >= 0 ? speed : null,
    accuracy_meters: accuracy,
    visibility_mode: session.visibilityMode,
    share_expires_at: session.expiresAt,
    updated_at: new Date().toISOString(),
  };
}

async function upsertLiveDrivePresence(
  session: LiveDriveSession,
  coords: Location.LocationObjectCoords,
) {
  const payload = buildPresencePayload(session, coords);
  if (!payload) return false;

  const { error } = await supabase.from('driver_locations').upsert(
    {
      user_id: session.userId,
      ...payload,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
  return true;
}

async function deleteLiveDrivePresence(
  userId: string,
  shareExpiresAt?: string,
) {
  let request = supabase
    .from('driver_locations')
    .delete()
    .eq('user_id', userId);

  if (shareExpiresAt) {
    request = request.eq('share_expires_at', shareExpiresAt);
  }

  const { error } = await request;
  if (error) throw error;
}

async function stopNativeLocationUpdates() {
  if (await Location.hasStartedLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME);
  }
}

function queuePresenceCleanup(session: LiveDriveSession) {
  storePendingCleanup({
    userId: session.userId,
    shareExpiresAt: session.expiresAt,
  });
  pendingCleanupRetryIndex = 0;
  schedulePendingCleanupRetry();
}

async function flushPendingPresenceCleanup() {
  const pending = readPendingCleanup();
  if (!pending) {
    pendingCleanupRetryIndex = 0;
    return true;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== pending.userId) return false;

  try {
    // Scope the retry to the stopped session's unique share expiry. If the
    // user already started a newer Live Drive, this cannot delete its row.
    await deleteLiveDrivePresence(pending.userId, pending.shareExpiresAt);
    storePendingCleanup(null);
    pendingCleanupRetryIndex = 0;
    return true;
  } catch {
    return false;
  }
}

function schedulePendingCleanupRetry(delayMs?: number) {
  if (pendingCleanupTimer || !readPendingCleanup()) return;
  const nextDelay =
    delayMs ??
    PENDING_CLEANUP_RETRY_DELAYS_MS[
      Math.min(pendingCleanupRetryIndex, PENDING_CLEANUP_RETRY_DELAYS_MS.length - 1)
    ];

  pendingCleanupTimer = setTimeout(() => {
    pendingCleanupTimer = null;
    void flushPendingPresenceCleanup().then((cleaned) => {
      if (cleaned || !readPendingCleanup()) return;
      pendingCleanupRetryIndex += 1;
      if (pendingCleanupRetryIndex < PENDING_CLEANUP_RETRY_DELAYS_MS.length) {
        schedulePendingCleanupRetry();
      }
    });
  }, nextDelay);
}

async function stopSessionAndCleanupPresence(session: LiveDriveSession) {
  storeSession(null);
  await stopNativeLocationUpdates().catch(() => undefined);
  try {
    await deleteLiveDrivePresence(session.userId, session.expiresAt);
    const pending = readPendingCleanup();
    if (
      pending?.userId === session.userId &&
      pending.shareExpiresAt === session.expiresAt
    ) {
      storePendingCleanup(null);
    }
  } catch {
    queuePresenceCleanup(session);
  }
}

async function expireSession(session: LiveDriveSession) {
  await stopSessionAndCleanupPresence(session);
}

if (!TaskManager.isTaskDefined(LIVE_DRIVE_TASK_NAME)) {
  TaskManager.defineTask<LiveDriveTaskData>(
    LIVE_DRIVE_TASK_NAME,
    async ({ data, error }) => {
      if (error) return;

      const session = readStoredSession();
      if (!session) {
        await stopNativeLocationUpdates().catch(() => undefined);
        return;
      }
      if (Date.now() >= Date.parse(session.expiresAt)) {
        await expireSession(session);
        return;
      }

      const latestLocation = data?.locations?.at(-1);
      if (!latestLocation) return;

      const foreground = await Location.getForegroundPermissionsAsync().catch(
        () => null,
      );
      if (
        !foreground ||
        !hasPreciseForegroundPermission(foreground) ||
        !hasPreciseLocationSample(latestLocation.coords)
      ) {
        await expireSession(session).catch(() => undefined);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user.id !== session.userId) {
        await expireSession(session);
        return;
      }

      await upsertLiveDrivePresence(session, latestLocation.coords).catch(
        () => undefined,
      );
    },
  );
}

// A transient offline stop must not become a forgotten server presence. Retry
// after module startup and after auth/session recovery without collecting GPS.
schedulePendingCleanupRetry(0);
supabase.auth.onAuthStateChange((_event, session) => {
  const pending = readPendingCleanup();
  if (session?.user.id && pending?.userId === session.user.id) {
    schedulePendingCleanupRetry(0);
  }
});

export function getLiveDriveSession() {
  const session = readStoredSession();
  if (!session) return null;
  if (Date.now() >= Date.parse(session.expiresAt)) {
    void expireSession(session);
    return null;
  }
  return session;
}

export async function requestLiveDrivePermissions() {
  if (!(await TaskManager.isAvailableAsync())) {
    throw new Error('Background location requires a development or store build. It does not run in Expo Go.');
  }
  if (!(await Location.isBackgroundLocationAvailableAsync())) {
    throw new Error('Background location is not available on this device.');
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!hasPreciseForegroundPermission(foreground)) {
    throw new Error('Precise location is required for Live Drive. Enable precise location in system settings.');
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error('Location services are off. Enable GPS to start Live Drive.');
  }

  // Expo 54 cannot expose iOS accuracyAuthorization. Reduced Accuracy normally
  // yields kilometer-scale uncertainty, so reject any sample that is not useful
  // for driving before asking for background access.
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  if (!hasPreciseLocationSample(current.coords)) {
    throw new Error('Precise location is unavailable. Enable Precise Location and retry where GPS has a clear signal.');
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Allow background location so your 4-hour Live Drive session can continue.');
  }
}

export async function hasLiveDriveRuntimeAccess() {
  try {
    const [foreground, background, servicesEnabled] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Location.hasServicesEnabledAsync(),
    ]);
    if (
      !servicesEnabled ||
      !hasPreciseForegroundPermission(foreground) ||
      background.status !== Location.PermissionStatus.GRANTED
    ) {
      return false;
    }
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return hasPreciseLocationSample(current.coords);
  } catch {
    return false;
  }
}

export async function startLiveDriveSession(
  userId: string,
  visibilityMode: LiveDriveVisibilityMode,
) {
  const session: LiveDriveSession = {
    userId,
    visibilityMode,
    expiresAt: new Date(Date.now() + LIVE_DRIVE_DURATION_MS).toISOString(),
  };
  storeSession(session);

  try {
    if (await Location.hasStartedLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME);
    }

    const initialLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const didPublishInitialPresence = await upsertLiveDrivePresence(
      session,
      initialLocation.coords,
    );
    if (!didPublishInitialPresence) {
      throw new Error('Live Drive needs a precise GPS fix before sharing can start.');
    }

    await Location.startLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15_000,
      distanceInterval: 20,
      deferredUpdatesDistance: 25,
      deferredUpdatesInterval: 30_000,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'NOXA Live Drive is active',
        notificationBody: 'Sharing your location for up to 4 hours. Select Ghost to stop.',
        notificationColor: '#C8102E',
        killServiceOnDestroy: true,
      },
    });
    return session;
  } catch (error) {
    storeSession(null);
    await stopNativeLocationUpdates().catch(() => undefined);
    try {
      await deleteLiveDrivePresence(userId, session.expiresAt);
    } catch {
      queuePresenceCleanup(session);
    }
    throw error;
  }
}

export async function updateLiveDriveVisibility(visibilityMode: LiveDriveVisibilityMode) {
  const session = getLiveDriveSession();
  if (!session) throw new Error('Live Drive session is no longer active.');
  const updated = { ...session, visibilityMode };
  storeSession(updated);
  return updated;
}

export async function stopLiveDriveSession(deletePresence = true) {
  const session = readStoredSession();
  storeSession(null);
  await stopNativeLocationUpdates().catch(() => undefined);
  if (!deletePresence || !session?.userId) return;

  try {
    await deleteLiveDrivePresence(session.userId, session.expiresAt);
    const pending = readPendingCleanup();
    if (
      pending?.userId === session.userId &&
      pending.shareExpiresAt === session.expiresAt
    ) {
      storePendingCleanup(null);
    }
  } catch {
    queuePresenceCleanup(session);
  }
}
