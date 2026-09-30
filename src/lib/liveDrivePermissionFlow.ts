import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { requestLiveDrivePermissions } from '@/src/lib/liveDrive';

/**
 * Live Drive needs background location, not only foreground map access.
 *
 * On iOS, requesting background access first when it is still requestable lets
 * Core Location use its native When In Use -> Always authorization path. The
 * canonical Live Drive runtime still performs the final permission + precise
 * GPS validation before sharing starts.
 */
export async function requestRequiredLiveDrivePermissions() {
  if (Platform.OS === 'ios') {
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

  return requestLiveDrivePermissions();
}
