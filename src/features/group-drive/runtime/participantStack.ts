import type { DriveParticipantProgress } from './routeProgress';

export const GROUP_DRIVE_REORDER_ADVANTAGE_METERS = 150;
export const GROUP_DRIVE_REORDER_CONFIRMATIONS = 2;
export const GROUP_DRIVE_STACK_MAX_VISIBLE = 5;

export type ParticipantStackOrderState = {
  order: readonly string[];
  pendingOrder: readonly string[] | null;
  pendingConfirmations: number;
};

export type ParticipantStackOrderOptions = {
  advantageMeters?: number;
  confirmationsRequired?: number;
};

export type ParticipantStackWindow = {
  visibleUserIds: readonly string[];
  hiddenCount: number;
  currentUserReserved: boolean;
};

export function emptyParticipantStackOrderState(): ParticipantStackOrderState {
  return { order: [], pendingOrder: null, pendingConfirmations: 0 };
}

function sameOrder(left: readonly string[] | null, right: readonly string[]) {
  return left !== null
    && left.length === right.length
    && left.every((userId, index) => userId === right[index]);
}

function progressGroup(progress: DriveParticipantProgress) {
  if (progress.status === 'arrived') return 0;
  if ((progress.status === 'fresh' || progress.retainedFromLastStable)
    && progress.remainingMeters !== null) return 1;
  return 2;
}

function stableGroupOrder(
  participantIds: readonly string[],
  previousIndex: ReadonlyMap<string, number>,
) {
  return [...participantIds].sort((left, right) => {
    const leftIndex = previousIndex.get(left);
    const rightIndex = previousIndex.get(right);
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

function orderFreshParticipants(
  participantIds: readonly string[],
  byUserId: Readonly<Record<string, DriveParticipantProgress>>,
  advantageMeters: number,
) {
  const ordered = [...participantIds];
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = byUserId[ordered[index - 1]].remainingMeters as number;
      const current = byUserId[ordered[index]].remainingMeters as number;
      if (current < previous && current + advantageMeters <= previous) {
        [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
        changed = true;
      }
    }
  }
  return ordered;
}

export function reduceParticipantStackOrder(
  current: ParticipantStackOrderState,
  participants: readonly DriveParticipantProgress[],
  options: ParticipantStackOrderOptions = {},
): ParticipantStackOrderState {
  const advantageMeters = options.advantageMeters !== undefined
    && Number.isFinite(options.advantageMeters)
    ? Math.max(0, options.advantageMeters)
    : GROUP_DRIVE_REORDER_ADVANTAGE_METERS;
  const confirmationsRequired = options.confirmationsRequired !== undefined
    && Number.isFinite(options.confirmationsRequired)
    ? Math.max(1, Math.floor(options.confirmationsRequired))
    : GROUP_DRIVE_REORDER_CONFIRMATIONS;
  const uniqueParticipants = [...new Map(
    participants.map((participant) => [participant.userId, participant]),
  ).values()];
  const byUserId = Object.fromEntries(
    uniqueParticipants.map((participant) => [participant.userId, participant]),
  );
  const participantIds = new Set(uniqueParticipants.map(({ userId }) => userId));
  const baseline = current.order.filter((userId) => participantIds.has(userId));
  const baselineIds = new Set(baseline);
  const newcomers = uniqueParticipants
    .map(({ userId }) => userId)
    .filter((userId) => !baselineIds.has(userId))
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  baseline.push(...newcomers);

  if (!baseline.length) return emptyParticipantStackOrderState();
  const previousIndex = new Map(baseline.map((userId, index) => [userId, index]));
  const arrived = stableGroupOrder(
    baseline.filter((userId) => progressGroup(byUserId[userId]) === 0),
    previousIndex,
  );
  const fresh = orderFreshParticipants(
    stableGroupOrder(
      baseline.filter((userId) => progressGroup(byUserId[userId]) === 1),
      previousIndex,
    ),
    byUserId,
    advantageMeters,
  );
  const unavailable = stableGroupOrder(
    baseline.filter((userId) => progressGroup(byUserId[userId]) === 2),
    previousIndex,
  );
  const candidate = [...arrived, ...fresh, ...unavailable];

  if (!current.order.length || sameOrder(candidate, baseline)) {
    return { order: candidate, pendingOrder: null, pendingConfirmations: 0 };
  }

  const pendingConfirmations = sameOrder(current.pendingOrder, candidate)
    ? current.pendingConfirmations + 1
    : 1;
  if (pendingConfirmations >= confirmationsRequired) {
    return { order: candidate, pendingOrder: null, pendingConfirmations: 0 };
  }
  return { order: baseline, pendingOrder: candidate, pendingConfirmations };
}

export function selectParticipantStackWindow(
  order: readonly string[],
  currentUserId: string,
  maxVisible = GROUP_DRIVE_STACK_MAX_VISIBLE,
): ParticipantStackWindow {
  const safeMaxVisible = Number.isFinite(maxVisible)
    ? Math.max(1, Math.floor(maxVisible))
    : GROUP_DRIVE_STACK_MAX_VISIBLE;
  const visibleUserIds = order.slice(0, safeMaxVisible);
  const currentIndex = order.indexOf(currentUserId);
  const currentUserReserved = currentIndex >= safeMaxVisible;
  if (currentUserReserved) visibleUserIds[visibleUserIds.length - 1] = currentUserId;
  return {
    visibleUserIds,
    hiddenCount: Math.max(0, order.length - visibleUserIds.length),
    currentUserReserved,
  };
}
