import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  acceptGroupDriveLocationDisclosure,
  cancelDrive,
  createQuickDriveRoom,
  DriveTogetherParticipantRail,
  DriveTogetherSheet,
  endGroupDrive,
  findMyActiveQuickDriveId,
  findMyHostedQuickDriveId,
  formatQuickRemainingDistance,
  getGroupDriveLocationSession,
  getPendingQuickDriveInvitation,
  getQuickDriveInvitation,
  groupDriveLocations,
  inviteQuickDriveUser,
  leaveGroupDriveAndStopLocation,
  listDriveTogetherFriends,
  loadActiveDriveRealtimeSnapshot,
  loadGroupDriveDetails,
  loadQuickDriveRoomState,
  proposeQuickDriveDestination,
  requestGroupDriveLocationPermissions,
  respondToDriveInvitation,
  respondToQuickDriveDestinationProposal,
  startGroupDriveLocationSession,
  stopGroupDriveLocationSession,
  subscribeToActiveDriveRealtime,
  subscribeToQuickDriveRoomState,
  useQuickDriveNavigation,
  type ActiveDriveRealtimeConnection,
  type ActiveDriveRealtimeSnapshot,
  type DriveDestination,
  type DriveProfile,
  type GroupDriveDetails,
  type PendingQuickDriveInvitation,
  type QuickDriveRoomState,
  type DriveTogetherSheetSnap,
} from '@/src/features/group-drive';
import { driveTogetherRouteChangedMessage } from '@/src/features/group-drive/driveTogetherCopy';
import {
  searchMapboxPlaces,
  type MapboxPlaceResult,
} from '@/src/features/mapbox/placeSearch';
import type {
  LatLng,
  MapboxDriver,
  MapboxRoute,
} from '@/src/features/mapbox/types';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

type ComposerMode =
  | 'room'
  | 'create-destination'
  | 'create-friends'
  | 'change-destination'
  | 'invite-drivers';

export type DriveTogetherNavigationOverlay = {
  route: MapboxRoute | null;
  destination: LatLng | null;
  remainingDistanceMeters: number | null;
  nextInstruction: string | null;
  distanceToNextManeuverMeters: number | null;
  status: string;
};

type Props = {
  open: boolean;
  invitationId?: string | null;
  bottomOffset: number;
  bottomInset: number;
  topOffset: number;
  currentLocation: LatLng | null;
  following: boolean;
  onFollowingChange: (following: boolean) => void;
  onOpenChange: (open: boolean) => void;
  onDriversChange: (drivers: MapboxDriver[]) => void;
  onNavigationChange: (navigation: DriveTogetherNavigationOverlay | null) => void;
  onPanelVisibilityChange: (visible: boolean) => void;
  onBeginMapPick: (handler: (point: LatLng) => void) => void;
  onEndMapPick: () => void;
};

const ROOM_DETAILS_RECONCILE_MS = 5_000;
const LOCATION_STALE_MS = 45_000;

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

function coordinateLabel(point: LatLng) {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

async function resolveDestinationLabel(point: LatLng) {
  try {
    const address = (await Location.reverseGeocodeAsync(point))[0];
    if (!address) return coordinateLabel(point);
    const street = [address.name, address.street].filter(Boolean).join(' ').trim();
    const parts = Array.from(
      new Set([street, address.city, address.district, address.region].filter(Boolean)),
    );
    return parts.length ? parts.join(', ') : coordinateLabel(point);
  } catch {
    return coordinateLabel(point);
  }
}

function profileName(profile: DriveProfile | null | undefined) {
  return profile?.displayName?.trim() || profile?.username?.trim() || 'NOXA driver';
}

function PrimaryAction({
  title,
  disabled,
  working,
  icon,
  grow = false,
  onPress,
}: {
  title: string;
  disabled?: boolean;
  working?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  grow?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || working}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryAction,
        grow && styles.actionGrow,
        (disabled || working) && styles.actionDisabled,
        pressed && !disabled && !working && styles.pressed,
      ]}>
      {working ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={colors.text} /> : null}
          <Text style={styles.primaryActionText}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

function SecondaryAction({
  title,
  icon,
  destructive,
  disabled,
  grow = false,
  onPress,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  disabled?: boolean;
  grow?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryAction,
        grow && styles.actionGrow,
        destructive && styles.destructiveAction,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={destructive ? colors.primaryHover : colors.text}
        />
      ) : null}
      <Text style={[styles.secondaryActionText, destructive && styles.destructiveText]}>
        {title}
      </Text>
    </Pressable>
  );
}

function FriendAvatar({ friend }: { friend: DriveProfile }) {
  return (
    <View style={styles.friendAvatar}>
      {friend.avatarUrl ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: friend.avatarUrl }}
          style={styles.friendAvatarImage}
        />
      ) : (
        <Text style={styles.friendAvatarText}>{initials(friend.displayName)}</Text>
      )}
    </View>
  );
}

