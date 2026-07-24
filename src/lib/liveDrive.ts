import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { supabase } from '@/src/lib/supabase';

export const LIVE_DRIVE_TASK_NAME = 'noxa-live-drive-location-v1';
export const LIVE_DRIVE_DURATION_MS = 4 * 60 * 60 * 1000;

const LIVE_DRIVE_SESSION_KEY = 'noxa.live-drive-session.v1';

export type LiveDriveVisibilityMode = 'crew' | 'friends' | 'global';

export type LiveDriveSession = {
  userId: string;
  visibilityMode: LiveDriveVisibilityMode;
  expiresAt: string;
};

type LiveDriveTaskData = {
  locations?: Location.LocationObject[];
};

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

function finiteOrNull(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function stopNativeLocationUpdates() {
  if (await Location.hasStartedLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME);
  }
}

async function expireSession(session: LiveDriveSession) {
  storeSession(null);
  await stopNativeLocationUpdates().catch(() => undefined);
  await supabase.from('driver_locations').delete().eq('user_id', session.userId);
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

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user.id !== session.userId) {
        await expireSession(session);
        return;
      }

      const latitude = finiteOrNull(latestLocation.coords.latitude);
      const longitude = finiteOrNull(latestLocation.coords.longitude);
      if (
        latitude === null ||
        longitude === null ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return;
      }

      const heading = finiteOrNull(latestLocation.coords.heading);
      const speed = finiteOrNull(latestLocation.coords.speed);
      const accuracy = finiteOrNull(latestLocation.coords.accuracy);
      await supabase.from('driver_locations').upsert(
        {
          user_id: session.userId,
          latitude,
          longitude,
          heading: heading !== null && heading >= 0 && heading < 360 ? heading : null,
          speed_mps: speed !== null && speed >= 0 ? speed : null,
          accuracy_meters: accuracy !== null && accuracy >= 0 ? accuracy : null,
          visibility_mode: session.visibilityMode,
          share_expires_at: session.expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    },
  );
}

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
  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Allow location while using NOXA to start Live Drive.');
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Allow background location so your 4-hour Live Drive session can continue.');
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
  if (deletePresence && session?.userId) {
    await supabase.from('driver_locations').delete().eq('user_id', session.userId);
  }
}
