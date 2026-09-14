import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const migration = fs.readFileSync(
  'supabase/migrations/20260914185251_add_group_drive_invitation_notifications.sql',
  'utf8',
);
const bridge = fs.readFileSync(
  'src/features/notifications/PushNotificationBridge.tsx',
  'utf8',
);
const pushFunction = fs.readFileSync(
  'supabase/functions/push-notification/index.ts',
  'utf8',
);

assert(
  /notifications_kind_check[\s\S]*'drive_invite'/.test(migration),
  'notifications.kind must explicitly allow drive_invite.',
);
assert(
  /create or replace function private\.noxa_notify_drive_invitation\(\)/.test(migration),
  'Group Drive invitation notification generator is missing.',
);
assert(
  /if new\.status <> 'invited' then[\s\S]*return new/.test(migration),
  'Only active invitation inserts may enqueue a Group Drive notification.',
);
assert(
  /private\.noxa_enqueue_notification\([\s\S]*new\.invited_user_id[\s\S]*new\.invited_by[\s\S]*'drive_invite'[\s\S]*'crews'/.test(migration),
  'Group Drive invitation must use the existing server-owned notification outbox and crews preference category.',
);
assert(
  /'drive_invitation_id', new\.id[\s\S]*'drive_session_id', new\.drive_session_id/.test(migration),
  'Push data must identify both invitation and drive session.',
);
assert(
  /'drive_invite:' \|\| new\.id::text/.test(migration),
  'Group Drive invitation notifications must be idempotent by invitation id.',
);
assert(
  /create trigger noxa_notify_drive_invitation_trigger[\s\S]*after insert on public\.drive_invitations/.test(migration),
  'drive_invitations must enqueue notifications after insert.',
);
assert(
  /'drive_invitation_id'[\s\S]*'driveInvitationId'/.test(bridge),
  'The native push router must accept the migration drive_invitation_id key.',
);
assert(
  /data:\s*\{[\s\S]*\.\.\.notification\.data[\s\S]*kind: notification\.kind/.test(pushFunction),
  'Remote push delivery must preserve notification.data for native routing.',
);

if (!process.exitCode) {
  console.log('Group Drive invitation push contract passed.');
}
