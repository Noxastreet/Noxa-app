export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
export const NOXA_MAPBOX_STYLE_URL = "mapbox://styles/mapbox/navigation-night-v1";
export const NOXA_MAPBOX_DEFAULT_ZOOM = 13;
export const NOXA_FALLBACK_COORDINATE = { latitude: 40.6401, longitude: 22.9444 };

export function isValidCoordinate(
  coordinate: { latitude: number; longitude: number } | null | undefined,
) {
  return Boolean(
    coordinate &&
      Number.isFinite(coordinate.latitude) &&
      coordinate.latitude >= -90 &&
      coordinate.latitude <= 90 &&
      Number.isFinite(coordinate.longitude) &&
      coordinate.longitude >= -180 &&
      coordinate.longitude <= 180,
  );
}
