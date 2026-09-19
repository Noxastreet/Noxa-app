import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
} from "react-native-reanimated";

import { NoxaAvatar } from "@/src/components/ui";
import {
  calculateDriveRoute,
  createDriveSession,
  inviteCrewsToDrive,
  inviteUsersToDrive,
  listMyGroupDrives,
  loadDriveInviteCandidates,
  loadDriveLobbyReadiness,
  loadGroupDriveDetails,
  saveCalculatedDriveRoute,
  setDriveReady,
  startDrive,
  subscribeToDriveLobbyStatus,
  updateDriveDetails,
  type DriveInviteCrew,
  type DriveInviteFriend,
  type DriveParticipant,
  type DriveRouteResult,
  type GroupDriveDetails,
  type GroupDriveListItem,
} from "@/src/features/group-drive";
import type { LatLng } from "@/src/features/mapbox/types";
import { colors, radius, spacing, typography } from "@/src/theme";

import { MapContextSheet } from "./MapContextSheet";
import { MapPlaceSearch, type MapPlaceSelection } from "./MapPlaceSearch";

type Destination = LatLng & { label: string };
type FlowState =
  | "hub"
  | "destination"
  | "route"
  | "people"
  | "departure"
  | "review"
  | "lobby";
type PickerMode = "date" | "time";
type DepartureMode = "now" | "scheduled";

type Props = {
  visible: boolean;
  bottomOffset: number;
  currentLocation: LatLng | null;
  startInPlanner?: boolean;
  mapCenter: LatLng;
  initialDestination?: Destination | null;
  initialDriveId?: string | null;
  initialRoute?: DriveRouteResult | null;
  onClose: () => void;
  onFocusPoint: (point: LatLng) => void;
  onHeightChange?: (height: number) => void;
  onMapSelectionChange: (active: boolean) => void;
  onPreviewRoute: (route: DriveRouteResult | null, destination: Destination | null) => void;
};

const STEP_INDEX: Record<Exclude<FlowState, "hub" | "lobby">, number> = {
  destination: 1,
  route: 2,
  people: 3,
  departure: 4,
  review: 5,
};

const STEP_LABEL: Record<Exclude<FlowState, "hub" | "lobby">, string> = {
  destination: "Where",
  route: "Route",
  people: "People",
  departure: "When",
  review: "Ready",
};

function nextStart() {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
  return value;
}

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.max(0, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function shortDestinationTitle(label: string) {
  const clean = label.trim().replace(/\s+/g, " ");
  const title = clean ? `Drive to ${clean}` : "Group Drive";
  return title.slice(0, 100);
}

async function resolveDestinationLabel(point: LatLng) {
  try {
    const address = (await Location.reverseGeocodeAsync(point))[0];
    if (!address) return "Pinned destination";
    const street = [address.name, address.street].filter(Boolean).join(" ").trim();
    const parts = Array.from(
      new Set([street, address.city, address.region].filter(Boolean)),
    );
    return parts.length ? parts.join(", ") : "Pinned destination";
  } catch {
    return "Pinned destination";
  }
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "NX"
  );
}

function isPreActive(status: GroupDriveDetails["status"]) {
  return status === "draft" || status === "scheduled";
}

function mergeLobbyReadiness(
  drive: GroupDriveDetails,
  rows: Awaited<ReturnType<typeof loadDriveLobbyReadiness>>,
) {
  const readyByUser = new Map(rows.map((row) => [row.userId, row.readyAt]));
  return {
    ...drive,
    participants: drive.participants.map((participant) => ({
      ...participant,
      readyAt: readyByUser.get(participant.userId) ?? null,
    })),
  };
}

function lobbyRoute(drive: GroupDriveDetails): {
  route: DriveRouteResult;
  destination: Destination;
} | null {
  const end = drive.stops.find((stop) => stop.kind === "end");
  if (
    !end ||
    !drive.routeGeometry ||
    drive.routeDistanceMeters === null ||
    drive.routeDurationSeconds === null
  ) {
    return null;
  }
  return {
    route: {
      geometry: drive.routeGeometry,
      coordinates: drive.routeGeometry.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      })),
      distanceMeters: drive.routeDistanceMeters,
      durationSeconds: drive.routeDurationSeconds,
      provider: drive.routeProvider ?? "mapbox",
    },
    destination: {
      latitude: end.latitude,
      longitude: end.longitude,
      label: end.label?.trim() || "Destination",
    },
  };
}

function LobbyParticipantRow({
  participant,
  preActive,
}: {
  participant: DriveParticipant;
  preActive: boolean;
}) {
  const name = participant.profile?.displayName ?? "NOXA driver";
  const isHost = participant.role === "host";
  const ready =
    preActive &&
    !isHost &&
    participant.status === "accepted" &&
    Boolean(participant.readyAt);
  const meta = isHost
    ? "Host"
    : ready
      ? "Ready"
      : participant.status === "accepted"
        ? "Waiting"
        : participant.status;

  return (
    <View style={styles.personRow}>
      <NoxaAvatar
        imageUrl={participant.profile?.avatarUrl}
        initials={initials(name)}
        size={40}
      />
      <View style={styles.driveCopy}>
        <Text numberOfLines={1} style={styles.personName}>{name}</Text>
        <Text style={styles.personMeta}>{meta}</Text>
      </View>
      {isHost ? (
        <Ionicons name="key-outline" size={17} color={colors.textMuted} />
      ) : ready ? (
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
      ) : (
        <Ionicons name="time-outline" size={18} color={colors.textSubtle} />
      )}
    </View>
  );
}

