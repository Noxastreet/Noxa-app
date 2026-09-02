import { corsHeaders } from '@supabase/supabase-js/cors';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type RoutePoint = { latitude: number; longitude: number };
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const openRouteServiceApiKey = Deno.env.get('OPENROUTESERVICE_API_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'Server configuration is missing.' }, 500);
  }
  if (!openRouteServiceApiKey) {
    return json({ error: 'Route provider is not configured.' }, 500);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication required.' }, 401);
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
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
  if (!Array.isArray(points) || points.length < 2 || points.length > 12 || !points.every(isRoutePoint)) {
    return json({ error: 'Two to twelve valid route points are required.' }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: {
          Authorization: openRouteServiceApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json, application/geo+json',
        },
        body: JSON.stringify({
          coordinates: points.map((point) => [point.longitude, point.latitude]),
        }),
        signal: controller.signal,
      },
    );
    const data = (await response.json().catch(() => ({}))) as OpenRouteServiceResponse;
    if (!response.ok) {
      return json(
        { error: 'Route provider request failed.' },
        response.status === 429 ? 429 : response.status >= 500 ? 502 : 400,
      );
    }
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
      return json({ error: 'No route found.' }, 404);
    }
    return json({
      geometry: { type: 'LineString', coordinates: normalized.geometryCoordinates },
      coordinates: normalized.routePoints,
      distanceMeters: distance,
      durationSeconds: duration,
      provider: 'openrouteservice',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return json({ error: 'Route request timed out.' }, 504);
    }
    return json({ error: 'Route request failed.' }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
