import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GroupDriveParticipantStack,
  acceptGroupDriveLocationDisclosure,
  buildParticipantStackPresentation,
  deriveGroupDriveParticipantProgress,
  emptyGroupDriveProgressState,
  emptyParticipantStackOrderState,
  getGroupDriveLocationSession,
  formatDriveDistance,
  formatDriveDuration,
  groupDriveLocations,
  loadActiveDriveRealtimeSnapshot,
  loadGroupDriveDetails,
  prepareDriveRoute,
  reduceParticipantStackOrder,
  requestGroupDriveLocationPermissions,
  startGroupDriveLocationSession,
  stopGroupDriveLocationSession,
  subscribeToActiveDriveRealtime,
  type ActiveDriveRealtimeConnection,
  type ActiveDriveRealtimeSnapshot,
  type GroupDriveDetails,
  type GroupDriveProgressState,
  type ParticipantStackOrderState,
} from '@/src/features/group-drive';
import {
  readLocalNavigationLocation,
  watchLocalNavigationLocation,
  type LocalNavigationLocation,
} from '@/src/features/group-drive/runtime/localNavigationLocation';
import { MapboxLiveMapCompat } from '@/src/features/mapbox/MapboxLiveMapCompat';
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
  const locationPromptedRef = useRef(false);

  const [details, setDetails] = useState<GroupDriveDetails | null>(null);
  const [snapshot, setSnapshot] = useState<ActiveDriveRealtimeSnapshot | null>(null);
  const [tripSheetExpanded, setTripSheetExpanded] = useState(false);
  const [progress, setProgress] = useState<GroupDriveProgressState>(
    emptyGroupDriveProgressState(driveSessionId),
  );
  const [order, setOrder] = useState<ParticipantStackOrderState>(emptyParticipantStackOrderState());
  const [connection, setConnection] = useState<ActiveDriveRealtimeConnection>('connecting');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [localNavigationLocation, setLocalNavigationLocation] = useState<LocalNavigationLocation | null>(null);
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

  const offerLocationSharing = useCallback(() => {
    if (!driveSessionId || locationPromptedRef.current) return;
    const session = getGroupDriveLocationSession();
    if (session?.driveSessionId === driveSessionId) return;

    locationPromptedRef.current = true;
    Alert.alert(
      'Share live location?',
      'Only participants in this active Group Drive can see your precise location. Sharing stops when the drive ends. You can stay in the drive without sharing.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Share location',
          onPress: () => {
            void (async () => {
              try {
                const consent = acceptGroupDriveLocationDisclosure(driveSessionId);
                await requestGroupDriveLocationPermissions();
                await startGroupDriveLocationSession(consent);
                setError(null);
              } catch (shareError) {
                setError(shareError instanceof Error
                  ? shareError.message
                  : 'Location sharing could not be started.');
              }
            })();
          },
        },
      ],
    );
  }, [driveSessionId]);

  useEffect(() => {
    let disposed = false;
    let stopWatching: (() => void) | null = null;

    void (async () => {
      try {
        const current = await readLocalNavigationLocation(false);
        if (!disposed && current) setLocalNavigationLocation(current);
        stopWatching = await watchLocalNavigationLocation((location) => {
          if (!disposed) setLocalNavigationLocation(location);
        });
        if (disposed) stopWatching();
      } catch {
        // Local navigation is optional and separate from Group Drive publication.
        // Permission can be requested later only when the user taps Recenter.
      }
    })();

    return () => {
      disposed = true;
      stopWatching?.();
    };
  }, []);

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
      offerLocationSharing();

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
  }, [applySnapshot, driveSessionId, offerLocationSharing]);

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
  const ownPublishedLocation = details ? locationByUserId.get(details.currentUserId) ?? null : null;
  const cameraLocation = localNavigationLocation ?? ownPublishedLocation;
  const ownRouteProgress = details ? progress.byUserId[details.currentUserId] ?? null : null;
  const remainingDistance =
    ownRouteProgress?.remainingMeters ?? details?.routeDistanceMeters ?? null;
  const tripSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -24) setTripSheetExpanded(true);
          else if (gesture.dy > 24) setTripSheetExpanded(false);
        },
      }),
    [],
  );

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

  const recenter = useCallback(async () => {
    let location = cameraLocation;
    if (!location) {
      try {
        location = await readLocalNavigationLocation(true);
        if (location) setLocalNavigationLocation(location);
      } catch {
        location = null;
      }
    }
    if (!location) {
      Alert.alert(
        'Location unavailable',
        'Allow location while using NOXA to recenter the map. This does not share your position with the Group Drive.',
      );
      return;
    }
    setSelectedUserId(null);
    setFollowUser(true);
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 350);
  }, [cameraLocation]);

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
      <MapboxLiveMapCompat
        ref={mapRef}
        initialRegion={initialRegion(details, snapshot)}
        driverLocation={cameraLocation}
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
        <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
          <Pressable
            accessibilityLabel="Back to Group Drive"
            accessibilityRole="button"
            hitSlop={2}
            onPress={() => router.replace({ pathname: '/group-drives/[id]', params: { id: driveSessionId } })}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-back" size={21} color={colors.text} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={styles.eyebrow}>ACTIVE DRIVE</Text>
            <Text numberOfLines={1} style={styles.title}>{details.title}</Text>
            <Text numberOfLines={1} style={styles.destinationMeta}>
              {details.stops.find((stop) => stop.kind === 'end')?.label ?? 'Shared destination'}
            </Text>
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
            router.push({ pathname: '/group-drives/[id]/participants', params: { id: driveSessionId } });
          }}
          style={[styles.participantStack, { top: insets.top + 118 }]}
        />

        <View
          style={[
            styles.bottomControls,
            { bottom: insets.bottom + (tripSheetExpanded ? 316 : 166) },
          ]}
        >
          <Pressable
            accessibilityLabel="Recenter on me"
            accessibilityRole="button"
            onPress={() => void recenter()}
            style={({ pressed }) => [
              styles.recenterButton,
              !cameraLocation && styles.recenterButtonNeedsPermission,
              pressed && styles.pressedButton,
            ]}
          >
            <Ionicons name="navigate" size={21} color={colors.text} />
          </Pressable>
        </View>

        <View
          style={[
            styles.tripSheet,
            tripSheetExpanded && styles.tripSheetExpanded,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <Pressable
            accessibilityLabel={tripSheetExpanded ? 'Collapse trip controls' : 'Expand trip controls'}
            accessibilityRole="button"
            onPress={() => setTripSheetExpanded((current) => !current)}
            style={styles.tripHandleHitArea}
            {...tripSheetPanResponder.panHandlers}
          >
            <View style={styles.tripHandle} />
          </Pressable>

          <View style={styles.tripSummary}>
            <View style={styles.tripPrimary}>
              <Text style={styles.tripValue}>{formatDriveDistance(remainingDistance)}</Text>
              <Text style={styles.tripSecondaryLine}>
                {ownRouteProgress?.status === 'arrived'
                  ? 'Arrived'
                  : `${formatDriveDuration(details.routeDurationSeconds)} planned · ${identities.length} active`}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="View participants"
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/group-drives/[id]/participants',
                  params: { id: driveSessionId },
                })
              }
              style={({ pressed }) => [
                styles.tripRoundAction,
                pressed && styles.pressedButton,
              ]}
            >
              <Ionicons name="people-outline" size={21} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityLabel="Drive controls"
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/group-drives/[id]/controls',
                  params: { id: driveSessionId },
                })
              }
              style={({ pressed }) => [
                styles.tripPrimaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Ionicons name="options-outline" size={18} color={colors.text} />
              <Text style={styles.tripPrimaryText}>Controls</Text>
            </Pressable>
          </View>

          {tripSheetExpanded ? (
            <View style={styles.tripExpandedContent}>
              <View style={styles.tripDivider} />

              <Pressable
                accessibilityLabel="View Group Drive participants"
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/group-drives/[id]/participants',
                    params: { id: driveSessionId },
                  })
                }
                style={({ pressed }) => [
                  styles.tripExpandedRow,
                  pressed && styles.pressedButton,
                ]}
              >
                <View style={styles.tripExpandedIcon}>
                  <Ionicons name="people-outline" size={20} color={colors.text} />
                </View>
                <View style={styles.tripExpandedCopy}>
                  <Text style={styles.tripExpandedTitle}>People</Text>
                  <Text style={styles.tripExpandedMeta}>
                    {identities.length} active participant{identities.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>

              <Pressable
                accessibilityLabel="Open Drive controls"
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/group-drives/[id]/controls',
                    params: { id: driveSessionId },
                  })
                }
                style={({ pressed }) => [
                  styles.tripExpandedRow,
                  pressed && styles.pressedButton,
                ]}
              >
                <View style={styles.tripExpandedIcon}>
                  <Ionicons name="options-outline" size={20} color={colors.text} />
                </View>
                <View style={styles.tripExpandedCopy}>
                  <Text style={styles.tripExpandedTitle}>Drive controls</Text>
                  <Text style={styles.tripExpandedMeta}>Lifecycle and host actions</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>

              <Pressable
                accessibilityLabel="Open Group Drive location sharing"
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/group-drives/[id]/location-sharing',
                    params: { id: driveSessionId },
                  })
                }
                style={({ pressed }) => [
                  styles.tripExpandedRow,
                  pressed && styles.pressedButton,
                ]}
              >
                <View style={styles.tripExpandedIcon}>
                  <Ionicons name="location-outline" size={20} color={colors.text} />
                </View>
                <View style={styles.tripExpandedCopy}>
                  <Text style={styles.tripExpandedTitle}>Location sharing</Text>
                  <Text style={styles.tripExpandedMeta}>Review or stop Group Drive sharing</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {error ? (
        <View
          style={[
            styles.errorBanner,
            { bottom: insets.bottom + (tripSheetExpanded ? 386 : 238) },
          ]}
        >
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
    left: spacing.md,
    right: spacing.md,
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(6,6,10,0.94)',
  },
  iconButton: {
    width: 44,
    height: 44,
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
  destinationMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  tripSheet: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: 0,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(10,10,14,0.98)',
  },
  tripSheetExpanded: {
    paddingBottom: spacing.lg,
  },
  tripHandleHitArea: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripHandle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  tripSummary: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tripPrimary: { flex: 1, minWidth: 0 },
  tripValue: {
    color: colors.success,
    fontFamily: typography.fontFamily.display,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  tripSecondaryLine: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  tripRoundAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  tripPrimaryButton: {
    minWidth: 112,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  tripPrimaryText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  tripExpandedContent: {
    marginTop: spacing.xs,
  },
  tripDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
    backgroundColor: colors.divider,
  },
  tripExpandedRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tripExpandedIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  tripExpandedCopy: { flex: 1, minWidth: 0 },
  tripExpandedTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  tripExpandedMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  participantStack: {
    position: 'absolute',
    left: spacing.sm,
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
  recenterButtonNeedsPermission: {
    opacity: 0.72,
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