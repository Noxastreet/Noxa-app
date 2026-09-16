import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import {
  refreshCurrentPushDevice,
  registerCurrentPushDevice,
  rememberCurrentAccessToken,
  unregisterLastPushDevice,
} from '@/src/lib/pushNotifications';
import { supabase } from '@/src/lib/supabase';

const handledResponses = new Set<string>();

function dataString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstDataString(data: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = dataString(data, key);
    if (value) return value;
  }
  return null;
}

function openNotificationResponse(response: Notifications.NotificationResponse) {
  const identifier = response.notification.request.identifier;
  if (handledResponses.has(identifier)) return;
  handledResponses.add(identifier);

  const rawData = response.notification.request.content.data;
  const data = rawData && typeof rawData === 'object'
    ? (rawData as Record<string, unknown>)
    : {};

  const eventId = firstDataString(data, 'event_id', 'eventId');
  if (eventId) {
    router.push({ pathname: '/event-details', params: { id: eventId } });
    return;
  }

  const crewId = firstDataString(data, 'crew_id', 'crewId');
  if (crewId) {
    router.push({ pathname: '/crew/[id]', params: { id: crewId } });
    return;
  }

  const postId = firstDataString(data, 'post_id', 'postId');
  if (postId) {
    router.push({ pathname: '/post-details', params: { id: postId } });
    return;
  }

  const actorId = firstDataString(data, 'actor_id', 'actorId');
  if (actorId) {
    router.push({ pathname: '/driver-profile/[id]', params: { id: actorId } });
    return;
  }

  const driveInvitationId = firstDataString(
    data,
    'drive_invitation_id',
    'driveInvitationId',
  );
  if (driveInvitationId) {
    router.push({
      pathname: '/group-drives/invitation/[id]',
      params: { id: driveInvitationId },
    });
    return;
  }

  if (firstDataString(data, 'drive_session_id', 'driveSessionId')) {
    router.push('/group-drives');
    return;
  }

  router.push('/notifications');
}

export function PushNotificationBridge() {
  useEffect(() => {
    let mounted = true;

    void registerCurrentPushDevice().catch((error) => {
      if (mounted) {
        console.warn('[noxa-push] Push setup failed.', error);
      }
    });

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (mounted && response) openNotificationResponse(response);
      })
      .catch((error) => {
        if (mounted) console.warn('[noxa-push] Unable to read launch notification.', error);
      });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      openNotificationResponse,
    );
    const tokenSubscription = Notifications.addPushTokenListener((devicePushToken) => {
      void refreshCurrentPushDevice(devicePushToken).catch((error) => {
        console.warn('[noxa-push] Push token refresh failed.', error);
      });
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      rememberCurrentAccessToken(session?.access_token);

      if (event === 'SIGNED_OUT') {
        setTimeout(() => {
          void unregisterLastPushDevice().catch((error) => {
            console.warn('[noxa-push] Push device unregister failed.', error);
          });
        }, 0);
      }
    });

    return () => {
      mounted = false;
      responseSubscription.remove();
      tokenSubscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
