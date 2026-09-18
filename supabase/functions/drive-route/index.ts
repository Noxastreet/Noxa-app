import { corsHeaders } from '@supabase/supabase-js/cors';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const PROVIDER_TIMEOUT_MS = 5500;

type RoutePoint = { latitude: number; longitude: number };
type DriveRouteResult = {
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  coordinates: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
  provider: 'mapbox-driving-traffic' | 'openrouteservice-fastest';
};

type MapboxDirectionsResponse = {
  code?: unknown;
  routes?: Array<{
    geometry?: { type?: unknown; coordinates?: unknown };
    distance?: unknown;
    duration?: unknown;
  }>;
};

type OpenRouteServiceResponse = {
  features?: Array<{
    geometry?: { type?: unknown; coordinates?: unknown };
    properties?: { summary?: { distance?: unknown; duration?: unknown } };
  }>;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
  });
}

function isRoutePoint(value: unknown): value is RoutePoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<RoutePoint>;
  return (
    typeof point.latitude === 'number' &&
    typeof point.longitude === 'number' &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function normalizeGeometry(coordinates: unknown) {
  if (!Array.isArray(coordinates)) return null;
  const geometryCoordinates: [number, number][] = [];
  const routePoints: RoutePoint[] = [];
  for (const coordinate of coordinates) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
    const longitude = Number(coordinate[0]);
    const latitude = Number(coordinate[1]);
    if (!isRoutePoint({ latitude, longitude })) return null;
    geometryCoordinates.push([longitude, latitude]);
    routePoints.push({ latitude, longitude });
  }
  if (geometryCoordinates.length < 2) return null;
  return { geometryCoordinates, routePoints };
}

async function requestMapbox(
  points: RoutePoint[],
  accessToken: string,
): Promise<{ route: DriveRouteResult | null; status: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const coordinates = points
      .map((point) => point.longitude + ',' + point.latitude)
      .join(';');
    const routeUrl = new URL(
      'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' + coordinates,
    );
    routeUrl.search = new URLSearchParams({
      alternatives: 'true',
      geometries: 'geojson',
      overview: 'full',
      steps: 'false',
      access_token: accessToken,
    }).toString();

    const response = await fetch(routeUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as MapboxDirectionsResponse;
    if (!response.ok || data.code !== 'Ok') {
      return { route: null, status: response.status || 502 };
    }

    const candidates = (data.routes ?? [])
      .map((candidate) => {
        const normalized = normalizeGeometry(candidate.geometry?.coordinates);
        const distance = candidate.distance;
        const duration = candidate.duration;
        if (
          candidate.geometry?.type !== 'LineString' ||
          !normalized ||
          typeof distance !== 'number' ||
          !Number.isFinite(distance) ||
          typeof duration !== 'number' ||
          !Number.isFinite(duration)
        ) {
          return null;
        }
        return {
          geometry: { type: 'LineString' as const, coordinates: normalized.geometryCoordinates },
          coordinates: normalized.routePoints,
          distanceMeters: distance,
          durationSeconds: duration,
          provider: 'mapbox-driving-traffic' as const,
        };
      })
      .filter((candidate): candidate is DriveRouteResult => Boolean(candidate))
      .sort(
        (a, b) =>
          a.durationSeconds - b.durationSeconds ||
          a.distanceMeters - b.distanceMeters,
      );

    return { route: candidates[0] ?? null, status: candidates.length ? 200 : 404 };
  } catch (error) {
    return {
      route: null,
      status:
        error instanceof DOMException && error.name === 'AbortError' ? 504 : 502,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestOpenRouteService(
  points: RoutePoint[],
  apiKey: string,
): Promise<{ route: DriveRouteResult | null; status: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json, application/geo+json',
        },
        body: JSON.stringify({
          coordinates: points.map((point) => [point.longitude, point.latitude]),
          preference: 'fastest',
        }),
        signal: controller.signal,
      },
    );
    const data = (await response.json().catch(() => ({}))) as OpenRouteServiceResponse;
    if (!response.ok) return { route: null, status: response.status || 502 };

    const feature = data.features?.[0];
    const normalized = normalizeGeometry(feature?.geometry?.coordinates);
    const distance = feature?.properties?.summary?.distance;
    const duration = feature?.properties?.summary?.duration;
    if (
      feature?.geometry?.type !== 'LineString' ||
      !normalized ||
      typeof distance !== 'number' ||
      !Number.isFinite(distance) ||
      typeof duration !== 'number' ||
      !Number.isFinite(duration)
    ) {
      return { route: null, status: 404 };
    }

    return {
      route: {
        geometry: { type: 'LineString', coordinates: normalized.geometryCoordinates },
        coordinates: normalized.routePoints,
        distanceMeters: distance,
        durationSeconds: duration,
        provider: 'openrouteservice-fastest',
      },
      status: 200,
    };
  } catch (error) {
    return {
      route: null,
      status:
        error instanceof DOMException && error.name === 'AbortError' ? 504 : 502,
    };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const mapboxAccessToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
  const openRouteServiceApiKey = Deno.env.get('OPENROUTESERVICE_API_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'Server configuration is missing.' }, 500);
  }
  if (!mapboxAccessToken && !openRouteServiceApiKey) {
    return json({ error: 'Route provider is not configured.' }, 500);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication required.' }, 401);
  const authResponse = await fetch(supabaseUrl + '/auth/v1/user', {
    headers: { Authorization: authorization, apikey: supabaseAnonKey },
  });
  if (!authResponse.ok) return json({ error: 'Authentication required.' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const points = (body as { points?: unknown } | null)?.points;
  if (
    !Array.isArray(points) ||
    points.length < 2 ||
    points.length > 12 ||
    !points.every(isRoutePoint)
  ) {
    return json({ error: 'Two to twelve valid route points are required.' }, 400);
  }

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
    return json({ error: 'Route provider request failed.' }, 429);
  }
  if (statuses.length > 0 && statuses.every((status) => status === 404)) {
    return json({ error: 'No route found.' }, 404);
  }
  if (statuses.includes(504)) {
    return json({ error: 'Route request timed out.' }, 504);
  }
  return json({ error: 'Route request failed.' }, 502);
});
