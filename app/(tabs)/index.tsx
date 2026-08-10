import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
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
import {
  NoxaFloatingCard,
  type NoxaFloatingCardAction,
} from "@/src/components/ui";

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
type MapDataRequestState = "loading" | "ready" | "error";
type MapLens = "all" | "mine";
type LocationVisibilityMode = "crew" | "friends" | "global" | "ghost";

const THESSALONIKI: LatLng = { latitude: 40.6401, longitude: 22.9444 };
const DEFAULT_DELTA = { latitudeDelta: 0.075, longitudeDelta: 0.075 };
const ACTIVE_DRIVER_WINDOW_MS = 2 * 60 * 1000;
const DRIVER_LOCATION_MIN_WRITE_MS = 7000;
const DRIVER_LIST_REFRESH_MS = 30 * 1000;
const ROUTE_REQUEST_TIMEOUT_MS = 14_000;
const NEARBY_RADIUS_METERS = 25_000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let driverLocationsMapChannelSequence = 0;

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_BOTTOM_GAP = 0;
const FLOATING_GAP = spacing.sm;
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

function distanceBetweenMeters(a: LatLng, b: LatLng) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(haversine));
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

function mapDataErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "REQUEST_FAILED";
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.trim() ? code : "REQUEST_FAILED";
}

function logMapDataFailure(resource: "events" | "drivers", error: unknown) {
  console.warn("[map-data] request failed", {
    resource,
    code: mapDataErrorCode(error),
  });
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
    <View style={[styles.floatingCardSlot, { bottom: bottomOffset }]}>
      <NoxaFloatingCard
        kicker="Upcoming event"
        title={event.title}
        titleNumberOfLines={2}
        subtitle={formatEventTime(event.starts_at)}
        headerContent={
          <Text style={styles.cardLocation} numberOfLines={1}>
            {event.location_name ?? "Exact location selected"}
          </Text>
        }
        headerAccessory={
          <View style={styles.eventCardIcon}>
            <Ionicons name="calendar-outline" size={18} color={colors.text} />
          </View>
        }
        headerAlignItems="flex-start"
        headerGap={spacing.sm}
        onClose={onClose}
        closeAccessibilityLabel="Close event preview"
        closeButtonSize={40}
        style={styles.eventCardSurface}
        primaryAction={{
          label: "View Event",
          onPress: () =>
            router.push({
              pathname: "/event-details",
              params: { id: event.id },
            }),
          variant: "solid",
        }}
        secondaryAction={{
          label: "Route",
          onPress: onRoute,
          disabled: !canRoute,
          variant: "outline",
          activeOpacity: 0.78,
          accessibilityLabel: "Route to event",
          icon: (
            <Ionicons
              name="navigate"
              size={15}
              color={canRoute ? colors.text : colors.textSubtle}
            />
          ),
        }}
      />
    </View>
  );
}

