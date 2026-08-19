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
  'noxa_upsert_drive_location',
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
  'optional session Crew context can clear on Crew deletion',
  /old\.crew_id is not null[\s\S]*?new\.crew_id is null[\s\S]*?return new;/i,
);
requireMatch(
  'optional invitation Crew source can clear on Crew deletion',
  /old\.source_crew_id is not null and new\.source_crew_id is null/i,
);
requireMatch(
  'session cascade can delete immutable route stops',
  /session_status is null and tg_op = 'DELETE'[\s\S]*?return old;/i,
);
requireMatch(
  'active participant location gate',
  /private\.noxa_is_active_drive_participant\(drive_session_id\)/i,
);
requireMatch(
  'opaque Realtime deletion primary key',
  /create table public\.drive_location_state\s*\(\s*id uuid primary key default gen_random_uuid\(\)/i,
);
requireMatch(
  'one current location row per participant',
  /constraint drive_location_state_session_user_key\s+unique \(drive_session_id, user_id\)/i,
);
requireMatch(
  'serialized location upsert session lock',
  /create or replace function public\.noxa_upsert_drive_location[\s\S]*?from public\.drive_sessions[\s\S]*?for share;/i,
);
requireMatch(
  'serialized location upsert participant lock',
  /create or replace function public\.noxa_upsert_drive_location[\s\S]*?from public\.drive_participants[\s\S]*?for share;/i,
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
requireMatch(
  'service role can resolve the private expiry primitive',
  /grant usage on schema private to service_role/i,
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
  'direct client writes to exact location',
  /grant\s+(?:insert|update|delete|select\s*,\s*insert|select\s*,\s*update)[^;]*public\.drive_location_state/i,
);

if (failures.length > 0) {
  console.error('Group Drive Phase 1 static contract: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Group Drive Phase 1 static contract: PASS');
console.log(`Verified ${tables.length} isolated RLS tables and ${requiredRpcNames.length} authenticated RPCs.`);
