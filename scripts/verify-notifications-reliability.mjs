import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const source = fs.readFileSync('app/notifications.tsx', 'utf8');

assert(
  /useCallback, useMemo, useRef, useState/.test(source),
  'Notifications must keep a request sequence ref.',
);
assert(
  /const requestIdRef = useRef\(0\)/.test(source),
  'Notifications must track the newest load request.',
);
assert(
  /const requestId = \+\+requestIdRef\.current/.test(source),
  'Each notifications load must receive a monotonic request id.',
);
assert(
  /Promise\.all\([\s\S]*listMyGroupDrives\(\)[\s\S]*\]\)/.test(source),
  'Group Drive inbox loading must run with the primary activity requests.',
);
assert(
  !/listMyGroupDrives\(\)\.catch\(\(\) => \[\]\)/.test(source),
  'Group Drive loading failures must not be translated into an empty inbox.',
);
assert(
  /if \(requestId !== requestIdRef\.current\) return;[\s\S]*setActivities\(/.test(source),
  'Only the newest request may publish activity state.',
);
assert(
  /catch \{[\s\S]*if \(requestId !== requestIdRef\.current\) return;[\s\S]*setErrorMessage/.test(source),
  'A stale failed request must not overwrite newer state with an error.',
);
assert(
  /finally \{[\s\S]*if \(requestId === requestIdRef\.current\)[\s\S]*setIsLoading\(false\)[\s\S]*setIsRefreshing\(false\)/.test(source),
  'Only the newest request may clear loading indicators.',
);

const pushBridge = fs.readFileSync('src/features/notifications/PushNotificationBridge.tsx', 'utf8');
const pushNotifications = fs.readFileSync('src/lib/pushNotifications.ts', 'utf8');
const eventChatPushMigration = fs.readFileSync(
  'supabase/migrations/20261003084115_add_event_chat_push_notifications.sql',
  'utf8',
);

assert(
  /addPushTokenListener\(\(devicePushToken\) => \{[\s\S]*refreshCurrentPushDevice\(devicePushToken\)/.test(pushBridge),
  'Push-token listener must reuse the emitted device token instead of fetching it again.',
);
assert(
  /getExpoPushTokenAsync\(\{[\s\S]*devicePushToken/.test(pushNotifications),
  'Push-token refresh must pass the emitted device token to Expo token lookup to avoid recursive listener events.',
);
assert(
  /pendingRegistration[\s\S]*pendingRegisteredExpoPushToken[\s\S]*pendingRegisteredAccessToken/.test(pushNotifications),
  'Push-device registration must deduplicate an identical in-flight registration.',
);

assert(
  /event_chat_id[\s\S]*pathname: '\/event-chat'/.test(pushBridge),
  'Event Chat push taps must open the exact Event Chat before generic event routing.',
);
assert(
  /'event_chat_message'/.test(eventChatPushMigration)
    && /after insert on public\.event_messages/.test(eventChatPushMigration)
    && /event_attendees\.user_id <> new\.sender_id/.test(eventChatPushMigration)
    && /'messages'/.test(eventChatPushMigration)
    && /'event_chat_id', new\.event_id/.test(eventChatPushMigration),
  'Event Chat messages must enqueue message-category pushes for other event participants only.',
);

if (!process.exitCode) {
  console.log('Notifications reliability contract passed.');
}
