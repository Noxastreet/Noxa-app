import fs from 'node:fs';

function replaceExact(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`${label}: source pattern not found`);
  if (text.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: source pattern is ambiguous`);
  }
  return text.slice(0, first) + after + text.slice(first + before.length);
}

function patchHomeMap() {
  const path = 'app/(tabs)/index.tsx';
  let text = fs.readFileSync(path, 'utf8');

  text = replaceExact(
    text,
    'import type { EventCategory } from "@/src/lib/eventExperience";',
    'import { getEventLifecycle, type EventCategory } from "@/src/lib/eventExperience";',
    'Home/Map event lifecycle import',
  );

  text = replaceExact(
    text,
    `type EventMarkerRow = {\n  id: string;\n  title: string;\n  category: EventCategory;\n  starts_at: string;\n  location_name: string | null;\n  latitude: number;\n  longitude: number;\n};`,
    `type EventMarkerRow = {\n  id: string;\n  title: string;\n  category: EventCategory;\n  starts_at: string;\n  ends_at: string | null;\n  status: string;\n  location_name: string | null;\n  latitude: number;\n  longitude: number;\n};`,
    'Home/Map EventMarkerRow lifecycle fields',
  );

  text = replaceExact(
    text,
    '<Text style={styles.cardKicker}>Upcoming event</Text>',
    '<Text style={styles.cardKicker}>{getEventLifecycle(event) === "live" ? "Live event" : "Upcoming event"}</Text>',
    'Home/Map event preview lifecycle label',
  );

  text = replaceExact(
    text,
    `      const requestEvents = () =>\n        supabase\n          .from("events")\n          .select("id,title,category,starts_at,location_name,latitude,longitude")\n          .eq("status", "scheduled")\n          .gte("starts_at", new Date().toISOString())\n          .not("latitude", "is", null)\n          .not("longitude", "is", null)\n          .order("starts_at", { ascending: true });`,
    `      const now = new Date();\n      const feedFloor = new Date(now.getTime() - 24 * 60 * 60 * 1000);\n      const requestEvents = () =>\n        supabase\n          .from("events")\n          .select("id,title,category,starts_at,ends_at,status,location_name,latitude,longitude")\n          .eq("status", "scheduled")\n          .or(\`starts_at.gte.\${feedFloor.toISOString()},ends_at.gt.\${now.toISOString()}\`)\n          .not("latitude", "is", null)\n          .not("longitude", "is", null)\n          .order("starts_at", { ascending: true });`,
    'Home/Map event query lifecycle window',
  );

  text = replaceExact(
    text,
    `      ).filter(\n        (event): event is EventMarkerRow =>\n          typeof event.latitude === "number" &&\n          typeof event.longitude === "number",\n      );`,
    `      )\n        .filter(\n          (event): event is EventMarkerRow =>\n            typeof event.latitude === "number" &&\n            typeof event.longitude === "number",\n        )\n        .filter((event) => {\n          const lifecycle = getEventLifecycle(event);\n          return lifecycle === "scheduled" || lifecycle === "live";\n        });`,
    'Home/Map event lifecycle filter',
  );

  fs.writeFileSync(path, text);
}

function patchEventDetail() {
  const path = 'src/features/crews-events/CanonicalEventDetailScreen.tsx';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceExact(
    text,
    'ORGANIZED BY {crew ? "· VERIFIED CREW" : ""}',
    'ORGANIZED BY {crew ? "· CREW" : ""}',
    'Event Detail unverified Crew copy',
  );
  fs.writeFileSync(path, text);
}

patchHomeMap();
patchEventDetail();
console.log('One-time MVP large-file polish patches applied.');
