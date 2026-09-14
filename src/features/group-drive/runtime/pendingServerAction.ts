import { supabase } from '@/src/lib/supabase';

const GROUP_DRIVE_PENDING_SERVER_ACTION_KEY = 'noxa.group-drive-pending-server-action.v2';
const LEGACY_GROUP_DRIVE_PENDING_SERVER_ACTION_KEY = 'noxa.group-drive-pending-server-action.v1';

export type PendingGroupDriveServerActionKind = 'clear_location' | 'leave' | 'end';

export type PendingGroupDriveServerAction = {
  kind: PendingGroupDriveServerActionKind;
  driveSessionId: string;
  userId: string;
  requestedAt: string;
};

type PendingGroupDriveServerActions = Record<string, PendingGroupDriveServerAction>;

function parsePendingAction(value: unknown): PendingGroupDriveServerAction | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<PendingGroupDriveServerAction>;
  if (
    !['clear_location', 'leave', 'end'].includes(parsed.kind ?? '')
    || typeof parsed.driveSessionId !== 'string'
    || typeof parsed.userId !== 'string'
    || typeof parsed.requestedAt !== 'string'
    || !Number.isFinite(Date.parse(parsed.requestedAt))
  ) {
    return null;
  }
  return parsed as PendingGroupDriveServerAction;
}

function writePendingActions(actions: PendingGroupDriveServerActions) {
  if (Object.keys(actions).length > 0) {
    localStorage.setItem(GROUP_DRIVE_PENDING_SERVER_ACTION_KEY, JSON.stringify(actions));
  } else {
    localStorage.removeItem(GROUP_DRIVE_PENDING_SERVER_ACTION_KEY);
  }
}

function readPendingActions(): PendingGroupDriveServerActions {
  let actions: PendingGroupDriveServerActions = {};
  let shouldRewrite = false;

  try {
    const raw = localStorage.getItem(GROUP_DRIVE_PENDING_SERVER_ACTION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [userId, value] of Object.entries(parsed)) {
          const action = parsePendingAction(value);
          if (action && action.userId === userId) actions[userId] = action;
          else shouldRewrite = true;
        }
      } else {
        shouldRewrite = true;
      }
    }
  } catch {
    shouldRewrite = true;
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_GROUP_DRIVE_PENDING_SERVER_ACTION_KEY);
    if (legacyRaw) {
      const legacyAction = parsePendingAction(JSON.parse(legacyRaw));
      if (legacyAction && !actions[legacyAction.userId]) {
        actions[legacyAction.userId] = legacyAction;
      }
      localStorage.removeItem(LEGACY_GROUP_DRIVE_PENDING_SERVER_ACTION_KEY);
      shouldRewrite = true;
    }
  } catch {
    localStorage.removeItem(LEGACY_GROUP_DRIVE_PENDING_SERVER_ACTION_KEY);
    shouldRewrite = true;
  }

  if (shouldRewrite) writePendingActions(actions);
  return actions;
}

export function getPendingGroupDriveServerAction(
  userId: string,
  driveSessionId?: string,
) {
  if (!userId) return null;
  const action = readPendingActions()[userId] ?? null;
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
  const actions = readPendingActions();
  actions[userId] = action;
  writePendingActions(actions);
  return action;
}

export function clearPendingGroupDriveServerAction(
  userId: string,
  kind?: PendingGroupDriveServerActionKind,
  driveSessionId?: string,
) {
  if (!userId) return;
  const actions = readPendingActions();
  const action = actions[userId];
  if (!action) return;
  if (kind && action.kind !== kind) return;
  if (driveSessionId && action.driveSessionId !== driveSessionId) return;
  delete actions[userId];
  writePendingActions(actions);
}
