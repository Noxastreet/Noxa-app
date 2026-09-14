import { supabase } from '@/src/lib/supabase';

import {
  getGroupDriveLocationSession,
  stopGroupDriveLocationSession,
} from './nativeLocation';
import {
  clearPendingGroupDriveServerAction,
  stagePendingGroupDriveServerAction,
} from './pendingServerAction';

export type GroupDriveLocationStopResult = {
  localStopped: true;
  serverCleared: boolean;
};

export async function retryGroupDriveLocationCleanup(
  driveSessionId: string,
): Promise<GroupDriveLocationStopResult> {
  const pending = await stagePendingGroupDriveServerAction('clear_location', driveSessionId);

  const { data, error } = await supabase.rpc('noxa_clear_my_drive_location', {
    target_drive_session_id: driveSessionId,
  });

  if (error || data !== true) {
    return { localStopped: true, serverCleared: false };
  }

  if (pending) {
    clearPendingGroupDriveServerAction(
      pending.userId,
      'clear_location',
      driveSessionId,
    );
  }
  return { localStopped: true, serverCleared: true };
}

export async function stopGroupDriveLocationSharing(
  driveSessionId: string,
): Promise<GroupDriveLocationStopResult> {
  const session = getGroupDriveLocationSession();

  // Privacy first: stop the native writer before waiting for any network response.
  await stopGroupDriveLocationSession();
  await stagePendingGroupDriveServerAction(
    'clear_location',
    driveSessionId,
    session?.userId,
  );

  return retryGroupDriveLocationCleanup(driveSessionId);
}
