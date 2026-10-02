import { requestLiveDrivePermissions } from '@/src/lib/liveDrive';

/**
 * Personal map presence is foreground-only. It needs precise When In Use
 * location access, but must never request background / Always permission.
 * Group Drive owns its separate explicit background-location permission flow.
 */
export async function requestRequiredLiveDrivePermissions() {
  return requestLiveDrivePermissions();
}