function Progress({ state }: { state: Exclude<FlowState, "hub" | "lobby"> }) {
  const current = STEP_INDEX[state];
  return (
    <View
      accessibilityLabel={`Step ${current} of 5, ${STEP_LABEL[state]}`}
      style={styles.progressWrap}
    >
      <View style={styles.progressCopy}>
        <Text style={styles.eyebrow}>{STEP_LABEL[state].toUpperCase()}</Text>
        <Text style={styles.progressCount}>{current} / 5</Text>
      </View>
      <View style={styles.progressTrack}>
        {[1, 2, 3, 4, 5].map((step) => (
          <View
            key={step}
            style={[
              styles.progressSegment,
              step <= current && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function Footer({
  backLabel = "Back",
  busy,
  disabled,
  onBack,
  onPrimary,
  primaryLabel,
}: {
  backLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onBack: () => void;
  onPrimary: () => void;
  primaryLabel: string;
}) {
  return (
    <View style={styles.footer}>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onBack}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && !busy && styles.pressed,
        ]}
      >
        <Ionicons name="chevron-back" size={17} color={colors.textMuted} />
        <Text style={styles.secondaryButtonText}>{backLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || busy}
        onPress={onPrimary}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && !disabled && !busy && styles.pressed,
          (disabled || busy) && styles.disabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.text} />
          </>
        )}
      </Pressable>
    </View>
  );
}

function DriveRow({
  item,
  onPress,
}: {
  item: GroupDriveListItem;
  onPress: () => void;
}) {
  const invited = item.myInvitationStatus === "invited";
  const active = item.sessionStatus === "active";
  const timing = item.scheduledStartAt
    ? `${dateFormat.format(new Date(item.scheduledStartAt))} · ${timeFormat.format(new Date(item.scheduledStartAt))}`
    : active
      ? "Active now"
      : "Ready when the host starts";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.driveRow, pressed && styles.rowPressed]}
    >
      <View style={styles.driveIcon}>
        <Ionicons
          name={active ? "navigate" : invited ? "mail-outline" : "car-sport-outline"}
          size={18}
          color={active ? colors.primaryHover : colors.textMuted}
        />
      </View>
      <View style={styles.driveCopy}>
        <Text numberOfLines={1} style={styles.driveTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.driveMeta}>
          {invited ? "Invitation" : timing}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

function PersonRow({
  friend,
  selected,
  onPress,
}: {
  friend: DriveInviteFriend;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: selected || friend.unavailable,
        disabled: friend.unavailable,
      }}
      disabled={friend.unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.personRow,
        pressed && !friend.unavailable && styles.rowPressed,
        friend.unavailable && styles.disabled,
      ]}
    >
      <NoxaAvatar initials={initials(friend.displayName)} size={40} />
      <View style={styles.driveCopy}>
        <Text numberOfLines={1} style={styles.personName}>
          {friend.displayName}
        </Text>
        <Text style={styles.personMeta}>
          {friend.unavailable ? "Already in this drive" : "Mutual friend"}
        </Text>
      </View>
      <Ionicons
        name={selected || friend.unavailable ? "checkmark-circle" : "ellipse-outline"}
        size={21}
        color={selected || friend.unavailable ? colors.primaryHover : colors.textSubtle}
      />
    </Pressable>
  );
}

function CrewRow({
  crew,
  selected,
  onPress,
}: {
  crew: DriveInviteCrew;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      disabled={crew.memberCount === 0}
      onPress={onPress}
      style={({ pressed }) => [
        styles.personRow,
        pressed && crew.memberCount > 0 && styles.rowPressed,
        crew.memberCount === 0 && styles.disabled,
      ]}
    >
      <View style={styles.crewIcon}>
        <Ionicons name="people-outline" size={18} color={colors.textMuted} />
      </View>
      <View style={styles.driveCopy}>
        <Text numberOfLines={1} style={styles.personName}>
          {crew.name}
        </Text>
        <Text style={styles.personMeta}>
          {crew.memberCount} eligible {crew.memberCount === 1 ? "driver" : "drivers"}
        </Text>
      </View>
      <Ionicons
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={21}
        color={selected ? colors.primaryHover : colors.textSubtle}
      />
    </Pressable>
  );
}

