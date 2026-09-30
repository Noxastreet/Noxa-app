import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * Enters the native iOS background-location authorization path before the
 * feature-specific runtime performs its final permission and GPS validation.
 *
 * This does not start GPS, publish location, or create a background task.
 */
export async function requestIosBackgroundLocationPreflight() {
  if (Platform.OS !== 'ios') return;

  const background = await Location.getBackgroundPermissionsAsync().catch(
    () => null,
  );

  if (
    background?.status !== Location.PermissionStatus.GRANTED
    && background?.canAskAgain !== false
  ) {
    await Location.requestBackgroundPermissionsAsync().catch(() => undefined);
  }
}
