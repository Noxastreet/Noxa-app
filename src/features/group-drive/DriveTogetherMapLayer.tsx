import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  acceptGroupDriveLocationDisclosure,
  cancelDrive,
  createQuickDrive,
  endGroupDrive,
  findMyActiveQuickDriveId,
  findMyWaitingQuickDrive,
  getQuickDriveInvitation,
  getGroupDriveLocationSession,
  getPendingQuickDriveInvitation,
  groupDriveLocations,
  leaveGroupDriveAndStopLocation,
  listDriveTogetherFriends,
  loadActiveDriveRealtimeSnapshot,
  loadGroupDriveDetails,
  requestGroupDriveLocationPermissions,
  respondToDriveInvitation,
  startGroupDriveLocationSession,
  subscribeToActiveDriveRealtime,
  subscribeToDriveLobbyStatus,
  type ActiveDriveRealtimeConnection,
  type ActiveDriveRealtimeSnapshot,
  type DriveProfile,
  type GroupDriveDetails,
} from '@/src/features/group-drive';
import type { MapboxDriver } from '@/src/features/mapbox/types';
import { colors, radius, spacing, typography } from '@/src/theme';

type WaitingDrive = {
  driveSessionId: string;
  invitationId: string;
  friend: DriveProfile | null;
};

type InviteCard = {
  invitationId: string;
  driveSessionId: string;
  hostDisplayName: string;
};

type Props = {
  open: boolean;
  invitationId?: string | null;
  bottomOffset: number;
  onOpenChange: (open: boolean) => void;
  onDriversChange: (drivers: MapboxDriver[]) => void;
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || 'NX'
  );
}

function connectionLabel(connection: ActiveDriveRealtimeConnection) {
  if (connection === 'subscribed') return 'LIVE';
  if (connection === 'reconnecting') return 'RECONNECTING';
  if (connection === 'closed') return 'OFFLINE';
  return 'CONNECTING';
}

