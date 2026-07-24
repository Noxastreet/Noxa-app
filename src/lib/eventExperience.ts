export type EventCategory = "meet" | "drive" | "track" | "social";
export type EventLifecycle = "upcoming" | "soon" | "live" | "completed" | "cancelled";
export type EventResponse = "going" | "maybe";

export type EventExperienceRow = {
  id: string;
  creator_id: string;
  crew_id: string | null;
  title: string;
  description: string | null;
  category: EventCategory;
  capacity: number | null;
  location_name: string;
  starts_at: string;
  ends_at: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_image_url: string | null;
  is_public: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function eventLifecycle(
  event: Pick<EventExperienceRow, "starts_at" | "ends_at" | "status">,
  now = Date.now(),
): EventLifecycle {
  if (event.status === "cancelled") return "cancelled";
  if (
    event.status === "completed"
    || (event.ends_at !== null && new Date(event.ends_at).getTime() <= now)
  ) {
    return "completed";
  }

  const startsAt = new Date(event.starts_at).getTime();
  if (startsAt <= now) return "live";
  if (startsAt - now <= 2 * 60 * 60 * 1000) return "soon";
  return "upcoming";
}

export function lifecycleLabel(lifecycle: EventLifecycle) {
  const labels: Record<EventLifecycle, string> = {
    upcoming: "UPCOMING",
    soon: "STARTING SOON",
    live: "LIVE NOW",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
  };
  return labels[lifecycle];
}

export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatEventDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDuration(startsAt: string, endsAt: string | null) {
  if (!endsAt) return "Open";
  const durationMinutes = Math.max(
    0,
    Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000),
  );
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NX";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}
