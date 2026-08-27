import { supabase } from '@/src/lib/supabase';

import { leaveDrive } from './api';
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
  return 'Group Drive could not be updated. Please retry.';
}

export async function endGroupDrive(driveSessionId: string) {
  const { data, error } = await supabase.rpc('noxa_end_drive', {
    target_drive_session_id: driveSessionId,
  });
  if (error) throw new Error(lifecycleError(error.message));
  if (data !== true) throw new Error('This Group Drive is no longer active.');

  // The server transition synchronously removes every exact Group Drive location row.
  // Stop this device's dedicated native writer as well so it cannot attempt another publish.
  await stopGroupDriveLocationSession();
  return true;
}

export async function leaveGroupDriveAndStopLocation(driveSessionId: string) {
  const left = await leaveDrive(driveSessionId);
  if (left !== true) throw new Error('This Group Drive can no longer be left.');

  // The server participant transition synchronously deletes this user's exact location row.
  await stopGroupDriveLocationSession();
  return true;
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
