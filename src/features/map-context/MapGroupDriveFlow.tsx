import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

import { NoxaAvatar } from "@/src/components/ui";
import {
  calculateDriveRoute,
  createDriveSession,
  inviteCrewsToDrive,
  inviteUsersToDrive,
  listMyGroupDrives,
  loadDriveInviteCandidates,
  saveCalculatedDriveRoute,
  updateDriveDetails,
  type DriveInviteCrew,
  type DriveInviteFriend,
  type DriveRouteResult,
  type GroupDriveListItem,
} from "@/src/features/group-drive";
import type { LatLng } from "@/src/features/mapbox/types";
import { colors, radius, spacing, typography } from "@/src/theme";

import { MapContextSheet } from "./MapContextSheet";

type Destination = LatLng & { label: string };
type FlowState = "hub" | "destination" | "route" | "people" | "departure" | "review";
type PickerMode = "date" | "time";
type DepartureMode = "now" | "scheduled";

type Props = {
  visible: boolean;
  bottomOffset: number;
  currentLocation: LatLng | null;
  startInPlanner?: boolean;
  mapCenter: LatLng;
  initialDestination?: Destination | null;
  onClose: () => void;
  onHeightChange?: (height: number) => void;
  onMapSelectionChange: (active: boolean) => void;
  onPreviewRoute: (route: DriveRouteResult | null, destination: Destination | null) => void;
};

const STEP_INDEX: Record<Exclude<FlowState, "hub">, number> = {
  destination: 1,
  route: 2,
  people: 3,
  departure: 4,
  review: 5,
};

const STEP_LABEL: Record<Exclude<FlowState, "hub">, string> = {
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

function Progress({ state }: { state: Exclude<FlowState, "hub"> }) {
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
  onClose,
  onHeightChange,
  onMapSelectionChange,
  onPreviewRoute,
}: Props) {
  const { height } = useWindowDimensions();
  const [state, setState] = useState<FlowState>("hub");
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
  const [error, setError] = useState<string | null>(null);

  const activeDrives = useMemo(
    () =>
      drives
        .filter((drive) => !["completed", "cancelled"].includes(drive.sessionStatus))
        .slice(0, 4),
    [drives],
  );

  const selectedPeopleCount = selectedFriends.size + selectedCrews.size;

  const resetPlanner = useCallback(
    (seed: Destination | null) => {
      setDestination(seed);
      setPickingDestination(!seed);
      setRoute(null);
      setInviteFriends([]);
      setInviteCrews([]);
      setSelectedFriends(new Set());
      setSelectedCrews(new Set());
      setPeopleLoaded(false);
      setDepartureMode("now");
      setScheduledAt(nextStart());
      setCreatedDriveId(null);
      setError(null);
      onPreviewRoute(null, null);
    },
    [onPreviewRoute],
  );

  useEffect(() => {
    if (!visible) {
      onMapSelectionChange(false);
      return;
    }
    if (startInPlanner && initialDestination && state === "hub") {
      resetPlanner(initialDestination);
      setState("destination");
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
    initialDestination,
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
  }, [
    initialDestination?.label,
    initialDestination?.latitude,
    initialDestination?.longitude,
    visible,
  ]);

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

  const closeFlow = useCallback(() => {
    onMapSelectionChange(false);
    resetPlanner(null);
    setState("hub");
    onClose();
  }, [onClose, onMapSelectionChange, resetPlanner]);

  const openExistingDrive = (item: GroupDriveListItem) => {
    closeFlow();
    if (item.myInvitationStatus === "invited" && item.invitationId) {
      router.push({
        pathname: "/group-drives/invitation/[id]",
        params: { id: item.invitationId },
      });
      return;
    }
    if (item.sessionStatus === "active") {
      router.push({
        pathname: "/group-drives/[id]/active",
        params: { id: item.driveSessionId },
      });
      return;
    }
    router.push({
      pathname: "/group-drives/[id]",
      params: { id: item.driveSessionId },
    });
  };

  const startPlanner = () => {
    resetPlanner(initialDestination);
    setState("destination");
  };

  const useMapCenter = async () => {
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
      setState("route");
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
    setState("people");
  };

  const backFromPlanner = useCallback(() => {
    setError(null);
    if (state === "destination") {
      onPreviewRoute(null, null);
      setState("hub");
      return;
    }
    if (state === "route") {
      onPreviewRoute(null, null);
      setState("destination");
      return;
    }
    if (state === "people") {
      setState("route");
      return;
    }
    if (state === "departure") {
      setState("people");
      return;
    }
    if (state === "review") {
      setState("departure");
    }
  }, [onPreviewRoute, state]);

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
      closeFlow();
      router.push({ pathname: "/group-drives/[id]", params: { id: createdDriveId } });
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
      onPreviewRoute(null, null);
      onMapSelectionChange(false);
      onClose();
      router.push({ pathname: "/group-drives/[id]", params: { id } });
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
        {drivesLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primaryHover} size="small" />
            <Text style={styles.muted}>Loading upcoming drives…</Text>
          </View>
        ) : activeDrives.length ? (
          <View>
            <Text style={styles.sectionLabel}>UPCOMING</Text>
            <View style={styles.listSurface}>
              {activeDrives.map((item) => (
                <DriveRow
                  item={item}
                  key={item.driveSessionId}
                  onPress={() => openExistingDrive(item)}
                />
              ))}
            </View>
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
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>Where are you going?</Text>
        {pickingDestination ? (
          <View style={styles.instruction}>
            <Ionicons name="move-outline" size={20} color={colors.primaryHover} />
            <View style={styles.driveCopy}>
              <Text style={styles.instructionTitle}>Move the map</Text>
              <Text style={styles.muted}>
                Keep the pin over the destination, then use this point.
              </Text>
            </View>
          </View>
        ) : destination ? (
          <View style={styles.selectionRow}>
            <View style={styles.selectionIcon}>
              <Ionicons name="flag" size={18} color={colors.primaryHover} />
            </View>
            <View style={styles.driveCopy}>
              <Text style={styles.sectionLabel}>DESTINATION</Text>
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
              <Text style={styles.linkText}>Change</Text>
            </Pressable>
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <Footer
        backLabel="Cancel"
        busy={routeLoading}
        disabled={!pickingDestination && !destination}
        onBack={backFromPlanner}
        onPrimary={() => {
          if (pickingDestination) void useMapCenter();
          else void prepareRoute();
        }}
        primaryLabel={pickingDestination ? "Use this point" : "Continue"}
      />
    </>
  );

  const renderRoute = () => (
    <>
      <Progress state="route" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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
          setState("departure");
        }}
        primaryLabel="Continue"
      />
    </>
  );

  const renderDeparture = () => (
    <>
      <Progress state="departure" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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
          setState("review");
        }}
        primaryLabel="Continue"
      />
    </>
  );

  const renderReview = () => (
    <>
      <Progress state="review" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>Ready to drive?</Text>
        <View style={styles.reviewList}>
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
          Creating the Group Drive opens the Lobby. Location sharing still starts only after the explicit Active Drive flow.
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

  return (
    <>
      <MapContextSheet
        dismissible={!saving}
        onDismiss={state === "hub" ? closeFlow : backFromPlanner}
        onHeightChange={onHeightChange}
        style={[
          styles.sheet,
          { bottom: bottomOffset, maxHeight: Math.max(420, height * 0.72) },
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
                  : renderReview()}
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
