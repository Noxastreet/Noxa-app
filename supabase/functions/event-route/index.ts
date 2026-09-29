declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROVIDER_TIMEOUT_MS = 5500;

type RoutePoint = { latitude: number; longitude: number };
type RouteManeuver = {
  instruction: string;
  type: string;
  modifier: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationSeconds: number;
};
type RouteResult = {
  coordinates: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
  provider: "mapbox-driving-traffic" | "openrouteservice-fastest";
  maneuvers: RouteManeuver[];
};

type MapboxDirectionsResponse = {
  code?: unknown;
  routes?: Array<{
    geometry?: { type?: unknown; coordinates?: unknown };
    distance?: unknown;
    duration?: unknown;
    legs?: Array<{
      steps?: Array<{
        distance?: unknown;
        duration?: unknown;
        maneuver?: {
          instruction?: unknown;
          type?: unknown;
          modifier?: unknown;
          location?: unknown;
        };
      }>;
    }>;
  }>;
};

type OpenRouteServiceResponse = {
  features?: Array<{
    geometry?: { type?: unknown; coordinates?: unknown };
    properties?: {
      summary?: { distance?: unknown; duration?: unknown };
      segments?: Array<{
        steps?: Array<{
          distance?: unknown;
          duration?: unknown;
          instruction?: unknown;
          type?: unknown;
          way_points?: unknown;
        }>;
      }>;
    };
  }>;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

function isValidPoint(value: unknown): value is RoutePoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<RoutePoint>;
  return (
    typeof point.latitude === "number" &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function normalizeCoordinates(coordinates: unknown) {
  if (!Array.isArray(coordinates)) return null;
  const normalized: RoutePoint[] = [];
  for (const coordinate of coordinates) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
    const longitude = Number(coordinate[0]);
    const latitude = Number(coordinate[1]);
    if (!isValidPoint({ latitude, longitude })) return null;
    normalized.push({ latitude, longitude });
  }
  return normalized.length >= 2 ? normalized : null;
}

async function requestMapbox(
  points: RoutePoint[],
  accessToken: string,
): Promise<{ route: RouteResult | null; status: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const coordinates = points
      .map((point) => point.longitude + "," + point.latitude)
      .join(";");
    const routeUrl = new URL(
      "https://api.mapbox.com/directions/v5/mapbox/driving-traffic/" + coordinates,
    );
    routeUrl.search = new URLSearchParams({
      alternatives: "true",
      geometries: "geojson",
      overview: "full",
      steps: "true",
      access_token: accessToken,
    }).toString();

    const response = await fetch(routeUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as MapboxDirectionsResponse;
    if (!response.ok || data.code !== "Ok") {
      return { route: null, status: response.status || 502 };
    }

    const candidates: RouteResult[] = [];
    for (const candidate of data.routes ?? []) {
      const routePoints = normalizeCoordinates(candidate.geometry?.coordinates);
      const distance = candidate.distance;
      const duration = candidate.duration;
      if (
        candidate.geometry?.type !== "LineString" ||
        !routePoints ||
        typeof distance !== "number" ||
        !Number.isFinite(distance) ||
        typeof duration !== "number" ||
        !Number.isFinite(duration)
      ) {
        continue;
      }

      const maneuvers: RouteManeuver[] = [];
      for (const leg of candidate.legs ?? []) {
        for (const step of leg.steps ?? []) {
          const location = step.maneuver?.location;
          if (!Array.isArray(location) || location.length < 2) continue;
          const longitude = Number(location[0]);
          const latitude = Number(location[1]);
          const stepDistance = Number(step.distance);
          const stepDuration = Number(step.duration);
          const instruction =
            typeof step.maneuver?.instruction === "string"
              ? step.maneuver.instruction.trim()
              : "";
          if (
            !instruction ||
            !isValidPoint({ latitude, longitude }) ||
            !Number.isFinite(stepDistance) ||
            !Number.isFinite(stepDuration)
          ) {
            continue;
          }
          maneuvers.push({
            instruction,
            type:
              typeof step.maneuver?.type === "string"
                ? step.maneuver.type
                : "turn",
            modifier:
              typeof step.maneuver?.modifier === "string"
                ? step.maneuver.modifier
                : null,
            latitude,
            longitude,
            distanceMeters: Math.max(0, stepDistance),
            durationSeconds: Math.max(0, stepDuration),
          });
        }
      }

      candidates.push({
        coordinates: routePoints,
        distanceMeters: distance,
        durationSeconds: duration,
        provider: "mapbox-driving-traffic",
        maneuvers,
      });
    }
    candidates.sort(
      (a, b) =>
        a.durationSeconds - b.durationSeconds ||
        a.distanceMeters - b.distanceMeters,
    );

    return { route: candidates[0] ?? null, status: candidates.length ? 200 : 404 };
  } catch (error) {
    return {
      route: null,
      status:
        error instanceof DOMException && error.name === "AbortError" ? 504 : 502,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestOpenRouteService(
  points: RoutePoint[],
  apiKey: string,
): Promise<{ route: RouteResult | null; status: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json, application/geo+json",
        },
        body: JSON.stringify({
          coordinates: points.map((point) => [point.longitude, point.latitude]),
          preference: "fastest",
          instructions: true,
        }),
        signal: controller.signal,
      },
    );
    const data = (await response.json().catch(() => ({}))) as OpenRouteServiceResponse;
    if (!response.ok) return { route: null, status: response.status || 502 };

    const feature = data.features?.[0];
    const routePoints = normalizeCoordinates(feature?.geometry?.coordinates);
    const distance = feature?.properties?.summary?.distance;
    const duration = feature?.properties?.summary?.duration;
    if (
      feature?.geometry?.type !== "LineString" ||
      !routePoints ||
      typeof distance !== "number" ||
      !Number.isFinite(distance) ||
      typeof duration !== "number" ||
      !Number.isFinite(duration)
    ) {
      return { route: null, status: 404 };
    }

    const maneuvers: RouteManeuver[] = [];
    for (const segment of feature?.properties?.segments ?? []) {
      for (const step of segment.steps ?? []) {
        const wayPoints = Array.isArray(step.way_points) ? step.way_points : [];
        const geometryIndex = Number(wayPoints[0]);
        const coordinate = Number.isInteger(geometryIndex)
          ? routePoints[geometryIndex]
          : null;
        const instruction =
          typeof step.instruction === "string" ? step.instruction.trim() : "";
        const stepDistance = Number(step.distance);
        const stepDuration = Number(step.duration);
        if (
          !coordinate ||
          !instruction ||
          !Number.isFinite(stepDistance) ||
          !Number.isFinite(stepDuration)
        ) {
          continue;
        }
        maneuvers.push({
          instruction,
          type: typeof step.type === "number" ? String(step.type) : "turn",
          modifier: null,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          distanceMeters: Math.max(0, stepDistance),
          durationSeconds: Math.max(0, stepDuration),
        });
      }
    }

    return {
      route: {
        coordinates: routePoints,
        distanceMeters: distance,
        durationSeconds: duration,
        provider: "openrouteservice-fastest",
        maneuvers,
      },
      status: 200,
    };
  } catch (error) {
    return {
      route: null,
      status:
        error instanceof DOMException && error.name === "AbortError" ? 504 : 502,
    };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const mapboxAccessToken = Deno.env.get("MAPBOX_ACCESS_TOKEN");
  const openRouteServiceApiKey = Deno.env.get("OPENROUTESERVICE_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Server configuration is missing." }, 500);
  }
  if (!mapboxAccessToken && !openRouteServiceApiKey) {
    return json({ error: "Route provider is not configured." }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required." }, 401);

  const authResponse = await fetch(supabaseUrl + "/auth/v1/user", {
    headers: { Authorization: authorization, apikey: supabaseAnonKey },
  });
  if (!authResponse.ok) return json({ error: "Authentication required." }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { origin, destination } = (body ?? {}) as {
    origin?: unknown;
    destination?: unknown;
  };
  if (!isValidPoint(origin) || !isValidPoint(destination)) {
    return json({ error: "Valid origin and destination are required." }, 400);
  }

  const points = [origin, destination];
  const statuses: number[] = [];

  if (mapboxAccessToken) {
    const mapbox = await requestMapbox(points, mapboxAccessToken);
    if (mapbox.route) return json(mapbox.route);
    if (mapbox.status) statuses.push(mapbox.status);
  }

  if (openRouteServiceApiKey) {
    const fallback = await requestOpenRouteService(points, openRouteServiceApiKey);
    if (fallback.route) return json(fallback.route);
    if (fallback.status) statuses.push(fallback.status);
  }

  if (statuses.includes(429)) {
    return json({ error: "Route provider request failed." }, 429);
  }
  if (statuses.length > 0 && statuses.every((status) => status === 404)) {
    return json({ error: "No route found." }, 404);
  }
  if (statuses.includes(504)) {
    return json({ error: "Route request timed out." }, 504);
  }
  return json({ error: "Route request failed." }, 502);
});
