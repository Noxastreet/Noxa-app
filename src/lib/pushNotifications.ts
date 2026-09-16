import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

export const NOXA_NOTIFICATION_CHANNEL = 'noxa_activity';
export const NOXA_APP_ID = 'com.karaketidis.noxa';

const LOCAL_EVENT_REMINDER_KIND = 'event-reminder';
const MAX_LOCAL_EVENT_REMINDERS = 8;
const ONE_HOUR_MS = 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

let lastRegisteredExpoPushToken: string | null = null;
let lastRegisteredAccessToken: string | null = null;
let pendingRegisteredExpoPushToken: string | null = null;
let pendingRegisteredAccessToken: string | null = null;
let pendingRegistration: Promise<void> | null = null;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

function easProjectId() {
  const configured = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim();
  }

  const runtime = Constants.easConfig?.projectId;
  return typeof runtime === 'string' && runtime.trim() ? runtime.trim() : null;
}

function isNativeAppRuntime() {
  return (
    Platform.OS !== 'web' &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(NOXA_NOTIFICATION_CHANNEL, {
    name: 'NOXA activity',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 180, 250],
    lightColor: '#C8102E',
  });
}

async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function removeNoxaEventReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const identifiers = scheduled
    .filter((notification) => {
      const data = notification.content.data;
      return data?.noxaKind === LOCAL_EVENT_REMINDER_KIND;
    })
    .map((notification) => notification.identifier);

  await Promise.all(
    identifiers.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier),
    ),
  );
}

function reminderDate(startsAt: string, now: number) {
  const eventStart = new Date(startsAt).getTime();
  if (!Number.isFinite(eventStart) || eventStart <= now + ONE_MINUTE_MS) {
    return null;
  }

  const preferred = eventStart - ONE_HOUR_MS;
  if (preferred > now + ONE_MINUTE_MS) {
    return new Date(preferred);
  }

  const shortNotice = eventStart - TEN_MINUTES_MS;
  if (shortNotice > now + ONE_MINUTE_MS) {
    return new Date(shortNotice);
  }

  return null;
}

export async function syncUpcomingEventReminders(userId: string) {
  if (!isNativeAppRuntime()) return;

  await removeNoxaEventReminders();

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from('event_attendees')
    .select('event_id')
    .eq('user_id', userId)
    .eq('response', 'going')
    .limit(32);

  if (attendanceError) throw attendanceError;

  const eventIds = Array.from(
    new Set((attendanceRows ?? []).map((row) => row.event_id).filter(Boolean)),
  );
  if (eventIds.length === 0) return;

  const now = Date.now();
  const { data: eventRows, error: eventError } = await supabase
    .from('events')
    .select('id,title,location_name,starts_at,status')
    .in('id', eventIds)
    .gt('starts_at', new Date(now).toISOString())
    .eq('status', 'scheduled')
    .order('starts_at', { ascending: true })
    .limit(MAX_LOCAL_EVENT_REMINDERS);

  if (eventError) throw eventError;

  for (const event of eventRows ?? []) {
    const date = reminderDate(event.starts_at, now);
    if (!date) continue;

    const trigger: Notifications.NotificationTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === 'android' ? { channelId: NOXA_NOTIFICATION_CHANNEL } : {}),
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${event.title} starts soon`,
        body: event.location_name
          ? `Get ready — ${event.location_name}`
          : 'Open NOXA for event details.',
        sound: 'default',
        data: {
          noxaKind: LOCAL_EVENT_REMINDER_KIND,
          event_id: event.id,
        },
      },
      trigger,
    });
  }
}

async function registerExpoToken(expoPushToken: string, accessToken: string) {
  if (
    lastRegisteredExpoPushToken === expoPushToken &&
    lastRegisteredAccessToken === accessToken
  ) {
    return;
  }

  if (
    pendingRegistration &&
    pendingRegisteredExpoPushToken === expoPushToken &&
    pendingRegisteredAccessToken === accessToken
  ) {
    return pendingRegistration;
  }

  const projectId = easProjectId();
  if (!projectId) {
    throw new Error('Expo project ID is missing from the app configuration.');
  }

  pendingRegisteredExpoPushToken = expoPushToken;
  pendingRegisteredAccessToken = accessToken;
  const registration = (async () => {
    const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>(
      'push-device',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          action: 'register',
          expo_push_token: expoPushToken,
          platform: Platform.OS,
          project_id: projectId,
          app_id: NOXA_APP_ID,
        },
      },
    );

    if (error || !data?.success) {
      throw new Error(data?.error ?? error?.message ?? 'Push device registration failed.');
    }

    lastRegisteredExpoPushToken = expoPushToken;
    lastRegisteredAccessToken = accessToken;
  })();
  pendingRegistration = registration;

  try {
    await registration;
  } finally {
    if (pendingRegistration === registration) {
      pendingRegistration = null;
      pendingRegisteredExpoPushToken = null;
      pendingRegisteredAccessToken = null;
    }
  }
}

export async function registerCurrentPushDevice() {
  if (!isNativeAppRuntime()) return null;

  await ensureAndroidNotificationChannel();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData.session;
  if (!session?.user) return null;

  const permissionGranted = await ensureNotificationPermission();
  if (!permissionGranted) return null;

  await syncUpcomingEventReminders(session.user.id);

  const projectId = easProjectId();
  if (!projectId) {
    throw new Error('Expo project ID is missing from the app configuration.');
  }

  const expoPushToken = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;
  await registerExpoToken(expoPushToken, session.access_token);
  return expoPushToken;
}

export async function refreshCurrentPushDevice(
  devicePushToken?: Notifications.DevicePushToken,
) {
  if (!isNativeAppRuntime()) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session?.user) return null;

  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return null;

  const projectId = easProjectId();
  if (!projectId) return null;

  const expoPushToken = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
      ...(devicePushToken ? { devicePushToken } : {}),
    })
  ).data;
  await registerExpoToken(expoPushToken, session.access_token);
  return expoPushToken;
}

export function rememberCurrentAccessToken(accessToken: string | null | undefined) {
  if (accessToken) lastRegisteredAccessToken = accessToken;
}

export async function unregisterLastPushDevice() {
  const expoPushToken = lastRegisteredExpoPushToken;
  const accessToken = lastRegisteredAccessToken;
  lastRegisteredExpoPushToken = null;
  lastRegisteredAccessToken = null;

  if (!expoPushToken || !accessToken) return;

  await supabase.functions.invoke('push-device', {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      action: 'unregister',
      expo_push_token: expoPushToken,
    },
  });
}
