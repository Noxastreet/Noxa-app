import { supabase } from '@/src/lib/supabase';

const GROUP_DRIVE_PENDING_SERVER_ACTION_KEY = 'noxa.group-drive-pending-server-action.v1';

export type PendingGroupDriveServerActionKind = 'clear_location' | 'leave' | 'end';

export type PendingGroupDriveServerAction = {
  kind: PendingGroupDriveServerActionKind;
  driveSessionId: string;
  userId: string;
  requestedAt: string;
};

function readPendingAction(): PendingGroupDriveServerAction | null {
  try {
    const raw = localStorage.getItem(GROUP_DRIVE_PENDING_SERVER_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingGroupDriveServerAction>;
    if (
      !['clear_location', 'leave', 'end'].includes(parsed.kind ?? '')
      || typeof parsed.driveSessionId !== 'string'
      || typeof parsed.userId !== 'string'
      || typeof parsed.requestedAt !== 'string'
      || !Number.isFinite(Date.parse(parsed.requestedAt))
    ) {
      localStorage.removeItem(GROUP_DRIVE_PENDING_SERVER_ACTION_KEY);
      return null;
    }
    return parsed as PendingGroupDriveServerAction;
  } catch {
    localStorage.removeItem(GROUP_DRIVE_PENDING_SERVER_ACTION_KEY);
    return null;
  }
}

function storePendingAction(action: PendingGroupDriveServerAction | null) {
  if (action) {
    localStorage.setItem(GROUP_DRIVE_PENDING_SERVER_ACTION_KEY, JSON.stringify(action));
  } else {
    localStorage.removeItem(GROUP_DRIVE_PENDING_SERVER_ACTION_KEY);
  }
}

export function getPendingGroupDriveServerAction(driveSessionId?: string) {
  const action = readPendingAction();
  if (!action) return null;
  if (driveSessionId && action.driveSessionId !== driveSessionId) return null;
  return action;
}

export async function stagePendingGroupDriveServerAction(
  kind: PendingGroupDriveServerActionKind,
  driveSessionId: string,
  preferredUserId?: string | null,
) {
  const { data } = await supabase.auth.getSession();
  const userId = preferredUserId ?? data.session?.user.id ?? null;
  if (!userId || !driveSessionId) return null;

  const action: PendingGroupDriveServerAction = {
    kind,
    driveSessionId,
    userId,
    requestedAt: new Date().toISOString(),
  };
  storePendingAction(action);
  return action;
}

export function clearPendingGroupDriveServerAction(
  kind?: PendingGroupDriveServerActionKind,
  driveSessionId?: string,
) {
  const action = readPendingAction();
  if (!action) return;
  if (kind && action.kind !== kind) return;
  if (driveSessionId && action.driveSessionId !== driveSessionId) return;
  storePendingAction(null);
}