export function DriveTogetherMapLayer({
  open,
  invitationId,
  bottomOffset,
  bottomInset,
  topOffset,
  currentLocation,
  following,
  onFollowingChange,
  onOpenChange,
  onDriversChange,
  onNavigationChange,
  onPanelVisibilityChange,
  onBeginMapPick,
  onEndMapPick,
}: Props) {
  const [friends, setFriends] = useState<DriveProfile[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<QuickDriveRoomState | null>(null);
  const [details, setDetails] = useState<GroupDriveDetails | null>(null);
  const [snapshot, setSnapshot] = useState<ActiveDriveRealtimeSnapshot | null>(null);
  const [connection, setConnection] = useState<ActiveDriveRealtimeConnection>('closed');
  const [invite, setInvite] = useState<PendingQuickDriveInvitation | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<DriveTogetherSheetSnap>('medium');
  const [composerMode, setComposerMode] = useState<ComposerMode>('room');
  const [draftDestination, setDraftDestination] = useState<DriveDestination | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MapboxPlaceResult[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [mapPicking, setMapPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [sharingLocation, setSharingLocation] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);

  const explicitInvitationRef = useRef<string | null>(null);
  const pendingHostConsentRef = useRef<ReturnType<
    typeof acceptGroupDriveLocationDisclosure
  > | null>(null);
  const previousDestinationVersionRef = useRef<number | null>(null);
  const autoFollowDestinationVersionRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomActive =
    roomState?.status === 'active' || details?.status === 'active';
  const destination = roomState?.destination ?? details?.destination ?? null;
  const destinationProposal =
    roomState?.proposal ?? details?.destinationProposal ?? null;
  const isHost = Boolean(
    details && details.hostId === details.currentUserId,
  );

  const loadFriends = useCallback(async () => {
    if (friendsLoading) return;
    setFriendsLoading(true);
    setError(null);
    try {
      setFriends(await listDriveTogetherFriends());
      setFriendsLoaded(true);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Friends could not be loaded.',
      );
    } finally {
      setFriendsLoading(false);
    }
  }, [friendsLoading]);

  const clearRoom = useCallback(() => {
    pendingHostConsentRef.current = null;
    previousDestinationVersionRef.current = null;
    autoFollowDestinationVersionRef.current = null;
    setPanelOpen(false);
    setRoomId(null);
    setRoomState(null);
    setDetails(null);
    setSnapshot(null);
    setInvite(null);
    setConnection('closed');
    setIsSharingLocation(false);
    setComposerMode('room');
    setSelectedFriendIds(new Set());
    onDriversChange([]);
    onNavigationChange(null);
    onFollowingChange(false);
    void stopGroupDriveLocationSession().catch(() => undefined);
  }, [
    onDriversChange,
    onFollowingChange,
    onNavigationChange,
  ]);

  const refreshDetails = useCallback(async (id: string) => {
    try {
      const next = await loadGroupDriveDetails(id);
      setDetails(next);
      return next;
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Drive Together could not be loaded.';
      if (/unavailable/i.test(message)) {
        clearRoom();
        return null;
      }
      setError(message);
      return null;
    }
  }, [clearRoom]);

  useFocusEffect(
    useCallback(() => {
      let disposed = false;
      void (async () => {
        try {
          const active = await findMyActiveQuickDriveId();
          if (disposed) return;
          if (active) {
            setRoomId(active);
            setInvite(null);
            return;
          }

          const hosted = await findMyHostedQuickDriveId();
          if (disposed) return;
          if (hosted) {
            setRoomId(hosted);
            setInvite(null);
            return;
          }

          const pending = await getPendingQuickDriveInvitation();
          if (disposed) return;
          setRoomId(null);
          setRoomState(null);
          setDetails(null);
          setSnapshot(null);
          setInvite(pending);
        } catch (stateError) {
          if (!disposed) {
            setError(
              stateError instanceof Error
                ? stateError.message
                : 'Drive Together state could not be refreshed.',
            );
          }
        }
      })();

      return () => {
        disposed = true;
      };
    }, []),
  );

  useEffect(() => {
    const id = invitationId?.trim() || null;
    if (!id || explicitInvitationRef.current === id) return;
    explicitInvitationRef.current = id;
    let disposed = false;

    void getQuickDriveInvitation(id)
      .then((preview) => {
        if (disposed) return;
        if (!preview) {
          router.push({
            pathname: '/group-drives/invitation/[id]',
            params: { id },
          });
          return;
        }
        setInvite(preview);
        setPanelOpen(true);
        setSheetSnap('medium');
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
    };
  }, [invitationId]);

  useEffect(() => {
    if (!roomId) {
      setRoomState(null);
      setDetails(null);
      return undefined;
    }

    let disposed = false;
    let teardown: (() => Promise<void>) | null = null;
    void Promise.all([
      refreshDetails(roomId),
      loadQuickDriveRoomState(roomId),
    ])
      .then(([nextDetails, nextRoom]) => {
        if (disposed) return;
        if (nextDetails) setDetails(nextDetails);
        if (nextRoom) setRoomState(nextRoom);
        return subscribeToQuickDriveRoomState(roomId, {
          onState: (state) => {
            if (!disposed) setRoomState(state);
          },
          onEnded: () => {
            if (!disposed) clearRoom();
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
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Drive Together room could not be opened.',
          );
        }
      });

    const reconcile = setInterval(() => {
      if (!disposed) void refreshDetails(roomId);
    }, ROOM_DETAILS_RECONCILE_MS);

    return () => {
      disposed = true;
      clearInterval(reconcile);
      if (teardown) void teardown();
    };
  }, [clearRoom, refreshDetails, roomId]);

  useEffect(() => {
    if (!roomId || !roomActive) {
      setSnapshot(null);
      setConnection('closed');
      setIsSharingLocation(false);
      onDriversChange([]);
      return undefined;
    }

    let disposed = false;
    let teardown: (() => Promise<void>) | null = null;
    setConnection('connecting');

    void loadActiveDriveRealtimeSnapshot(roomId)
      .then((initial) => {
        if (disposed) return;
        setSnapshot(initial);
        setIsSharingLocation(
          getGroupDriveLocationSession()?.driveSessionId === roomId,
        );
        return subscribeToActiveDriveRealtime(roomId, {
          onSnapshot: (next) => {
            if (!disposed) setSnapshot(next);
          },
          onConnectionChange: (next) => {
            if (!disposed) setConnection(next);
          },
          onAccessRevoked: () => {
            if (!disposed) clearRoom();
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
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Drive Together realtime could not be opened.',
          );
        }
      });

    return () => {
      disposed = true;
      if (teardown) void teardown();
    };
  }, [clearRoom, onDriversChange, roomActive, roomId]);

  useEffect(() => {
    if (!roomId || !roomActive) return;
    const consent = pendingHostConsentRef.current;
    if (
      !consent
      || consent.driveSessionId !== roomId
      || isSharingLocation
      || sharingLocation
    ) {
      return;
    }

    setSharingLocation(true);
    void startGroupDriveLocationSession(consent)
      .then(() => {
        pendingHostConsentRef.current = null;
        setIsSharingLocation(true);
      })
      .catch((shareError) => {
        pendingHostConsentRef.current = null;
        setError(
          shareError instanceof Error
            ? shareError.message
            : 'Location sharing could not be started.',
        );
      })
      .finally(() => setSharingLocation(false));
  }, [
    isSharingLocation,
    roomActive,
    roomId,
    sharingLocation,
  ]);

  const driveDrivers = useMemo<MapboxDriver[]>(() => {
    if (!details || !snapshot) return [];
    const profiles = new Map(
      details.participants.map((participant) => [
        participant.userId,
        participant.profile,
      ]),
    );
    return groupDriveLocations(snapshot.locations)
      .filter((location) => location.userId !== details.currentUserId)
      .map((location) => {
        const profile = profiles.get(location.userId);
        return {
          user_id: location.userId,
          latitude: location.latitude,
          longitude: location.longitude,
          label: profileName(profile),
          avatar_url: profile?.avatarUrl ?? null,
          is_relevant: true,
          is_dimmed:
            location.status === 'stale'
            || Date.now() - Date.parse(location.updatedAt) > LOCATION_STALE_MS,
        };
      });
  }, [details, snapshot]);

  useEffect(() => {
    onDriversChange(driveDrivers);
  }, [driveDrivers, onDriversChange]);

  const ownNavigationLocation = useMemo(() => {
    if (details && snapshot) {
      const own = groupDriveLocations(snapshot.locations).find(
        (location) => location.userId === details.currentUserId,
      );
      if (own) {
        return {
          latitude: own.latitude,
          longitude: own.longitude,
          heading: own.heading,
        };
      }
    }

    return currentLocation
      ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          heading: null,
        }
      : null;
  }, [currentLocation, details, snapshot]);

  const navigation = useQuickDriveNavigation({
    driveSessionId: roomActive ? roomId : null,
    destination,
    active: Boolean(roomId && roomActive && destination),
    publishProgressEnabled: isSharingLocation,
    location: ownNavigationLocation,
    onRoomEnded: clearRoom,
  });

  useEffect(() => {
    if (!roomActive || !destination) {
      onNavigationChange(null);
      return;
    }
    onNavigationChange({
      route: navigation.route
        ? { coordinates: navigation.route.coordinates }
        : null,
      destination: {
        latitude: destination.latitude,
        longitude: destination.longitude,
      },
      remainingDistanceMeters:
        navigation.projection?.remainingDistanceMeters ?? null,
      nextInstruction:
        navigation.projection?.nextManeuver?.instruction ?? null,
      distanceToNextManeuverMeters:
        navigation.projection?.distanceToNextManeuverMeters ?? null,
      status: navigation.status,
    });
  }, [
    destination,
    navigation.projection,
    navigation.route,
    navigation.status,
    onNavigationChange,
    roomActive,
  ]);

  useEffect(() => {
    if (!roomActive || !destination || !navigation.route) return;
    if (autoFollowDestinationVersionRef.current === destination.version) return;
    autoFollowDestinationVersionRef.current = destination.version;
    onFollowingChange(true);
  }, [
    destination,
    navigation.route,
    onFollowingChange,
    roomActive,
  ]);

  useEffect(() => {
    const nextVersion = destination?.version ?? null;
    const previousVersion = previousDestinationVersionRef.current;
    if (
      previousVersion !== null
      && nextVersion !== null
      && nextVersion !== previousVersion
    ) {
      const updater = details?.participants.find(
        (participant) => participant.userId === destination?.updatedByUserId,
      );
      const message = driveTogetherRouteChangedMessage(
        profileName(updater?.profile),
      );
      setToast(message);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 3_000);
    }
    previousDestinationVersionRef.current = nextVersion;
  }, [
    destination?.updatedByUserId,
    destination?.version,
    details?.participants,
  ]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      onEndMapPick();
    },
    [onEndMapPick],
  );

  useEffect(() => {
    if (!open) return;

    setPanelOpen(true);
    setError(null);

    if (roomId || invite) {
      setSheetSnap('medium');
      setComposerMode('room');
      onOpenChange(false);
      return;
    }

    setComposerMode('create-destination');
    setDraftDestination(null);
    setSelectedFriendIds(new Set());
    setSheetSnap('medium');
    setSearchQuery('');
    setSearchResults([]);
    onOpenChange(false);
  }, [invite, onOpenChange, open, roomId]);

  useEffect(() => {
    const destinationComposer =
      composerMode === 'create-destination'
      || composerMode === 'change-destination';
    const query = searchQuery.trim();
    if (!destinationComposer || query.length < 2) {
      setSearchResults([]);
      setSearchingPlaces(false);
      return undefined;
    }

    let disposed = false;
    const timer = setTimeout(() => {
      setSearchingPlaces(true);
      void searchMapboxPlaces(query, currentLocation)
        .then((results) => {
          if (!disposed) setSearchResults(results);
        })
        .catch((searchError) => {
          if (!disposed) {
            setError(
              searchError instanceof Error
                ? searchError.message
                : 'Place search is unavailable.',
            );
          }
        })
        .finally(() => {
          if (!disposed) setSearchingPlaces(false);
        });
    }, 280);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [composerMode, currentLocation, searchQuery]);

  const participantMetrics = useMemo(() => {
    if (!details || !roomActive || !destination) return [];
    const locations = snapshot
      ? groupDriveLocations(snapshot.locations)
      : [];
    const locationByUserId = new Map(
      locations.map((location) => [location.userId, location]),
    );

    return details.participants
      .filter((participant) => participant.status === 'active')
      .slice(0, 8)
      .map((participant) => {
        const self = participant.userId === details.currentUserId;
        const server = locationByUserId.get(participant.userId);
        const serverMatchesDestination =
          server?.routeDestinationVersion === destination.version;
        const serverDistance =
          serverMatchesDestination && server?.remainingDistanceMeters !== null
            ? server?.remainingDistanceMeters ?? null
            : null;
        const ownDistance =
          self
            ? navigation.projection?.remainingDistanceMeters ?? serverDistance
            : serverDistance;
        const arrived =
          self
            ? navigation.projection?.arrived || server?.status === 'arrived'
            : server?.status === 'arrived';
        const stale =
          !self
          && (
            !server
            || !serverMatchesDestination
            || Date.now() - Date.parse(server.updatedAt) > LOCATION_STALE_MS
          );

        return {
          userId: participant.userId,
          displayName: profileName(participant.profile),
          avatarUrl: participant.profile?.avatarUrl ?? null,
          distanceLabel: arrived
            ? 'ARRIVED'
            : formatQuickRemainingDistance(ownDistance),
          stale,
          self,
        };
      });
  }, [
    destination,
    details,
    navigation.projection,
    roomActive,
    snapshot,
  ]);

  const availableInviteFriends = useMemo(() => {
    if (!details) return friends;
    const unavailable = new Set<string>([
      ...details.participants
        .filter((participant) =>
          participant.status === 'accepted' || participant.status === 'active')
        .map((participant) => participant.userId),
      ...details.invitations
        .filter((invitation) => invitation.status === 'invited')
        .map((invitation) => invitation.invitedUserId),
    ]);
    return friends.filter((friend) => !unavailable.has(friend.id));
  }, [details, friends]);

  const occupiedSlots = useMemo(() => {
    if (!details) return 0;
    const participants = details.participants.filter(
      (participant) =>
        participant.status === 'accepted' || participant.status === 'active',
    ).length;
    const pending = details.invitations.filter(
      (invitation) => invitation.status === 'invited',
    ).length;
    return participants + pending;
  }, [details]);

  const maxSelectableFriends =
    composerMode === 'invite-drivers'
      ? Math.max(0, 8 - occupiedSlots)
      : 7;

  const toggleFriend = useCallback((friendId: string) => {
    setSelectedFriendIds((current) => {
      const next = new Set(current);
      if (next.has(friendId)) {
        next.delete(friendId);
        return next;
      }
      if (next.size >= maxSelectableFriends) return current;
      next.add(friendId);
      return next;
    });
  }, [maxSelectableFriends]);

  const selectDestination = useCallback(async (
    point: LatLng,
    label: string,
  ) => {
    const next: DriveDestination = {
      latitude: point.latitude,
      longitude: point.longitude,
      label,
      version: 1,
      updatedByUserId: null,
      updatedAt: null,
    };

    if (composerMode === 'create-destination') {
      setDraftDestination(next);
      setComposerMode('create-friends');
      setSelectedFriendIds(new Set());
      setSheetSnap('expanded');
      if (!friendsLoaded) void loadFriends();
      return;
    }

    if (composerMode === 'change-destination' && roomId) {
      setWorking(true);
      setError(null);
      try {
        await proposeQuickDriveDestination(roomId, next);
        setComposerMode('room');
        setSheetSnap('medium');
      } catch (changeError) {
        setError(
          changeError instanceof Error
            ? changeError.message
            : 'Destination could not be updated.',
        );
      } finally {
        setWorking(false);
      }
    }
  }, [
    composerMode,
    friendsLoaded,
    loadFriends,
    roomId,
  ]);

  const choosePlace = useCallback((place: MapboxPlaceResult) => {
    void selectDestination(place.coordinate, place.label);
  }, [selectDestination]);

  const beginMapPick = useCallback(() => {
    setMapPicking(true);
    setSheetSnap('collapsed');
    setError(null);
    onBeginMapPick((point) => {
      void (async () => {
        const label = await resolveDestinationLabel(point);
        setMapPicking(false);
        onEndMapPick();
        await selectDestination(point, label);
      })();
    });
  }, [
    onBeginMapPick,
    onEndMapPick,
    selectDestination,
  ]);

  const cancelMapPick = useCallback(() => {
    setMapPicking(false);
    onEndMapPick();
    setSheetSnap('medium');
  }, [onEndMapPick]);

  const createRoom = useCallback(async () => {
    if (
      !draftDestination
      || selectedFriendIds.size < 1
      || working
    ) {
      return;
    }

    setWorking(true);
    setError(null);
    try {
      await requestGroupDriveLocationPermissions();
      const created = await createQuickDriveRoom(
        [...selectedFriendIds],
        draftDestination,
      );
      pendingHostConsentRef.current =
        acceptGroupDriveLocationDisclosure(created.driveSessionId);
      setRoomId(created.driveSessionId);
      setInvite(null);
      setComposerMode('room');
      setSelectedFriendIds(new Set());
      setSheetSnap('collapsed');
      await refreshDetails(created.driveSessionId);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Drive Together could not be created.',
      );
    } finally {
      setWorking(false);
    }
  }, [
    draftDestination,
    refreshDetails,
    selectedFriendIds,
    working,
  ]);

  const joinInvite = useCallback(async () => {
    if (!invite || working) return;
    setWorking(true);
    setError(null);
    try {
      await requestGroupDriveLocationPermissions();
      const changed = await respondToDriveInvitation(
        invite.invitationId,
        true,
      );
      if (!changed) {
        throw new Error('This invitation is no longer available.');
      }

      const consent = acceptGroupDriveLocationDisclosure(
        invite.driveSessionId,
      );
      setRoomId(invite.driveSessionId);
      setInvite(null);
      setSheetSnap('collapsed');
      await startGroupDriveLocationSession(consent);
      setIsSharingLocation(true);
      await refreshDetails(invite.driveSessionId);
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : 'Drive Together could not be joined.',
      );
    } finally {
      setWorking(false);
    }
  }, [invite, refreshDetails, working]);

  const declineInvite = useCallback(async () => {
    if (!invite || working) return;
    setWorking(true);
    setError(null);
    try {
      const changed = await respondToDriveInvitation(
        invite.invitationId,
        false,
      );
      if (!changed) {
        throw new Error('This invitation is no longer available.');
      }
      setInvite(null);
      setPanelOpen(false);
      setSheetSnap('medium');
    } catch (declineError) {
      setError(
        declineError instanceof Error
          ? declineError.message
          : 'Invitation could not be declined.',
      );
    } finally {
      setWorking(false);
    }
  }, [invite, working]);

  const enableSharing = useCallback(async () => {
    if (!roomId || sharingLocation || isSharingLocation) return;
    setSharingLocation(true);
    setError(null);
    try {
      const consent = acceptGroupDriveLocationDisclosure(roomId);
      await requestGroupDriveLocationPermissions();
      await startGroupDriveLocationSession(consent);
      setIsSharingLocation(true);
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : 'Location sharing could not be started.',
      );
    } finally {
      setSharingLocation(false);
    }
  }, [
    isSharingLocation,
    roomId,
    sharingLocation,
  ]);

  const openDestinationComposer = useCallback(() => {
    setComposerMode('change-destination');
    setSearchQuery('');
    setSearchResults([]);
    setSheetSnap('expanded');
    setError(null);
  }, []);

  const openInviteComposer = useCallback(() => {
    setComposerMode('invite-drivers');
    setSelectedFriendIds(new Set());
    setSheetSnap('expanded');
    setError(null);
    if (!friendsLoaded) void loadFriends();
  }, [friendsLoaded, loadFriends]);

  const inviteSelectedDrivers = useCallback(async () => {
    if (!roomId || selectedFriendIds.size < 1 || working) return;
    setWorking(true);
    setError(null);
    try {
      for (const userId of selectedFriendIds) {
        await inviteQuickDriveUser(roomId, userId);
      }
      setSelectedFriendIds(new Set());
      setComposerMode('room');
      setSheetSnap('medium');
      await refreshDetails(roomId);
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : 'Drivers could not be invited.',
      );
    } finally {
      setWorking(false);
    }
  }, [
    refreshDetails,
    roomId,
    selectedFriendIds,
    working,
  ]);

  const respondToProposal = useCallback(async (accept: boolean) => {
    if (!roomId || working) return;
    setWorking(true);
    setError(null);
    try {
      await respondToQuickDriveDestinationProposal(roomId, accept);
    } catch (proposalError) {
      setError(
        proposalError instanceof Error
          ? proposalError.message
          : 'Destination request could not be updated.',
      );
    } finally {
      setWorking(false);
    }
  }, [roomId, working]);

  const cancelWaitingRoom = useCallback(() => {
    if (!roomId || working) return;

    Alert.alert(
      'Cancel Drive Together?',
      'The room and all pending invitations will be removed. No trip history will be saved.',
      [
        { text: 'Keep room', style: 'cancel' },
        {
          text: 'Cancel room',
          style: 'destructive',
          onPress: () => {
            setWorking(true);
            setError(null);
            void cancelDrive(roomId)
              .then((cancelled) => {
                if (!cancelled) {
                  throw new Error('The room is no longer cancellable. Refreshing its state.');
                }
                clearRoom();
              })
              .catch((cancelError) => {
                setError(
                  cancelError instanceof Error
                    ? cancelError.message
                    : 'Drive Together could not be cancelled.',
                );
                void refreshDetails(roomId);
              })
              .finally(() => setWorking(false));
          },
        },
      ],
    );
  }, [clearRoom, refreshDetails, roomId, working]);

  const finishActive = useCallback(() => {
    if (!details || !roomId || working) return;
    const host = details.hostId === details.currentUserId;

    Alert.alert(
      host ? 'End Drive Together?' : 'Leave Drive Together?',
      host
        ? 'This ends the shared drive for everyone. No trip history will be saved.'
        : 'You will leave the room and stop sharing your Drive Together location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: host ? 'End' : 'Leave',
          style: 'destructive',
          onPress: () => {
            setWorking(true);
            setError(null);
            void (host
              ? endGroupDrive(roomId)
              : leaveGroupDriveAndStopLocation(roomId)
            )
              .then(() => clearRoom())
              .catch((finishError) => {
                setError(
                  finishError instanceof Error
                    ? finishError.message
                    : 'Drive Together could not be ended.',
                );
              })
              .finally(() => setWorking(false));
          },
        },
      ],
    );
  }, [
    clearRoom,
    details,
    roomId,
    working,
  ]);

  const proposalAuthor = destinationProposal
    ? details?.participants.find(
        (participant) =>
          participant.userId === destinationProposal.proposedByUserId,
      )
    : null;

  const pendingInvitations =
    details?.invitations.filter(
      (invitation) => invitation.status === 'invited',
    ) ?? [];

  const activeParticipants =
    details?.participants.filter(
      (participant) => participant.status === 'active',
    ) ?? [];

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setComposerMode('room');
    setSheetSnap('medium');
    setMapPicking(false);
    setError(null);
    onEndMapPick();
    onOpenChange(false);
  }, [onEndMapPick, onOpenChange]);

  const sheetVisible = panelOpen;

  useEffect(() => {
    onPanelVisibilityChange(sheetVisible);
  }, [onPanelVisibilityChange, sheetVisible]);

  useEffect(
    () => () => onPanelVisibilityChange(false),
    [onPanelVisibilityChange],
  );

  const renderDestinationComposer = () => (
    <View style={styles.composer}>
      <View style={styles.sheetHeader}>
        <Pressable
          accessibilityLabel="Back"
          onPress={() => {
            if (composerMode === 'change-destination') {
              setComposerMode('room');
              setSheetSnap('medium');
            } else {
              setDraftDestination(null);
              closePanel();
            }
          }}
          style={styles.iconButton}>
          <Ionicons name="chevron-back" size={19} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>
            {composerMode === 'change-destination'
              ? isHost
                ? 'CHANGE DESTINATION'
                : 'REQUEST DESTINATION'
              : 'DRIVE TOGETHER'}
          </Text>
          <Text style={styles.sheetTitle}>
            {composerMode === 'change-destination'
              ? 'Where should the room go next?'
              : 'Choose the destination first.'}
          </Text>
        </View>
      </View>

      {mapPicking ? (
        <View style={styles.mapPickNotice}>
          <Ionicons name="location-outline" size={20} color={colors.primaryHover} />
          <View style={styles.flexCopy}>
            <Text style={styles.mapPickTitle}>Tap anywhere on the map</Text>
            <Text style={styles.mapPickBody}>
              That point becomes the shared destination.
            </Text>
          </View>
          <Pressable onPress={cancelMapPick} style={styles.smallGhostButton}>
            <Text style={styles.smallGhostText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setSearchQuery}
              placeholder="Address, place or destination"
              placeholderTextColor={colors.textSubtle}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchQuery}
            />
            {searchingPlaces ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : searchQuery ? (
              <Pressable
                accessibilityLabel="Clear destination search"
                onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <SecondaryAction
            icon="map-outline"
            onPress={beginMapPick}
            title="Pick on map"
          />

          <ScrollView
            contentContainerStyle={styles.searchResults}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.searchResultsViewport}>
            {searchResults.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => choosePlace(place)}
                style={({ pressed }) => [
                  styles.placeRow,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.placeIcon}>
                  <Ionicons name="location" size={16} color={colors.primaryHover} />
                </View>
                <View style={styles.flexCopy}>
                  <Text numberOfLines={2} style={styles.placeTitle}>
                    {place.label}
                  </Text>
                  {place.subtitle ? (
                    <Text numberOfLines={1} style={styles.placeSubtitle}>
                      {place.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
              </Pressable>
            ))}
            {searchQuery.trim().length >= 2
              && !searchingPlaces
              && searchResults.length === 0 ? (
              <Text style={styles.emptyText}>No matching destination found.</Text>
            ) : null}
          </ScrollView>
        </>
      )}
    </View>
  );

  const renderFriendComposer = () => {
    const source =
      composerMode === 'invite-drivers'
        ? availableInviteFriends
        : friends;
    const title =
      composerMode === 'invite-drivers'
        ? 'Add drivers'
        : 'Who is going?';

    return (
      <View style={styles.composer}>
        <View style={styles.sheetHeader}>
          <Pressable
            accessibilityLabel="Back"
            onPress={() => {
              if (composerMode === 'invite-drivers') {
                setComposerMode('room');
                setSheetSnap('medium');
              } else {
                setComposerMode('create-destination');
                setSheetSnap('medium');
              }
            }}
            style={styles.iconButton}>
            <Ionicons name="chevron-back" size={19} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>DRIVE TOGETHER</Text>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Text style={styles.sheetSubtitle}>
              {composerMode === 'invite-drivers'
                ? `${occupiedSlots}/8 places occupied`
                : draftDestination?.label ?? 'Shared destination'}
            </Text>
          </View>
        </View>

        {friendsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>Loading friends…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.friendList}
            showsVerticalScrollIndicator={false}
            style={styles.friendListViewport}>
            {source.map((friend) => {
              const selected = selectedFriendIds.has(friend.id);
              return (
                <Pressable
                  key={friend.id}
                  onPress={() => toggleFriend(friend.id)}
                  style={({ pressed }) => [
                    styles.friendRow,
                    selected && styles.friendRowSelected,
                    pressed && styles.pressed,
                  ]}>
                  <FriendAvatar friend={friend} />
                  <View style={styles.flexCopy}>
                    <Text numberOfLines={1} style={styles.friendName}>
                      {friend.displayName}
                    </Text>
                    <Text numberOfLines={1} style={styles.friendMeta}>
                      {friend.username
                        ? `@${friend.username}`
                        : 'Mutual friend'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkCircle,
                      selected && styles.checkCircleSelected,
                    ]}>
                    {selected ? (
                      <Ionicons name="checkmark" size={15} color={colors.text} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {!source.length ? (
              <Text style={styles.emptyText}>
                No available mutual friends right now.
              </Text>
            ) : null}
          </ScrollView>
        )}

        <View style={styles.stickyActions}>
          {composerMode === 'create-friends' ? (
            <Text style={styles.privacyNote}>
              When the first driver joins, NOXA starts your private Drive Together location session so everyone can follow the shared route.
            </Text>
          ) : null}
          <PrimaryAction
            disabled={selectedFriendIds.size < 1}
            icon="paper-plane-outline"
            onPress={() => {
              if (composerMode === 'invite-drivers') {
                void inviteSelectedDrivers();
              } else {
                void createRoom();
              }
            }}
            title={
              composerMode === 'invite-drivers'
                ? `Invite ${selectedFriendIds.size || ''} driver${selectedFriendIds.size === 1 ? '' : 's'}`
                : `Invite ${selectedFriendIds.size || ''} driver${selectedFriendIds.size === 1 ? '' : 's'}`
            }
            working={working}
          />
        </View>
      </View>
    );
  };

  const renderInvite = () => (
    <View style={styles.roomContent}>
      <View style={styles.roomHeadline}>
        <View style={styles.liveBadge}>
          <Ionicons name="navigate" size={15} color={colors.primaryHover} />
        </View>
        <View style={styles.flexCopy}>
          <Text style={styles.eyebrow}>DRIVE TOGETHER INVITE</Text>
          <Text numberOfLines={1} style={styles.roomTitle}>
            {invite?.hostDisplayName} invited you
          </Text>
          <Text numberOfLines={2} style={styles.destinationText}>
            {invite?.destination?.label ?? 'Shared destination'}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <SecondaryAction
          disabled={working}
          grow
          onPress={() => void declineInvite()}
          title="Decline"
        />
        <PrimaryAction
          disabled={working}
          grow
          icon="navigate"
          onPress={() => void joinInvite()}
          title="Join & share"
          working={working}
        />
      </View>

      <Text style={styles.privacyNote}>
        Each driver gets their own route from their current position to the same destination.
      </Text>
    </View>
  );

  const renderRoom = () => {
    if (!details && roomId) {
      return (
        <View style={styles.loadingRoom}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Opening Drive Together…</Text>
        </View>
      );
    }

    const collapsed = sheetSnap === 'collapsed';
    const expanded = sheetSnap === 'expanded';
    const myDistance = navigation.projection?.remainingDistanceMeters ?? null;
    const nextTurnDistance =
      navigation.projection?.distanceToNextManeuverMeters ?? null;
    const nextInstruction =
      navigation.projection?.nextManeuver?.instruction ?? null;

    const header = (
      <View style={styles.roomHeadline}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setSheetSnap((current) =>
              current === 'collapsed' ? 'medium' : current)
          }
          style={styles.roomHeadlineMain}>
          <View style={[styles.liveBadge, roomActive && styles.liveBadgeActive]}>
            <Ionicons
              name={roomActive ? 'navigate' : 'time-outline'}
              size={16}
              color={roomActive ? colors.success : colors.primaryHover}
            />
          </View>
          <View style={styles.flexCopy}>
            <View style={styles.roomKickerRow}>
              <Text style={styles.eyebrow}>
                {roomActive
                  ? `DRIVE TOGETHER · ${connectionLabel(connection)}`
                  : 'DRIVE TOGETHER · WAITING'}
              </Text>
              {roomActive && myDistance !== null ? (
                <Text style={styles.myDistance}>
                  {formatQuickRemainingDistance(myDistance)}
                </Text>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.roomTitle}>
              {destination?.label ?? 'Choose a destination'}
            </Text>
            {roomActive && nextInstruction ? (
              <Text numberOfLines={1} style={styles.nextTurn}>
                {nextTurnDistance !== null
                  ? `${formatQuickRemainingDistance(nextTurnDistance)} · `
                  : ''}
                {nextInstruction}
              </Text>
            ) : (
              <Text numberOfLines={1} style={styles.destinationText}>
                {roomActive
                  ? `${activeParticipants.length}/8 drivers`
                  : `${pendingInvitations.length} invitation${pendingInvitations.length === 1 ? '' : 's'} pending`}
              </Text>
            )}
          </View>
          {collapsed ? (
            <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
          ) : null}
        </Pressable>

        <Pressable
          accessibilityLabel="Hide Drive Together panel"
          accessibilityRole="button"
          onPress={closePanel}
          style={({ pressed }) => [
            styles.roomCloseButton,
            pressed && styles.pressed,
          ]}>
          <Ionicons name="chevron-down" size={19} color={colors.textMuted} />
        </Pressable>
      </View>
    );

    if (collapsed) {
      return <View style={styles.roomShell}>{header}</View>;
    }

    return (
      <View style={styles.roomShell}>
        {header}

        {roomActive && !isSharingLocation ? (
          <View style={styles.noticeCard}>
            <Ionicons name="location-outline" size={18} color={colors.primaryHover} />
            <View style={styles.flexCopy}>
              <Text style={styles.noticeTitle}>Resume route sharing</Text>
              <Text style={styles.noticeBody}>
                Your room is live, but this device is not publishing its Drive Together position.
              </Text>
            </View>
            <Pressable
              disabled={sharingLocation}
              onPress={() => void enableSharing()}
              style={styles.inlineButton}>
              {sharingLocation ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.inlineButtonText}>Resume</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {navigation.status === 'error' && navigation.error ? (
          <View style={styles.noticeCard}>
            <Ionicons name="warning-outline" size={18} color={colors.primaryHover} />
            <View style={styles.flexCopy}>
              <Text style={styles.noticeTitle}>Route unavailable</Text>
              <Text style={styles.noticeBody}>{navigation.error}</Text>
            </View>
            <Pressable onPress={navigation.retry} style={styles.inlineButton}>
              <Text style={styles.inlineButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {roomActive ? (
          <View style={styles.quickActions}>
            <Pressable
              onPress={() => onFollowingChange(!following)}
              style={styles.quickAction}>
              <Ionicons
                name={following ? 'navigate' : 'navigate-outline'}
                size={18}
                color={following ? colors.primaryHover : colors.text}
              />
              <Text style={styles.quickActionText}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </Pressable>

            <Pressable
              onPress={openDestinationComposer}
              style={styles.quickAction}>
              <Ionicons name="flag-outline" size={18} color={colors.text} />
              <Text style={styles.quickActionText}>
                {isHost ? 'Destination' : 'Request'}
              </Text>
            </Pressable>

            <Pressable
              disabled={occupiedSlots >= 8 || !isHost}
              onPress={openInviteComposer}
              style={[
                styles.quickAction,
                (occupiedSlots >= 8 || !isHost) && styles.actionDisabled,
              ]}>
              <Ionicons name="person-add-outline" size={18} color={colors.text} />
              <Text style={styles.quickActionText}>Driver</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.quickActions}>
            <Pressable
              onPress={openInviteComposer}
              style={styles.quickAction}>
              <Ionicons name="person-add-outline" size={18} color={colors.text} />
              <Text style={styles.quickActionText}>Add driver</Text>
            </Pressable>
            <Pressable
              onPress={openDestinationComposer}
              style={styles.quickAction}>
              <Ionicons name="flag-outline" size={18} color={colors.text} />
              <Text style={styles.quickActionText}>Destination</Text>
            </Pressable>
          </View>
        )}

        {destinationProposal ? (
          <View style={styles.proposalCard}>
            <View style={styles.proposalIcon}>
              <Ionicons name="swap-horizontal" size={17} color={colors.primaryHover} />
            </View>
            <View style={styles.flexCopy}>
              <Text style={styles.proposalLabel}>
                {isHost ? 'DESTINATION REQUEST' : 'ROUTE CHANGE REQUESTED'}
              </Text>
              <Text numberOfLines={2} style={styles.proposalTitle}>
                {destinationProposal.label}
              </Text>
              <Text style={styles.proposalMeta}>
                {profileName(proposalAuthor?.profile)}
              </Text>
            </View>
            {isHost ? (
              <View style={styles.proposalActions}>
                <Pressable
                  disabled={working}
                  onPress={() => void respondToProposal(false)}
                  style={styles.proposalButton}>
                  <Ionicons name="close" size={17} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  disabled={working}
                  onPress={() => void respondToProposal(true)}
                  style={[styles.proposalButton, styles.proposalButtonAccept]}>
                  <Ionicons name="checkmark" size={17} color={colors.text} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {expanded ? (
          <>
            <ScrollView
              contentContainerStyle={styles.roomScrollContent}
              showsVerticalScrollIndicator={false}
              style={styles.roomScroll}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Drivers</Text>
                  <Text style={styles.sectionMeta}>
                    {roomActive
                      ? `${activeParticipants.length}/8`
                      : `${occupiedSlots}/8`}
                  </Text>
                </View>

                {(details?.participants ?? []).map((participant) => {
                  const metric = participantMetrics.find(
                    (entry) => entry.userId === participant.userId,
                  );
                  return (
                    <View key={participant.userId} style={styles.participantRow}>
                      <View style={styles.participantAvatar}>
                        {participant.profile?.avatarUrl ? (
                          <Image
                            cachePolicy="memory-disk"
                            contentFit="cover"
                            source={{ uri: participant.profile.avatarUrl }}
                            style={styles.participantAvatarImage}
                          />
                        ) : (
                          <Text style={styles.participantInitial}>
                            {initials(profileName(participant.profile))}
                          </Text>
                        )}
                      </View>
                      <View style={styles.flexCopy}>
                        <Text numberOfLines={1} style={styles.participantName}>
                          {profileName(participant.profile)}
                          {participant.role === 'host' ? ' · Host' : ''}
                        </Text>
                        <Text style={styles.participantMeta}>
                          {participant.status === 'active'
                            ? 'In drive'
                            : participant.status}
                        </Text>
                      </View>
                      {metric ? (
                        <Text style={styles.participantDistance}>
                          {metric.distanceLabel}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}

                {pendingInvitations.map((pending) => (
                  <View key={pending.id} style={styles.participantRow}>
                    <View style={[styles.participantAvatar, styles.pendingAvatar]}>
                      <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                    </View>
                    <View style={styles.flexCopy}>
                      <Text numberOfLines={1} style={styles.participantName}>
                        {profileName(pending.profile)}
                      </Text>
                      <Text style={styles.participantMeta}>Invited</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <View style={styles.roomFooter}>
              <SecondaryAction
                destructive
                disabled={working}
                icon={roomActive ? 'exit-outline' : 'trash-outline'}
                onPress={() => {
                  if (roomActive) finishActive();
                  else cancelWaitingRoom();
                }}
                title={
                  roomActive
                    ? isHost
                      ? 'End Drive Together'
                      : 'Leave Drive Together'
                    : 'Cancel room'
                }
              />
            </View>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSheetSnap('expanded')}
              style={styles.driversSummary}>
              <View>
                <Text style={styles.sectionTitle}>Drivers</Text>
                <Text style={styles.driversSummaryMeta}>
                  {roomActive
                    ? `${activeParticipants.length} active · up to 8`
                    : `${occupiedSlots}/8 in room · ${pendingInvitations.length} pending`}
                </Text>
              </View>
              <Ionicons name="chevron-up" size={17} color={colors.textMuted} />
            </Pressable>
            {error ? (
              <Text accessibilityRole="alert" numberOfLines={2} style={styles.error}>
                {error}
              </Text>
            ) : null}
          </>
        )}
      </View>
    );
  };

  return (
    <>
      {roomActive && participantMetrics.length ? (
        <DriveTogetherParticipantRail
          entries={participantMetrics}
          top={topOffset}
        />
      ) : null}

      {toast ? (
        <View pointerEvents="none" style={[styles.toast, { top: topOffset }]}>
          <Ionicons name="git-compare-outline" size={15} color={colors.text} />
          <Text numberOfLines={1} style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {sheetVisible ? (
        <DriveTogetherSheet
          bottomInset={bottomInset}
          bottomOffset={bottomOffset}
          onSnapChange={setSheetSnap}
          topOffset={topOffset}
          snap={
            mapPicking
              ? 'collapsed'
              : sheetSnap
          }>
          {composerMode === 'create-destination'
            || composerMode === 'change-destination'
            ? renderDestinationComposer()
            : composerMode === 'create-friends'
              || composerMode === 'invite-drivers'
              ? renderFriendComposer()
              : invite
                ? renderInvite()
                : roomId
                  ? renderRoom()
                  : (
                    <View style={styles.emptyComposer}>
                      <Text style={styles.eyebrow}>DRIVE TOGETHER</Text>
                      <Text style={styles.sheetTitle}>Choose a destination.</Text>
                      <PrimaryAction
                        icon="flag-outline"
                        onPress={() => setComposerMode('create-destination')}
                        title="Set destination"
                      />
                    </View>
                  )}
        </DriveTogetherSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flexCopy: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.78,
  },
  actionDisabled: {
    opacity: 0.42,
  },
  actionGrow: {
    flex: 1,
  },
  composer: {
    flex: 1,
    gap: spacing.md,
  },
  roomContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  roomShell: {
    flex: 1,
    minHeight: 0,
    gap: spacing.sm,
  },
  roomScroll: {
    flex: 1,
    minHeight: 0,
  },
  roomScrollContent: {
    paddingBottom: spacing.sm,
  },
  roomFooter: {
    paddingTop: 2,
  },
  driversSummary: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  driversSummaryMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10.5,
  },
  emptyComposer: {
    gap: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  sheetSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  searchResultsViewport: {
    flex: 1,
    minHeight: 0,
  },
  searchResults: {
    gap: 6,
    paddingBottom: spacing.md,
  },
  placeRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  placeIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  placeTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  placeSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
  },
  mapPickNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  mapPickTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  mapPickBody: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
  },
  smallGhostButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  smallGhostText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  primaryAction: {
    minHeight: 46,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  primaryActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  secondaryAction: {
    minHeight: 46,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  destructiveAction: {
    borderColor: 'rgba(200,16,46,0.40)',
    backgroundColor: 'rgba(200,16,46,0.10)',
  },
  destructiveText: {
    color: colors.primaryHover,
  },
  friendListViewport: {
    flex: 1,
    minHeight: 0,
  },
  friendList: {
    gap: 7,
    paddingBottom: spacing.sm,
  },
  friendRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  friendRowSelected: {
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: colors.surfaceSoft,
  },
  friendAvatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  friendAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
  },
  friendAvatarText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  friendName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  friendMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
  },
  checkCircle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  checkCircleSelected: {
    borderColor: colors.primaryHover,
    backgroundColor: colors.primary,
  },
  stickyActions: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  privacyNote: {
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loadingRow: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingRoom: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyText: {
    paddingVertical: spacing.lg,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  roomHeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 68,
  },
  roomHeadlineMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roomCloseButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  liveBadge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(200,16,46,0.10)',
  },
  liveBadgeActive: {
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  roomKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  roomTitle: {
    marginTop: 3,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  destinationText: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  nextTurn: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '700',
  },
  myDistance: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  noticeBody: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  inlineButton: {
    minWidth: 64,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  inlineButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 7,
  },
  quickAction: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  quickActionText: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: '800',
  },
  proposalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.34)',
    backgroundColor: 'rgba(200,16,46,0.08)',
  },
  proposalIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(200,16,46,0.12)',
  },
  proposalLabel: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  proposalTitle: {
    marginTop: 2,
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '800',
  },
  proposalMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10.5,
  },
  proposalActions: {
    flexDirection: 'row',
    gap: 6,
  },
  proposalButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  proposalButtonAccept: {
    backgroundColor: colors.primary,
  },
  section: {
    gap: 4,
    paddingTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: '800',
  },
  participantRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 4,
  },
  participantAvatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  participantAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
  },
  participantInitial: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  pendingAvatar: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  participantName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  participantMeta: {
    marginTop: 1,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'capitalize',
  },
  participantDistance: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  error: {
    color: colors.primaryHover,
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 16,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,10,14,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    ...shadows.card,
  },
  toastText: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 11.5,
    fontWeight: '800',
  },
});
