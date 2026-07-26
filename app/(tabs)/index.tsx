import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";

import { NoxaCompactLogo } from "@/src/components/brand";
import { MapboxLiveMapCompat } from "@/src/features/mapbox/MapboxLiveMapCompat";
import type {
  LiveMapHandle,
  MapRegion,
  MapboxDriver,
  MapboxEvent,
} from "@/src/features/mapbox/types";
import {
  LIVE_DRIVE_TASK_NAME,
  getLiveDriveSession,
  requestLiveDrivePermissions,
  startLiveDriveSession,
  stopLiveDriveSession,
  updateLiveDriveVisibility,
  type LiveDriveVisibilityMode,
} from "@/src/lib/liveDrive";
import type { EventCategory } from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type ProfileMarkerRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};
type ActiveDriverRow = {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  profiles: ProfileMarkerRow | ProfileMarkerRow[] | null;
};
type ActiveDriver = {
  user_id: string;
  latitude: number;
  longitude: number;
  profile: ProfileMarkerRow | null;
};

type EventMarkerRow = {
  id: string;
  title: string;
  category: EventCategory;
  starts_at: string;
  location_name: string | null;
  latitude: number;
  longitude: number;
};
type LatLng = { latitude: number; longitude: number };
type PresenceLocationPayload = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed_mps: number | null;
  accuracy_meters: number | null;
  visibility_mode: LocationVisibilityMode;
  share_expires_at: string;
};
type RouteResult = {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};
type RouteStatus = "idle" | "loading" | "ready" | "error";
type MapFilter = "all" | "drivers" | "events";
type LocationVisibilityMode = "crew" | "friends" | "global" | "ghost";

type ActionButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress?: () => void;
};

const THESSALONIKI: LatLng = { latitude: 40.6401, longitude: 22.9444 };
const DEFAULT_DELTA = { latitudeDelta: 0.075, longitudeDelta: 0.075 };
const ACTIVE_DRIVER_WINDOW_MS = 2 * 60 * 1000;
const DRIVER_LOCATION_MIN_WRITE_MS = 7000;
const DRIVER_LIST_REFRESH_MS = 30 * 1000;
const ROUTE_REQUEST_TIMEOUT_MS = 14_000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let driverLocationsMapChannelSequence = 0;

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_BOTTOM_GAP = 0;
const FLOATING_GAP = spacing.sm;
const MAP_FILTERS: { id: MapFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "drivers", label: "Drivers" },
  { id: "events", label: "Events" },
];
const VISIBILITY_MODES: {
  id: LocationVisibilityMode;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "crew",
    label: "Crew",
    description: "Visible to drivers in your crews",
    icon: "people-outline",
  },
  {
    id: "friends",
    label: "Friends",
    description: "Visible to mutual followers",
    icon: "person-add-outline",
  },
  {
    id: "global",
    label: "Global",
    description: "Visible to everyone on NOXA",
    icon: "earth-outline",
  },
  {
    id: "ghost",
    label: "Ghost",
    description: "Location sharing is off",
    icon: "eye-off-outline",
  },
];

function HeaderAction({
  icon,
  accessibilityLabel,
  onPress,
}: ActionButtonProps) {
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.78}
      onPress={onPress}
      style={styles.headerAction}
    >
      <Ionicons name={icon} size={17} color={colors.text} />
    </TouchableOpacity>
  );
}

