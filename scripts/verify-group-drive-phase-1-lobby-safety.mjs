#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const amendmentPath = path.join(
  repoRoot,
  'supabase/migrations/20260819201500_group_drive_phase_1_lobby_safety.sql',
);
const sql = fs.readFileSync(amendmentPath, 'utf8');
const failures = [];

function requireMatch(label, pattern) {
  if (!pattern.test(sql)) failures.push(`missing: ${label}`);
}

function forbidMatch(label, pattern) {
  if (pattern.test(sql)) failures.push(`forbidden: ${label}`);
}

requireMatch('ready_at column', /alter table public\.drive_participants[\s\S]*?add column ready_at timestamptz/i);
requireMatch('readiness lifecycle constraint', /drive_participants_ready_lifecycle_check[\s\S]*?role = 'participant'[\s\S]*?status = 'accepted'/i);
requireMatch('readiness reset on plan change', /noxa_reset_drive_readiness_on_plan_change[\s\S]*?scheduled_start_at[\s\S]*?route_version/i);
requireMatch('authenticated readiness RPC', /grant execute on function public\.noxa_set_drive_ready\(uuid, boolean\)[\s\S]*?to authenticated/i);
requireMatch('readiness RPC owns caller row', /drive_participants\.user_id = actor[\s\S]*?for update/i);
requireMatch('host cannot use Ready', /host controls Start and does not use Ready/i);
requireMatch('Ready only before active', /status not in \('draft', 'scheduled'\)[\s\S]*?Lobby readiness/i);
requireMatch('Start locks accepted participant profiles deterministically', /from public\.profiles[\s\S]*?drive_participants\.status = 'accepted'[\s\S]*?order by profiles\.id[\s\S]*?for update of profiles/i);
requireMatch('Start rejects overlapping active membership', /active_participant\.user_id = candidate\.user_id[\s\S]*?active_participant\.status = 'active'[\s\S]*?active_session\.status = 'active'/i);
requireMatch('human-readable overlap error', /already active in another Group Drive/i);
requireMatch('existing 8h cap preserved', /active_expires_at = now\(\) \+ interval '8 hours'/i);
requireMatch('new public RPC execute revoked by default', /revoke all on function public\.noxa_set_drive_ready\(uuid, boolean\)[\s\S]*?from public, anon, authenticated/i);

forbidMatch('personal Live Drive table mutation', /(?:alter|update|delete from|insert into|drop)\s+(?:table\s+)?public\.driver_locations/i);
forbidMatch('Event table mutation', /(?:alter|update|delete from|insert into|drop)\s+(?:table\s+)?public\.events\b/i);
forbidMatch('Crew Convoy mutation', /(?:alter|update|delete from|insert into|drop)\s+(?:table\s+)?public\.crew_convoys\b/i);
forbidMatch('exact speed', /\bspeed_mps\b/i);
forbidMatch('readiness as participant status', /status\s*=\s*'ready'|status\s+in\s*\([^)]*'ready'/i);
forbidMatch('Ready starts location sharing', /drive_location_state|noxa_upsert_drive_location/i);
forbidMatch('new dependency or cron', /pg_cron|cron\.schedule/i);

if (failures.length) {
  console.error('Group Drive Phase 1 lobby safety contract: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Group Drive Phase 1 lobby safety contract: PASS');
console.log('Verified readiness isolation and one-active-drive Start hardening.');
