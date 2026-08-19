import {
  isJwtValidationError,
  refreshSupabaseSessionOnce,
  supabase,
} from '@/src/lib/supabase';

import type { DriveSessionStatus } from './types';

export type DriveLobbyReadiness = {
  userId: string;
  readyAt: string | null;
};

export type DriveLobbySnapshot = {
  sessionStatus: DriveSessionStatus;
  routeVersion: number;
  scheduledStartAt: string | null;
  participants: DriveLobbyReadiness[];
};

type RpcError = { code?: string; message?: string } | null;
type RpcResult<T> = { data: T | null; error: RpcError };

function lobbyError(error: RpcError) {
  if (!error) return 'Lobby could not be updated.';
  if (error.code === 'PGRST202' || error.code === 'PGRST205') {
    return 'Group Drive Lobby is not available in this environment yet.';
  }

  const message = error.message ?? '';
  if (/authentication required/i.test(message)) return 'Sign in again to continue.';
  if (/already active in another Group Drive/i.test(message)) {
    return 'One of the drivers is already active in another Group Drive.';
  }
  if (/host and at least one accepted participant/i.test(message)) {
    return 'Invite at least one driver before starting.';
  }
  if (/calculated start-to-end route/i.test(message)) {
    return 'Set the route before starting the Group Drive.';
  }
  if (/only the Group Drive host can start/i.test(message)) {
    return 'Only the host can start this Group Drive.';
  }
  if (/host controls Start and does not use Ready/i.test(message)) {
    return 'The host starts the Group Drive and does not use Ready.';
  }
  if (/Lobby readiness is available only before/i.test(message)) {
    return 'This Group Drive has already started.';
  }
  if (/unavailable/i.test(message)) return 'This Group Drive is unavailable.';
  return 'Lobby could not be updated. Please retry.';
}

async function refreshJwtIfNeeded(error: RpcError) {
  if (!isJwtValidationError(error)) return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  const refresh = await refreshSupabaseSessionOnce();
  return !refresh.error;
}

async function rpcBoolean(name: string, args: Record<string, unknown>) {
  const request = () => supabase.rpc(name, args) as unknown as Promise<RpcResult<boolean>>;
  let result = await request();

  if (await refreshJwtIfNeeded(result.error)) result = await request();

  if (result.error) throw new Error(lobbyError(result.error));
  return result.data === true;
}

export async function loadDriveLobbySnapshot(driveSessionId: string): Promise<DriveLobbySnapshot> {
  const request = () =>
    Promise.all([
      supabase
        .from('drive_sessions')
        .select('status,route_version,scheduled_start_at')
        .eq('id', driveSessionId)
        .maybeSingle(),
      supabase
        .from('drive_participants')
        .select('user_id,ready_at')
        .eq('drive_session_id', driveSessionId)
        .in('status', ['accepted', 'active']),
    ]);

  let [sessionResult, participantsResult] = await request();
  const initialError = sessionResult.error ?? participantsResult.error;
  if (await refreshJwtIfNeeded(initialError)) {
    [sessionResult, participantsResult] = await request();
  }

  const error = sessionResult.error ?? participantsResult.error;
  if (error) throw new Error(lobbyError(error));
  if (!sessionResult.data) throw new Error('This Group Drive is unavailable.');

  return {
    sessionStatus: sessionResult.data.status as DriveSessionStatus,
    routeVersion: Number(sessionResult.data.route_version ?? 0),
    scheduledStartAt: sessionResult.data.scheduled_start_at
      ? String(sessionResult.data.scheduled_start_at)
      : null,
    participants: (participantsResult.data ?? []).map((row) => ({
      userId: String(row.user_id),
      readyAt: row.ready_at ? String(row.ready_at) : null,
    })),
  };
}

export async function loadDriveLobbyReadiness(
  driveSessionId: string,
): Promise<DriveLobbyReadiness[]> {
  return (await loadDriveLobbySnapshot(driveSessionId)).participants;
}

export async function setDriveReady(driveSessionId: string, ready: boolean) {
  return rpcBoolean('noxa_set_drive_ready', {
    target_drive_session_id: driveSessionId,
    ready_state: ready,
  });
}

export async function startDrive(driveSessionId: string) {
  return rpcBoolean('noxa_start_drive', {
    target_drive_session_id: driveSessionId,
  });
}
