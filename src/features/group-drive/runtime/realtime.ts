import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/src/lib/supabase';

import type { DriveLocationState, DriveParticipantStatus, DriveSessionStatus } from '../types';
import {
  emptyGroupDriveLocationSnapshot,
  reduceGroupDriveLocationState,
  type GroupDriveLocationSnapshot,
} from './locationState';

type LocationDatabaseRow = {
  id: string;
  drive_session_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  status: DriveLocationState['status'];
  updated_at: string;
};

export type ActiveDriveParticipantState = {
  userId: string;
  status: DriveParticipantStatus;
};

export type ActiveDriveRealtimeSnapshot = {
  sessionStatus: DriveSessionStatus;
  activeExpiresAt: string | null;
  participants: ActiveDriveParticipantState[];
  locations: GroupDriveLocationSnapshot;
};

export type ActiveDriveRealtimeConnection = 'connecting' | 'subscribed' | 'reconnecting' | 'closed';

export type ActiveDriveRealtimeCallbacks = {
  onSnapshot: (snapshot: ActiveDriveRealtimeSnapshot) => void;
  onConnectionChange?: (state: ActiveDriveRealtimeConnection) => void;
  onAccessRevoked?: () => void;
  onError?: (error: Error) => void;
};

const LIFECYCLE_RECONCILE_INTERVAL_MS = 5000;

function mapLocation(row: LocationDatabaseRow): DriveLocationState {
  return {
    id: String(row.id),
    driveSessionId: String(row.drive_session_id),
    userId: String(row.user_id),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    heading: row.heading === null ? null : Number(row.heading),
    status: row.status,
    updatedAt: String(row.updated_at),
  };
}

export async function loadActiveDriveRealtimeSnapshot(
  driveSessionId: string,
): Promise<ActiveDriveRealtimeSnapshot> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in to open this Active Drive.');

  const [sessionResult, participantsResult, locationsResult] = await Promise.all([
    supabase
      .from('drive_sessions')
      .select('status,active_expires_at')
      .eq('id', driveSessionId)
      .maybeSingle(),
    supabase
      .from('drive_participants')
      .select('user_id,status')
      .eq('drive_session_id', driveSessionId),
    supabase
      .from('drive_location_state')
      .select('id,drive_session_id,user_id,latitude,longitude,heading,status,updated_at')
      .eq('drive_session_id', driveSessionId),
  ]);
  const error = sessionResult.error ?? participantsResult.error ?? locationsResult.error;
  if (error) throw new Error('Active Drive state could not be synchronized.');

  const session = sessionResult.data;
  const participants = (participantsResult.data ?? []).map((row) => ({
    userId: String(row.user_id),
    status: row.status as DriveParticipantStatus,
  }));
  const ownParticipant = participants.find(({ userId }) => userId === authData.user.id);
  if (!session || session.status !== 'active' || ownParticipant?.status !== 'active') {
    throw new Error('Active Drive access is no longer available.');
  }

  return {
    sessionStatus: session.status as DriveSessionStatus,
    activeExpiresAt: session.active_expires_at ? String(session.active_expires_at) : null,
    participants,
    locations: reduceGroupDriveLocationState(emptyGroupDriveLocationSnapshot(driveSessionId), {
      type: 'snapshot',
      rows: (locationsResult.data ?? []).map((row) => mapLocation(row as LocationDatabaseRow)),
    }),
  };
}

export async function subscribeToActiveDriveRealtime(
  driveSessionId: string,
  callbacks: ActiveDriveRealtimeCallbacks,
) {
  let closed = false;
  let current: ActiveDriveRealtimeSnapshot | null = null;
  let reconcilePromise: Promise<void> | null = null;
  let channel: RealtimeChannel | null = null;
  let unsubscribeAuth: (() => void) | null = null;
  let lifecycleInterval: ReturnType<typeof setInterval> | null = null;
  callbacks.onConnectionChange?.('connecting');

  const teardown = async () => {
    if (closed) return;
    closed = true;
    callbacks.onConnectionChange?.('closed');
    unsubscribeAuth?.();
    unsubscribeAuth = null;
    if (lifecycleInterval) clearInterval(lifecycleInterval);
    lifecycleInterval = null;
    if (channel) await supabase.removeChannel(channel);
  };

  const publish = () => {
    if (!closed && current) callbacks.onSnapshot(current);
  };
  const reconcile = () => {
    if (reconcilePromise) return reconcilePromise;
    reconcilePromise = loadActiveDriveRealtimeSnapshot(driveSessionId)
      .then((snapshot) => {
        current = snapshot;
        publish();
      })
      .catch((error: unknown) => {
        const nextError = error instanceof Error ? error : new Error('Active Drive sync failed.');
        if (/access is no longer available/i.test(nextError.message)) {
          callbacks.onAccessRevoked?.();
          void teardown();
        }
        else callbacks.onError?.(nextError);
      })
      .finally(() => {
        reconcilePromise = null;
      });
    return reconcilePromise;
  };

  await reconcile();
  if (!current || closed) return async () => undefined;

  const applyLocation = (row: LocationDatabaseRow) => {
    if (!current) return;
    current = {
      ...current,
      locations: reduceGroupDriveLocationState(current.locations, {
        type: 'upsert',
        row: mapLocation(row),
      }),
    };
    publish();
  };
  const applyOpaqueDelete = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    const oldRow = payload.old as Partial<Record<string, unknown>>;
    const opaqueId = typeof oldRow.id === 'string' ? oldRow.id : null;
    if (!current || !opaqueId) return;
    current = {
      ...current,
      locations: reduceGroupDriveLocationState(current.locations, { type: 'delete', opaqueId }),
    };
    publish();
  };

  channel = supabase
    .channel(`group-drive-runtime-${driveSessionId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'drive_location_state',
      filter: `drive_session_id=eq.${driveSessionId}`,
    }, (payload) => applyLocation(payload.new as LocationDatabaseRow))
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'drive_location_state',
      filter: `drive_session_id=eq.${driveSessionId}`,
    }, (payload) => applyLocation(payload.new as LocationDatabaseRow))
    .on('postgres_changes', {
      event: 'DELETE', schema: 'public', table: 'drive_location_state',
    }, applyOpaqueDelete)
    .subscribe((status) => {
      if (closed) return;
      if (status === 'SUBSCRIBED') {
        callbacks.onConnectionChange?.('subscribed');
        void reconcile();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        callbacks.onConnectionChange?.('reconnecting');
      } else if (status === 'CLOSED') {
        callbacks.onConnectionChange?.('closed');
      }
    });

  const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      callbacks.onAccessRevoked?.();
      void teardown();
    }
  });
  unsubscribeAuth = () => authListener.subscription.unsubscribe();
  lifecycleInterval = setInterval(() => void reconcile(), LIFECYCLE_RECONCILE_INTERVAL_MS);

  return teardown;
}