function RouteCard({
  event,
  route,
  status,
  message,
  bottomOffset,
  following,
  canFollow,
  onClose,
  onFollowToggle,
  onRetry,
}: {
  event: EventMarkerRow;
  route: RouteResult | null;
  status: RouteStatus;
  message: string | null;
  bottomOffset: number;
  following: boolean;
  canFollow: boolean;
  onClose: () => void;
  onFollowToggle: () => void;
  onRetry: () => void;
}) {
  const loading = status === "loading";
  const primaryAction: NoxaFloatingCardAction | undefined =
    route && canFollow
      ? {
          label: following ? "Following" : "Follow",
          onPress: onFollowToggle,
          variant: following ? "active" : "outline",
          accessibilityLabel: following
            ? "Stop following current location"
            : "Follow route",
          accessibilityState: { selected: following },
          icon: (
            <Ionicons
              name={following ? "navigate" : "navigate-outline"}
              size={16}
              color={following ? colors.text : colors.primaryHover}
            />
          ),
          textStyle: styles.routeFollowText,
          style: styles.routeFollowActionSize,
        }
      : status === "error"
        ? {
            label: "Retry route",
            onPress: onRetry,
            variant: "outline",
            textStyle: styles.routeRetryText,
          }
        : undefined;

  return (
    <View style={[styles.floatingCardSlot, { bottom: bottomOffset }]}>
      <NoxaFloatingCard
        kicker="NOXA route"
        title={event.title}
        titleNumberOfLines={1}
        onClose={onClose}
        closeAccessibilityLabel="Exit route mode"
        closeButtonSize={38}
        closeIconColor={colors.text}
        style={styles.routeCardSurface}
        primaryAction={primaryAction}
      >
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
      </NoxaFloatingCard>
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
  const [eventsRequestState, setEventsRequestState] =
    useState<MapDataRequestState>("loading");
  const [selectedEvent, setSelectedEvent] = useState<EventMarkerRow | null>(
    null,
  );
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>("idle");
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [isRouteFollowing, setIsRouteFollowing] = useState(false);
  const routeRequestKeyRef = useRef<string | null>(null);
  const routeRequestIdRef = useRef(0);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const driverLocationRef = useRef<LatLng | null>(null);
  const eventsRef = useRef<EventMarkerRow[]>([]);
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
  const [activeDriversRequestState, setActiveDriversRequestState] =
    useState<MapDataRequestState>("loading");
  const [currentProfile, setCurrentProfile] = useState<ProfileMarkerRow | null>(null);
  const [myDriverIds, setMyDriverIds] = useState<Set<string>>(() => new Set());
  const [mapLens, setMapLens] = useState<MapLens>("all");
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

  const loadCurrentProfile = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      if (isMountedRef.current) setCurrentProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (isMountedRef.current) {
      setCurrentProfile((data as ProfileMarkerRow | null) ?? null);
    }
  }, []);

  const loadMyDriverIds = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      if (isMountedRef.current) setMyDriverIds(new Set());
      return;
    }

    const [outgoingResult, incomingResult, membershipResult] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", userId),
      supabase.from("follows").select("follower_id").eq("following_id", userId),
      supabase.from("crew_members").select("crew_id").eq("user_id", userId),
    ]);

    const outgoing = new Set(
      ((outgoingResult.data ?? []) as { following_id: string }[]).map(
        (row) => row.following_id,
      ),
    );
    const mutualIds = ((incomingResult.data ?? []) as { follower_id: string }[])
      .map((row) => row.follower_id)
      .filter((id) => outgoing.has(id));
    const crewIds = ((membershipResult.data ?? []) as { crew_id: string }[]).map(
      (row) => row.crew_id,
    );

    let crewMemberIds: string[] = [];
    if (crewIds.length > 0) {
      const { data } = await supabase
        .from("crew_members")
        .select("user_id")
        .in("crew_id", crewIds)
        .neq("user_id", userId);
      crewMemberIds = ((data ?? []) as { user_id: string }[]).map(
        (row) => row.user_id,
      );
    }

    if (isMountedRef.current) {
      setMyDriverIds(new Set([...mutualIds, ...crewMemberIds]));
    }
  }, []);

  const loadEvents = useCallback(async () => {
    if (isMountedRef.current) setEventsRequestState("loading");
    try {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,category,starts_at,location_name,latitude,longitude")
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("starts_at", { ascending: true });

      if (error) {
        logMapDataFailure("events", error);
        if (isMountedRef.current) setEventsRequestState("error");
        return eventsRef.current;
      }

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

      eventsRef.current = rows;
      if (isMountedRef.current) {
        setEvents(rows);
        setEventsRequestState("ready");
      }
      return rows;
    } catch (error) {
      logMapDataFailure("events", error);
      if (isMountedRef.current) setEventsRequestState("error");
      return eventsRef.current;
    }
  }, []);

  const refreshActiveDrivers = useCallback(async () => {
    if (activeDriversRefreshInFlightRef.current) {
      activeDriversRefreshQueuedRef.current = true;
      return;
    }
    activeDriversRefreshInFlightRef.current = true;
    const requestId = activeDriversRequestIdRef.current + 1;
    activeDriversRequestIdRef.current = requestId;
    if (isMountedRef.current) setActiveDriversRequestState("loading");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        logMapDataFailure("drivers", sessionError);
        if (
          isMountedRef.current &&
          activeDriversRequestIdRef.current === requestId
        ) {
          setActiveDriversRequestState("error");
        }
        return;
      }

      const userId = sessionData.session?.user.id;
      if (!userId) {
        if (
          isMountedRef.current &&
          activeDriversRequestIdRef.current === requestId
        ) {
          setActiveDrivers([]);
          setActiveDriversRequestState("ready");
        }
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
        !isMountedRef.current ||
        activeDriversRequestIdRef.current !== requestId
      ) {
        return;
      }

      if (error) {
        logMapDataFailure("drivers", error);
        setActiveDriversRequestState("error");
        return;
      }

      const drivers = ((data ?? []) as ActiveDriverRow[])
        .map(normalizeActiveDriver)
        .filter((driver): driver is ActiveDriver => driver !== null);

      setActiveDrivers(drivers);
      setActiveDriversRequestState("ready");
    } catch (error) {
      logMapDataFailure("drivers", error);
      if (
        isMountedRef.current &&
        activeDriversRequestIdRef.current === requestId
      ) {
        setActiveDriversRequestState("error");
      }
    } finally {
      activeDriversRefreshInFlightRef.current = false;
      if (activeDriversRefreshQueuedRef.current) {
        activeDriversRefreshQueuedRef.current = false;
        void refreshActiveDrivers();
      }
    }
  }, []);

  const retryMapData = useCallback(() => {
    void loadEvents();
    void refreshActiveDrivers();
  }, [loadEvents, refreshActiveDrivers]);

  useEffect(() => {
    let isActive = true;
    isMountedRef.current = true;
    void restoreLiveDriveSession();
    void refreshActiveDrivers();
    void loadCurrentProfile();
    void loadMyDriverIds();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isActive) return;
        if (event === "SIGNED_OUT" || !session) {
          setCurrentProfile(null);
          setMyDriverIds(new Set());
          void stopSharing(true);
          return;
        }
        void loadCurrentProfile();
        void loadMyDriverIds();
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
    loadCurrentProfile,
    loadMyDriverIds,
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
    setIsRouteFollowing(false);
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
    setIsRouteFollowing(false);
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
    setIsRouteFollowing(false);
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
    setIsRouteFollowing(false);
    routeRequestIdRef.current += 1;
    routeAbortControllerRef.current?.abort();
    routeAbortControllerRef.current = null;
    void requestRoute(true);
  }, [requestRoute]);

  const routeToEvent = useCallback((event: EventMarkerRow) => {
    setIsRouteFollowing(false);
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

  const recenterMap = useCallback(async () => {
    if (locationRequestInFlightRef.current) return;
    const point = await loadDriverLocation({
      requestPermission: true,
      showLoading: true,
    });
    if (point) {
      if (isRouteFollowing) {
        setIsRouteFollowing(false);
        requestAnimationFrame(() => animateTo(pointRegion(point)));
      } else {
        animateTo(pointRegion(point));
      }
    }
  }, [animateTo, isRouteFollowing, loadDriverLocation]);
  const toggleRouteFollow = useCallback(() => {
    const point = driverLocationRef.current;

    if (isRouteFollowing) {
      setIsRouteFollowing(false);

      if (
        route &&
        point &&
        hasValidCoordinates(selectedEvent) &&
        hasValidLatLng(point.latitude, point.longitude)
      ) {
        requestAnimationFrame(() =>
          fitRouteToMap(
            route.coordinates,
            {
              latitude: selectedEvent.latitude,
              longitude: selectedEvent.longitude,
            },
            point,
          ),
        );
      }
      return;
    }

    if (
      !isRouteMode ||
      routeStatus !== "ready" ||
      !route ||
      !point ||
      !hasValidLatLng(point.latitude, point.longitude)
    ) {
      return;
    }

    mapRef.current?.animateToRegion(pointRegion(point), 250);
    setIsRouteFollowing(true);
  }, [
    fitRouteToMap,
    isRouteFollowing,
    isRouteMode,
    route,
    routeStatus,
    selectedEvent,
  ]);

  const nearbyDrivers = useMemo(
    () =>
      driverLocation
        ? activeDrivers.filter(
            (driver) =>
              distanceBetweenMeters(driverLocation, driver) <=
              NEARBY_RADIUS_METERS,
          )
        : activeDrivers,
    [activeDrivers, driverLocation],
  );
  const mapboxDrivers = useMemo<MapboxDriver[]>(
    () =>
      activeDrivers.map((driver) => ({
        user_id: driver.user_id,
        latitude: driver.latitude,
        longitude: driver.longitude,
        label: driverLabel(driver),
        avatar_url: driver.profile?.avatar_url ?? null,
        is_relevant: myDriverIds.has(driver.user_id),
        is_dimmed: mapLens === "mine" && !myDriverIds.has(driver.user_id),
      })),
    [activeDrivers, mapLens, myDriverIds],
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
  const headerBottom = headerTop + 44;
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
  const mapDataHasError =
    eventsRequestState === "error" || activeDriversRequestState === "error";
  const mapDataNoticeMessage =
    eventsRequestState === "error" && activeDriversRequestState === "error"
      ? "Events and drivers couldn't refresh. Existing markers are preserved."
      : eventsRequestState === "error"
        ? "Events couldn't refresh. Existing event markers are preserved."
        : "Drivers couldn't refresh. Existing driver markers are preserved.";
  const activeNotice = sharingError
    ? {
        icon: "warning-outline" as const,
        message: isVisibleOnMap
          ? "Live Drive is reconnecting. Your last visibility setting is preserved."
          : "Live Drive could not start. You are still in Ghost.",
      }
    : locationError
      ? { icon: "warning-outline" as const, message: locationError }
      : permissionDenied
        ? {
            icon: "location-outline" as const,
            message: "Location is off. Use Recenter to request access.",
          }
        : null;
  const noticesTop = headerBottom + spacing.sm;
  const mapDataNoticeTop = noticesTop + (activeNotice ? 46 : 0);
  const topScrimHeight =
    mapDataNoticeTop + (mapDataHasError ? 58 : activeNotice ? 40 : 28);
  const eventCardBottom =
    insets.bottom + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + FLOATING_GAP;
  const routeCardBottom = eventCardBottom;
  const controlBottom =
    eventCardBottom +
    (isRouteMode && selectedEvent ? 276 : selectedEvent ? 196 : spacing.sm);

  return (
    <View style={styles.screen}>
      <MapboxLiveMapCompat
        ref={mapRef}
        activeDrivers={mapboxDrivers}
        driverLocation={driverLocation}
        events={mapboxEvents}
        initialRegion={initialRegion}
        isRouteMode={isRouteMode}
        followUserLocation={isRouteFollowing}
        mapFilter="all"
        onFollowUserLocationChange={setIsRouteFollowing}
        onDriverPress={openDriverProfile}
        onEventPress={selectMapboxEvent}
        route={route}
        selectedEventId={selectedEvent?.id ?? null}
      />

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <Svg
          height={topScrimHeight}
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
          <TouchableOpacity
            accessibilityLabel={`${
              currentProfile?.display_name?.trim() ||
              currentProfile?.username?.trim() ||
              "Your identity"
            }. Visibility: ${activeVisibilityMode.label}${
              liveDriveRemaining ? `, ${liveDriveRemaining} remaining` : ""
            }`}
            accessibilityHint="Manage who can see your temporary live location"
            accessibilityRole="button"
            accessibilityState={{ expanded: visibilityMenuOpen }}
            activeOpacity={0.8}
            onPress={() => setVisibilityMenuOpen((current) => !current)}
            style={[
              styles.identityControl,
              isVisibleOnMap && styles.identityControlLive,
            ]}
          >
            {currentProfile?.avatar_url ? (
              <Image
                contentFit="cover"
                source={{ uri: currentProfile.avatar_url }}
                style={styles.identityAvatar}
              />
            ) : (
              <Ionicons name="person" size={17} color={colors.text} />
            )}
            <View
              style={[
                styles.identityStatusDot,
                isVisibleOnMap && styles.identityStatusDotLive,
              ]}
            />
          </TouchableOpacity>

          <View pointerEvents="none" style={styles.livingPulse}>
            <View style={styles.livingPulseRow}>
              <View style={styles.livingPulseDot} />
              <Text style={styles.livingPulseNumber}>{nearbyDrivers.length}</Text>
            </View>
            <Text style={styles.livingPulseLabel}>
              {driverLocation ? "nearby now" : "active now"}
            </Text>
          </View>

          <TouchableOpacity
            accessibilityLabel={`Map lens: ${mapLens === "all" ? "All" : "Mine"}`}
            accessibilityHint="Switch between the full city and your social circle"
            accessibilityRole="button"
            accessibilityState={{ selected: mapLens === "mine" }}
            activeOpacity={0.8}
            onPress={() =>
              setMapLens((current) => (current === "all" ? "mine" : "all"))
            }
            style={[
              styles.lensControl,
              mapLens === "mine" && styles.lensControlActive,
            ]}
          >
            <Ionicons
              name={mapLens === "all" ? "earth-outline" : "people-outline"}
              size={15}
              color={mapLens === "mine" ? colors.text : colors.textMuted}
            />
            <Text style={styles.lensText}>
              {mapLens === "all" ? "All" : "Mine"}
            </Text>
          </TouchableOpacity>
        </View>

        {visibilityMenuOpen ? (
          <View style={[styles.visibilityMenu, { top: headerBottom + spacing.xs }]}>
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
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.primaryHover}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <View
          pointerEvents="box-none"
          style={[styles.locationControlStack, { bottom: controlBottom }]}
        >
          <TouchableOpacity
            accessibilityLabel="Recenter map"
            accessibilityState={{
              busy: locationLoading,
              disabled: locationLoading,
            }}
            activeOpacity={0.78}
            disabled={locationLoading}
            onPress={recenterMap}
            style={styles.recenterButton}
          >
            {locationLoading ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Ionicons name="locate" size={22} color={colors.text} />
            )}
          </TouchableOpacity>
        </View>

        {activeNotice ? (
          <View
            accessibilityLiveRegion="polite"
            pointerEvents="none"
            style={[styles.mapNotice, { top: noticesTop }]}
          >
            <Ionicons
              name={activeNotice.icon}
              size={15}
              color={colors.primaryHover}
            />
            <Text style={styles.mapNoticeText}>{activeNotice.message}</Text>
          </View>
        ) : null}

        {mapDataHasError ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.mapDataNotice, { top: mapDataNoticeTop }]}
          >
            <View style={styles.mapDataNoticeCopy}>
              <Ionicons
                name="cloud-offline-outline"
                size={15}
                color={colors.primaryHover}
              />
              <Text style={styles.mapDataNoticeText}>
                {mapDataNoticeMessage}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Retry map data"
              accessibilityRole="button"
              activeOpacity={0.78}
              onPress={retryMapData}
              style={styles.mapDataRetryButton}
            >
              <Text style={styles.mapDataRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedEvent && isRouteMode ? (
          <RouteCard
            event={selectedEvent}
            route={route}
            status={routeStatus}
            message={routeMessage}
            bottomOffset={routeCardBottom}
            following={isRouteFollowing}
            canFollow={routeStatus === "ready" && Boolean(driverLocation)}
            onClose={closeRouteMode}
            onFollowToggle={toggleRouteFollow}
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
              NOXA collects and shares your precise location with{" "}
              {pendingVisibility?.label.toLowerCase() ?? "your selected audience"} while
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
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  identityControl: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.88)",
    ...shadows.control,
  },
  identityControlLive: {
    borderColor: colors.borderAccent,
  },
  identityAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
  },
  identityStatusDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.textSubtle,
  },
  identityStatusDotLive: {
    backgroundColor: colors.success,
  },
  livingPulse: {
    position: "absolute",
    left: 72,
    right: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  livingPulseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  livingPulseDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  livingPulseNumber: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  livingPulseLabel: {
    marginTop: -1,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  lensControl: {
    minWidth: 64,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.82)",
  },
  lensControlActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  lensText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },
  locationControlStack: {
    position: "absolute",
    right: spacing.md,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  visibilityControl: {
    minWidth: 104,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.88)",
    ...shadows.control,
  },
  visibilityControlActive: {
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(200,16,46,0.14)",
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
    left: spacing.md,
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
  mapNotice: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    minHeight: 38,
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
  mapNoticeText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  mapDataNotice: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 7,
    paddingLeft: spacing.sm,
    paddingRight: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: "rgba(12,12,16,0.96)",
  },
  mapDataNoticeCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  mapDataNoticeText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 14,
  },
  mapDataRetryButton: {
    minWidth: 52,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  mapDataRetryText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
  },
  recenterButton: {
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
  floatingCardSlot: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
  },
  eventCardSurface: {
    padding: 14,
    backgroundColor: "rgba(17,17,22,0.94)",
  },
  eventCardIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  cardLocation: {
    marginTop: 2,
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "500",
  },
  routeCardSurface: {
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(17,17,22,0.96)",
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
  routeFollowActionSize: {
    height: 42,
  },
  routeFollowText: {
    fontWeight: "700",
  },
  routeRetryText: {
    fontSize: typography.caption,
  },
});
