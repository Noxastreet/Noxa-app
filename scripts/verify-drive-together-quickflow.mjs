#!/usr/bin/env node

import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const migration = fs.readFileSync(
  'supabase/migrations/20260927112000_drive_together_quickflow.sql',
  'utf8',
);
const api = fs.readFileSync('src/features/group-drive/api.ts', 'utf8');
const layer = fs.readFileSync(
  'src/features/group-drive/DriveTogetherMapLayer.tsx',
  'utf8',
);
const map = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const bridge = fs.readFileSync(
  'src/features/notifications/PushNotificationBridge.tsx',
  'utf8',
);
const notifications = fs.readFileSync('app/notifications.tsx', 'utf8');

assert(
  /add column if not exists drive_mode text not null default 'planned'/.test(migration)
    && /drive_mode in \('planned', 'quick'\)/.test(migration),
  'Quick Drive must be additive to the existing drive_sessions table.',
);
assert(
  !/^as \$/m.test(migration) && !/^\$;$/m.test(migration),
  'PL/pgSQL function dollar quotes must remain balanced.',
);
assert(
  /function public\.noxa_create_quick_drive\([\s\S]*private\.noxa_users_blocked[\s\S]*public\.follows[\s\S]*drive_mode[\s\S]*'quick'/.test(migration),
  'Quick creation must preserve blocking, mutual-friend privacy, and explicit quick mode.',
);
assert(
  /function public\.noxa_respond_to_drive_invitation\([\s\S]*current_session\.drive_mode = 'quick'[\s\S]*status = 'active'[\s\S]*active_expires_at = now\(\) \+ interval '8 hours'/.test(migration),
  'Quick Join must atomically activate the existing Group Drive lifecycle.',
);
assert(
  /function public\.noxa_start_drive/.test(
    fs.readFileSync('supabase/migrations/20260819201500_group_drive_phase_1_lobby_safety.sql', 'utf8'),
  ),
  'The existing planned Group Drive start contract must remain present.',
);
assert(
  /export async function listDriveTogetherFriends/.test(api)
    && /export async function createQuickDrive/.test(api)
    && /export async function findMyActiveQuickDriveId/.test(api)
    && /export async function findMyWaitingQuickDrive/.test(api),
  'Drive Together client recovery/create APIs are incomplete.',
);
assert(
  /subscribeToActiveDriveRealtime/.test(layer)
    && /startGroupDriveLocationSession/.test(layer)
    && /groupDriveLocations/.test(layer),
  'Map quick flow must reuse existing Group Drive realtime and location runtime.',
);
assert(
  !/MapboxLiveMapCompat/.test(layer)
    && !/Location\.startLocationUpdatesAsync/.test(layer)
    && !/TaskManager\.defineTask/.test(layer),
  'Drive Together layer must not create a second MapView or GPS/background task.',
);
assert(
  /DriveTogetherMapLayer/.test(map)
    && /accessibilityLabel="Drive Together"/.test(map)
    && /setDriveTogetherOpen\(true\)/.test(map)
    && /for \(const driver of driveTogetherDrivers\) merged\.set\(driver\.user_id, driver\)/.test(map),
  'Home/Map must own the Drive Together entry and merge private participant markers.',
);
assert(
  !/accessibilityLabel="Group Drives"[\s\S]{0,300}router\.push\("\/group-drives"\)/.test(map),
  'Home/Map must not send the primary quick-drive action into the legacy wizard.',
);
assert(
  /pathname: '\/\(tabs\)'[\s\S]*driveInvitationId/.test(bridge),
  'Native drive-invitation pushes must reopen Home/Map.',
);
assert(
  /item\.kind === 'drive'[\s\S]*pathname: '\/\(tabs\)'[\s\S]*driveInvitationId/.test(notifications),
  'In-app drive invitations must reopen Home/Map.',
);
assert(
  fs.existsSync('app/group-drives/details.tsx')
    && fs.existsSync('app/group-drives/route.tsx')
    && fs.existsSync('app/group-drives/[id].tsx'),
  'Legacy planned Group Drive flow must remain available as a reversible fallback.',
);

if (!process.exitCode) {
  console.log('Drive Together quick-flow static contract passed.');
}
