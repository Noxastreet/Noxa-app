import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/src/lib/supabase';

import type { DriveLocationState, DriveParticipantStatus, DriveSessionStatus } from '../types';
import {
  emptyGroupDriveLocationSnapshot,
  reduceGroupDriveLocationState,
  type GroupDriveLocationEvent,
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

type ParticipantDatabaseRow = {
  user_id: string;
  status: DriveParticipantStatus;
};

type SessionDatabaseRow = {
  status: DriveSessionStatus;
  active_expires_at: string | null;
};

export type ActiveDriveParticipantState = {
  userId: string;
  status: DriveParticipantStatus;
};

export type ActiveDriveLifecycleSnapshot = {
  sessionStatus: DriveSessionStatus;
  activeExpiresAt: string | null;
  participants: ActiveDriveParticipantState[];
};

export type ActiveDriveRealtimeSnapshot = ActiveDriveLifecycleSnapshot & {
  locations: GroupDriveLocationSnapshot;
};

export type ActiveDriveRealtimeConnection = 'connecting' | 'subscribed' | 'reconnecting' | 'closed';

export type ActiveDriveRealtimeCallbacks = {
  onSnapshot: (snapshot: ActiveDriveRealtimeSnapshot) => void;
  onConnectionChange?: (state: ActiveDriveRealtimeConnection) => void;
  onAccessRevoked?: () => void;
  onError?: (error: Error) => void;
};

export type ActiveDriveAccessCallbacks = {
  onAccessRevoked?: () => void;
  onError?: (error: Error) => void;
};

const LIFECYCLE_RECONCILE_INTERVAL_MS = 5000;
let runtimeChannelSequence = 0;

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

function mapParticipants(rows: ParticipantDatabaseRow[]): ActiveDriveParticipantState[] {
  return rows.map((row) => ({
    userId: String(row.user_id),
    status: row.status as DriveParticipantStatus,
  }));
}

async function requireAuthenticatedUserId() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in to open this Active Drive.');
  return authData.user.id;
}

function requireActiveDriveAccess(
  session: SessionDatabaseRow | null,
  participants: ActiveDriveParticipantState[],
  currentUserId: string,
): SessionDatabaseRow {
  const ownParticipant = participants.find(({ userId }) => userId === currentUserId);
  if (!session || session.status !== 'active' || ownParticipant?.status !== 'active') {
    throw new Error('Active Drive access is no longer available.');
  }
  return session;
}

async function loadActiveDriveLifecycleSnapshotForUser(
  driveSessionId: string,
  currentUserId: string,
): Promise<ActiveDriveLifecycleSnapshot> {
  const [sessionResult, participantsResult] = await Promise.all([
    supabase
      .from('drive_sessions')
      .select('status,active_expires_at')
      .eq('id', driveSessionId)
      .maybeSingle(),
    supabase
      .from('drive_participants')
      .select('user_id,status')
      .eq('drive_session_id', driveSessionId),
  ]);
  const error = sessionResult.error ?? participantsResult.error;
  if (error) throw new Error('Active Drive state could not be synchronized.');

  const session = sessionResult.data as SessionDatabaseRow | null;
  const participants = mapParticipants((participantsResult.data ?? []) as ParticipantDatabaseRow[]);
  const activeSession = requireActiveDriveAccess(session, participants, currentUserId);

  return {
    sessionStatus: activeSession.status as DriveSessionStatus,
    activeExpiresAt: activeSession.active_expires_at ? String(activeSession.active_expires_at) : null,
    participants,
  };
}

async function loadActiveDriveRealtimeSnapshotForUser(
  driveSessionId: string,
  currentUserId: string,
): Promise<ActiveDriveRealtimeSnapshot> {
  const [lifecycle, locationsResult] = await Promise.all([
    loadActiveDriveLifecycleSnapshotForUser(driveSessionId, currentUserId),
    supabase
      .from('drive_location_state')
      .select('id,drive_session_id,user_id,latitude,longitude,heading,status,updated_at')
      .eq('drive_session_id', driveSessionId),
  ]);
  if (locationsResult.error) throw new Error('Active Drive state could not be synchronized.');

  return {
    ...lifecycle,
    locations: reduceGroupDriveLocationState(emptyGroupDriveLocationSnapshot(driveSessionId), {
      type: 'snapshot',
      rows: (locationsResult.data ?? []).map((row) => mapLocation(row as LocationDatabaseRow)),
    }),
  };
}

export async function loadActiveDriveLifecycleSnapshot(
  driveSessionId: string,
): Promise<ActiveDriveLifecycleSnapshot> {
  const currentUserId = await requireAuthenticatedUserId();
  return loadActiveDriveLifecycleSnapshotForUser(driveSessionId, currentUserId);
}

export async function loadActiveDriveRealtimeSnapshot(
  driveSessionId: string,
): Promise<ActiveDriveRealtimeSnapshot> {
  const currentUserId = await requireAuthenticatedUserId();
  return loadActiveDriveRealtimeSnapshotForUser(driveSessionId, currentUserId);
}

