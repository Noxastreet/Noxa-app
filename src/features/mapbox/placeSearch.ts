import { MAPBOX_ACCESS_TOKEN } from './config';
import type { LatLng } from './types';

export type MapboxPlaceResult = {
  id: string;
  label: string;
  subtitle: string | null;
  coordinate: LatLng;
};

type MapboxFeature = {
  id?: unknown;
  place_name?: unknown;
  text?: unknown;
  center?: unknown;
  context?: Array<{ text?: unknown }>;
};

type MapboxSearchResponse = {
  features?: MapboxFeature[];
};

function validCenter(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length < 2) return false;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  return (
    Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -90
    && latitude <= 90
  );
}

export async function searchMapboxPlaces(
  query: string,
  proximity?: LatLng | null,
): Promise<MapboxPlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  if (!MAPBOX_ACCESS_TOKEN) throw new Error('Place search is unavailable.');

  const endpoint =
    'https://api.mapbox.com/geocoding/v5/mapbox.places/'
    + encodeURIComponent(trimmed)
    + '.json';
  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    autocomplete: 'true',
    limit: '6',
    language: 'en',
    types: 'poi,address,place,locality,neighborhood',
  });
  if (proximity) {
    params.set('proximity', `${proximity.longitude},${proximity.latitude}`);
  }

  const response = await fetch(`${endpoint}?${params.toString()}`);
  if (!response.ok) throw new Error('Place search is temporarily unavailable.');
  const body = (await response.json()) as MapboxSearchResponse;

  return (body.features ?? []).flatMap((feature): MapboxPlaceResult[] => {
    if (!validCenter(feature.center)) return [];
    const [longitude, latitude] = feature.center;
    const placeName =
      typeof feature.place_name === 'string' ? feature.place_name.trim() : '';
    const title =
      typeof feature.text === 'string' ? feature.text.trim() : '';
    const context = (feature.context ?? [])
      .map((item) => typeof item.text === 'string' ? item.text.trim() : '')
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');
    return [{
      id:
        typeof feature.id === 'string'
          ? feature.id
          : `${latitude}:${longitude}:${placeName}`,
      label: placeName || title || 'Selected destination',
      subtitle: context || null,
      coordinate: { latitude, longitude },
    }];
  });
}
