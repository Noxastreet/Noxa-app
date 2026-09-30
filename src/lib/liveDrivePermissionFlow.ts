import { requestIosBackgroundLocationPreflight } from '@/src/lib/backgroundLocationPermissionFlow';
import { requestLiveDrivePermissions } from '@/src/lib/liveDrive';

/**
 * Live Drive needs background location, not only foreground map access.
 * The shared iOS preflight enters the native Always authorization path; the
 * verified Live Drive runtime still performs final permission + GPS validation.
 */
export async function requestRequiredLiveDrivePermissions() {
  await requestIosBackgroundLocationPreflight();
  return requestLiveDrivePermissions();
}
