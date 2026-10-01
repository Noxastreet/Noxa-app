import {
  endAllNativeDriveActivities,
  endNativeDriveActivity,
  isDriveLiveActivitySupported,
  startNativeDriveActivity,
  updateNativeDriveActivity,
  type NativeDriveLiveActivityState,
} from '@/modules/noxa-live-activity';

import type { DriveParticipantProgress } from './runtime/routeProgress';
import type { GroupDriveDetails } from './types';

const MIN_UPDATE_INTERVAL_MS = 15_000;
const DISTANCE_BUCKET_METERS = 250;
const PROGRESS_BUCKET = 0.02;

let currentDriveSessionId: string | null = null;
let lastNativeState: NativeDriveLiveActivityState | null = null;
let lastNativeUpdateAt = 0;

function finiteOrNull(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function destinationTitle(details: GroupDriveDetails) {
  const label = details.destination?.label?.trim()
    || details.stops.find((stop) => stop.kind === 'end')?.label?.trim()
    || details.title.trim();
  return label || 'Drive Together';
}

function estimateEtaMinutes(
  details: GroupDriveDetails,
  progress: DriveParticipantProgress | null,
) {
  const fullDurationSeconds = finiteOrNull(details.routeDurationSeconds);
  const fullDistanceMeters = finiteOrNull(details.routeDistanceMeters);
  const remainingMeters = finiteOrNull(progress?.remainingMeters);

  // A static route duration is not a truthful "remaining ETA" once the drive is
  // active unless this device has current route progress. Do not fabricate motion.
  if (
    fullDurationSeconds === null
    || fullDurationSeconds < 0
    || fullDistanceMeters === null
    || fullDistanceMeters <= 0
    || remainingMeters === null
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil((fullDurationSeconds * Math.min(1, remainingMeters / fullDistanceMeters)) / 60),
  );
}

export function buildGroupDriveLiveActivityState(
  details: GroupDriveDetails,
  ownProgress: DriveParticipantProgress | null,
  activeParticipantCount?: number,
): NativeDriveLiveActivityState {
  return {
    driveSessionId: details.id,
    destinationTitle: destinationTitle(details),
    etaMinutes: estimateEtaMinutes(details, ownProgress),
    remainingDistanceMeters: finiteOrNull(ownProgress?.remainingMeters),
    participantCount: Math.max(
      1,
      activeParticipantCount
        ?? details.participants.filter((participant) => participant.status === 'active').length,
    ),
    progress: finiteOrNull(ownProgress?.progressFraction),
    status: 'active',
  };
}

function distanceBucket(value: number | null) {
  return value === null ? null : Math.round(value / DISTANCE_BUCKET_METERS);
}

function progressBucket(value: number | null) {
  return value === null ? null : Math.round(value / PROGRESS_BUCKET);
}

function materiallyDifferent(
  previous: NativeDriveLiveActivityState | null,
  next: NativeDriveLiveActivityState,
) {
  if (!previous) return true;
  return previous.driveSessionId !== next.driveSessionId
    || previous.destinationTitle !== next.destinationTitle
    || previous.etaMinutes !== next.etaMinutes
    || previous.participantCount !== next.participantCount
    || previous.status !== next.status
    || distanceBucket(previous.remainingDistanceMeters) !== distanceBucket(next.remainingDistanceMeters)
    || progressBucket(previous.progress) !== progressBucket(next.progress);
}

export async function syncGroupDriveLiveActivity(
  state: NativeDriveLiveActivityState,
) {
  if (!isDriveLiveActivitySupported()) return false;

  const now = Date.now();
  const sessionChanged = currentDriveSessionId !== state.driveSessionId;
  const shouldUpdate = materiallyDifferent(lastNativeState, state);

  if (!sessionChanged && (!shouldUpdate || now - lastNativeUpdateAt < MIN_UPDATE_INTERVAL_MS)) {
    return true;
  }

  try {
    if (sessionChanged || currentDriveSessionId === null) {
      const activityId = await startNativeDriveActivity(state);
      if (!activityId) return false;
      currentDriveSessionId = state.driveSessionId;
    } else {
      const updated = await updateNativeDriveActivity(state);
      if (!updated) {
        const activityId = await startNativeDriveActivity(state);
        if (!activityId) return false;
      }
    }
    lastNativeState = state;
    lastNativeUpdateAt = now;
    return true;
  } catch {
    return false;
  }
}

export async function endGroupDriveLiveActivity(driveSessionId: string) {
  try {
    await endNativeDriveActivity(driveSessionId);
  } catch {
    // Live Activity is non-critical and must never block Drive Together cleanup.
  } finally {
    if (currentDriveSessionId === driveSessionId) {
      currentDriveSessionId = null;
      lastNativeState = null;
      lastNativeUpdateAt = 0;
    }
  }
}

export async function endAllGroupDriveLiveActivities() {
  try {
    await endAllNativeDriveActivities();
  } catch {
    // Sign-out and app runtime remain authoritative if ActivityKit is unavailable.
  } finally {
    currentDriveSessionId = null;
    lastNativeState = null;
    lastNativeUpdateAt = 0;
  }
}
