import {
  selectParticipantStackWindow,
  type ParticipantStackWindow,
} from './participantStack';
import type { DriveParticipantProgress } from './routeProgress';

export type ParticipantStackIdentity = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  initials?: string;
};

export type ParticipantStackRowKind = 'distance' | 'arrived' | 'unavailable';

export type ParticipantStackRow = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  kind: ParticipantStackRowKind;
  valueLabel: string;
  accessibilityLabel: string;
  isCurrentUser: boolean;
  canFocus: boolean;
};

export type ParticipantStackPresentation = ParticipantStackWindow & {
  rows: readonly ParticipantStackRow[];
  moreAccessibilityLabel: string | null;
};

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'NX';
}

export function formatParticipantRemainingDistance(remainingMeters: number) {
  if (!Number.isFinite(remainingMeters)) return 'Unavailable';
  const kilometers = Math.max(0.1, Math.max(0, remainingMeters) / 1_000);
  return `${kilometers.toFixed(1)} km`;
}

function rowKind(progress: DriveParticipantProgress | undefined): ParticipantStackRowKind {
  if (progress?.status === 'arrived') return 'arrived';
  if (progress?.remainingMeters !== null
    && progress?.remainingMeters !== undefined
    && (progress.status === 'fresh' || progress.retainedFromLastStable)) {
    return 'distance';
  }
  return 'unavailable';
}

function valueLabel(kind: ParticipantStackRowKind, progress: DriveParticipantProgress | undefined) {
  if (kind === 'arrived') return 'Arrived';
  if (kind === 'distance' && progress?.remainingMeters !== null
    && progress?.remainingMeters !== undefined) {
    return formatParticipantRemainingDistance(progress.remainingMeters);
  }
  return 'Unavailable';
}

function canFocusParticipant(progress: DriveParticipantProgress | undefined) {
  if (!progress?.locationId) return false;
  return progress.status === 'arrived'
    || progress.status === 'fresh'
    || progress.status === 'off_route';
}

function spokenState(kind: ParticipantStackRowKind, label: string) {
  if (kind === 'arrived') return 'arrived';
  if (kind === 'unavailable') return 'location unavailable';
  return `${label.replace(' km', ' kilometres')} remaining`;
}

export function buildParticipantStackPresentation(
  identities: readonly ParticipantStackIdentity[],
  progressByUserId: Readonly<Record<string, DriveParticipantProgress>>,
  order: readonly string[],
  currentUserId: string,
  maxVisible?: number,
): ParticipantStackPresentation {
  const identityByUserId = new Map(identities.map((identity) => [identity.userId, identity]));
  const eligibleOrder = order.filter((userId) => identityByUserId.has(userId));
  const window = selectParticipantStackWindow(eligibleOrder, currentUserId, maxVisible);
  const rows = window.visibleUserIds.flatMap((userId) => {
    const identity = identityByUserId.get(userId);
    if (!identity) return [];
    const progress = progressByUserId[userId];
    const kind = rowKind(progress);
    const label = valueLabel(kind, progress);
    const isCurrentUser = userId === currentUserId;
    return [{
      userId,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl ?? null,
      initials: identity.initials?.slice(0, 2).toUpperCase() || initials(identity.displayName),
      kind,
      valueLabel: label,
      accessibilityLabel: `${isCurrentUser ? 'You, ' : ''}${identity.displayName}, ${spokenState(kind, label)}`,
      isCurrentUser,
      canFocus: canFocusParticipant(progress),
    }];
  });

  return {
    ...window,
    rows,
    moreAccessibilityLabel: window.hiddenCount > 0
      ? `${window.hiddenCount} more participants. Open participant list.`
      : null,
  };
}
