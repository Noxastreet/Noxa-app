import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GroupDriveParticipantStack,
  buildParticipantStackPresentation,
  deriveGroupDriveParticipantProgress,
  emptyGroupDriveProgressState,
  emptyParticipantStackOrderState,
  groupDriveLocations,
  loadActiveDriveRealtimeSnapshot,
  loadGroupDriveDetails,
  prepareDriveRoute,
  reduceParticipantStackOrder,
  stopGroupDriveLocationSession,
  subscribeToActiveDriveRealtime,
  type ActiveDriveRealtimeConnection,
  type ActiveDriveRealtimeSnapshot,
  type GroupDriveDetails,
  type GroupDriveProgressState,
  type ParticipantStackOrderState,
} from '@/src/features/group-drive';
import { MapboxLiveMap } from '@/src/features/mapbox/MapboxLiveMap';
import type { LiveMapHandle, MapRegion, MapboxDriver, MapboxRoute } from '@/src/features/mapbox/types';
import { colors, radius, spacing, typography } from '@/src/theme';

function routeForMap(details: GroupDriveDetails | null): MapboxRoute | null {
  const coordinates = details?.routeGeometry?.coordinates;
  if (!coordinates?.length) return null;
  return {
    coordinates: coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
  };
}

function initialRegion(
  details: GroupDriveDetails | null,
  snapshot: ActiveDriveRealtimeSnapshot | null,
): MapRegion {
  const ownOpaqueId = details && snapshot
    ? snapshot.locations.opaqueIdByUserId[details.currentUserId]
    : null;
  const ownLocation = ownOpaqueId ? snapshot?.locations.byOpaqueId[ownOpaqueId] : null;
  const start = details?.stops.find((stop) => stop.kind === 'start');
  const firstRoute = details?.routeGeometry?.coordinates[0];
  const latitude = ownLocation?.latitude ?? start?.latitude ?? firstRoute?.[1] ?? 37.9838;
  const longitude = ownLocation?.longitude ?? start?.longitude ?? firstRoute?.[0] ?? 23.7275;
  return {
    latitude,
    longitude,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };
}

function connectionLabel(connection: ActiveDriveRealtimeConnection) {
  if (connection === 'subscribed') return 'LIVE';
  if (connection === 'reconnecting') return 'RECONNECTING';
  if (connection === 'closed') return 'OFFLINE';
  return 'CONNECTING';
}

