import { supabase } from '@/src/lib/supabase';

import {
  clearPendingGroupDriveServerAction,
  stagePendingGroupDriveServerAction,
} from './runtime/pendingServerAction';
import { stopGroupDriveLocationSession } from './runtime/nativeLocation';
import type { DriveParticipantRole, DriveParticipantStatus, DriveSessionStatus } from './types';

export type GroupDriveSummaryParticipant = {
  userId: string;
  displayName: string;
  role: DriveParticipantRole;
  status: DriveParticipantStatus;
};

export type GroupDriveSummary = {
  driveSessionId: string;
  title: string;
  sessionStatus: Extract<DriveSessionStatus, 'completed' | 'cancelled'>;
  endReason: 'host_completed' | 'host_cancelled' | 'expired' | null;
  completedAt: string | null;
  routeDistanceMeters: number | null;
  routeDurationSeconds: number | null;
  participants: GroupDriveSummaryParticipant[];
};

type SummaryRpcRow = {
  drive_session_id: string;
  title: string;
  session_status: GroupDriveSummary['sessionStatus'];
  end_reason: GroupDriveSummary['endReason'];
  completed_at: string | null;
  route_distance_meters: number | string | null;
  route_duration_seconds: number | string | null;
  participants: Array<{
    user_id?: string;
    display_name?: string | null;
    role?: DriveParticipantRole;
    status?: DriveParticipantStatus;
  }> | null;
};

function lifecycleError(message?: string) {
  if (/authentication required/i.test(message ?? '')) return 'Sign in again to continue.';
  if (/only the group drive host/i.test(message ?? '')) return 'Only the Group Drive host can do this.';
  if (/host must cancel or end/i.test(message ?? '')) return 'The Group Drive host must end the drive instead.';
  return 'Group Drive could not be updated. Please retry.';
}

function isNonRetryableLifecycleError(message?: string) {
  return /authentication required|only the group drive host|host must cancel or end/i.test(message ?? '');
}

async function stopLocalWriterAndStage(
  kind: 'leave' | 'end',
  driveSessionId: string,
) {
  // Privacy first: once the user confirms Leave/End, this device must stop
  // publishing immediately instead of waiting for a network round-trip.
  await stopGroupDriveLocationSession();
  await stagePendingGroupDriveServerAction(kind, driveSessionId);
}

export async function endGroupDrive(driveSessionId: string) {
  await stopLocalWriterAndStage('end', driveSessionId);

  const { data, error } = await supabase.rpc('noxa_end_drive', {
    target_drive_session_id: driveSessionId,
  });

  if (error) {
    if (isNonRetryableLifecycleError(error.message)) {
      clearPendingGroupDriveServerAction('end', driveSessionId);
      throw new Error(lifecycleError(error.message));
    }
    throw new Error(
      'Location sharing stopped on this device. Ending the Group Drive is waiting for server confirmation. Retry when you are online.',
    );
  }

  // true means this request completed the transition. false means the drive was
  // already terminal (for example after a lost response), which is also safe to
  // treat as confirmed after the server answered.
  if (data === true || data === false) {
    clearPendingGroupDriveServerAction('end', driveSessionId);
    return true;
  }

  throw new Error(
    'Location sharing stopped on this device. Ending the Group Drive is waiting for server confirmation. Please retry.',
  );
}

export async function leaveGroupDriveAndStopLocation(driveSessionId: string) {
  await stopLocalWriterAndStage('leave', driveSessionId);

  const { data, error } = await supabase.rpc('noxa_leave_drive', {
    target_drive_session_id: driveSessionId,
  });

  if (error) {
    if (isNonRetryableLifecycleError(error.message)) {
      clearPendingGroupDriveServerAction('leave', driveSessionId);
      throw new Error(lifecycleError(error.message));
    }
    throw new Error(
      'Location sharing stopped on this device. Leaving the Group Drive is waiting for server confirmation. Retry when you are online.',
    );
  }

  if (data === true || data === false) {
    clearPendingGroupDriveServerAction('leave', driveSessionId);
    return true;
  }

  throw new Error(
    'Location sharing stopped on this device. Leaving the Group Drive is waiting for server confirmation. Please retry.',
  );
}

export async function loadGroupDriveSummary(driveSessionId: string): Promise<GroupDriveSummary> {
  const { data, error } = await supabase.rpc('noxa_get_drive_summary', {
    target_drive_session_id: driveSessionId,
  });
  if (error) throw new Error('Drive summary could not be loaded.');

  const row = (Array.isArray(data) ? data[0] : null) as SummaryRpcRow | undefined;
  if (!row) throw new Error('This completed Group Drive is unavailable.');

  return {
    driveSessionId: String(row.drive_session_id),
    title: String(row.title ?? 'Group Drive'),
    sessionStatus: row.session_status,
    endReason: row.end_reason ?? null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    routeDistanceMeters:
      row.route_distance_meters === null ? null : Number(row.route_distance_meters),
    routeDurationSeconds:
      row.route_duration_seconds === null ? null : Number(row.route_duration_seconds),
    participants: Array.isArray(row.participants)
      ? row.participants
          .filter((participant) => participant.user_id && participant.role && participant.status)
          .map((participant) => ({
            userId: String(participant.user_id),
            displayName: participant.display_name?.trim() || 'NOXA driver',
            role: participant.role!,
            status: participant.status!,
          }))
      : [],
  };
}
