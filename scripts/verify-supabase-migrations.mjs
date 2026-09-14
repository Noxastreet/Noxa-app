import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve('supabase/migrations');
const files = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const migrationPattern = /^(\d{14})_(.+)\.sql$/;
const versions = new Set();
const names = new Map();

for (const file of files) {
  const match = file.match(migrationPattern);
  if (!match) {
    throw new Error(`Invalid migration filename: ${file}`);
  }

  const [, version, name] = match;
  if (versions.has(version)) {
    throw new Error(`Duplicate migration version: ${version}`);
  }
  versions.add(version);

  if (names.has(name)) {
    throw new Error(`Duplicate migration name: ${name}`);
  }
  names.set(name, file);
}

const required = [
  'create_profiles',
  'create_vehicles',
  'create_follows',
  'create_events',
  'add_event_coordinates',
  'create_driver_locations',
  'add_moderation_and_blocks',
  'add_push_notifications',
  'harden_push_device_registration',
  'restrict_push_device_client_writes',
  'add_live_drive_background_sharing',
  'create_prelaunch_waitlist',
  'group_drive_phase_1',
  'complete_remote_push_dispatch',
  'remove_duplicate_activity_notification_triggers',
  'add_group_drive_invitation_notifications',
  'harden_driver_location_defaults_and_freshness',
];

for (const name of required) {
  if (!names.has(name)) {
    throw new Error(`Missing required migration: ${name}`);
  }
}

const indexOf = (name) => files.indexOf(names.get(name));
const before = (first, second) => {
  if (indexOf(first) >= indexOf(second)) {
    throw new Error(
      `Migration dependency order is invalid: ${names.get(first)} must run before ${names.get(second)}`,
    );
  }
};

before('create_profiles', 'create_vehicles');
before('create_profiles', 'create_follows');
before('create_profiles', 'create_events');
before('create_events', 'add_event_coordinates');
before('create_profiles', 'create_driver_locations');
before('create_driver_locations', 'add_live_drive_background_sharing');
before('add_moderation_and_blocks', 'add_push_notifications');
before('add_push_notifications', 'harden_push_device_registration');
before('harden_push_device_registration', 'restrict_push_device_client_writes');
before('add_push_notifications', 'complete_remote_push_dispatch');
before('complete_remote_push_dispatch', 'remove_duplicate_activity_notification_triggers');
before('remove_duplicate_activity_notification_triggers', 'add_group_drive_invitation_notifications');
before('group_drive_phase_1', 'add_group_drive_invitation_notifications');
before('add_live_drive_background_sharing', 'harden_driver_location_defaults_and_freshness');

console.log(`Supabase migration contract OK (${files.length} migrations).`);