export function DriveTogetherMapLayer({
  open,
  invitationId,
  bottomOffset,
  onOpenChange,
  onDriversChange,
}: Props) {
  const [friends, setFriends] = useState<DriveProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<WaitingDrive | null>(null);
  const [invite, setInvite] = useState<InviteCard | null>(null);
  const [activeDriveId, setActiveDriveId] = useState<string | null>(null);
  const [details, setDetails] = useState<GroupDriveDetails | null>(null);
  const [snapshot, setSnapshot] = useState<ActiveDriveRealtimeSnapshot | null>(null);
  const [connection, setConnection] = useState<ActiveDriveRealtimeConnection>('closed');
  const [sharingLocation, setSharingLocation] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const explicitInvitationRef = useRef<string | null>(null);

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    setError(null);
    try {
      setFriends(await listDriveTogetherFriends());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Friends could not be loaded.');
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !friendsLoading && friends.length === 0) void loadFriends();
  }, [friends.length, friendsLoading, loadFriends, open]);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      try {
        const active = await findMyActiveQuickDriveId();
        if (disposed) return;
        if (active) {
          setActiveDriveId(active);
          setWaiting(null);
          setInvite(null);
          return;
        }

        const pendingHost = await findMyWaitingQuickDrive();
        if (disposed) return;
        if (pendingHost) {
          setWaiting(pendingHost);
          return;
        }

        const pendingInvite = await getPendingQuickDriveInvitation();
        if (!disposed && pendingInvite) {
          setInvite({
            invitationId: pendingInvite.invitationId,
            driveSessionId: pendingInvite.driveSessionId,
            hostDisplayName: pendingInvite.hostDisplayName,
          });
        }
      } catch {
        // Quick-flow migration may not exist in an older build/environment yet.
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const id = invitationId?.trim() || null;
    if (!id || explicitInvitationRef.current === id) return;
    explicitInvitationRef.current = id;
    let disposed = false;

    void getQuickDriveInvitation(id)
      .then((preview) => {
        if (disposed) return;
        if (!preview) {
          router.push({ pathname: '/group-drives/invitation/[id]', params: { id } });
          return;
        }
        setInvite({
          invitationId: id,
          driveSessionId: preview.driveSessionId,
          hostDisplayName: preview.hostDisplayName,
        });
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
    };
  }, [invitationId]);

  useEffect(() => {
    if (!waiting?.driveSessionId) return undefined;
    return subscribeToDriveLobbyStatus(waiting.driveSessionId, (status) => {
      if (status === 'active') {
        setActiveDriveId(waiting.driveSessionId);
        setWaiting(null);
      } else if (status === 'cancelled' || status === 'completed') {
        setWaiting(null);
      }
    });
  }, [waiting]);

  useEffect(() => {
    let disposed = false;
    let teardown: (() => Promise<void>) | null = null;

    if (!activeDriveId) {
      setDetails(null);
      setSnapshot(null);
      setConnection('closed');
      onDriversChange([]);
      setIsSharingLocation(false);
      return () => undefined;
    }

    setConnection('connecting');
    void Promise.all([
      loadGroupDriveDetails(activeDriveId),
      loadActiveDriveRealtimeSnapshot(activeDriveId),
    ])
      .then(([nextDetails, nextSnapshot]) => {
        if (disposed) return;
        setDetails(nextDetails);
        setSnapshot(nextSnapshot);
        setIsSharingLocation(getGroupDriveLocationSession()?.driveSessionId === activeDriveId);
        return subscribeToActiveDriveRealtime(activeDriveId, {
          onSnapshot: (next) => {
            if (!disposed) setSnapshot(next);
          },
          onConnectionChange: (next) => {
            if (!disposed) setConnection(next);
          },
          onAccessRevoked: () => {
            if (disposed) return;
            setActiveDriveId(null);
            setDetails(null);
            setSnapshot(null);
            onDriversChange([]);
          },
          onError: (syncError) => {
            if (!disposed) setError(syncError.message);
          },
        });
      })
      .then((nextTeardown) => {
        if (!nextTeardown) return;
        if (disposed) void nextTeardown();
        else teardown = nextTeardown;
      })
      .catch((loadError) => {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : 'Drive Together could not be opened.');
        }
      });

    return () => {
      disposed = true;
      if (teardown) void teardown();
    };
  }, [activeDriveId, onDriversChange]);

  const driveDrivers = useMemo<MapboxDriver[]>(() => {
    if (!details || !snapshot) return [];
    const profiles = new Map(details.participants.map((participant) => [participant.userId, participant.profile]));
    return groupDriveLocations(snapshot.locations)
      .filter((location) => location.userId !== details.currentUserId)
      .map((location) => {
        const profile = profiles.get(location.userId);
        return {
          user_id: location.userId,
          latitude: location.latitude,
          longitude: location.longitude,
          label: profile?.displayName ?? 'Drive Together',
          avatar_url: profile?.avatarUrl ?? null,
          is_relevant: true,
          is_dimmed: location.status === 'stale',
        };
      });
  }, [details, snapshot]);

  useEffect(() => {
    onDriversChange(driveDrivers);
  }, [driveDrivers, onDriversChange]);

  const createWithFriend = useCallback(
    async (friend: DriveProfile) => {
      if (working) return;
      setWorking(true);
      setError(null);
      try {
        const created = await createQuickDrive(friend.id);
        setWaiting({
          driveSessionId: created.driveSessionId,
          invitationId: created.invitationId,
          friend,
        });
        setInvite(null);
        onOpenChange(false);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : 'Drive Together could not be created.');
      } finally {
        setWorking(false);
      }
    },
    [onOpenChange, working],
  );

  const joinInvite = useCallback(async () => {
    if (!invite || working) return;
    setWorking(true);
    setError(null);
    try {
      const changed = await respondToDriveInvitation(invite.invitationId, true);
      if (!changed) throw new Error('This invitation is no longer available.');
      const nextDetails = await loadGroupDriveDetails(invite.driveSessionId);
      setInvite(null);

      if (nextDetails.driveMode !== 'quick' || nextDetails.status !== 'active') {
        router.push({ pathname: '/group-drives/[id]', params: { id: invite.driveSessionId } });
        return;
      }

      setActiveDriveId(invite.driveSessionId);
      const consent = acceptGroupDriveLocationDisclosure(invite.driveSessionId);
      await requestGroupDriveLocationPermissions();
      await startGroupDriveLocationSession(consent);
      setIsSharingLocation(true);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Drive Together could not be joined.');
    } finally {
      setWorking(false);
    }
  }, [invite, working]);

  const dismissInvite = useCallback(() => {
    setInvite(null);
  }, []);

  const cancelWaiting = useCallback(async () => {
    if (!waiting || working) return;
    setWorking(true);
    setError(null);
    try {
      await cancelDrive(waiting.driveSessionId);
      setWaiting(null);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Invitation could not be cancelled.');
    } finally {
      setWorking(false);
    }
  }, [waiting, working]);

  const enableSharing = useCallback(async () => {
    if (!activeDriveId || sharingLocation || isSharingLocation) return;
    setSharingLocation(true);
    setError(null);
    try {
      const consent = acceptGroupDriveLocationDisclosure(activeDriveId);
      await requestGroupDriveLocationPermissions();
      await startGroupDriveLocationSession(consent);
      setIsSharingLocation(true);
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Location sharing could not be started.');
    } finally {
      setSharingLocation(false);
    }
  }, [activeDriveId, isSharingLocation, sharingLocation]);

  const finishActive = useCallback(async () => {
    if (!details || working) return;
    const isHost = details.hostId === details.currentUserId;
    Alert.alert(
      isHost ? 'End Drive Together?' : 'Leave Drive Together?',
      isHost
        ? 'This ends the shared drive for both drivers.'
        : 'You will stop sharing your Group Drive location immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isHost ? 'End' : 'Leave',
          style: 'destructive',
          onPress: () => {
            setWorking(true);
            setError(null);
            void (isHost
              ? endGroupDrive(details.id)
              : leaveGroupDriveAndStopLocation(details.id)
            )
              .then(() => {
                setActiveDriveId(null);
                setDetails(null);
                setSnapshot(null);
                setIsSharingLocation(false);
                onDriversChange([]);
              })
              .catch((finishError) => {
                setError(finishError instanceof Error ? finishError.message : 'Drive Together could not be ended.');
              })
              .finally(() => setWorking(false));
          },
        },
      ],
    );
  }, [details, onDriversChange, working]);

  const otherParticipant = details?.participants.find(
    (participant) => participant.userId !== details.currentUserId && participant.status === 'active',
  );
  const otherName = otherParticipant?.profile?.displayName ?? 'your friend';

  return (
    <>
      <Modal
        animationType="slide"
        onRequestClose={() => onOpenChange(false)}
        presentationStyle="pageSheet"
        visible={open}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.eyebrow}>DRIVE TOGETHER</Text>
              <Text style={styles.sheetTitle}>Choose a friend</Text>
              <Text style={styles.sheetBody}>Tap once to send a private driving invitation.</Text>
            </View>
            <Pressable
              accessibilityLabel="Close Drive Together"
              onPress={() => onOpenChange(false)}
              style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {friendsLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.muted}>Loading friends…</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(friend) => friend.id}
              contentContainerStyle={styles.friendList}
              ListEmptyComponent={
                <Text style={styles.empty}>No mutual friends available yet.</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  disabled={working}
                  onPress={() => void createWithFriend(item)}
                  style={({ pressed }) => [styles.friendRow, pressed && styles.pressed]}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(item.displayName)}</Text>
                  </View>
                  <View style={styles.friendCopy}>
                    <Text numberOfLines={1} style={styles.friendName}>{item.displayName}</Text>
                    <Text numberOfLines={1} style={styles.friendMeta}>
                      {item.username ? `@${item.username}` : 'Mutual friend'}
                    </Text>
                  </View>
                  <Ionicons name="navigate" size={19} color={colors.primaryHover} />
                </Pressable>
              )}
            />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </Modal>

      {invite ? (
        <View style={[styles.card, { bottom: bottomOffset }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="navigate" size={18} color={colors.primaryHover} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardEyebrow}>DRIVE TOGETHER</Text>
              <Text numberOfLines={1} style={styles.cardTitle}>{invite.hostDisplayName} invited you</Text>
              <Text style={styles.cardBody}>
                Join and share your precise location only with this drive while it is active.
              </Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <Pressable disabled={working} onPress={dismissInvite} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Not now</Text>
            </Pressable>
            <Pressable disabled={working} onPress={() => void joinInvite()} style={styles.primaryButton}>
              {working ? <ActivityIndicator color={colors.text} size="small" /> : (
                <Text style={styles.primaryText}>JOIN & SHARE</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : waiting ? (
        <View style={[styles.card, { bottom: bottomOffset }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="time-outline" size={18} color={colors.primaryHover} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardEyebrow}>INVITE SENT</Text>
              <Text numberOfLines={1} style={styles.cardTitle}>
                Waiting for {waiting.friend?.displayName ?? 'your friend'}
              </Text>
              <Text style={styles.cardBody}>The drive starts automatically when they join.</Text>
            </View>
          </View>
          <Pressable disabled={working} onPress={() => void cancelWaiting()} style={styles.secondaryFullButton}>
            <Text style={styles.secondaryText}>Cancel invitation</Text>
          </Pressable>
        </View>
      ) : activeDriveId && details ? (
        <View style={[styles.card, { bottom: bottomOffset }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, styles.liveIcon]}>
              <View style={styles.liveDot} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardEyebrow}>DRIVE TOGETHER · {connectionLabel(connection)}</Text>
              <Text numberOfLines={1} style={styles.cardTitle}>Driving with {otherName}</Text>
              <Text style={styles.cardBody}>
                {isSharingLocation
                  ? 'Your live position is shared only with this drive.'
                  : 'Share your position so both drivers can see each other on the map.'}
              </Text>
            </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.cardActions}>
            {!isSharingLocation ? (
              <Pressable
                disabled={sharingLocation}
                onPress={() => void enableSharing()}
                style={styles.primaryButton}>
                {sharingLocation ? <ActivityIndicator color={colors.text} size="small" /> : (
                  <Text style={styles.primaryText}>SHARE LOCATION</Text>
                )}
              </Pressable>
            ) : null}
            <Pressable
              disabled={working}
              onPress={() => void finishActive()}
              style={[styles.secondaryButton, isSharingLocation && styles.secondaryGrow]}>
              <Text style={styles.secondaryText}>
                {details.hostId === details.currentUserId ? 'End' : 'Leave'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : error && !open ? (
        <View style={[styles.errorCard, { bottom: bottomOffset }]}>
          <Text numberOfLines={2} style={styles.error}>{error}</Text>
          <Pressable onPress={() => setError(null)}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  sheetTitle: {
    marginTop: 4,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 24,
    fontWeight: '900',
  },
  sheetBody: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    marginLeft: 'auto',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  muted: { color: colors.textMuted, fontSize: 13 },
  friendList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  friendRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pressed: { opacity: 0.76 },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  avatarText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  friendCopy: { flex: 1, minWidth: 0 },
  friendName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  friendMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  empty: {
    paddingVertical: spacing.xxl,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  card: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 40,
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(12,12,16,0.97)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  liveIcon: { backgroundColor: colors.surfaceSoft },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  cardCopy: { flex: 1, minWidth: 0 },
  cardEyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  cardTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  cardBody: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  cardActions: { flexDirection: 'row', gap: spacing.xs },
  primaryButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  secondaryButton: {
    minWidth: 92,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceBase,
  },
  secondaryGrow: { flex: 1 },
  secondaryFullButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceBase,
  },
  secondaryText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  error: { color: colors.primaryHover, fontSize: 11, lineHeight: 16 },
  errorCard: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 40,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
});
