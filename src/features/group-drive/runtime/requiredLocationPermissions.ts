import { requestIosBackgroundLocationPreflight } from '@/src/lib/backgroundLocationPermissionFlow';

import { requestGroupDriveLocationPermissions } from './nativeLocation';

export async function requestRequiredGroupDriveLocationPermissions() {
  await requestIosBackgroundLocationPreflight();
  return requestGroupDriveLocationPermissions();
}
