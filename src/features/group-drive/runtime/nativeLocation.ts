import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { supabase } from '@/src/lib/supabase';

import { loadActiveDriveRealtimeSnapshot } from './realtime';

export const GROUP_DRIVE_LOCATION_TASK_NAME = 'noxa-group-drive-location-v1';

const GROUP_DRIVE_LOCATION_SESSION_KEY = 'noxa.group-drive-location-session.v1';
const GROUP_DRIVE_CONSENT_SCOPE = 'group-drive-precise-location-v1' as const;
const CONSENT_MAX_AGE_MS = 10 * 60 * 1000;

type GroupDriveTaskData = {
  locations?: Location.LocationObject[];
};

export type GroupDriveLocationConsent = {
  driveSessionId: string;
  acceptedAt: string;
  scope: typeof GROUP_DRIVE_CONSENT_SCOPE;
};

export type GroupDriveLocationSession = {
  driveSessionId: string;
  userId: string;
  activeExpiresAt: string;
  consentedAt: string;
};

export type GroupDriveLocationPublishResult = 'published' | 'retry' | 'revoked';

function readStoredSession(): GroupDriveLocationSession | null {
  try {
    const raw = localStorage.getItem(GROUP_DRIVE_LOCATION_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GroupDriveLocationSession>;
    if (
      typeof parsed.driveSessionId !== 'string'
      || typeof parsed.userId !== 'string'
      || typeof parsed.activeExpiresAt !== 'string'
      || typeof parsed.consentedAt !== 'string'
      || !Number.isFinite(Date.parse(parsed.activeExpiresAt))
      || !Number.isFinite(Date.parse(parsed.consentedAt))
    ) {
      localStorage.removeItem(GROUP_DRIVE_LOCATION_SESSION_KEY);
      return null;
    }
    return parsed as GroupDriveLocationSession;
  } catch {
    localStorage.removeItem(GROUP_DRIVE_LOCATION_SESSION_KEY);
    return null;
  }
}

function storeSession(session: GroupDriveLocationSession | null) {
  if (session) {
    localStorage.setItem(GROUP_DRIVE_LOCATION_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(GROUP_DRIVE_LOCATION_SESSION_KEY);
  }
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function validConsent(consent: GroupDriveLocationConsent) {
  const acceptedAt = Date.parse(consent.acceptedAt);
  return (
    consent.scope === GROUP_DRIVE_CONSENT_SCOPE
    && consent.driveSessionId.length > 0
    && Number.isFinite(acceptedAt)
    && acceptedAt <= Date.now()
    && Date.now() - acceptedAt <= CONSENT_MAX_AGE_MS
  );
}

function isAuthorizationFailure(error: { message?: string } | null) {
  const message = error?.message ?? '';
  return /authentication required|available only during an active session|only an active group drive participant|this group drive is unavailable/i.test(message);
}

async function stopNativeLocationUpdates() {
  if (await Location.hasStartedLocationUpdatesAsync(GROUP_DRIVE_LOCATION_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(GROUP_DRIVE_LOCATION_TASK_NAME);
  }
}

async function clearLocalRuntime() {
  storeSession(null);
  await stopNativeLocationUpdates().catch(() => undefined);
}

async function publishLocation(
  session: GroupDriveLocationSession,
  location: Location.LocationObject,
): Promise<GroupDriveLocationPublishResult> {
  if (Date.now() >= Date.parse(session.activeExpiresAt)) {
    await clearLocalRuntime();
    return 'revoked';
  }

  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError) return 'retry';
  if (authData.session?.user.id !== session.userId) {
    await clearLocalRuntime();
    return 'revoked';
  }

  const latitude = finiteOrNull(location.coords.latitude);
  const longitude = finiteOrNull(location.coords.longitude);
  if (
    latitude === null
    || longitude === null
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return 'retry';
  }

  const rawHeading = finiteOrNull(location.coords.heading);
  const heading = rawHeading !== null && rawHeading >= 0 && rawHeading < 360
    ? rawHeading
    : null;

  const { error } = await supabase.rpc('noxa_upsert_drive_location', {
    target_drive_session_id: session.driveSessionId,
    location_latitude: latitude,
    location_longitude: longitude,
    location_heading: heading,
    location_status: 'moving',
  });

  if (!error) return 'published';
  if (isAuthorizationFailure(error)) {
    await clearLocalRuntime();
    return 'revoked';
  }
  return 'retry';
}

if (!TaskManager.isTaskDefined(GROUP_DRIVE_LOCATION_TASK_NAME)) {
  TaskManager.defineTask<GroupDriveTaskData>(
    GROUP_DRIVE_LOCATION_TASK_NAME,
    async ({ data, error }) => {
      if (error) return;

      const session = readStoredSession();
      if (!session) {
        await stopNativeLocationUpdates().catch(() => undefined);
        return;
      }

      const latestLocation = data?.locations?.at(-1);
      if (!latestLocation) return;
      await publishLocation(session, latestLocation);
    },
  );
}

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') void clearLocalRuntime();
});

export function acceptGroupDriveLocationDisclosure(driveSessionId: string): GroupDriveLocationConsent {
  if (!driveSessionId) throw new Error('This Group Drive is unavailable.');
  return {
    driveSessionId,
    acceptedAt: new Date().toISOString(),
    scope: GROUP_DRIVE_CONSENT_SCOPE,
  };
}

export function getGroupDriveLocationSession() {
  const session = readStoredSession();
  if (!session) return null;
  if (Date.now() >= Date.parse(session.activeExpiresAt)) {
    void clearLocalRuntime();
    return null;
  }
  return session;
}

export async function requestGroupDriveLocationPermissions() {
  if (!(await TaskManager.isAvailableAsync())) {
    throw new Error('Group Drive background location requires a development or store build.');
  }
  if (!(await Location.isBackgroundLocationAvailableAsync())) {
    throw new Error('Background location is not available on this device.');
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Allow precise location while using NOXA to share your position in this Group Drive.');
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Allow background location so this Group Drive can keep your position current while driving.');
  }
}

async function assertPermissionsAlreadyGranted() {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  if (
    foreground.status !== Location.PermissionStatus.GRANTED
    || background.status !== Location.PermissionStatus.GRANTED
  ) {
    throw new Error('Location permission is not granted for this Group Drive.');
  }
}

export async function startGroupDriveLocationSession(consent: GroupDriveLocationConsent) {
  if (!validConsent(consent)) {
    throw new Error('Confirm Group Drive location sharing before starting it.');
  }
  await assertPermissionsAlreadyGranted();

  const [{ data: authData, error: authError }, snapshot] = await Promise.all([
    supabase.auth.getUser(),
    loadActiveDriveRealtimeSnapshot(consent.driveSessionId),
  ]);
  if (authError || !authData.user) throw new Error('Sign in again to share Group Drive location.');
  if (!snapshot.activeExpiresAt || Date.now() >= Date.parse(snapshot.activeExpiresAt)) {
    throw new Error('This Group Drive is no longer active.');
  }

  const session: GroupDriveLocationSession = {
    driveSessionId: consent.driveSessionId,
    userId: authData.user.id,
    activeExpiresAt: snapshot.activeExpiresAt,
    consentedAt: consent.acceptedAt,
  };
  storeSession(session);

  try {
    if (await Location.hasStartedLocationUpdatesAsync(GROUP_DRIVE_LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(GROUP_DRIVE_LOCATION_TASK_NAME);
    }
    await Location.startLocationUpdatesAsync(GROUP_DRIVE_LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 10,
      deferredUpdatesDistance: 15,
      deferredUpdatesInterval: 15_000,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'NOXA Group Drive is active',
        notificationBody: 'Sharing your location only with participants in this active Group Drive.',
        notificationColor: '#C8102E',
        killServiceOnDestroy: true,
      },
    });

    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const initialPublish = await publishLocation(session, current);
    if (initialPublish === 'revoked') {
      throw new Error('Group Drive location access is no longer available.');
    }
    return session;
  } catch (error) {
    await clearLocalRuntime();
    throw error;
  }
}

export async function stopGroupDriveLocationSession() {
  await clearLocalRuntime();
}
