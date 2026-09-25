import * as Location from 'expo-location';

import type { LatLng } from '@/src/features/mapbox/types';

export type DriveRoutePointSelection = LatLng & { label: string };

export function coordinateLabel(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export async function resolveDrivePointLabel(
  point: LatLng,
  approximate = false,
): Promise<string> {
  try {
    const address = (await Location.reverseGeocodeAsync(point))[0];
    if (!address) {
      return approximate
        ? 'Destination shared after joining'
        : coordinateLabel(point.latitude, point.longitude);
    }

    if (approximate) {
      const area = Array.from(
        new Set(
          [address.city, address.district, address.subregion, address.region].filter(Boolean),
        ),
      );
      return area.length ? area.join(', ') : 'Destination shared after joining';
    }

    const street = [address.name, address.street].filter(Boolean).join(' ').trim();
    const parts = Array.from(
      new Set([street, address.city, address.region].filter(Boolean)),
    );
    return parts.length
      ? parts.join(', ')
      : coordinateLabel(point.latitude, point.longitude);
  } catch {
    return approximate
      ? 'Destination shared after joining'
      : coordinateLabel(point.latitude, point.longitude);
  }
}