export function MapGroupDriveFlow({
  visible,
  bottomOffset,
  currentLocation,
  startInPlanner = false,
  mapCenter,
  initialDestination = null,
  initialDriveId = null,
  initialRoute = null,
  onClose,
  onFocusPoint,
  onHeightChange,
  onMapSelectionChange,
  onPreviewRoute,
}: Props) {
  const { height } = useWindowDimensions();
  const [state, setState] = useState<FlowState>("hub");
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [drives, setDrives] = useState<GroupDriveListItem[]>([]);
  const [drivesLoading, setDrivesLoading] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(initialDestination);
  const [pickingDestination, setPickingDestination] = useState(!initialDestination);
  const [route, setRoute] = useState<DriveRouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<DriveInviteFriend[]>([]);
  const [inviteCrews, setInviteCrews] = useState<DriveInviteCrew[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(() => new Set());
  const [selectedCrews, setSelectedCrews] = useState<Set<string>>(() => new Set());
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [departureMode, setDepartureMode] = useState<DepartureMode>("now");
  const [scheduledAt, setScheduledAt] = useState(nextStart);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [draftDate, setDraftDate] = useState(nextStart);
  const [saving, setSaving] = useState(false);
  const [createdDriveId, setCreatedDriveId] = useState<string | null>(null);
  const [lobbyDriveId, setLobbyDriveId] = useState<string | null>(null);
  const [lobbyDrive, setLobbyDrive] = useState<GroupDriveDetails | null>(null);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [lobbyWorking, setLobbyWorking] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeDrives = useMemo(
    () =>
      drives
        .filter((drive) => !["completed", "cancelled"].includes(drive.sessionStatus))
        .slice(0, 4),
    [drives],
  );

  const selectedPeopleCount = selectedFriends.size + selectedCrews.size;

  const goTo = useCallback((next: FlowState, direction: 1 | -1 = 1) => {
    setTransitionDirection(direction);
    setState(next);
  }, []);

  const resetPlanner = useCallback(
    (seed: Destination | null, seedRoute: DriveRouteResult | null = null) => {
      setDestination(seed);
      setPickingDestination(!seed);
      setRoute(seedRoute);
      setInviteFriends([]);
      setInviteCrews([]);
      setSelectedFriends(new Set());
      setSelectedCrews(new Set());
      setPeopleLoaded(false);
      setDepartureMode("now");
      setScheduledAt(nextStart());
      setCreatedDriveId(null);
      setLobbyDriveId(null);
      setLobbyDrive(null);
      setLobbyError(null);
      setError(null);
      onPreviewRoute(seedRoute, seedRoute && seed ? seed : null);
    },
    [onPreviewRoute],
  );

  useEffect(() => {
    if (!visible) {
      onMapSelectionChange(false);
      return;
    }
    if (initialDriveId && state === "hub") {
      setLobbyDriveId(initialDriveId);
      setLobbyDrive(null);
      goTo("lobby");
      return;
    }
    if (startInPlanner && initialDestination && state === "hub") {
      resetPlanner(initialDestination, initialRoute);
      goTo(initialRoute ? "people" : "destination");
      return;
    }
    if (state === "hub") {
      setDrivesLoading(true);
      setError(null);
      void listMyGroupDrives()
        .then(setDrives)
        .catch((loadError) => {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Group Drives could not be loaded.",
          );
        })
        .finally(() => setDrivesLoading(false));
    }
  }, [
    goTo,
    initialDestination,
    initialDriveId,
    initialRoute,
    onMapSelectionChange,
    resetPlanner,
    startInPlanner,
    state,
    visible,
  ]);

  useEffect(() => {
    if (!visible) return;
    if (initialDestination) {
      setDestination(initialDestination);
      setPickingDestination(false);
    }
  }, [initialDestination, visible]);

  useEffect(() => {
    onMapSelectionChange(
      visible && state === "destination" && pickingDestination,
    );
  }, [onMapSelectionChange, pickingDestination, state, visible]);

  useEffect(() => {
    if (!visible || state !== "people" || peopleLoaded) return;
    setPeopleLoaded(true);
    setPeopleLoading(true);
    setError(null);
    void loadDriveInviteCandidates()
      .then((options) => {
        setInviteFriends(options.friends);
        setInviteCrews(options.crews);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "People could not be loaded.",
        );
      })
      .finally(() => setPeopleLoading(false));
  }, [peopleLoaded, state, visible]);

  const loadLobby = useCallback(
    async (driveId: string) => {
      setLobbyLoading(true);
      setLobbyError(null);
      try {
        let next = await loadGroupDriveDetails(driveId);
        if (isPreActive(next.status)) {
          const rows = await loadDriveLobbyReadiness(driveId);
          next = mergeLobbyReadiness(next, rows);
        }
        setLobbyDrive(next);
        const mapRoute = lobbyRoute(next);
        if (mapRoute) {
          onPreviewRoute(mapRoute.route, mapRoute.destination);
        }
      } catch (loadError) {
        setLobbyDrive(null);
        setLobbyError(
          loadError instanceof Error
            ? loadError.message
            : "Group Drive Lobby could not be loaded.",
        );
      } finally {
        setLobbyLoading(false);
      }
    },
    [onPreviewRoute],
  );

  useEffect(() => {
    if (!visible || state !== "lobby" || !lobbyDriveId) return undefined;
    void loadLobby(lobbyDriveId);
    const interval = setInterval(() => void loadLobby(lobbyDriveId), 5000);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void loadLobby(lobbyDriveId);
    });
    const unsubscribe = subscribeToDriveLobbyStatus(lobbyDriveId, (status) => {
      if (status === "active") {
        onMapSelectionChange(false);
        onClose();
        router.replace({
          pathname: "/group-drives/[id]/active",
          params: { id: lobbyDriveId },
        });
        return;
      }
      void loadLobby(lobbyDriveId);
    });
    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
      unsubscribe();
    };
  }, [
    loadLobby,
    lobbyDriveId,
    onClose,
    onMapSelectionChange,
    state,
    visible,
  ]);

  const closeFlow = useCallback(() => {
    onMapSelectionChange(false);
    resetPlanner(null);
    setState("hub");
    onClose();
  }, [onClose, onMapSelectionChange, resetPlanner]);

  const openExistingDrive = (item: GroupDriveListItem) => {
    if (item.myInvitationStatus === "invited" && item.invitationId) {
      closeFlow();
      router.push({
        pathname: "/group-drives/invitation/[id]",
        params: { id: item.invitationId },
      });
      return;
    }
    if (item.sessionStatus === "active") {
      closeFlow();
      router.push({
        pathname: "/group-drives/[id]/active",
        params: { id: item.driveSessionId },
      });
      return;
    }
    setLobbyDriveId(item.driveSessionId);
    setLobbyDrive(null);
    goTo("lobby");
  };

  const startPlanner = () => {
    resetPlanner(initialDestination);
    goTo("destination");
  };

  const confirmMapCenter = async () => {
    setError(null);
    const label = await resolveDestinationLabel(mapCenter);
    setDestination({ ...mapCenter, label });
    setPickingDestination(false);
    setRoute(null);
    onPreviewRoute(null, null);
  };

  const prepareRoute = async () => {
    if (!currentLocation) {
      setError("Current location is unavailable. Recenter the map and try again.");
      return;
    }
    if (!destination) {
      setError("Choose a destination first.");
      return;
    }
    setRouteLoading(true);
    setError(null);
    try {
      const next = await calculateDriveRoute([currentLocation, destination]);
      setRoute(next);
      onPreviewRoute(next, destination);
      goTo("route");
    } catch (routeError) {
      setError(
        routeError instanceof Error
          ? routeError.message
          : "Route could not be calculated.",
      );
    } finally {
      setRouteLoading(false);
    }
  };

  const loadPeopleStep = () => {
    setError(null);
    goTo("people");
  };

  const backFromPlanner = useCallback(() => {
    setError(null);
    if (state === "destination") {
      onPreviewRoute(null, null);
      goTo("hub", -1);
      return;
    }
    if (state === "route") {
      onPreviewRoute(null, null);
      goTo("destination", -1);
      return;
    }
    if (state === "people") {
      goTo("route", -1);
      return;
    }
    if (state === "departure") {
      goTo("people", -1);
      return;
    }
    if (state === "review") {
      goTo("departure", -1);
      return;
    }
    if (state === "lobby") {
      onPreviewRoute(null, null);
      setLobbyDriveId(null);
      setLobbyDrive(null);
      goTo("hub", -1);
    }
  }, [goTo, onPreviewRoute, state]);

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pickerMode) {
        setPickerMode(null);
        return true;
      }
      if (saving) return true;
      if (state === "hub") closeFlow();
      else backFromPlanner();
      return true;
    });
    return () => subscription.remove();
  }, [backFromPlanner, closeFlow, pickerMode, saving, state, visible]);

  if (!visible) return null;

  const openPicker = (mode: PickerMode) => {
    setDraftDate(scheduledAt);
    setPickerMode(mode);
  };

  const commitPicker = () => {
    setScheduledAt((current) =>
      pickerMode === "date"
        ? new Date(
            draftDate.getFullYear(),
            draftDate.getMonth(),
            draftDate.getDate(),
            current.getHours(),
            current.getMinutes(),
          )
        : new Date(
            current.getFullYear(),
            current.getMonth(),
            current.getDate(),
            draftDate.getHours(),
            draftDate.getMinutes(),
          ),
    );
    setPickerMode(null);
  };

  const createDrive = async () => {
    if (createdDriveId) {
      setLobbyDriveId(createdDriveId);
      await loadLobby(createdDriveId);
      goTo("lobby");
      return;
    }
    if (!currentLocation || !destination || !route) {
      setError("Route context is incomplete. Go back and review the route.");
      return;
    }
    if (
      departureMode === "scheduled" &&
      scheduledAt.getTime() <= Date.now() + 60_000
    ) {
      setError("Choose a future start time.");
      return;
    }

    setSaving(true);
    setError(null);
    let id: string | null = null;
    try {
      const title = shortDestinationTitle(destination.label);
      id = await createDriveSession(title, "");
      setCreatedDriveId(id);
      await updateDriveDetails(
        id,
        title,
        "",
        departureMode === "scheduled" ? scheduledAt.toISOString() : null,
        null,
      );
      await saveCalculatedDriveRoute(
        id,
        { ...currentLocation, label: "Current location" },
        destination,
        route,
      );
      if (selectedFriends.size) {
        await inviteUsersToDrive(id, Array.from(selectedFriends));
      }
      if (selectedCrews.size) {
        await inviteCrewsToDrive(id, Array.from(selectedCrews));
      }
      setLobbyDriveId(id);
      onMapSelectionChange(false);
      await loadLobby(id);
      goTo("lobby");
    } catch (createError) {
      setError(
        id
          ? "The Group Drive draft was created, but setup did not finish. Open the draft to continue safely."
          : createError instanceof Error
            ? createError.message
            : "Group Drive could not be created.",
      );
    } finally {
      setSaving(false);
    }
  };

  const renderHub = () => (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>GROUP DRIVE</Text>
          <Text style={styles.sheetTitle}>Drive together.</Text>
        </View>
        <Pressable
          accessibilityLabel="Close Group Drive"
          accessibilityRole="button"
          onPress={closeFlow}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={19} color={colors.textMuted} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>UPCOMING</Text>
        {drivesLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primaryHover} size="small" />
            <Text style={styles.muted}>Loading drives…</Text>
          </View>
        ) : activeDrives.length ? (
          <View style={styles.listSurface}>
            {activeDrives.map((item) => (
              <DriveRow
                item={item}
                key={item.driveSessionId}
                onPress={() => openExistingDrive(item)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="navigate-outline" size={22} color={colors.textMuted} />
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No upcoming Group Drives</Text>
              <Text style={styles.muted}>
                Plan a destination without leaving the map.
              </Text>
            </View>
          </View>
        )}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.singleFooter}>
        <Pressable
          accessibilityRole="button"
          onPress={startPlanner}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={18} color={colors.text} />
          <Text style={styles.primaryButtonText}>Create Group Drive</Text>
        </Pressable>
      </View>
    </>
  );

  const renderDestination = () => (
    <>
      <Progress state="destination" />
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.question}>Where are you going?</Text>

        <View style={styles.originRow}>
          <View style={styles.selectionIcon}>
            <Ionicons name="navigate" size={18} color={colors.success} />
          </View>
          <View style={styles.driveCopy}>
            <Text style={styles.sectionLabel}>A · START</Text>
            <Text style={styles.selectionValue}>
              {currentLocation ? "Current location" : "Locating current position…"}
            </Text>
          </View>
          <Ionicons
            name={currentLocation ? "checkmark-circle" : "time-outline"}
            size={19}
            color={currentLocation ? colors.success : colors.textSubtle}
          />
        </View>

        <View style={styles.searchBlock}>
          <Text style={styles.sectionLabel}>B · DESTINATION</Text>
          <MapPlaceSearch
            proximity={currentLocation ?? mapCenter}
            onSelect={(place: MapPlaceSelection) => {
              setDestination(place);
              setPickingDestination(false);
              setRoute(null);
              setError(null);
              onPreviewRoute(null, null);
              onFocusPoint(place);
            }}
          />
        </View>

        {pickingDestination ? (
          <View style={styles.instruction}>
            <Ionicons name="move-outline" size={20} color={colors.primaryHover} />
            <View style={styles.driveCopy}>
              <Text style={styles.instructionTitle}>Move the map</Text>
              <Text style={styles.muted}>
                Or move the map and keep the pin over the destination.
              </Text>
            </View>
          </View>
        ) : destination ? (
          <View style={styles.selectionRow}>
            <View style={styles.selectionIcon}>
              <Ionicons name="flag" size={18} color={colors.primaryHover} />
            </View>
            <View style={styles.driveCopy}>
              <Text style={styles.sectionLabel}>SELECTED</Text>
              <Text numberOfLines={2} style={styles.selectionValue}>
                {destination.label}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPickingDestination(true);
                setRoute(null);
                onPreviewRoute(null, null);
              }}
            >
              <Text style={styles.linkText}>Map</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <Footer
        backLabel="Cancel"
        busy={routeLoading}
        disabled={!currentLocation || (!pickingDestination && !destination)}
        onBack={backFromPlanner}
        onPrimary={() => {
          if (pickingDestination) void confirmMapCenter();
          else void prepareRoute();
        }}
        primaryLabel={pickingDestination ? "Use this point" : "Continue"}
      />
    </>
  );

  const renderRoute = () => (
    <>
      <Progress state="route" />
      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>Which route?</Text>
        {route ? (
          <View style={[styles.routeOption, styles.routeOptionSelected]}>
            <View style={styles.routeIcon}>
              <Ionicons name="navigate" size={18} color={colors.primaryHover} />
            </View>
            <View style={styles.driveCopy}>
              <View style={styles.routeTitleRow}>
                <Text style={styles.routeTitle}>Fastest</Text>
                <Ionicons name="checkmark-circle" size={19} color={colors.primaryHover} />
              </View>
              <Text style={styles.routeMeta}>
                {formatDuration(route.durationSeconds)} · {formatDistance(route.distanceMeters)}
              </Text>
              <Text style={styles.muted}>Traffic-aware route</Text>
            </View>
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <Footer
        onBack={backFromPlanner}
        onPrimary={loadPeopleStep}
        primaryLabel="Continue"
        disabled={!route}
      />
    </>
  );

  const renderPeople = () => (
    <>
      <Progress state="people" />
      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>Who is coming?</Text>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedPeopleCount === 0 }}
          onPress={() => {
            setSelectedFriends(new Set());
            setSelectedCrews(new Set());
          }}
          style={({ pressed }) => [
            styles.soloRow,
            selectedPeopleCount === 0 && styles.soloRowSelected,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={styles.selectionIcon}>
            <Ionicons name="car-sport-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.driveCopy}>
            <Text style={styles.personName}>Drive solo</Text>
            <Text style={styles.personMeta}>You can invite people later from the Lobby.</Text>
          </View>
          <Ionicons
            name={selectedPeopleCount === 0 ? "radio-button-on" : "radio-button-off"}
            size={21}
            color={selectedPeopleCount === 0 ? colors.primaryHover : colors.textSubtle}
          />
        </Pressable>
        {peopleLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primaryHover} size="small" />
            <Text style={styles.muted}>Loading people…</Text>
          </View>
        ) : (
          <>
            {inviteFriends.length ? (
              <View>
                <Text style={styles.sectionLabel}>FRIENDS</Text>
                <View style={styles.listSurface}>
                  {inviteFriends.map((friend) => (
                    <PersonRow
                      friend={friend}
                      key={friend.id}
                      selected={selectedFriends.has(friend.id)}
                      onPress={() =>
                        setSelectedFriends((current) => {
                          const next = new Set(current);
                          if (next.has(friend.id)) next.delete(friend.id);
                          else next.add(friend.id);
                          return next;
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {inviteCrews.length ? (
              <View>
                <Text style={styles.sectionLabel}>CREWS</Text>
                <View style={styles.listSurface}>
                  {inviteCrews.map((crew) => (
                    <CrewRow
                      crew={crew}
                      key={crew.id}
                      selected={selectedCrews.has(crew.id)}
                      onPress={() =>
                        setSelectedCrews((current) => {
                          const next = new Set(current);
                          if (next.has(crew.id)) next.delete(crew.id);
                          else next.add(crew.id);
                          return next;
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <Footer
        onBack={backFromPlanner}
        onPrimary={() => {
          setError(null);
          goTo("departure");
        }}
        primaryLabel="Continue"
      />
    </>
  );

  const renderDeparture = () => (
    <>
      <Progress state="departure" />
      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>When do you leave?</Text>
        <View accessibilityRole="radiogroup" style={styles.choiceStack}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: departureMode === "now" }}
            onPress={() => setDepartureMode("now")}
            style={({ pressed }) => [
              styles.choice,
              departureMode === "now" && styles.choiceSelected,
              pressed && styles.rowPressed,
            ]}
          >
            <Ionicons name="flash-outline" size={19} color={colors.text} />
            <View style={styles.driveCopy}>
              <Text style={styles.personName}>Leave now</Text>
              <Text style={styles.personMeta}>The Lobby stays ready until the host starts.</Text>
            </View>
            <Ionicons
              name={departureMode === "now" ? "radio-button-on" : "radio-button-off"}
              size={21}
              color={departureMode === "now" ? colors.primaryHover : colors.textSubtle}
            />
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: departureMode === "scheduled" }}
            onPress={() => setDepartureMode("scheduled")}
            style={({ pressed }) => [
              styles.choice,
              departureMode === "scheduled" && styles.choiceSelected,
              pressed && styles.rowPressed,
            ]}
          >
            <Ionicons name="calendar-outline" size={19} color={colors.text} />
            <View style={styles.driveCopy}>
              <Text style={styles.personName}>Schedule</Text>
              <Text style={styles.personMeta}>Show invited drivers a planned start time.</Text>
            </View>
            <Ionicons
              name={
                departureMode === "scheduled"
                  ? "radio-button-on"
                  : "radio-button-off"
              }
              size={21}
              color={
                departureMode === "scheduled"
                  ? colors.primaryHover
                  : colors.textSubtle
              }
            />
          </Pressable>
        </View>
        {departureMode === "scheduled" ? (
          <View style={styles.pickerRow}>
            <Pressable
              onPress={() => openPicker("date")}
              style={({ pressed }) => [styles.pickerButton, pressed && styles.rowPressed]}
            >
              <Text style={styles.sectionLabel}>DATE</Text>
              <Text style={styles.pickerValue}>{dateFormat.format(scheduledAt)}</Text>
            </Pressable>
            <Pressable
              onPress={() => openPicker("time")}
              style={({ pressed }) => [styles.pickerButton, pressed && styles.rowPressed]}
            >
              <Text style={styles.sectionLabel}>TIME</Text>
              <Text style={styles.pickerValue}>{timeFormat.format(scheduledAt)}</Text>
            </Pressable>
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <Footer
        onBack={backFromPlanner}
        onPrimary={() => {
          if (
            departureMode === "scheduled" &&
            scheduledAt.getTime() <= Date.now() + 60_000
          ) {
            setError("Choose a future start time.");
            return;
          }
          setError(null);
          goTo("review");
        }}
        primaryLabel="Continue"
      />
    </>
  );

  const renderReview = () => (
    <>
      <Progress state="review" />
      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>Ready to drive?</Text>
        <View style={styles.reviewList}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Start</Text>
            <Text style={styles.reviewValue}>Current location</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Destination</Text>
            <Text numberOfLines={2} style={styles.reviewValue}>
              {destination?.label ?? "Destination"}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Crew</Text>
            <Text style={styles.reviewValue}>
              {selectedPeopleCount
                ? `${selectedPeopleCount} selected`
                : "Solo for now"}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Departure</Text>
            <Text style={styles.reviewValue}>
              {departureMode === "scheduled"
                ? `${dateFormat.format(scheduledAt)} · ${timeFormat.format(scheduledAt)}`
                : "Leave now"}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Route</Text>
            <Text style={styles.reviewValue}>
              {route
                ? `${formatDuration(route.durationSeconds)} · ${formatDistance(route.distanceMeters)}`
                : "Fastest route"}
            </Text>
          </View>
        </View>
        <Text style={styles.reviewNote}>
          Create keeps you on this map. The Lobby opens in this same card; live location sharing still starts only after the explicit Active Drive flow.
        </Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <Footer
        busy={saving}
        onBack={backFromPlanner}
        onPrimary={() => void createDrive()}
        primaryLabel={createdDriveId ? "Open draft" : "Create Group Drive"}
      />
    </>
  );

  const toggleLobbyReady = async () => {
    if (!lobbyDrive) return;
    const mine = lobbyDrive.participants.find(
      (participant) => participant.userId === lobbyDrive.currentUserId,
    );
    if (
      !mine ||
      mine.role === "host" ||
      mine.status !== "accepted" ||
      !isPreActive(lobbyDrive.status)
    ) {
      return;
    }
    setLobbyWorking(true);
    setLobbyError(null);
    try {
      await setDriveReady(lobbyDrive.id, !mine.readyAt);
      await loadLobby(lobbyDrive.id);
    } catch (readyError) {
      setLobbyError(
        readyError instanceof Error
          ? readyError.message
          : "Ready state could not be updated.",
      );
    } finally {
      setLobbyWorking(false);
    }
  };

  const startLobbyDrive = async () => {
    if (!lobbyDrive) return;
    setLobbyWorking(true);
    setLobbyError(null);
    try {
      await startDrive(lobbyDrive.id);
      onMapSelectionChange(false);
      onClose();
      router.replace({
        pathname: "/group-drives/[id]/active",
        params: { id: lobbyDrive.id },
      });
    } catch (startError) {
      setLobbyError(
        startError instanceof Error
          ? startError.message
          : "Group Drive could not be started.",
      );
    } finally {
      setLobbyWorking(false);
    }
  };

  const renderLobby = () => {
    if (lobbyLoading && !lobbyDrive) {
      return (
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>GROUP DRIVE</Text>
              <Text style={styles.sheetTitle}>Lobby</Text>
            </View>
            <Pressable
              accessibilityLabel="Close Group Drive"
              accessibilityRole="button"
              onPress={closeFlow}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={19} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.lobbyLoading}>
            <ActivityIndicator color={colors.primaryHover} />
            <Text style={styles.muted}>Loading Lobby…</Text>
          </View>
        </>
      );
    }

    if (!lobbyDrive) {
      return (
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>GROUP DRIVE</Text>
              <Text style={styles.sheetTitle}>Lobby unavailable</Text>
            </View>
            <Pressable
              accessibilityLabel="Close Group Drive"
              accessibilityRole="button"
              onPress={closeFlow}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={19} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.lobbyLoading}>
            <Text accessibilityRole="alert" style={styles.error}>
              {lobbyError ?? "This Group Drive is unavailable."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => lobbyDriveId && void loadLobby(lobbyDriveId)}
              style={styles.retryInline}
            >
              <Text style={styles.linkText}>Try again</Text>
            </Pressable>
          </View>
        </>
      );
    }

    const preActive = isPreActive(lobbyDrive.status);
    const isHost = lobbyDrive.currentUserId === lobbyDrive.hostId;
    const mine = lobbyDrive.participants.find(
      (participant) => participant.userId === lobbyDrive.currentUserId,
    );
    const acceptedParticipants = lobbyDrive.participants.filter(
      (participant) =>
        participant.role === "participant" &&
        participant.status === "accepted",
    );
    const readyCount = acceptedParticipants.filter(
      (participant) => Boolean(participant.readyAt),
    ).length;
    const waitingCount = acceptedParticipants.length - readyCount;
    const canStart =
      isHost &&
      preActive &&
      lobbyDrive.routeVersion > 0 &&
      acceptedParticipants.length > 0 &&
      waitingCount === 0;
    const canToggleReady =
      !isHost && preActive && mine?.status === "accepted";
    const isReady = Boolean(mine?.readyAt);
    const start = lobbyDrive.stops.find((stop) => stop.kind === "start");
    const end = lobbyDrive.stops.find((stop) => stop.kind === "end");

    const hostPrimaryLabel =
      acceptedParticipants.length === 0
        ? "Invite a driver first"
        : waitingCount > 0
          ? `Waiting for ${waitingCount} at A`
          : "Start Group Drive";

    return (
      <>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>LOBBY</Text>
            <Text numberOfLines={1} style={styles.sheetTitle}>
              {lobbyDrive.title}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close Group Drive"
            accessibilityRole="button"
            onPress={closeFlow}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={19} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.stepScroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.lobbyStatusRow}>
            <View>
              <Text style={styles.sectionLabel}>UPCOMING</Text>
              <Text style={styles.lobbyStatusValue}>
                {acceptedParticipants.length === 0
                  ? "Waiting for drivers"
                  : `${readyCount} ready · ${waitingCount} waiting`}
              </Text>
            </View>
            <Ionicons name="people-outline" size={20} color={colors.textMuted} />
          </View>

          <View style={styles.reviewList}>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>A · Start</Text>
              <Text numberOfLines={1} style={styles.reviewValue}>
                {start?.label?.trim() || "Current location"}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>B · Destination</Text>
              <Text numberOfLines={2} style={styles.reviewValue}>
                {end?.label?.trim() || "Destination"}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Departure</Text>
              <Text style={styles.reviewValue}>
                {lobbyDrive.scheduledStartAt
                  ? `${dateFormat.format(new Date(lobbyDrive.scheduledStartAt))} · ${timeFormat.format(new Date(lobbyDrive.scheduledStartAt))}`
                  : "Leave when everyone is ready"}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Route</Text>
              <Text style={styles.reviewValue}>
                {lobbyDrive.routeDurationSeconds !== null &&
                lobbyDrive.routeDistanceMeters !== null
                  ? `${formatDuration(lobbyDrive.routeDurationSeconds)} · ${formatDistance(lobbyDrive.routeDistanceMeters)}`
                  : "Fastest route"}
              </Text>
            </View>
          </View>

          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>PARTICIPANTS</Text>
              <Text style={styles.sectionCount}>
                {lobbyDrive.participants.length}
              </Text>
            </View>
            <View style={styles.listSurface}>
              {lobbyDrive.participants.map((participant) => (
                <LobbyParticipantRow
                  key={participant.userId}
                  participant={participant}
                  preActive={preActive}
                />
              ))}
            </View>
          </View>

          {lobbyDrive.invitations.some(
            (invitation) => invitation.status === "invited",
          ) ? (
            <Text style={styles.muted}>
              {lobbyDrive.invitations.filter(
                (invitation) => invitation.status === "invited",
              ).length} pending invitation(s). Starting the drive cancels pending invitations.
            </Text>
          ) : null}

          {!isHost && preActive ? (
            <Text style={styles.reviewNote}>
              Ready coordinates the Lobby only. It never starts location sharing.
            </Text>
          ) : null}

          {lobbyError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {lobbyError}
            </Text>
          ) : null}
        </ScrollView>

        <Footer
          backLabel="Upcoming"
          busy={lobbyWorking}
          disabled={isHost ? !canStart : !canToggleReady}
          onBack={() => {
            onPreviewRoute(null, null);
            setLobbyDriveId(null);
            setLobbyDrive(null);
            goTo("hub", -1);
          }}
          onPrimary={() => {
            if (isHost) void startLobbyDrive();
            else void toggleLobbyReady();
          }}
          primaryLabel={
            isHost
              ? hostPrimaryLabel
              : canToggleReady
                ? isReady
                  ? "Ready at A · tap to undo"
                  : "I'm at A · Ready"
                : "Waiting for host"
          }
        />
      </>
    );
  };

  const expandedSheetHeight = Math.min(610, Math.max(480, height * 0.64));
  const stateEntering =
    transitionDirection > 0
      ? FadeInRight.duration(190)
      : FadeInLeft.duration(190);
  const stateExiting =
    transitionDirection > 0
      ? FadeOutLeft.duration(145)
      : FadeOutRight.duration(145);

  return (
    <>
      <MapContextSheet
        dismissible={!saving}
        onDismiss={state === "hub" ? closeFlow : backFromPlanner}
        onHeightChange={onHeightChange}
        style={[
          styles.sheet,
          {
            bottom: bottomOffset,
            maxHeight: Math.max(420, height * 0.72),
          },
          state !== "hub" && { height: expandedSheetHeight },
        ]}
      >
        <Animated.View
          entering={stateEntering}
          exiting={stateExiting}
          key={state}
          style={[
            styles.stateContainer,
            state !== "hub" && styles.stateContainerExpanded,
          ]}
        >
          {state === "hub"
            ? renderHub()
            : state === "destination"
              ? renderDestination()
              : state === "route"
                ? renderRoute()
                : state === "people"
                  ? renderPeople()
                  : state === "departure"
                    ? renderDeparture()
                    : state === "review"
                      ? renderReview()
                      : renderLobby()}
        </Animated.View>
      </MapContextSheet>

      <Modal
        animationType="fade"
        onRequestClose={() => setPickerMode(null)}
        transparent
        visible={pickerMode !== null}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dateSheet}>
            <View style={styles.dateHeader}>
              <Pressable onPress={() => setPickerMode(null)}>
                <Text style={styles.dateAction}>Cancel</Text>
              </Pressable>
              <Text style={styles.dateTitle}>Select {pickerMode}</Text>
              <Pressable onPress={commitPicker}>
                <Text style={styles.dateDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={new Date()}
              mode={pickerMode ?? "date"}
              onChange={(_, selected) => {
                if (selected) setDraftDate(selected);
              }}
              textColor={colors.text}
              themeVariant="dark"
              value={draftDate}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  stateContainer: { minHeight: 0 },
  stateContainerExpanded: { flex: 1 },
  stepScroll: { flex: 1 },
  headerCopy: { flex: 1, minWidth: 0 },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  sheetTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: "900",
  },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  progressWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  progressCopy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressCount: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "800",
  },
  progressTrack: {
    flexDirection: "row",
    gap: 5,
    marginTop: spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  body: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  question: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
  },
  sectionLabel: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  listSurface: {
    overflow: "hidden",
    marginTop: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  driveRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  driveIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  driveCopy: { flex: 1, minWidth: 0 },
  driveTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  driveMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  emptyState: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
  },
  emptyCopy: { flex: 1, gap: 2 },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  loadingRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  originRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchBlock: { gap: spacing.xs },
  instruction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySubtle,
  },
  instructionTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  selectionRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  selectionValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  linkText: { color: colors.primaryHover, fontSize: 12, fontWeight: "800" },
  routeOption: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  routeOptionSelected: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  routeIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  routeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  routeMeta: {
    marginTop: 3,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  soloRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  soloRowSelected: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  personRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  personName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  personMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  crewIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  choiceStack: { gap: spacing.sm },
  choice: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  pickerRow: { flexDirection: "row", gap: spacing.sm },
  pickerButton: {
    flex: 1,
    minHeight: 66,
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  pickerValue: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  reviewList: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reviewRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  reviewLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  reviewValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  reviewNote: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  lobbyLoading: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  lobbyStatusRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
  },
  lobbyStatusValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionCount: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "800",
  },
  retryInline: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  singleFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  secondaryButton: {
    minWidth: 104,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 50,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  primaryButtonText: { color: colors.text, fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.76 },
  rowPressed: { backgroundColor: colors.surfacePressed },
  disabled: { opacity: 0.42 },
  error: { color: colors.primaryHover, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.scrim,
  },
  dateSheet: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.surfaceRaised,
  },
  dateHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateAction: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  dateDone: { color: colors.primaryHover, fontSize: 14, fontWeight: "800" },
  dateTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
});
