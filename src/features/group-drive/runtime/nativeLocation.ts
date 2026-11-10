import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { supabase } from '@/src/lib/supabase';

import { loadActiveDriveRealtimeSnapshot } from './realtime';

export const GROUP_DRIVE_LOCATION_TASK_NAME = 'noxa-group-drive-location-v1';

const GROUP_DRIVE_LOCATION_SESSION_KEY = 'noxa.group-drive-location-session.v1';
const GROUP_DRIVE_SIGNOUT_CLEANUP_KEY = 'noxa.group-drive-signout-cleanup.v1';
const GROUP_DRIVE_CONSENT_SCOPE = 'group-drive-precise-location-v1' as const;
const CONSENT_MAX_AGE_MS = 10 * 60 * 1000;
const PRECISE_LOCATION_MAX_ACCURACY_METERS = 1000;

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

let runtimeGeneration = 0;
let locationPublishQueue: Promise<unknown> = Promise.resolve();
let locationStartInProgress = false;
let signOutCleanupInProgress = false;

function ownsSession(session: GroupDriveLocationSession, generation: number) {
  const current = readStoredSession();
  return generation === runtimeGeneration
    && current?.userId === session.userId
    && current.driveSessionId === session.driveSessionId
    && current.consentedAt === session.consentedAt
    && current.activeExpiresAt === session.activeExpiresAt;
}

