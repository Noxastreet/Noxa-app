import type { LatLng } from "@/src/features/mapbox/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DRIVER_BROADCAST_EVENT = "location";
export const DRIVER_BROADCAST_LEAVE_EVENT = "leave";
export const DRIVER_BROADCAST_SEND_MS = 2_000;
export const DRIVER_BROADCAST_ANIMATION_MS = 1_850;
export const DRIVER_BROADCAST_ANIMATION_TICK_MS = 100;
export const MAX_LIVE_DRIVER_CHANNELS = 80;

export type DriverBroadcastPayload = {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
};

export function createDriverBroadcastTopic(userId: string, broadcastKey: string) {
  if (!UUID_PATTERN.test(userId) || !UUID_PATTERN.test(broadcastKey)) return null;
  return `noxa-driver:${userId}:${broadcastKey}`;
}

export function parseDriverBroadcastPayload(
  payload: unknown,
): DriverBroadcastPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const userId = typeof value.user_id === "string" ? value.user_id : "";
  const latitude = typeof value.latitude === "number" ? value.latitude : Number.NaN;
  const longitude =
    typeof value.longitude === "number" ? value.longitude : Number.NaN;
  const updatedAt = typeof value.updated_at === "string" ? value.updated_at : "";

  if (
    !UUID_PATTERN.test(userId) ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(Date.parse(updatedAt))
  ) {
    return null;
  }

  return {
    user_id: userId,
    latitude,
    longitude,
    updated_at: updatedAt,
  };
}

export function interpolateDriverPoint(
  from: LatLng,
  to: LatLng,
  progress: number,
): LatLng {
  const clamped = Math.min(1, Math.max(0, progress));
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * clamped,
    longitude: from.longitude + (to.longitude - from.longitude) * clamped,
  };
}
