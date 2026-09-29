#!/usr/bin/env node

import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const migration = fs.readFileSync(
  'supabase/migrations/20260929103000_quick_connect_friends.sql',
  'utf8',
);
const api = fs.readFileSync('src/features/quick-connect/api.ts', 'utf8');
const screen = fs.readFileSync('app/quick-connect.tsx', 'utf8');
const root = fs.readFileSync('app/_layout.tsx', 'utf8');
const appConfig = fs.readFileSync('app.json', 'utf8');
const crews = fs.readFileSync(
  'src/features/crews-events/CanonicalCrewsScreen.tsx',
  'utf8',
);
const profile = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');
const driveTogether = fs.readFileSync(
  'src/features/group-drive/DriveTogetherMapLayer.tsx',
  'utf8',
);

assert(
  /expires_at timestamptz not null default \(now\(\) \+ interval '5 minutes'\)/.test(migration)
    && /owner_unique/.test(migration)
    && /token_unique/.test(migration)
    && /code_unique/.test(migration),
  'Quick Connect sessions must be short-lived and one-at-a-time per owner.',
);
assert(
  /enable row level security/.test(migration)
    && /revoke all on table public\.friend_connect_sessions from public, anon, authenticated/.test(migration),
  'Quick Connect session storage must not be directly readable by clients.',
);
assert(
  /private\.noxa_users_blocked/.test(migration)
    && /insert into public\.follows[\s\S]*\(actor, target_session\.owner_id\)[\s\S]*\(target_session\.owner_id, actor\)/.test(migration)
    && /delete from public\.friend_connect_sessions[\s\S]*target_session\.id/.test(migration),
  'Redeem must respect blocks, create reciprocal follows, and consume the handshake.',
);
assert(
  /quickConnectQrPayload/.test(api)
    && /noxa:\/\/quick-connect\//.test(api)
    && /noxa_resolve_friend_connect/.test(api)
    && /noxa_redeem_friend_connect/.test(api),
  'Quick Connect client API must support token QR, preview, and redeem.',
);
assert(
  /CameraView/.test(screen)
    && /barcodeTypes: \['qr'\]/.test(screen)
    && /react-native-qrcode-svg/.test(screen)
    && /ADD FRIEND/.test(screen)
    && /alreadyFriends/.test(screen),
  'Quick Connect UI must include local QR rendering, camera scanning, preview, and explicit confirmation.',
);
assert(
  !/expo-location|driver_locations|watchPosition/.test(screen),
  'Quick Connect must not use or expose location.',
);
assert(
  /QuickConnectDeepLinkBridge/.test(root)
    && /pathname: '\/quick-connect'/.test(root)
    && root.includes('^noxa:\\/\\/quick-connect\\/'),
  'Quick Connect QR deep links must route into the authenticated app flow.',
);
assert(
  /expo-camera/.test(appConfig)
    && /scan Quick Connect QR codes/.test(appConfig),
  'Camera permission must be scoped to Quick Connect scanning.',
);
assert(
  !/accessibilityLabel="Quick Connect"/.test(crews)
    && !/pathname: "\/quick-connect"/.test(crews),
  'Crew chrome must stay Crew-specific and must not own the global Quick Connect action.',
);
assert(
  /accessibilityLabel="Quick Connect"/.test(profile)
    && /pathname: '\/quick-connect'/.test(profile)
    && /mode: 'share'/.test(profile),
  'Profile must expose Quick Connect as a global social identity action.',
);
assert(
  /Quick add someone nearby/.test(driveTogether)
    && /returnTo: 'drive-together'/.test(driveTogether)
    && /listDriveTogetherFriends\(\)/.test(driveTogether),
  'Drive Together friend picker must support Quick Connect and refresh mutual friends on return.',
);

if (!process.exitCode) {
  console.log('Quick Connect static contract passed.');
}