export async function subscribeToActiveDriveRealtime(
  driveSessionId: string,
  callbacks: ActiveDriveRealtimeCallbacks,
) {
  let closed = false;
  let current: ActiveDriveRealtimeSnapshot | null = null;
  let currentUserId: string | null = null;
  let fullReconcilePromise: Promise<void> | null = null;
  let lifecycleReconcilePromise: Promise<void> | null = null;
  let channel: RealtimeChannel | null = null;
  let unsubscribeAuth: (() => void) | null = null;
  let lifecycleInterval: ReturnType<typeof setInterval> | null = null;
  const pendingLocationEvents: GroupDriveLocationEvent[] = [];
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

  const handleSyncError = (error: unknown) => {
    const nextError = error instanceof Error ? error : new Error('Active Drive sync failed.');
    if (/access is no longer available/i.test(nextError.message)) {
      callbacks.onAccessRevoked?.();
      void teardown();
    } else {
      callbacks.onError?.(nextError);
    }
  };

  const reconcileFull = () => {
    if (fullReconcilePromise) return fullReconcilePromise;
    if (!currentUserId) return Promise.resolve();
    fullReconcilePromise = loadActiveDriveRealtimeSnapshotForUser(driveSessionId, currentUserId)
      .then((snapshot) => {
        current = snapshot;
        if (pendingLocationEvents.length) {
          current = {
            ...current,
            locations: pendingLocationEvents.splice(0).reduce(
              (locations, event) => reduceGroupDriveLocationState(locations, event),
              current.locations,
            ),
          };
        }
        publish();
      })
      .catch(handleSyncError)
      .finally(() => {
        fullReconcilePromise = null;
      });
    return fullReconcilePromise;
  };

  const reconcileLifecycle = () => {
    if (lifecycleReconcilePromise) return lifecycleReconcilePromise;
    if (fullReconcilePromise) return fullReconcilePromise;
    if (!currentUserId) return Promise.resolve();
    lifecycleReconcilePromise = loadActiveDriveLifecycleSnapshotForUser(driveSessionId, currentUserId)
      .then((lifecycle) => {
        if (!current) return;
        current = {
          ...current,
          ...lifecycle,
        };
        publish();
      })
      .catch(handleSyncError)
      .finally(() => {
        lifecycleReconcilePromise = null;
      });
    return lifecycleReconcilePromise;
  };

  try {
    currentUserId = await requireAuthenticatedUserId();
  } catch (error) {
    handleSyncError(error);
    return async () => undefined;
  }

  await reconcileFull();
  if (!current || closed) return async () => undefined;

  const applyLocation = (row: LocationDatabaseRow) => {
    const event: GroupDriveLocationEvent = { type: 'upsert', row: mapLocation(row) };
    if (fullReconcilePromise) {
      pendingLocationEvents.push(event);
      return;
    }
    if (!current) return;
    current = {
      ...current,
      locations: reduceGroupDriveLocationState(current.locations, event),
    };
    publish();
  };
  const applyOpaqueDelete = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    const oldRow = payload.old as Partial<Record<string, unknown>>;
    const opaqueId = typeof oldRow.id === 'string' ? oldRow.id : null;
    if (!opaqueId) return;
    const event: GroupDriveLocationEvent = { type: 'delete', opaqueId };
    if (fullReconcilePromise) {
      pendingLocationEvents.push(event);
      return;
    }
    if (!current) return;
    current = {
      ...current,
      locations: reduceGroupDriveLocationState(current.locations, event),
    };
    publish();
  };

  channel = supabase
    .channel(`group-drive-runtime-${driveSessionId}-${++runtimeChannelSequence}`)
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
        // Close the gap between the initial snapshot and the moment Realtime
        // actually became subscribed. This is the only recurring path that
        // needs to re-read location rows; the 5 s heartbeat below checks only
        // session/participant lifecycle state.
        void reconcileFull();
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
  lifecycleInterval = setInterval(() => {
    // Re-publish locally so freshness ages even with no network. The network
    // safety check intentionally excludes drive_location_state: location rows
    // arrive through Realtime and are fully reconciled on (re)subscription.
    publish();
    void reconcileLifecycle();
  }, LIFECYCLE_RECONCILE_INTERVAL_MS);

  return teardown;
}

export async function subscribeToActiveDriveAccess(
  driveSessionId: string,
  callbacks: ActiveDriveAccessCallbacks,
) {
  let closed = false;
  let currentUserId: string | null = null;
  let reconcilePromise: Promise<void> | null = null;
  let unsubscribeAuth: (() => void) | null = null;
  let lifecycleInterval: ReturnType<typeof setInterval> | null = null;

  const teardown = async () => {
    if (closed) return;
    closed = true;
    unsubscribeAuth?.();
    unsubscribeAuth = null;
    if (lifecycleInterval) clearInterval(lifecycleInterval);
    lifecycleInterval = null;
  };

  const handleSyncError = (error: unknown) => {
    const nextError = error instanceof Error ? error : new Error('Active Drive sync failed.');
    if (/access is no longer available/i.test(nextError.message)) {
      callbacks.onAccessRevoked?.();
      void teardown();
    } else {
      callbacks.onError?.(nextError);
    }
  };

  const reconcile = () => {
    if (reconcilePromise) return reconcilePromise;
    if (!currentUserId) return Promise.resolve();
    reconcilePromise = loadActiveDriveLifecycleSnapshotForUser(driveSessionId, currentUserId)
      .then(() => undefined)
      .catch(handleSyncError)
      .finally(() => {
        reconcilePromise = null;
      });
    return reconcilePromise;
  };

  try {
    currentUserId = await requireAuthenticatedUserId();
  } catch (error) {
    handleSyncError(error);
    return async () => undefined;
  }

  await reconcile();
  if (closed) return async () => undefined;

  const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      callbacks.onAccessRevoked?.();
      void teardown();
    }
  });
  unsubscribeAuth = () => authListener.subscription.unsubscribe();
  lifecycleInterval = setInterval(() => {
    void reconcile();
  }, LIFECYCLE_RECONCILE_INTERVAL_MS);

  return teardown;
}
