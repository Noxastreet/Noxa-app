import { supabase } from '@/src/lib/supabase';

import type {
  DriveDestination,
  DriveDestinationProposal,
  DriveSessionStatus,
} from '../types';

type QuickDriveSessionRow = {
  id: string;
  status: DriveSessionStatus;
  host_id: string;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_label: string | null;
  destination_version: number;
  destination_updated_by: string | null;
  destination_updated_at: string | null;
  proposed_destination_latitude: number | null;
  proposed_destination_longitude: number | null;
  proposed_destination_label: string | null;
  proposed_destination_by: string | null;
  proposed_destination_at: string | null;
};

export type QuickDriveRoomState = {
  id: string;
  status: DriveSessionStatus;
  hostId: string;
  destination: DriveDestination | null;
  proposal: DriveDestinationProposal | null;
};

type Callbacks = {
  onState: (state: QuickDriveRoomState) => void;
  onEnded: () => void;
  onError?: (error: Error) => void;
};

const ROOM_RECONCILE_MS = 5_000;
let roomChannelSequence = 0;

function mapRoom(row: QuickDriveSessionRow): QuickDriveRoomState {
  const destination =
    row.destination_latitude !== null
    && row.destination_longitude !== null
    && row.destination_version > 0
      ? {
          latitude: Number(row.destination_latitude),
          longitude: Number(row.destination_longitude),
          label: row.destination_label?.trim() || 'Shared destination',
          version: Number(row.destination_version),
          updatedByUserId: row.destination_updated_by
            ? String(row.destination_updated_by)
            : null,
          updatedAt: row.destination_updated_at
            ? String(row.destination_updated_at)
            : null,
        }
      : null;

  const proposal =
    row.proposed_destination_latitude !== null
    && row.proposed_destination_longitude !== null
    && row.proposed_destination_by
    && row.proposed_destination_at
      ? {
          latitude: Number(row.proposed_destination_latitude),
          longitude: Number(row.proposed_destination_longitude),
          label: row.proposed_destination_label?.trim() || 'Proposed destination',
          proposedByUserId: String(row.proposed_destination_by),
          proposedAt: String(row.proposed_destination_at),
        }
      : null;

  return {
    id: String(row.id),
    status: row.status,
    hostId: String(row.host_id),
    destination,
    proposal,
  };
}

async function loadRoom(driveSessionId: string) {
  const { data, error } = await supabase
    .from('drive_sessions')
    .select(
      'id,status,host_id,destination_latitude,destination_longitude,destination_label,destination_version,destination_updated_by,destination_updated_at,proposed_destination_latitude,proposed_destination_longitude,proposed_destination_label,proposed_destination_by,proposed_destination_at',
    )
    .eq('id', driveSessionId)
    .eq('drive_mode', 'quick')
    .maybeSingle();
  if (error) throw new Error('Drive Together room could not be synchronized.');
  return data ? mapRoom(data as QuickDriveSessionRow) : null;
}

export async function loadQuickDriveRoomState(driveSessionId: string) {
  return loadRoom(driveSessionId);
}

export async function subscribeToQuickDriveRoomState(
  driveSessionId: string,
  callbacks: Callbacks,
) {
  let closed = false;
  let reconciling = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  const reconcile = async () => {
    if (closed || reconciling) return;
    reconciling = true;
    try {
      const room = await loadRoom(driveSessionId);
      if (closed) return;
      if (!room) {
        callbacks.onEnded();
        await teardown();
        return;
      }
      callbacks.onState(room);
    } catch (error) {
      if (!closed) {
        callbacks.onError?.(
          error instanceof Error
            ? error
            : new Error('Drive Together room could not be synchronized.'),
        );
      }
    } finally {
      reconciling = false;
    }
  };

  const channel = supabase
    .channel(`quick-drive-room:${driveSessionId}:${++roomChannelSequence}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'drive_sessions',
        filter: `id=eq.${driveSessionId}`,
      },
      () => {
        void reconcile();
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'drive_sessions',
        filter: `id=eq.${driveSessionId}`,
      },
      () => {
        if (!closed) callbacks.onEnded();
        void teardown();
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void reconcile();
    });

  const teardown = async () => {
    if (closed) return;
    closed = true;
    if (interval) clearInterval(interval);
    interval = null;
    await supabase.removeChannel(channel);
  };

  await reconcile();
  if (!closed) {
    interval = setInterval(() => {
      void reconcile();
    }, ROOM_RECONCILE_MS);
  }

  return teardown;
}
