import * as Location from 'expo-location';

export type LocalNavigationLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
};

function validCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function mapLocation(location: Location.LocationObject): LocalNavigationLocation | null {
  const { latitude, longitude } = location.coords;
  if (!validCoordinate(latitude, longitude)) return null;
  const rawHeading = location.coords.heading;
  const heading =
    typeof rawHeading === 'number'
    && Number.isFinite(rawHeading)
    && rawHeading >= 0
    && rawHeading < 360
      ? rawHeading
      : null;
  return { latitude, longitude, heading };
}

async function foregroundPermission(requestPermission: boolean) {
  const permission = requestPermission
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  return permission.status === Location.PermissionStatus.GRANTED;
}

export async function readLocalNavigationLocation(requestPermission = false) {
  if (!(await foregroundPermission(requestPermission))) return null;
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return mapLocation(location);
}

export async function watchLocalNavigationLocation(
  onLocation: (location: LocalNavigationLocation) => void,
) {
  if (!(await foregroundPermission(false))) return () => undefined;

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5_000,
      distanceInterval: 5,
    },
    (location) => {
      const mapped = mapLocation(location);
      if (mapped) onLocation(mapped);
    },
  );

  return () => subscription.remove();
}
