import {
  isJwtValidationError,
  refreshSupabaseSessionOnce,
  supabase,
} from '@/src/lib/supabase';

export type DriveLobbyReadiness = {
  userId: string;
  readyAt: string | null;
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

async function rpcBoolean(name: string, args: Record<string, unknown>) {
  const request = () => supabase.rpc(name, args) as unknown as Promise<RpcResult<boolean>>;
  let result = await request();

  if (isJwtValidationError(result.error)) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { error } = await refreshSupabaseSessionOnce();
      if (!error) result = await request();
    }
  }

  if (result.error) throw new Error(lobbyError(result.error));
  return result.data === true;
}

export async function loadDriveLobbyReadiness(
  driveSessionId: string,
): Promise<DriveLobbyReadiness[]> {
  const request = () =>
    supabase
      .from('drive_participants')
      .select('user_id,ready_at')
      .eq('drive_session_id', driveSessionId)
      .in('status', ['accepted', 'active']);

  let result = await request();
  if (isJwtValidationError(result.error)) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { error } = await refreshSupabaseSessionOnce();
      if (!error) result = await request();
    }
  }

  if (result.error) throw new Error(lobbyError(result.error));
  return (result.data ?? []).map((row) => ({
    userId: String(row.user_id),
    readyAt: row.ready_at ? String(row.ready_at) : null,
  }));
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
