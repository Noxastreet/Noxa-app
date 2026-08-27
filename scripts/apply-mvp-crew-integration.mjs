import fs from 'node:fs';

function replaceExact(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`${label}: source pattern not found`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source pattern ambiguous`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

function patchApi() {
  const path = 'src/features/group-drive/api.ts';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceExact(
    text,
    `export async function createDriveSession(title: string, description: string) {\n  return rpc<string>('noxa_create_drive_session', {\n    drive_title: title.trim(),\n    drive_description: description.trim() || null,\n    context_crew_id: null,\n    drive_scheduled_start_at: null,\n  });\n}`,
    `export async function createDriveSession(\n  title: string,\n  description: string,\n  crewId: string | null = null,\n) {\n  return rpc<string>('noxa_create_drive_session', {\n    drive_title: title.trim(),\n    drive_description: description.trim() || null,\n    context_crew_id: crewId,\n    drive_scheduled_start_at: null,\n  });\n}`,
    'Group Drive Crew context API',
  );
  fs.writeFileSync(path, text);
}

function patchCrewsList() {
  const path = 'src/features/crews-events/CanonicalCrewsScreen.tsx';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceExact(text, 'import { supabase } from "@/src/lib/supabase";', 'import { getEventLifecycle } from "@/src/lib/eventExperience";\nimport { supabase } from "@/src/lib/supabase";', 'Crews lifecycle import');
  text = replaceExact(
    text,
    `type CrewEvent = {\n  id: string;\n  crew_id: string | null;\n  title: string;\n  location_name: string;\n  starts_at: string;\n  cover_image_url: string | null;\n};`,
    `type CrewEvent = {\n  id: string;\n  crew_id: string | null;\n  title: string;\n  location_name: string;\n  starts_at: string;\n  ends_at: string | null;\n  status: string;\n  cover_image_url: string | null;\n};`,
    'Crews event type',
  );
  text = replaceExact(
    text,
    `    const requestsQuery = currentUserId`,
    `    const eventNow = new Date();\n    const eventFeedFloor = new Date(eventNow.getTime() - 24 * 60 * 60 * 1000);\n\n    const requestsQuery = currentUserId`,
    'Crews event feed clock',
  );
  text = replaceExact(
    text,
    `        supabase\n          .from("events")\n          .select("id,crew_id,title,location_name,starts_at,cover_image_url")\n          .not("crew_id", "is", null)\n          .eq("status", "scheduled")\n          .gte("starts_at", new Date().toISOString())\n          .order("starts_at", { ascending: true })\n          .limit(8),`,
    `        supabase\n          .from("events")\n          .select("id,crew_id,title,location_name,starts_at,ends_at,status,cover_image_url")\n          .not("crew_id", "is", null)\n          .eq("status", "scheduled")\n          .or(\`starts_at.gte.\${eventFeedFloor.toISOString()},ends_at.gt.\${eventNow.toISOString()}\`)\n          .order("starts_at", { ascending: true })\n          .limit(12),`,
    'Crews live event query',
  );
  text = replaceExact(
    text,
    `    setEvents((eventsResult.data ?? []) as CrewEvent[]);`,
    `    setEvents(\n      ((eventsResult.data ?? []) as CrewEvent[]).filter((event) => {\n        const lifecycle = getEventLifecycle(event);\n        return lifecycle === "scheduled" || lifecycle === "live";\n      }),\n    );`,
    'Crews live event filter',
  );
  fs.writeFileSync(path, text);
}

function patchCrewDetail() {
  const path = 'src/features/crews-events/CanonicalCrewDetailScreen.tsx';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceExact(text, 'import { supabase } from "@/src/lib/supabase";', 'import { getEventLifecycle } from "@/src/lib/eventExperience";\nimport { supabase } from "@/src/lib/supabase";', 'Crew Detail lifecycle import');
  text = replaceExact(
    text,
    `type CrewEvent = {\n  id: string;\n  title: string;\n  location_name: string;\n  starts_at: string;\n  cover_image_url: string | null;\n};`,
    `type CrewEvent = {\n  id: string;\n  title: string;\n  location_name: string;\n  starts_at: string;\n  ends_at: string | null;\n  status: string;\n  cover_image_url: string | null;\n};`,
    'Crew Detail event type',
  );
  text = replaceExact(text, '<Text style={styles.eventEyebrow}>UPCOMING DRIVE</Text>', '<Text style={styles.eventEyebrow}>CREW EVENT</Text>', 'Crew Detail event eyebrow');
  text = replaceExact(text, '<SectionTitle title="CREW GARAGE" meta={`${vehicles.length} CARS`} />', '<SectionTitle title="CREW GARAGE" meta={`${vehicles.length} VEHICLES`} />', 'Crew Garage count terminology');
  text = replaceExact(text, '<Text style={styles.garageEyebrow}>MEMBER CARS</Text>', '<Text style={styles.garageEyebrow}>MEMBER VEHICLES</Text>', 'Crew Garage vehicle terminology');
  text = replaceExact(text, '<SectionTitle title="CREW EVENTS" meta={`${events.length} UPCOMING`} />', '<SectionTitle title="CREW EVENTS" meta={`${events.length} ACTIVE`} />', 'Crew event count terminology');
  text = replaceExact(text, '<Text style={styles.emptyTitle}>No upcoming events</Text>', '<Text style={styles.emptyTitle}>No active events</Text>', 'Crew event empty title');
  text = replaceExact(
    text,
    `    const [crewResult, memberResult, eventResult, requestResult] =`,
    `    const eventNow = new Date();\n    const eventFeedFloor = new Date(eventNow.getTime() - 24 * 60 * 60 * 1000);\n\n    const [crewResult, memberResult, eventResult, requestResult] =`,
    'Crew Detail event feed clock',
  );
  text = replaceExact(
    text,
    `        supabase\n          .from("events")\n          .select("id,title,location_name,starts_at,cover_image_url")\n          .eq("crew_id", crewId)\n          .eq("status", "scheduled")\n          .gte("starts_at", new Date().toISOString())\n          .order("starts_at", { ascending: true })\n          .limit(8),`,
    `        supabase\n          .from("events")\n          .select("id,title,location_name,starts_at,ends_at,status,cover_image_url")\n          .eq("crew_id", crewId)\n          .eq("status", "scheduled")\n          .or(\`starts_at.gte.\${eventFeedFloor.toISOString()},ends_at.gt.\${eventNow.toISOString()}\`)\n          .order("starts_at", { ascending: true })\n          .limit(12),`,
    'Crew Detail live event query',
  );
  text = replaceExact(
    text,
    `    setEvents((eventResult.data ?? []) as CrewEvent[]);`,
    `    setEvents(\n      ((eventResult.data ?? []) as CrewEvent[]).filter((event) => {\n        const lifecycle = getEventLifecycle(event);\n        return lifecycle === "scheduled" || lifecycle === "live";\n      }),\n    );`,
    'Crew Detail live event filter',
  );
  fs.writeFileSync(path, text);
}

patchApi();
patchCrewsList();
patchCrewDetail();
console.log('Crew integration exact patches applied.');
