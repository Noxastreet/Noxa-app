#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const migrationPath = path.join(
  repoRoot,
  'supabase/migrations/20260819080201_group_drive_phase_1.sql',
);
const sql = fs.readFileSync(migrationPath, 'utf8');

const failures = [];

function requireMatch(label, pattern) {
  if (!pattern.test(sql)) failures.push(`missing: ${label}`);
}

function forbidMatch(label, pattern) {
  if (pattern.test(sql)) failures.push(`forbidden: ${label}`);
}

const tables = [
  'drive_sessions',
  'drive_stops',
  'drive_participants',
  'drive_invitations',
  'drive_location_state',
];

for (const table of tables) {
  requireMatch(
    `public.${table}`,
    new RegExp(`create table public\\.${table}\\s*\\(`, 'i'),
  );
  requireMatch(
    `RLS on public.${table}`,
    new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
  );
  requireMatch(
    `anon/authenticated revoke on public.${table}`,
    new RegExp(
      `revoke all on table public\\.${table} from anon, authenticated`,
      'i',
    ),
  );
}

const requiredRpcNames = [
  'noxa_create_drive_session',
  'noxa_update_drive_details',
  'noxa_set_drive_route',
  'noxa_invite_user_to_drive',
  'noxa_invite_crew_to_drive',
  'noxa_respond_to_drive_invitation',
  'noxa_cancel_drive_invitation',
  'noxa_start_drive',
  'noxa_cancel_drive',
  'noxa_end_drive',
  'noxa_leave_drive',
  'noxa_remove_drive_participant',
  'noxa_get_drive_invitation_preview',
  'noxa_list_my_group_drives',
  'noxa_get_drive_summary',
];

for (const rpc of requiredRpcNames) {
  requireMatch(
    `authenticated RPC ${rpc}`,
    new RegExp(`grant execute on function public\\.${rpc}\\([\\s\\S]*?to authenticated;`, 'i'),
  );
}

requireMatch(
  'eight-hour server cap',
  /active_expires_at\s*=\s*now\(\)\s*\+\s*interval '8 hours'/i,
);
requireMatch(
  'accepted participants become active atomically',
  /update public\.drive_participants[\s\S]*?set status = 'active'[\s\S]*?status = 'accepted'/i,
);
requireMatch(
  'pending invitations cancel atomically on start',
  /update public\.drive_invitations[\s\S]*?set status = 'cancelled'[\s\S]*?status = 'invited'/i,
);
requireMatch(
  'terminal session location deletion',
  /delete from public\.drive_location_state[\s\S]*?where drive_session_id = new\.id/i,
);
requireMatch(
  'participant exit location deletion',
  /delete from public\.drive_location_state[\s\S]*?user_id = new\.user_id/i,
);
requireMatch(
  'active participant location gate',
  /private\.noxa_is_active_drive_participant\(drive_session_id\)/i,
);
requireMatch(
  'blocking restrictive participant policy',
  /create policy drive_participants_blocks_hide[\s\S]*?as restrictive/i,
);
requireMatch(
  'blocking restrictive invitation policy',
  /create policy drive_invitations_blocks_hide[\s\S]*?as restrictive/i,
);
requireMatch(
  'blocking restrictive location policy',
  /create policy drive_location_state_blocks_hide[\s\S]*?as restrictive/i,
);
requireMatch(
  'expiry primitive is private',
  /create or replace function private\.noxa_expire_group_drives\(\)/i,
);

const previewStart = sql.indexOf(
  'create or replace function public.noxa_get_drive_invitation_preview',
);
const previewEnd = sql.indexOf(
  'create or replace function public.noxa_list_my_group_drives',
  previewStart,
);
const previewSql = sql.slice(previewStart, previewEnd);

if (previewStart < 0 || previewEnd < 0) {
  failures.push('unable to isolate invitation preview RPC');
} else {
  if (/destination\.(latitude|longitude)/i.test(previewSql)) {
    failures.push('invitation preview exposes destination coordinates');
  }
  if (/drive_sessions\.route_geometry/i.test(previewSql)) {
    failures.push('invitation preview exposes route geometry');
  }
  if (/drive_location_state/i.test(previewSql)) {
    failures.push('invitation preview reads live location state');
  }
}

forbidMatch('exact speed storage', /\bspeed_mps\b/i);
forbidMatch(
  'personal Live Drive mutation',
  /(?:alter|update|delete from|insert into|drop)\s+(?:table\s+)?public\.driver_locations/i,
);
forbidMatch(
  'Events mutation',
  /(?:alter|update|delete from|insert into|drop)\s+(?:table\s+)?public\.events\b/i,
);
forbidMatch(
  'Crew Convoy mutation',
  /(?:alter|update|delete from|insert into|drop)\s+(?:table\s+)?public\.crew_convoys\b/i,
);
forbidMatch(
  'anonymous function execution grant',
  /grant execute on function[\s\S]*?\bto\s+(?:public|anon)\b/i,
);
forbidMatch('Phase 1 cron scheduling', /cron\.schedule|pg_cron/i);
forbidMatch(
  'direct durable table writes',
  /grant\s+(?:insert|update|delete)[^;]*public\.(?:drive_sessions|drive_stops|drive_participants|drive_invitations)/i,
);
forbidMatch(
  'client deletion of exact location',
  /grant[^;]*delete[^;]*public\.drive_location_state/i,
);

if (failures.length > 0) {
  console.error('Group Drive Phase 1 static contract: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Group Drive Phase 1 static contract: PASS');
console.log(`Verified ${tables.length} isolated RLS tables and ${requiredRpcNames.length} authenticated RPCs.`);
