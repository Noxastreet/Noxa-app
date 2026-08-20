import type { DriveLocationState } from '../types';

export type GroupDriveLocationSnapshot = {
  driveSessionId: string;
  byOpaqueId: Readonly<Record<string, DriveLocationState>>;
  opaqueIdByUserId: Readonly<Record<string, string>>;
};

export type GroupDriveLocationEvent =
  | { type: 'snapshot'; rows: DriveLocationState[] }
  | { type: 'upsert'; row: DriveLocationState }
  | { type: 'delete'; opaqueId: string };

export function emptyGroupDriveLocationSnapshot(
  driveSessionId: string,
): GroupDriveLocationSnapshot {
  return { driveSessionId, byOpaqueId: {}, opaqueIdByUserId: {} };
}

export function reduceGroupDriveLocationState(
  current: GroupDriveLocationSnapshot,
  event: GroupDriveLocationEvent,
): GroupDriveLocationSnapshot {
  if (event.type === 'snapshot') {
    const next = emptyGroupDriveLocationSnapshot(current.driveSessionId);
    return event.rows.reduce(
      (state, row) => reduceGroupDriveLocationState(state, { type: 'upsert', row }),
      next,
    );
  }

  if (event.type === 'delete') {
    const removed = current.byOpaqueId[event.opaqueId];
    if (!removed) return current;
    const byOpaqueId = { ...current.byOpaqueId };
    const opaqueIdByUserId = { ...current.opaqueIdByUserId };
    delete byOpaqueId[event.opaqueId];
    if (opaqueIdByUserId[removed.userId] === event.opaqueId) {
      delete opaqueIdByUserId[removed.userId];
    }
    return { ...current, byOpaqueId, opaqueIdByUserId };
  }

  const row = event.row;
  if (row.driveSessionId !== current.driveSessionId) return current;

  const previousOpaqueId = current.opaqueIdByUserId[row.userId];
  const byOpaqueId = { ...current.byOpaqueId };
  if (previousOpaqueId && previousOpaqueId !== row.id) delete byOpaqueId[previousOpaqueId];
  byOpaqueId[row.id] = row;
  return {
    ...current,
    byOpaqueId,
    opaqueIdByUserId: { ...current.opaqueIdByUserId, [row.userId]: row.id },
  };
}

export function groupDriveLocations(snapshot: GroupDriveLocationSnapshot) {
  return Object.values(snapshot.byOpaqueId);
}
