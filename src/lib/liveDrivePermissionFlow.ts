import { requestLiveDrivePermissions } from '@/src/lib/liveDrive';

/**
 * Personal map presence uses its existing dedicated Live Drive location task
 * only while NOXA is minimized. Permission is requested only after the user
 * explicitly chooses a non-Ghost audience.
 */
export async function requestRequiredLiveDrivePermissions() {
  return requestLiveDrivePermissions();
}
