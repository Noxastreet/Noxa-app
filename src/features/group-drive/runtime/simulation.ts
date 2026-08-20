import {
  emptyGroupDriveLocationSnapshot,
  reduceGroupDriveLocationState,
  type GroupDriveLocationSnapshot,
} from './locationState';
import type { DriveLocationState, DriveLocationStatus } from '../types';

export type SimulatedParticipant = {
  userId: string;
  path: { latitude: number; longitude: number; heading?: number | null }[];
};

export type GroupDriveSimulation = {
  snapshot: GroupDriveLocationSnapshot;
  tick: (at?: Date) => GroupDriveLocationSnapshot;
  remove: (userId: string) => GroupDriveLocationSnapshot;
  reset: () => GroupDriveLocationSnapshot;
};

function simulatedStatus(index: number, lastIndex: number): DriveLocationStatus {
  if (index >= lastIndex) return 'arrived';
  return 'moving';
}

export function createGroupDriveSimulation(
  driveSessionId: string,
  participants: SimulatedParticipant[],
): GroupDriveSimulation {
  let step = 0;
  let snapshot = emptyGroupDriveLocationSnapshot(driveSessionId);
  const removedUserIds = new Set<string>();

  const api: GroupDriveSimulation = {
    get snapshot() {
      return snapshot;
    },
    tick(at = new Date()) {
      const rows: DriveLocationState[] = participants
        .filter((participant) => participant.path.length > 0 && !removedUserIds.has(participant.userId))
        .map((participant) => {
          const index = Math.min(step, participant.path.length - 1);
          const point = participant.path[index];
          return {
            id: `sim-${participant.userId}`,
            driveSessionId,
            userId: participant.userId,
            latitude: point.latitude,
            longitude: point.longitude,
            heading: point.heading ?? null,
            status: simulatedStatus(index, participant.path.length - 1),
            updatedAt: at.toISOString(),
          };
        });
      snapshot = reduceGroupDriveLocationState(snapshot, { type: 'snapshot', rows });
      step += 1;
      return snapshot;
    },
    remove(userId) {
      removedUserIds.add(userId);
      const opaqueId = snapshot.opaqueIdByUserId[userId];
      if (opaqueId) {
        snapshot = reduceGroupDriveLocationState(snapshot, { type: 'delete', opaqueId });
      }
      return snapshot;
    },
    reset() {
      step = 0;
      removedUserIds.clear();
      snapshot = emptyGroupDriveLocationSnapshot(driveSessionId);
      return snapshot;
    },
  };
  return api;
}
