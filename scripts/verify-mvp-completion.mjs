import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

const paths = {
  primaryMigration: 'supabase/migrations/20260827090000_add_primary_vehicle.sql',
  clearLocationMigration: 'supabase/migrations/20260827091000_group_drive_clear_my_location.sql',
  meetMigration: 'supabase/migrations/20260827092000_default_car_meet_duration.sql',
  crewMigration: 'supabase/migrations/20260827093000_crew_join_request_ui_compat.sql',
  garage: 'app/(tabs)/garage.tsx',
  profile: 'app/(tabs)/profile.tsx',
  settings: 'app/settings.tsx',
  groupLocation: 'src/features/group-drive/runtime/nativeLocation.ts',
  eas: 'eas.json',
};

for (const file of Object.values(paths)) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requirePattern = (label, text, pattern) => {
  if (!pattern.test(text)) failures.push(label);
};

if (!failures.length) {
  const primary = read(paths.primaryMigration);
  const clearLocation = read(paths.clearLocationMigration);
  const meet = read(paths.meetMigration);
  const crew = read(paths.crewMigration);
  const garage = read(paths.garage);
  const profile = read(paths.profile);
  const settings = read(paths.settings);
  const groupLocation = read(paths.groupLocation);
  const eas = read(paths.eas);

  // Garage primary vehicle invariant.
  requirePattern('primary vehicle column missing', primary, /add column if not exists is_primary boolean not null default false/i);
  requirePattern('one-primary unique index missing', primary, /create unique index[\s\S]*vehicles_one_primary_per_owner_idx[\s\S]*where is_primary = true/i);
  requirePattern('primary selection RPC missing', primary, /create or replace function public\.noxa_set_primary_vehicle\(target_vehicle_id uuid\)/i);
  requirePattern('primary selection RPC does not bind vehicle to auth actor', primary, /target_owner <> actor/i);
  requirePattern('first vehicle primary trigger missing', primary, /noxa_vehicles_assign_primary_after_insert/i);
  requirePattern('deleted primary reassignment trigger missing', primary, /noxa_vehicles_reassign_primary_after_delete/i);
  requirePattern('Garage does not select primary vehicle', garage, /is_primary/);
  requirePattern('Garage does not order primary vehicle first', garage, /\.order\('is_primary', \{ ascending: false \}\)/);
  requirePattern('Garage does not use protected primary RPC', garage, /supabase\.rpc\('noxa_set_primary_vehicle'/);
  requirePattern('Profile does not query primary vehicle', profile, /select\([^\n]*is_primary/);
  requirePattern('Profile does not order primary vehicle first', profile, /\.order\('is_primary', \{ ascending: false \}\)/);

  // Pre-signout exact-location privacy cleanup.
  requirePattern('authenticated self-location cleanup RPC missing', clearLocation, /create or replace function public\.noxa_clear_my_drive_location/);
  requirePattern('self-location cleanup is not actor-scoped', clearLocation, /user_id = actor/);
  if (/delete from public\.drive_location_state[\s\S]*user_id\s*<>|target_user_id|delete from public\.drive_location_state\s*;/.test(clearLocation)) {
    failures.push('self-location cleanup may delete another participant location');
  }
  const pauseIndex = groupLocation.indexOf('await stopNativeLocationUpdates()');
  const cleanupRpcIndex = groupLocation.indexOf("supabase.rpc('noxa_clear_my_drive_location'");
  const finalClearIndex = groupLocation.lastIndexOf('storeSession(null)');
  if (!(pauseIndex >= 0 && cleanupRpcIndex > pauseIndex && finalClearIndex > cleanupRpcIndex)) {
    failures.push('pre-signout cleanup must pause writer, delete server row, then forget local session');
  }
  requirePattern('pre-signout cleanup does not preserve retry state on failure', groupLocation, /if \(error \|\| data !== true\)[\s\S]*storeSession\(storedSession\)[\s\S]*throw new Error/);
  for (const [label, text] of [['Settings', settings], ['Profile', profile]]) {
    const clearIndex = text.indexOf('clearGroupDriveLocationBeforeSignOut()');
    const signOutIndex = text.indexOf("supabase.auth.signOut({ scope: 'local' })");
    if (!(clearIndex >= 0 && signOutIndex > clearIndex)) {
      failures.push(`${label} must clear Group Drive exact location before auth sign-out`);
    }
  }

  // Car Meet canonical default duration.
  requirePattern('Car Meet 3h backfill missing', meet, /category = 'meet'[\s\S]*starts_at \+ interval '3 hours'/i);
  requirePattern('Car Meet 3h default trigger missing', meet, /if new\.category = 'meet' and new\.ends_at is null[\s\S]*new\.ends_at := new\.starts_at \+ interval '3 hours'/i);

  // Crew approval request compatibility remains narrow and actor-scoped.
  requirePattern('Crew approval INSERT grant is not column-scoped', crew, /grant insert \(crew_id, user_id, status\) on table public\.crew_join_requests to authenticated/i);
  requirePattern('Crew approval INSERT policy missing actor binding', crew, /user_id = \(select auth\.uid\(\)\)/i);
  requirePattern('Crew approval INSERT policy missing pending restriction', crew, /status = 'pending'/i);
  requirePattern('Crew approval INSERT policy missing approval-only restriction', crew, /join_policy = 'approval'/i);
  requirePattern('Crew approval cancel policy missing own pending restriction', crew, /for delete[\s\S]*user_id = \(select auth\.uid\(\)\)[\s\S]*status = 'pending'/i);
  if (/grant update on table public\.crew_join_requests to authenticated/i.test(crew)) {
    failures.push('Crew approval compatibility must not grant direct UPDATE');
  }

  // Acceptance builds must be pinned to Group Drive staging, never production.
  requirePattern('MVP staging EAS profile missing', eas, /"mvp-staging"\s*:/);
  requirePattern('MVP staging profile is not a development client', eas, /"mvp-staging"[\s\S]*"developmentClient"\s*:\s*true/);
  requirePattern('MVP staging profile does not target staging Supabase URL', eas, /https:\/\/eawmryofqonnaihlzeiw\.supabase\.co/);
  requirePattern('MVP staging profile missing publishable staging key', eas, /"EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"\s*:\s*"sb_publishable_/);

  // This release-prep branch must never hard-code or target production Supabase.
  for (const [label, text] of [
    ['primary migration', primary],
    ['location cleanup migration', clearLocation],
    ['Car Meet migration', meet],
    ['Crew migration', crew],
    ['Garage', garage],
    ['Profile', profile],
    ['Settings', settings],
    ['EAS staging profile', eas],
  ]) {
    if (/wzfpwuyyaotvofdijhin|Noxa\s+production|production Supabase/i.test(text)) {
      failures.push(`${label} contains a production Supabase reference`);
    }
  }
}

if (failures.length) {
  console.error('MVP Completion verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`MVP Completion contract: PASS (${Object.keys(paths).length} files)`);