function readStoredSession(storageKey = GROUP_DRIVE_LOCATION_SESSION_KEY): GroupDriveLocationSession | null {
  try {
    const raw = localStorage.getItem(storageKey);
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
      localStorage.removeItem(storageKey);
      return null;
    }
    return parsed as GroupDriveLocationSession;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

function storeSession(session: GroupDriveLocationSession | null, storageKey = GROUP_DRIVE_LOCATION_SESSION_KEY) {
  if (session) {
    localStorage.setItem(storageKey, JSON.stringify(session));
  } else {
    localStorage.removeItem(storageKey);
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
    accuracy !== null
    && accuracy >= 0
    && accuracy < PRECISE_LOCATION_MAX_ACCURACY_METERS
  );
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
  runtimeGeneration += 1;
  storeSession(null);
  await stopNativeLocationUpdates().catch(() => undefined);
}

async function clearRemoteLocationAndRuntime(
  session: GroupDriveLocationSession,
) {
  const { data, error } = await supabase.rpc('noxa_clear_my_drive_location', {
    target_drive_session_id: session.driveSessionId,
  });
  if (error || data !== true) return false;
  await clearLocalRuntime();
  return true;
}

async function publishLocationNow(
  session: GroupDriveLocationSession,
  location: Location.LocationObject,
  generation: number,
): Promise<GroupDriveLocationPublishResult> {
  if (!ownsSession(session, generation)) return 'revoked';
  if (Date.now() >= Date.parse(session.activeExpiresAt)) {
    await clearLocalRuntime();
    return 'revoked';
  }

  if (!hasPreciseLocationSample(location.coords)) return 'retry';

  const { data: authData, error: authError } = await supabase.auth.getSession();
  // Stop or a newer consent can invalidate this callback while auth is pending.
  if (!ownsSession(session, generation)) return 'revoked';
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

function publishLocation(
  session: GroupDriveLocationSession,
  location: Location.LocationObject,
): Promise<GroupDriveLocationPublishResult> {
  const generation = runtimeGeneration;
  const publish = locationPublishQueue.then(() => publishLocationNow(session, location, generation));
  locationPublishQueue = publish.catch(() => undefined);
  return publish;
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

      const foreground = await Location.getForegroundPermissionsAsync().catch(
        () => null,
      );
      if (
        !foreground
        || !hasPreciseForegroundPermission(foreground)
        || !hasPreciseLocationSample(latestLocation.coords)
      ) {
        // Do not publish an approximate coordinate. Clear the previous exact
        // server row first; if the network is unavailable, keep the task alive
        // so the next callback can retry the privacy cleanup.
        await clearRemoteLocationAndRuntime(session).catch(() => false);
        return;
      }

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
  if (!hasPreciseForegroundPermission(foreground)) {
    throw new Error('Precise location is required for Group Drive. Enable precise location in system settings.');
  }

  // Expo 54 cannot expose iOS accuracyAuthorization. Fail closed using the
  // delivered uncertainty radius before background sharing is requested.
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  if (!hasPreciseLocationSample(current.coords)) {
    throw new Error('Precise location is unavailable. Enable Precise Location and retry where GPS has a clear signal.');
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
    !hasPreciseForegroundPermission(foreground)
    || background.status !== Location.PermissionStatus.GRANTED
  ) {
    throw new Error('Precise location permission is not granted for this Group Drive.');
  }
}

async function beginGroupDriveLocationSession(consent: GroupDriveLocationConsent) {
  const generation = runtimeGeneration;
  const assertCurrentStart = () => {
    if (generation !== runtimeGeneration) {
      throw new Error('Group Drive location sharing was cancelled.');
    }
  };
  if (!validConsent(consent)) {
    throw new Error('Confirm Group Drive location sharing before starting it.');
  }
  await assertPermissionsAlreadyGranted();
  assertCurrentStart();

  const [{ data: authData, error: authError }, snapshot] = await Promise.all([
    supabase.auth.getUser(),
    loadActiveDriveRealtimeSnapshot(consent.driveSessionId),
  ]);
  assertCurrentStart();
  if (authError || !authData.user) throw new Error('Sign in again to share Group Drive location.');
  if (readStoredSession(`${GROUP_DRIVE_SIGNOUT_CLEANUP_KEY}:${authData.user.id}`)) {
    throw new Error('Retry Group Drive sign out to finish location cleanup before sharing again.');
  }
  if (!snapshot.activeExpiresAt || Date.now() >= Date.parse(snapshot.activeExpiresAt)) {
    throw new Error('This Group Drive is no longer active.');
  }

  const session: GroupDriveLocationSession = {
    driveSessionId: consent.driveSessionId,
    userId: authData.user.id,
    activeExpiresAt: snapshot.activeExpiresAt,
    consentedAt: consent.acceptedAt,
  };

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    assertCurrentStart();
    if (!hasPreciseLocationSample(current.coords)) {
      throw new Error('Group Drive needs a precise GPS fix before location sharing can start.');
    }

    storeSession(session);
    if (await Location.hasStartedLocationUpdatesAsync(GROUP_DRIVE_LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(GROUP_DRIVE_LOCATION_TASK_NAME);
    }
    assertCurrentStart();

    const initialPublish = await publishLocation(session, current);
    if (initialPublish === 'revoked') {
      throw new Error('Group Drive location access is no longer available.');
    }
    assertCurrentStart();

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
    if (generation !== runtimeGeneration) {
      await stopNativeLocationUpdates().catch(() => undefined);
      assertCurrentStart();
    }
    return session;
  } catch (error) {
    if (generation === runtimeGeneration) await clearLocalRuntime();
    throw error;
  }
}

export async function startGroupDriveLocationSession(consent: GroupDriveLocationConsent) {
  if (signOutCleanupInProgress) throw new Error('Group Drive sign out is still finishing. Retry shortly.');
  if (locationStartInProgress) throw new Error('Group Drive location startup is still finishing. Retry shortly.');
  locationStartInProgress = true;
  try {
    return await beginGroupDriveLocationSession(consent);
  } finally {
    locationStartInProgress = false;
  }
}

export async function stopGroupDriveLocationSession() {
  await clearLocalRuntime();
  // An issued request cannot be unsent. Final server cleanup must run after it.
  await locationPublishQueue;
}

export async function clearGroupDriveLocationBeforeSignOut() {
  if (signOutCleanupInProgress) throw new Error('Group Drive sign out is still finishing. Retry shortly.');
  signOutCleanupInProgress = true;
  const storedSession = readStoredSession();
  const stopping = stopGroupDriveLocationSession();
  try {
    // Retry information is not consent: a failed logout must never restore the
    // writer's session. Scope it to the account, including across app restarts.
    if (storedSession) {
      storeSession(storedSession, `${GROUP_DRIVE_SIGNOUT_CLEANUP_KEY}:${storedSession.userId}`);
    }
    // Also cancel a startup which has not stored its session yet.
    await stopping;
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;
    const userId = authData.session?.user.id;
    if (!userId) {
      if (storedSession) throw new Error('Sign in again to clear Group Drive location.');
      return;
    }
    const cleanupKey = `${GROUP_DRIVE_SIGNOUT_CLEANUP_KEY}:${userId}`;
    const pending = readStoredSession(cleanupKey);
    if (!pending || pending.userId !== userId) return;
    const { data, error } = await supabase.rpc('noxa_clear_my_drive_location', {
      target_drive_session_id: pending.driveSessionId,
    });
    if (error || data !== true) {
      throw new Error('Group Drive location could not be cleared before sign out.');
    }
    storeSession(null, cleanupKey);
  } finally {
    signOutCleanupInProgress = false;
  }
}