export default function ActiveDriveScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const insets = useSafeAreaInsets();
  const mapRef = useRef<LiveMapHandle | null>(null);
  const progressRef = useRef<GroupDriveProgressState>(emptyGroupDriveProgressState(driveSessionId));
  const orderRef = useRef<ParticipantStackOrderState>(emptyParticipantStackOrderState());
  const detailsRef = useRef<GroupDriveDetails | null>(null);

  const [details, setDetails] = useState<GroupDriveDetails | null>(null);
  const [snapshot, setSnapshot] = useState<ActiveDriveRealtimeSnapshot | null>(null);
  const [progress, setProgress] = useState<GroupDriveProgressState>(
    emptyGroupDriveProgressState(driveSessionId),
  );
  const [order, setOrder] = useState<ParticipantStackOrderState>(emptyParticipantStackOrderState());
  const [connection, setConnection] = useState<ActiveDriveRealtimeConnection>('connecting');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapRoute = useMemo(() => routeForMap(details), [details]);

  const applySnapshot = useCallback((nextSnapshot: ActiveDriveRealtimeSnapshot) => {
    const currentDetails = detailsRef.current;
    if (!currentDetails) {
      setSnapshot(nextSnapshot);
      return;
    }
    const nextProgress = deriveGroupDriveParticipantProgress(
      driveSessionId,
      prepareDriveRoute(currentDetails.routeGeometry, currentDetails.routeDistanceMeters),
      nextSnapshot.participants
        .filter((participant) => participant.status === 'active')
        .map((participant) => participant.userId),
      groupDriveLocations(nextSnapshot.locations),
      progressRef.current,
      new Date(),
    );
    const nextOrder = reduceParticipantStackOrder(
      orderRef.current,
      Object.values(nextProgress.byUserId),
    );
    progressRef.current = nextProgress;
    orderRef.current = nextOrder;
    setProgress(nextProgress);
    setOrder(nextOrder);
    setSnapshot(nextSnapshot);
  }, [driveSessionId]);

  useEffect(() => {
    let disposed = false;
    let teardown: (() => Promise<void>) | null = null;

    if (!driveSessionId) {
      setError('This Active Drive link is invalid.');
      setLoading(false);
      return () => undefined;
    }

    void Promise.all([
      loadGroupDriveDetails(driveSessionId),
      loadActiveDriveRealtimeSnapshot(driveSessionId),
    ]).then(([nextDetails, nextSnapshot]) => {
      if (disposed) return;
      detailsRef.current = nextDetails;
      setDetails(nextDetails);
      applySnapshot(nextSnapshot);
      setLoading(false);
      setError(null);

      void subscribeToActiveDriveRealtime(driveSessionId, {
        onSnapshot: (liveSnapshot) => {
          if (!disposed) applySnapshot(liveSnapshot);
        },
        onConnectionChange: (state) => {
          if (!disposed) setConnection(state);
        },
        onAccessRevoked: () => {
          if (disposed) return;
          setConnection('closed');
          setError('Your access to this Active Drive ended.');
          void stopGroupDriveLocationSession().finally(() => {
            if (!disposed) router.replace('/group-drives');
          });
        },
        onError: (syncError) => {
          if (!disposed) setError(syncError.message);
        },
      }).then((nextTeardown) => {
        if (disposed) void nextTeardown();
        else teardown = nextTeardown;
      });
    }).catch((loadError) => {
      if (disposed) return;
      setLoading(false);
      setError(loadError instanceof Error ? loadError.message : 'Active Drive could not be opened.');
    });

    return () => {
      disposed = true;
      if (teardown) void teardown();
    };
  }, [applySnapshot, driveSessionId]);

  const identities = useMemo(
    () => (details?.participants ?? [])
      .filter((participant) => participant.status === 'active')
      .map((participant) => ({
        userId: participant.userId,
        displayName: participant.profile?.displayName ?? 'NOXA driver',
        avatarUrl: participant.profile?.avatarUrl ?? null,
      })),
    [details?.participants],
  );

  const presentation = useMemo(
    () => buildParticipantStackPresentation(
      identities,
      progress.byUserId,
      order.order,
      details?.currentUserId ?? '',
    ),
    [details?.currentUserId, identities, order.order, progress.byUserId],
  );

  const locations = useMemo(
    () => snapshot ? groupDriveLocations(snapshot.locations) : [],
    [snapshot],
  );
  const locationByUserId = useMemo(
    () => new Map(locations.map((location) => [location.userId, location])),
    [locations],
  );
  const profileByUserId = useMemo(
    () => new Map((details?.participants ?? []).map((participant) => [participant.userId, participant.profile])),
    [details?.participants],
  );
  const ownLocation = details ? locationByUserId.get(details.currentUserId) ?? null : null;

  const activeDrivers = useMemo<MapboxDriver[]>(
    () => locations
      .filter((location) => location.userId !== details?.currentUserId)
      .map((location) => {
        const profile = profileByUserId.get(location.userId);
        return {
          user_id: location.userId,
          latitude: location.latitude,
          longitude: location.longitude,
          label: profile?.displayName ?? 'Group Drive participant',
          avatar_url: profile?.avatarUrl ?? null,
          is_relevant: selectedUserId === location.userId,
          is_dimmed: progress.byUserId[location.userId]?.status === 'stale',
        };
      }),
    [details?.currentUserId, locations, profileByUserId, progress.byUserId, selectedUserId],
  );

  const focusParticipant = useCallback((userId: string) => {
    const location = locationByUserId.get(userId);
    if (!location) {
      Alert.alert('Location unavailable', 'This participant does not have a current location to focus.');
      return;
    }
    setSelectedUserId(userId);
    setFollowUser(false);
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 450);
  }, [locationByUserId]);

  const recenter = useCallback(() => {
    if (!ownLocation) {
      Alert.alert('Location unavailable', 'Your current Group Drive location is not available yet.');
      return;
    }
    setSelectedUserId(null);
    setFollowUser(true);
    mapRef.current?.animateToRegion({
      latitude: ownLocation.latitude,
      longitude: ownLocation.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 350);
  }, [ownLocation]);

  if (loading) {
    return (
      <View style={styles.stateView}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.stateText}>Opening Active Drive…</Text>
      </View>
    );
  }

  if (!details || !snapshot) {
    return (
      <View style={styles.stateView}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.primaryHover} />
        <Text style={styles.stateTitle}>Active Drive unavailable</Text>
        <Text style={styles.stateText}>{error ?? 'You no longer have access to this Group Drive.'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/group-drives')}
          style={styles.stateButton}
        >
          <Text style={styles.stateButtonText}>Back to Group Drives</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapboxLiveMap
        ref={mapRef}
        initialRegion={initialRegion(details, snapshot)}
        driverLocation={ownLocation ? {
          latitude: ownLocation.latitude,
          longitude: ownLocation.longitude,
        } : null}
        activeDrivers={activeDrivers}
        events={[]}
        route={mapRoute}
        selectedEventId={null}
        mapFilter="drivers"
        isRouteMode
        followUserLocation={followUser}
        onFollowUserLocationChange={setFollowUser}
        onUserPan={() => {
          setFollowUser(false);
          setSelectedUserId(null);
        }}
        onDriverPress={focusParticipant}
        onEventPress={() => undefined}
      />

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            accessibilityLabel="Back to Group Drive"
            accessibilityRole="button"
            onPress={() => router.replace({ pathname: '/group-drives/[id]', params: { id: driveSessionId } })}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-back" size={21} color={colors.text} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={styles.eyebrow}>ACTIVE DRIVE</Text>
            <Text numberOfLines={1} style={styles.title}>{details.title}</Text>
          </View>
          <View style={styles.connectionPill}>
            <View style={[styles.connectionDot, connection !== 'subscribed' && styles.connectionDotMuted]} />
            <Text style={styles.connectionText}>{connectionLabel(connection)}</Text>
          </View>
        </View>

        <GroupDriveParticipantStack
          presentation={presentation}
          selectedUserId={selectedUserId}
          onSelectParticipant={focusParticipant}
          onUnavailableParticipant={() => {
            Alert.alert('Location unavailable', 'This participant’s current location cannot be focused.');
          }}
          onOpenParticipants={() => {
            Alert.alert('Participants', `${identities.length} active participants in this Group Drive.`);
          }}
          style={[styles.participantStack, { top: insets.top + 92 }]}
        />

        <View style={[styles.bottomControls, { bottom: insets.bottom + spacing.lg }]}>
          <Pressable
            accessibilityLabel="Recenter on me"
            accessibilityRole="button"
            disabled={!ownLocation}
            onPress={recenter}
            style={({ pressed }) => [
              styles.recenterButton,
              !ownLocation && styles.disabledButton,
              pressed && ownLocation && styles.pressedButton,
            ]}
          >
            <Ionicons name="navigate" size={21} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={[styles.errorBanner, { bottom: insets.bottom + 86 }]}>
          <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stateView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '800',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
    textAlign: 'center',
  },
  stateButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  stateButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(6,6,10,0.82)',
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: typography.letterSpacing.label,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '800',
    lineHeight: typography.lineHeight.subtitle,
  },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceBase,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  connectionDotMuted: {
    backgroundColor: colors.warning,
  },
  connectionText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  participantStack: {
    position: 'absolute',
    left: spacing.md,
  },
  bottomControls: {
    position: 'absolute',
    right: spacing.md,
  },
  recenterButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  disabledButton: {
    opacity: 0.42,
  },
  pressedButton: {
    opacity: 0.78,
  },
  errorBanner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeight.caption,
  },
});