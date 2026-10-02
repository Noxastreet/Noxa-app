import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const map = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const push = fs.readFileSync('src/lib/pushNotifications.ts', 'utf8');
const editor = fs.readFileSync('app/event-editor.tsx', 'utf8');
const detail = fs.readFileSync('src/features/crews-events/CanonicalEventDetailScreen.tsx', 'utf8');
const eventExperience = fs.readFileSync('src/lib/eventExperience.ts', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20261002154500_expand_event_categories.sql',
  'utf8',
);

assert(
  /nextState === "inactive" \|\| nextState === "background"[\s\S]*startLiveDriveBackgroundUpdates\(\)/.test(map)
    && /nextState === "active"[\s\S]*stopLiveDriveBackgroundUpdates\(\)/.test(map),
  'Personal map presence must continue through the dedicated background task while the app is minimized.',
);
assert(
  /id: "global"[\s\S]*label: "Public"/.test(map),
  'The public visibility choice must be presented as Public.',
);
assert(
  /Ghost mode · Location sharing off/.test(map)
    && /setShowGhostToast\(false\)/.test(map),
  'Ghost state must use a temporary compact notice without enabling Public automatically.',
);

const reminderStart = push.indexOf('export async function syncUpcomingEventReminders');
const reminderEnd = push.indexOf('async function registerExpoToken', reminderStart);
const reminderSection = reminderStart >= 0 && reminderEnd > reminderStart
  ? push.slice(reminderStart, reminderEnd)
  : '';

assert(
  reminderSection.includes(".from('saved_events')"),
  'Event reminders must source explicit saved events.',
);
assert(
  reminderSection.includes(".eq('creator_id', userId)"),
  'Event reminders must include events organized by the current user.',
);
assert(
  !reminderSection.includes(".from('event_attendees')"),
  'RSVP/attendance alone must never schedule an event reminder.',
);
assert(
  /registerCurrentPushDevice\(\)[\s\S]*Notifications\.getPermissionsAsync\(\)/.test(push),
  'Main-tab push registration must check permission without automatically prompting.',
);
assert(
  /requestAndRegisterCurrentPushDevice/.test(detail)
    && /syncUpcomingEventReminders\(currentUserId\)/.test(detail),
  'Saving/removing an event must resync reminder scheduling.',
);
assert(
  /requestAndRegisterCurrentPushDevice/.test(editor),
  'Event organizers must register/sync reminders after saving an event.',
);

for (const category of ['drift', 'drag', 'rally', 'offroad', 'show']) {
  assert(
    eventExperience.includes(`"${category}"`),
    `Shared event taxonomy must include ${category}.`,
  );
  assert(
    editor.includes(`value: "${category}"`),
    `Event editor must offer ${category}.`,
  );
  assert(
    migration.includes(`'${category}'`),
    `Database constraint must allow ${category}.`,
  );
}

if (!process.exitCode) {
  console.log('Release privacy, reminder and event taxonomy contract passed.');
}