function MapFilterBar({
  active,
  onChange,
  top,
}: {
  active: MapFilter;
  onChange: (filter: MapFilter) => void;
  top: number;
}) {
  return (
    <View style={[styles.filterBar, { top }]}>
      {MAP_FILTERS.map((filter) => {
        const selected = active === filter.id;
        return (
          <TouchableOpacity
            key={filter.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            activeOpacity={0.78}
            onPress={() => onChange(filter.id)}
            style={[styles.filterPill, selected && styles.filterPillActive]}
          >
            <Text
              style={[
                styles.filterPillText,
                selected && styles.filterPillTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function eventRegion(event: EventMarkerRow): MapRegion {
  return {
    latitude: event.latitude,
    longitude: event.longitude,
    ...DEFAULT_DELTA,
  };
}
function pointRegion(point: LatLng): MapRegion {
  return { ...point, ...DEFAULT_DELTA };
}

function formatEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time TBA";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatLiveDriveRemaining(expiresAt: string | null, nowMs: number) {
  if (!expiresAt) return null;
  const remainingMs = Math.max(0, Date.parse(expiresAt) - nowMs);
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasValidLatLng(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function normalizeActiveDriver(row: ActiveDriverRow): ActiveDriver | null {
  if (!hasValidLatLng(row.latitude, row.longitude)) return null;
  const profile = Array.isArray(row.profiles)
    ? (row.profiles[0] ?? null)
    : row.profiles;
  return {
    user_id: row.user_id,
    latitude: row.latitude,
    longitude: row.longitude,
    profile,
  };
}

function driverLabel(driver: ActiveDriver) {
  return (
    driver.profile?.display_name?.trim() ||
    driver.profile?.username?.trim() ||
    "NOXA driver"
  );
}

function hasValidCoordinates(
  event: EventMarkerRow | null,
): event is EventMarkerRow {
  return Boolean(
    event &&
    Number.isFinite(event.latitude) &&
    Number.isFinite(event.longitude) &&
    event.latitude >= -90 &&
    event.latitude <= 90 &&
    event.longitude >= -180 &&
    event.longitude <= 180,
  );
}

function createDriverLocationsMapTopic() {
  driverLocationsMapChannelSequence += 1;
  return `driver-locations-map:${Date.now()}:${driverLocationsMapChannelSequence}`;
}

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.max(0, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} hr ${String(minutes).padStart(2, "0")} min`;
}

function EventCard({
  event,
  bottomOffset,
  onClose,
  onRoute,
}: {
  event: EventMarkerRow;
  bottomOffset: number;
  onClose: () => void;
  onRoute: () => void;
}) {
  const canRoute = hasValidCoordinates(event);
  return (
    <View style={[styles.eventCard, { bottom: bottomOffset }]}>
      <View style={styles.eventCardHeader}>
        <View style={styles.eventCardCopy}>
          <Text style={styles.cardKicker}>Upcoming event</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.cardSubtitle}>
            {formatEventTime(event.starts_at)}
          </Text>
          <Text style={styles.cardLocation} numberOfLines={1}>
            {event.location_name ?? "Exact location selected"}
          </Text>
        </View>
        <View style={styles.eventCardHeaderActions}>
          <View style={styles.eventCardIcon}>
            <Ionicons name="calendar-outline" size={18} color={colors.text} />
          </View>
          <TouchableOpacity
            accessibilityLabel="Close event preview"
            activeOpacity={0.78}
            hitSlop={2}
            onPress={onClose}
            style={styles.eventCardCloseControl}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.eventActions}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() =>
            router.push({
              pathname: "/event-details",
              params: { id: event.id },
            })
          }
          style={styles.eventButton}
        >
          <Text style={styles.eventButtonText}>View Event</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Route to event"
          accessibilityState={{ disabled: !canRoute }}
          activeOpacity={0.78}
          disabled={!canRoute}
          onPress={onRoute}
          style={[styles.eventRouteButton, !canRoute && styles.eventButtonDisabled]}
        >
          <Ionicons
            name="navigate"
            size={15}
            color={canRoute ? colors.text : colors.textSubtle}
          />
          <Text
            style={[
              styles.eventRouteButtonText,
              !canRoute && styles.eventRouteButtonTextDisabled,
            ]}
          >
            Route
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RouteCard({
  event,
  route,
  status,
  message,
  bottomOffset,
  onClose,
  onRetry,
}: {
  event: EventMarkerRow;
  route: RouteResult | null;
  status: RouteStatus;
  message: string | null;
  bottomOffset: number;
  onClose: () => void;
  onRetry: () => void;
}) {
  const loading = status === "loading";
  return (
    <View style={[styles.routeCard, { bottom: bottomOffset }]}>
      <View style={styles.routeHeader}>
        <View style={styles.routeTitleWrap}>
          <Text style={styles.cardKicker}>NOXA route</Text>
          <Text style={styles.routeTitle} numberOfLines={1}>
            {event.title}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Exit route mode"
          activeOpacity={0.78}
          onPress={onClose}
          style={styles.routeCloseButton}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.routeStatusRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.routeStatusText}>Building road route…</Text>
        </View>
      ) : route ? (
        <View style={styles.routeMetrics}>
          <Text style={styles.routeMetric}>
            {formatDistance(route.distanceMeters)}
          </Text>
          <Text style={styles.routeMetricMuted}>•</Text>
          <Text style={styles.routeMetric}>
            ~{formatDuration(route.durationSeconds)}
          </Text>
        </View>
      ) : (
        <Text style={styles.routeStatusText}>
          {message ?? "Route unavailable. Keep exploring the NOXA map."}
        </Text>
      )}
      {status === "error" ? (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={onRetry}
          style={styles.routeRetryButton}
        >
          <Text style={styles.routeRetryText}>Retry route</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function LiveMapScreen() {
  const params = useLocalSearchParams<{
    focusEventId?: string | string[];
    mapMode?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<LiveMapHandle | null>(null);
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventMarkerRow[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventMarkerRow | null>(
    null,
  );
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>("idle");
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const routeRequestKeyRef = useRef<string | null>(null);
  const routeRequestIdRef = useRef(0);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const driverLocationRef = useRef<LatLng | null>(null);
  const isMountedRef = useRef(true);
  const locationRequestInFlightRef = useRef(false);
  const isAppForegroundRef = useRef(AppState.currentState === "active");
  const sharingUserIdRef = useRef<string | null>(null);
  const visibilityModeRef = useRef<LocationVisibilityMode>("ghost");
  const latestPresencePayloadRef = useRef<PresenceLocationPayload | null>(null);
  const lastPresenceWriteRef = useRef(0);
  const presenceWriteQueueRef = useRef(Promise.resolve());
  const activeDriversRequestIdRef = useRef(0);
  const activeDriversRefreshInFlightRef = useRef(false);
  const activeDriversRefreshQueuedRef = useRef(false);
  const [isVisibleOnMap, setIsVisibleOnMap] = useState(false);
  const [visibilityMode, setVisibilityMode] =
    useState<LocationVisibilityMode>("ghost");
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [pendingVisibilityMode, setPendingVisibilityMode] =
    useState<LiveDriveVisibilityMode | null>(null);
  const [isStartingLiveDrive, setIsStartingLiveDrive] = useState(false);
  const [liveDriveExpiresAt, setLiveDriveExpiresAt] = useState<string | null>(null);
  const [liveDriveClock, setLiveDriveClock] = useState(Date.now());
  const [sharingError, setSharingError] = useState<string | null>(null);
  const [activeDrivers, setActiveDrivers] = useState<ActiveDriver[]>([]);
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");
  const normalizedFocusEventId = normalizeParam(params.focusEventId);
  const normalizedMapMode = normalizeParam(params.mapMode);
  const focusEventId =
    typeof normalizedFocusEventId === "string" &&
    uuidPattern.test(normalizedFocusEventId)
      ? normalizedFocusEventId
      : null;
  const isRouteMode = normalizedMapMode === "route" && Boolean(focusEventId);
  driverLocationRef.current = driverLocation;

  const initialRegion = useMemo(() => pointRegion(THESSALONIKI), []);

  const animateTo = useCallback(
    (region: MapRegion) => mapRef.current?.animateToRegion(region, 550),
    [],
  );

  const fitRouteToMap = useCallback(
    (coordinates: LatLng[], destination: LatLng, origin: LatLng) => {
      const points = [origin, ...coordinates, destination];
      if (points.length < 2) return;
      mapRef.current?.fitToCoordinates(points, {
        animated: true,
        edgePadding: {
          top: insets.top + 96,
          right: spacing.xl,
          bottom: insets.bottom + TAB_BAR_HEIGHT + 190,
          left: spacing.xl,
        },
      });
    },
    [insets.bottom, insets.top],
  );

  const loadDriverLocation = useCallback(
    async ({
      requestPermission,
      showLoading = false,
    }: {
      requestPermission: boolean;
      showLoading?: boolean;
    }) => {
      if (isMountedRef.current) setLocationError(null);
      if (showLoading) {
        locationRequestInFlightRef.current = true;
        if (isMountedRef.current) {
          setLocationLoading(true);
        }
      }

      try {
        const permission = requestPermission
          ? await Location.requestForegroundPermissionsAsync()
          : await Location.getForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          if (isMountedRef.current) {
            setPermissionDenied(
              permission.status === Location.PermissionStatus.DENIED,
            );
          }
          return null;
        }
        if (isMountedRef.current) setPermissionDenied(false);
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        if (isMountedRef.current) setDriverLocation(point);
        return point;
      } catch {
        if (isMountedRef.current) {
          setLocationError(
            "Could not get your location. Check GPS and try again.",
          );
        }
        return null;
      } finally {
        if (showLoading) {
          locationRequestInFlightRef.current = false;
          if (isMountedRef.current) setLocationLoading(false);
        }
      }
    },
    [],
  );

  const deletePresence = useCallback(async (userId?: string | null) => {
    const id = userId ?? sharingUserIdRef.current;
    if (!id) return;
    await supabase.from("driver_locations").delete().eq("user_id", id);
  }, []);

  const stopSharing = useCallback(
    async (deleteRow = true) => {
      lastPresenceWriteRef.current = 0;
      latestPresencePayloadRef.current = null;
      const userId = sharingUserIdRef.current;
      sharingUserIdRef.current = null;
      visibilityModeRef.current = "ghost";
      if (isMountedRef.current) {
        setIsVisibleOnMap(false);
        setVisibilityMode("ghost");
        setVisibilityMenuOpen(false);
        setPendingVisibilityMode(null);
        setLiveDriveExpiresAt(null);
        setSharingError(null);
      }
      await stopLiveDriveSession(deleteRow).catch(() => undefined);
      if (deleteRow && userId) await deletePresence(userId).catch(() => undefined);
    },
    [deletePresence],
  );

  const writePresencePayload = useCallback(
    (userId: string, payload: PresenceLocationPayload, force = false) => {
      const nowMs = Date.now();
      if (
        !force &&
        nowMs - lastPresenceWriteRef.current < DRIVER_LOCATION_MIN_WRITE_MS
      )
        return presenceWriteQueueRef.current;

      lastPresenceWriteRef.current = nowMs;
      const write = presenceWriteQueueRef.current.then(async () => {
        if (!isMountedRef.current || sharingUserIdRef.current !== userId)
          return;
        const { error } = await supabase.from("driver_locations").upsert(
          {
            user_id: userId,
            ...payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) {
          lastPresenceWriteRef.current = 0;
          if (isMountedRef.current)
            setSharingError("Could not update visibility. Retrying soon.");
          return;
        }
        if (isMountedRef.current) setSharingError(null);
      });
      presenceWriteQueueRef.current = write.catch(() => undefined);
      return presenceWriteQueueRef.current;
    },
    [],
  );

  const upsertPresence = useCallback(
    (userId: string, coords: Location.LocationObjectCoords) => {
      const latitude = finiteOrNull(coords.latitude);
      const longitude = finiteOrNull(coords.longitude);
      if (
        latitude === null ||
        longitude === null ||
        !hasValidLatLng(latitude, longitude)
      )
        return;
      const heading = finiteOrNull(coords.heading);
      const speed = finiteOrNull(coords.speed);
      const accuracy = finiteOrNull(coords.accuracy);
      const payload: PresenceLocationPayload = {
        latitude,
        longitude,
        heading:
          heading !== null && heading >= 0 && heading < 360 ? heading : null,
        speed_mps: speed !== null && speed >= 0 ? speed : null,
        accuracy_meters: accuracy !== null && accuracy >= 0 ? accuracy : null,
        visibility_mode: visibilityModeRef.current,
        share_expires_at:
          getLiveDriveSession()?.expiresAt ?? new Date().toISOString(),
      };
      latestPresencePayloadRef.current = payload;
      void writePresencePayload(userId, payload);
    },
    [writePresencePayload],
  );

  const startSharing = useCallback(
    async (mode: LiveDriveVisibilityMode) => {
      setSharingError(null);
      setIsStartingLiveDrive(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        visibilityModeRef.current = "ghost";
        setSharingError("Sign in to become visible on the map.");
        setIsVisibleOnMap(false);
        setVisibilityMode("ghost");
        setIsStartingLiveDrive(false);
        return;
      }
      try {
        await requestLiveDrivePermissions();
        const liveDriveSession = await startLiveDriveSession(userId, mode);
        visibilityModeRef.current = mode;
        sharingUserIdRef.current = userId;
        setVisibilityMode(mode);
        setLiveDriveExpiresAt(liveDriveSession.expiresAt);
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        upsertPresence(userId, position.coords);
        if (isMountedRef.current) setIsVisibleOnMap(true);
      } catch (error) {
        sharingUserIdRef.current = null;
        visibilityModeRef.current = "ghost";
        latestPresencePayloadRef.current = null;
        await stopLiveDriveSession(true).catch(() => undefined);
        await deletePresence(userId).catch(() => undefined);
        if (isMountedRef.current) {
          setIsVisibleOnMap(false);
          setVisibilityMode("ghost");
          setLiveDriveExpiresAt(null);
          setSharingError(
            error instanceof Error
              ? error.message
              : "Could not start the 4-hour Live Drive session.",
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsStartingLiveDrive(false);
          setPendingVisibilityMode(null);
        }
      }
    },
    [deletePresence, upsertPresence],
  );

  const changeVisibilityMode = useCallback(
    async (mode: LocationVisibilityMode) => {
      setVisibilityMenuOpen(false);
      if (mode === "ghost") {
        await stopSharing(true);
        return;
      }

      const activeSession = getLiveDriveSession();
      const userId = sharingUserIdRef.current ?? activeSession?.userId;
      if (!userId || !activeSession) {
        setPendingVisibilityMode(mode);
        return;
      }

      visibilityModeRef.current = mode;
      const liveDriveSession = await updateLiveDriveVisibility(mode).catch(() => null);
      if (!liveDriveSession) {
        await stopSharing(true);
        setSharingError("Your Live Drive session expired. Start a new 4-hour session.");
        return;
      }
      setVisibilityMode(mode);
      setIsVisibleOnMap(true);
      setLiveDriveExpiresAt(liveDriveSession.expiresAt);
      lastPresenceWriteRef.current = 0;
      const latestPayload = latestPresencePayloadRef.current;
      if (latestPayload) {
        const nextPayload = { ...latestPayload, visibility_mode: mode };
        latestPresencePayloadRef.current = nextPayload;
        await writePresencePayload(userId, nextPayload, true);
      } else {
        await supabase
          .from("driver_locations")
          .update({ visibility_mode: mode })
          .eq("user_id", userId);
      }
    },
    [stopSharing, writePresencePayload],
  );

  const restoreLiveDriveSession = useCallback(async () => {
    const activeSession = getLiveDriveSession();
    if (!activeSession) {
      if (sharingUserIdRef.current) await stopSharing(true);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== activeSession.userId) {
      await stopSharing(true);
      return;
    }
    if (!(await Location.hasStartedLocationUpdatesAsync(LIVE_DRIVE_TASK_NAME))) {
      await stopSharing(true);
      return;
    }
    sharingUserIdRef.current = activeSession.userId;
    visibilityModeRef.current = activeSession.visibilityMode;
    if (isMountedRef.current) {
      setVisibilityMode(activeSession.visibilityMode);
      setLiveDriveExpiresAt(activeSession.expiresAt);
      setIsVisibleOnMap(true);
      setLiveDriveClock(Date.now());
    }
  }, [stopSharing]);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id,title,category,starts_at,location_name,latitude,longitude")
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("starts_at", { ascending: true });
    const rows = (
      (data ?? []) as (
        | EventMarkerRow
        | (Omit<EventMarkerRow, "latitude" | "longitude"> & {
            latitude: number | null;
            longitude: number | null;
          })
      )[]
    ).filter(
      (event): event is EventMarkerRow =>
        typeof event.latitude === "number" &&
        typeof event.longitude === "number",
    );
    setEvents(rows);
    return rows;
  }, []);

  const refreshActiveDrivers = useCallback(async () => {
    if (activeDriversRefreshInFlightRef.current) {
      activeDriversRefreshQueuedRef.current = true;
      return;
    }
    activeDriversRefreshInFlightRef.current = true;
    const requestId = activeDriversRequestIdRef.current + 1;
    activeDriversRequestIdRef.current = requestId;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        if (isMountedRef.current) setActiveDrivers([]);
        return;
      }
      const since = new Date(
        Date.now() - ACTIVE_DRIVER_WINDOW_MS,
      ).toISOString();
      const { data, error } = await supabase
        .from("driver_locations")
        .select(
          "user_id,latitude,longitude,updated_at,profiles(id,display_name,username,avatar_url)",
        )
        .gte("updated_at", since)
        .neq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (
        error ||
        !isMountedRef.current ||
        activeDriversRequestIdRef.current !== requestId
      )
        return;
      const drivers = ((data ?? []) as ActiveDriverRow[])
        .map(normalizeActiveDriver)
        .filter((driver): driver is ActiveDriver => driver !== null);
      setActiveDrivers(drivers);
    } finally {
      activeDriversRefreshInFlightRef.current = false;
      if (activeDriversRefreshQueuedRef.current) {
        activeDriversRefreshQueuedRef.current = false;
        void refreshActiveDrivers();
      }
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    isMountedRef.current = true;
    void restoreLiveDriveSession();
    void refreshActiveDrivers();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (isActive && (event === "SIGNED_OUT" || !session))
          void stopSharing(true);
      },
    );
    const refreshInterval = setInterval(() => {
      if (isActive && isAppForegroundRef.current) void refreshActiveDrivers();
    }, DRIVER_LIST_REFRESH_MS);
    const channel = supabase.channel(createDriverLocationsMapTopic());
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "driver_locations" },
      () => {
        if (isActive) void refreshActiveDrivers();
      },
    );
    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" && isActive && isMountedRef.current) {
        setSharingError(
          (current) => current ?? "Live driver updates are reconnecting.",
        );
      }
    });

    return () => {
      isActive = false;
      isMountedRef.current = false;
      activeDriversRequestIdRef.current += 1;
      latestPresencePayloadRef.current = null;
      sharingUserIdRef.current = null;
      clearInterval(refreshInterval);
      void supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, [
    refreshActiveDrivers,
    restoreLiveDriveSession,
    stopSharing,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      isAppForegroundRef.current = nextState === "active";
      if (nextState === "active") void restoreLiveDriveSession();
    });
    return () => subscription.remove();
  }, [restoreLiveDriveSession]);

  useEffect(() => {
    if (!liveDriveExpiresAt) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setLiveDriveClock(now);
      if (now >= Date.parse(liveDriveExpiresAt)) void stopSharing(true);
    }, 30_000);
    return () => clearInterval(interval);
  }, [liveDriveExpiresAt, stopSharing]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      void (async () => {
        const [point, rows] = await Promise.all([
          loadDriverLocation({ requestPermission: false }),
          loadEvents(),
        ]);
        if (!isActive) return;
        const focused = focusEventId
          ? (rows.find((event) => event.id === focusEventId) ?? null)
          : null;
        if (focused) {
          setSelectedEvent(focused);
          if (!isRouteMode) animateTo(eventRegion(focused));
          return;
        }
        if (point) animateTo(pointRegion(point));
        else if (rows[0]) animateTo(eventRegion(rows[0]));
        else animateTo(pointRegion(THESSALONIKI));
      })();
      return () => {
        isActive = false;
      };
    }, [animateTo, focusEventId, isRouteMode, loadDriverLocation, loadEvents]),
  );

  useEffect(() => {
    if (!focusEventId || events.length === 0) return;
    const focused = events.find((event) => event.id === focusEventId);
    if (focused) {
      setSelectedEvent(focused);
      if (!isRouteMode) animateTo(eventRegion(focused));
    }
  }, [animateTo, events, focusEventId, isRouteMode]);

  useEffect(() => {
    routeAbortControllerRef.current?.abort();
    routeAbortControllerRef.current = null;
    routeRequestIdRef.current += 1;
    routeRequestKeyRef.current = null;
    setRoute(null);
    setRouteMessage(null);
    setRouteStatus("idle");
    routeRequestKeyRef.current = null;
  }, [focusEventId, isRouteMode]);

  const requestRoute = useCallback(async (retry = false) => {
    if (!isRouteMode || !focusEventId || !selectedEvent) return;
    if (selectedEvent.id !== focusEventId) return;
    if (!hasValidCoordinates(selectedEvent)) {
      setRoute(null);
      setRouteStatus("error");
      setRouteMessage("This event does not have a valid route location.");
      return;
    }
    const origin = driverLocationRef.current;
    if (!origin || !hasValidLatLng(origin.latitude, origin.longitude)) {
      setRoute(null);
      setRouteStatus("error");
      setRouteMessage(
        permissionDenied
          ? "Location permission is off. Enable location, then retry."
          : "Current location is unavailable. Check GPS, then retry.",
      );
      return;
    }

    const requestKey = `${focusEventId}:` +
      `${selectedEvent.latitude.toFixed(5)},${selectedEvent.longitude.toFixed(5)}`;
    if (!retry && routeRequestKeyRef.current === requestKey) return;

    const requestId = routeRequestIdRef.current + 1;
    routeRequestIdRef.current = requestId;
    routeRequestKeyRef.current = requestKey;
    routeAbortControllerRef.current?.abort();
    const controller = new AbortController();
    routeAbortControllerRef.current = controller;
    setRoute(null);
    setRouteStatus("loading");
    setRouteMessage(null);

    let nextRoute: RouteResult | null = null;
    let nextMessage = "Route could not be built right now.";
    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, ROUTE_REQUEST_TIMEOUT_MS);

    try {
      const { data, error } = await supabase.functions.invoke<RouteResult>(
        "event-route",
        {
          body: {
            origin,
            destination: {
              latitude: selectedEvent.latitude,
              longitude: selectedEvent.longitude,
            },
          },
          signal: controller.signal,
        },
      );

      if (
        routeRequestIdRef.current !== requestId ||
        routeAbortControllerRef.current !== controller ||
        !isMountedRef.current
      ) {
        return;
      }
      if (controller.signal.aborted) {
        if (!didTimeout) return;
        console.warn("[event-route] request timed out", {
          code: "TIMEOUT",
          message: "Route request timed out.",
        });
        nextMessage = "Route request timed out. Please retry.";
      } else if (error) {
        const status =
          error.context instanceof Response ? error.context.status : undefined;
        console.warn("[event-route] request failed", {
          status,
          code: error.name,
          message: "Edge Function did not return a route.",
        });
        nextMessage =
          status === 401
            ? "Your session expired. Sign in again, then retry."
            : status === 429
              ? "Route service is busy. Wait a moment, then retry."
              : "Route is unavailable right now. Please retry.";
      } else if (
        data &&
        Array.isArray(data.coordinates) &&
        data.coordinates.length >= 2 &&
        data.coordinates.every((point) =>
          hasValidLatLng(point.latitude, point.longitude),
        ) &&
        Number.isFinite(data.distanceMeters) &&
        Number.isFinite(data.durationSeconds)
      ) {
        nextRoute = data;
      } else {
        console.warn("[event-route] invalid response", {
          code: "MALFORMED_ROUTE",
          message: "Edge Function returned an invalid route.",
        });
        nextMessage = "The route response was invalid. Please retry.";
      }
    } catch {
      if (
        routeRequestIdRef.current !== requestId ||
        routeAbortControllerRef.current !== controller ||
        !isMountedRef.current ||
        (controller.signal.aborted && !didTimeout)
      ) {
        return;
      }
      console.warn("[event-route] request exception", {
        code: didTimeout ? "TIMEOUT" : "REQUEST_EXCEPTION",
        message: didTimeout
          ? "Route request timed out."
          : "Route request could not be completed.",
      });
      nextMessage = didTimeout
        ? "Route request timed out. Please retry."
        : "Route request failed. Check your connection and retry.";
    } finally {
      clearTimeout(timeout);
      if (routeAbortControllerRef.current === controller) {
        routeAbortControllerRef.current = null;
      }
      if (
        routeRequestIdRef.current !== requestId ||
        !isMountedRef.current
      ) {
        return;
      }
      setRoute(nextRoute);
      setRouteStatus(nextRoute ? "ready" : "error");
      setRouteMessage(nextRoute ? null : nextMessage);
      if (nextRoute) {
        fitRouteToMap(nextRoute.coordinates, {
          latitude: selectedEvent.latitude,
          longitude: selectedEvent.longitude,
        }, origin);
      }
    }
  }, [
    fitRouteToMap,
    focusEventId,
    isRouteMode,
    permissionDenied,
    selectedEvent,
  ]);

  useEffect(() => {
    void requestRoute();
  }, [driverLocation, requestRoute]);

  useEffect(() => {
    return () => {
      routeRequestIdRef.current += 1;
      routeAbortControllerRef.current?.abort();
      routeAbortControllerRef.current = null;
    };
  }, []);

  const closeRouteMode = useCallback(() => {
    routeRequestIdRef.current += 1;
    routeAbortControllerRef.current?.abort();
    routeAbortControllerRef.current = null;
    routeRequestKeyRef.current = null;
    setRoute(null);
    setRouteStatus("idle");
    setRouteMessage(null);
    router.setParams({ mapMode: undefined, focusEventId: undefined });
  }, []);

  const retryRoute = useCallback(() => {
    routeRequestIdRef.current += 1;
    routeAbortControllerRef.current?.abort();
    routeAbortControllerRef.current = null;
    void requestRoute(true);
  }, [requestRoute]);

  const routeToEvent = useCallback((event: EventMarkerRow) => {
    if (!hasValidCoordinates(event)) return;
    setSelectedEvent(event);
    router.setParams({ focusEventId: event.id, mapMode: "route" });
  }, []);

  const selectEvent = useCallback(
    (event: EventMarkerRow) => {
      setSelectedEvent(event);
      animateTo(eventRegion(event));
    },
    [animateTo],
  );

  const changeMapFilter = useCallback((filter: MapFilter) => {
    setMapFilter(filter);
    if (filter === "drivers") setSelectedEvent(null);
  }, []);

  const recenterMap = useCallback(async () => {
    if (locationRequestInFlightRef.current) return;
    const point = await loadDriverLocation({
      requestPermission: true,
      showLoading: true,
    });
    if (point) {
      animateTo(pointRegion(point));
    }
  }, [animateTo, loadDriverLocation]);

  const mapboxDrivers = useMemo<MapboxDriver[]>(
    () =>
      activeDrivers.map((driver) => ({
        user_id: driver.user_id,
        latitude: driver.latitude,
        longitude: driver.longitude,
        label: driverLabel(driver),
        avatar_url: driver.profile?.avatar_url ?? null,
      })),
    [activeDrivers],
  );
  const mapboxEvents = useMemo<MapboxEvent[]>(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        category: event.category,
        latitude: event.latitude,
        longitude: event.longitude,
      })),
    [events],
  );
  const openDriverProfile = useCallback((driverId: string) => {
    router.push({
      pathname: "/driver-profile/[id]",
      params: { id: driverId },
    });
  }, []);
  const selectMapboxEvent = useCallback(
    (event: MapboxEvent) => {
      const fullEvent = events.find((candidate) => candidate.id === event.id);
      if (fullEvent) selectEvent(fullEvent);
    },
    [events, selectEvent],
  );

  const headerTop = insets.top + spacing.sm;
  const headerBottom = headerTop + 34;
  const filtersTop = headerBottom + spacing.sm;
  const filtersBottom = filtersTop + 32;
  const visibilityTop = filtersBottom + 10;
  const activeVisibilityMode =
    VISIBILITY_MODES.find((mode) => mode.id === visibilityMode) ??
    VISIBILITY_MODES[VISIBILITY_MODES.length - 1];
  const liveDriveRemaining = formatLiveDriveRemaining(
    liveDriveExpiresAt,
    liveDriveClock,
  );
  const pendingVisibility = VISIBILITY_MODES.find(
    (mode) => mode.id === pendingVisibilityMode,
  );
  const noticesTop = visibilityTop + (visibilityMenuOpen ? 238 : 42);
  const eventCardBottom =
    insets.bottom + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + FLOATING_GAP;
  const routeCardBottom = eventCardBottom;
  const controlBottom =
    eventCardBottom +
    (isRouteMode && selectedEvent ? 218 : selectedEvent ? 196 : 62);

  return (
    <View style={styles.screen}>
      <MapboxLiveMapCompat
        ref={mapRef}
        activeDrivers={mapboxDrivers}
        driverLocation={driverLocation}
        events={mapboxEvents}
        initialRegion={initialRegion}
        isRouteMode={isRouteMode}
        mapFilter={mapFilter}
        onDriverPress={openDriverProfile}
        onEventPress={selectMapboxEvent}
        route={route}
        selectedEventId={selectedEvent?.id ?? null}
      />

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <Svg
          height={noticesTop + 70}
          pointerEvents="none"
          style={styles.topScrim}
          width="100%"
        >
          <Defs>
            <LinearGradient id="mapTopFade" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={colors.background} stopOpacity="0.9" />
              <Stop
                offset="0.62"
                stopColor={colors.background}
                stopOpacity="0.54"
              />
              <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#mapTopFade)" height="100%" width="100%" />
        </Svg>

        <View style={[styles.header, { top: headerTop }]}>
          <NoxaCompactLogo />
          <View style={styles.headerActions}>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>
                {activeDrivers.length} online
              </Text>
            </View>
            <HeaderAction
              icon="search-outline"
              accessibilityLabel="Search"
              onPress={() => router.push("/search")}
            />
            <HeaderAction
              icon="notifications-outline"
              accessibilityLabel="Notifications"
              onPress={() => router.push("/notifications")}
            />
          </View>
        </View>

        <MapFilterBar
          active={mapFilter}
          onChange={changeMapFilter}
          top={filtersTop}
        />

        <TouchableOpacity
          accessibilityLabel={`Map visibility: ${activeVisibilityMode.label}`}
          accessibilityHint="Choose who can see your temporary live location"
          accessibilityRole="button"
          accessibilityState={{ expanded: visibilityMenuOpen }}
          activeOpacity={0.78}
          onPress={() => setVisibilityMenuOpen((current) => !current)}
          style={[
            styles.visibilityControl,
            isVisibleOnMap && styles.visibilityControlActive,
            { top: visibilityTop },
          ]}
        >
          <Ionicons
            name={activeVisibilityMode.icon}
            size={15}
            color={isVisibleOnMap ? colors.primaryHover : colors.textMuted}
          />
          <Text
            style={[
              styles.visibilityTitle,
              isVisibleOnMap && styles.visibilityTitleActive,
            ]}
          >
            {activeVisibilityMode.label}
            {isVisibleOnMap && liveDriveRemaining
              ? ` · ${liveDriveRemaining}`
              : ""}
          </Text>
          <Ionicons
            name={visibilityMenuOpen ? "chevron-up" : "chevron-down"}
            size={13}
            color={colors.textSubtle}
          />
        </TouchableOpacity>

        {visibilityMenuOpen ? (
          <View style={[styles.visibilityMenu, { top: visibilityTop + 38 }]}>
            <Text style={styles.visibilityMenuEyebrow}>WHO CAN SEE YOU</Text>
            {VISIBILITY_MODES.map((mode) => {
              const selected = visibilityMode === mode.id;
              return (
                <TouchableOpacity
                  accessibilityLabel={`${mode.label}. ${mode.description}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  activeOpacity={0.76}
                  key={mode.id}
                  onPress={() => void changeVisibilityMode(mode.id)}
                  style={[
                    styles.visibilityOption,
                    selected && styles.visibilityOptionSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.visibilityOptionIcon,
                      selected && styles.visibilityOptionIconSelected,
                    ]}
                  >
                    <Ionicons
                      name={mode.icon}
                      size={16}
                      color={selected ? colors.primaryHover : colors.textMuted}
                    />
                  </View>
                  <View style={styles.visibilityOptionCopy}>
                    <Text
                      style={[
                        styles.visibilityOptionLabel,
                        selected && styles.visibilityOptionLabelSelected,
                      ]}
                    >
                      {mode.label}
                    </Text>
                    <Text style={styles.visibilityOptionDescription}>
                      {mode.description}
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark" size={16} color={colors.primaryHover} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {sharingError ? (
          <View
            pointerEvents="none"
            style={[styles.sharingNotice, { top: noticesTop }]}
          >
            <Text style={styles.locationNoticeText}>{sharingError}</Text>
          </View>
        ) : null}

        {permissionDenied ? (
          <View
            pointerEvents="none"
            style={[
              styles.locationNotice,
              { top: noticesTop + (sharingError ? 46 : 0) },
            ]}
          >
            <Text style={styles.locationNoticeText}>
              Location off — centered on NOXA map.
            </Text>
          </View>
        ) : null}

        {locationError ? (
          <View
            pointerEvents="none"
            style={[
              styles.locationErrorNotice,
              {
                top:
                  noticesTop +
                  (sharingError ? 46 : 0) +
                  (permissionDenied ? 46 : 0),
              },
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={14}
              color={colors.primaryHover}
            />
            <Text style={styles.locationNoticeText}>{locationError}</Text>
          </View>
        ) : null}

        {!selectedEvent ? (
          <View
            pointerEvents="none"
            style={[styles.nearbySummary, { bottom: eventCardBottom }]}
          >
            <Text style={styles.nearbyLabel}>Nearby</Text>
            <View style={styles.nearbyMetrics}>
              <View style={styles.nearbyMetric}>
                <View style={styles.nearbyDriverDot} />
                <Text style={styles.nearbyMetricText}>
                  {activeDrivers.length} drivers
                </Text>
              </View>
              <View style={styles.nearbyDivider} />
              <View style={styles.nearbyMetric}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={colors.primaryHover}
                />
                <Text style={styles.nearbyMetricText}>
                  {events.length} events
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          accessibilityLabel="Recenter map"
          accessibilityState={{
            busy: locationLoading,
            disabled: locationLoading,
          }}
          activeOpacity={0.78}
          disabled={locationLoading}
          onPress={recenterMap}
          style={[styles.recenterButton, { bottom: controlBottom }]}
        >
          {locationLoading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Ionicons name="locate" size={22} color={colors.text} />
          )}
        </TouchableOpacity>

        {selectedEvent && isRouteMode ? (
          <RouteCard
            event={selectedEvent}
            route={route}
            status={routeStatus}
            message={routeMessage}
            bottomOffset={routeCardBottom}
            onClose={closeRouteMode}
            onRetry={retryRoute}
          />
        ) : selectedEvent ? (
          <EventCard
            event={selectedEvent}
            bottomOffset={eventCardBottom}
            onClose={() => setSelectedEvent(null)}
            onRoute={() => routeToEvent(selectedEvent)}
          />
        ) : null}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!isStartingLiveDrive) setPendingVisibilityMode(null);
        }}
        transparent
        visible={pendingVisibilityMode !== null}
      >
        <View style={styles.liveDriveModalBackdrop}>
          <View style={styles.liveDriveModalCard}>
            <View style={styles.liveDriveModalIcon}>
              <Ionicons name="navigate" size={22} color={colors.primaryHover} />
            </View>
            <Text style={styles.liveDriveModalEyebrow}>BACKGROUND LOCATION</Text>
            <Text style={styles.liveDriveModalTitle}>Start a 4-hour Live Drive?</Text>
            <Text style={styles.liveDriveModalBody}>
              NOXA collects and shares your precise location with{' '}
              {pendingVisibility?.label.toLowerCase() ?? 'your selected audience'} while
              the app is in the background, so they can see you on the live map.
            </Text>
            <Text style={styles.liveDriveModalFootnote}>
              Sharing stops after 4 hours, when you select Ghost, or when you sign out.
            </Text>
            <View style={styles.liveDriveModalActions}>
              <TouchableOpacity
                disabled={isStartingLiveDrive}
                onPress={() => setPendingVisibilityMode(null)}
                style={styles.liveDriveCancelButton}
              >
                <Text style={styles.liveDriveCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isStartingLiveDrive || !pendingVisibilityMode}
                onPress={() => {
                  if (pendingVisibilityMode) void startSharing(pendingVisibilityMode);
                }}
                style={styles.liveDriveStartButton}
              >
                {isStartingLiveDrive ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Text style={styles.liveDriveStartText}>START 4-HOUR SESSION</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden", backgroundColor: colors.background },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  onlinePill: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.78)",
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  onlineText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "500",
  },
  headerAction: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.72)",
  },
  filterBar: {
    position: "absolute",
    left: spacing.md,
    flexDirection: "row",
    gap: 6,
  },
  filterPill: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(24,24,29,0.84)",
  },
  filterPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterPillText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  filterPillTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
  driverMarker: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "rgba(17,17,22,0.96)",
    shadowColor: colors.black,
    shadowOpacity: 0.42,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  driverMarkerAccent: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.surface,
    backgroundColor: colors.success,
  },
  markerDot: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: colors.primary,
    shadowColor: colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  markerDotSelected: {
    borderColor: colors.white,
    backgroundColor: colors.primaryHover,
    transform: [{ scale: 1.1 }],
  },
  visibilityControl: {
    position: "absolute",
    right: spacing.md,
    minWidth: 104,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.82)",
  },
  visibilityControlActive: {
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(200,16,46,0.12)",
  },
  visibilityTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  visibilityTitleActive: {
    color: colors.text,
  },
  visibilityMenu: {
    position: "absolute",
    right: spacing.md,
    width: 264,
    overflow: "hidden",
    padding: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.97)",
    ...shadows.card,
  },
  visibilityMenuEyebrow: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: 6,
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  visibilityOption: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  visibilityOptionSelected: {
    backgroundColor: colors.primarySubtle,
  },
  visibilityOptionIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  visibilityOptionIconSelected: {
    backgroundColor: colors.primaryMuted,
  },
  visibilityOptionCopy: { flex: 1, minWidth: 0 },
  visibilityOptionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  visibilityOptionLabelSelected: { color: colors.text },
  visibilityOptionDescription: {
    marginTop: 1,
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: "600",
  },
  sharingNotice: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(12,12,16,0.9)",
  },
  locationNotice: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(12,12,16,0.9)",
  },
  locationErrorNotice: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: "rgba(12,12,16,0.94)",
  },
  locationNoticeText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  liveDriveModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: "rgba(4,4,7,0.78)",
  },
  liveDriveModalCard: {
    padding: spacing.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  liveDriveModalIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  liveDriveModalEyebrow: {
    marginBottom: spacing.xs,
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  liveDriveModalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  liveDriveModalBody: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  liveDriveModalFootnote: {
    marginTop: spacing.sm,
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 18,
  },
  liveDriveModalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  liveDriveCancelButton: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  liveDriveCancelText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  liveDriveStartButton: {
    flex: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  liveDriveStartText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  nearbySummary: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(17,17,22,0.9)",
    ...shadows.card,
  },
  nearbyLabel: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  nearbyMetrics: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  nearbyMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nearbyDriverDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  nearbyMetricText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },
  nearbyDivider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
    backgroundColor: colors.borderStrong,
  },
  recenterButton: {
    position: "absolute",
    right: spacing.md,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.88)",
    ...shadows.control,
  },
  eventCard: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(17,17,22,0.94)",
    ...shadows.card,
  },
  eventCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  eventCardCopy: {
    flex: 1,
  },
  eventCardIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  eventCardHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  eventCardCloseControl: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  cardKicker: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  cardTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  cardSubtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  cardLocation: {
    marginTop: 2,
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "500",
  },
  eventActions: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
  },
  eventButton: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  eventButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  eventRouteButton: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  eventRouteButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  eventButtonDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    opacity: 0.55,
  },
  eventRouteButtonTextDisabled: {
    color: colors.textSubtle,
  },
  routeCard: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(17,17,22,0.96)",
    ...shadows.card,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  routeTitleWrap: { flex: 1 },
  routeTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  routeCloseButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  routeStatusRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  routeStatusText: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "500",
  },
  routeMetrics: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  routeMetric: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "600",
  },
  routeMetricMuted: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
  },
  routeRetryButton: {
    marginTop: spacing.md,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  routeRetryText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "600",
  },
});
