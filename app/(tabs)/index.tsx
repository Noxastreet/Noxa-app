import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NoxaButton, NoxaIconButton } from "@/src/components/ui";
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
  hasLiveDriveRuntimeAccess,
  requestLiveDrivePermissions,
  startLiveDriveSession,
  stopLiveDriveSession,
  updateLiveDriveVisibility,
  type LiveDriveVisibilityMode,
} from "@/src/lib/liveDrive";
import { getEventLifecycle, type EventCategory } from "@/src/lib/eventExperience";
import {
  isJwtValidationError,
  refreshSupabaseSessionOnce,
  supabase,
} from "@/src/lib/supabase";
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
  updated_at: string;
  profile: ProfileMarkerRow | null;
};
type PrimaryVehicleRow = {
  owner_id: string;
  brand: string | null;
  model: string | null;
};

type EventMarkerRow = {
  id: string;
  title: string;
  category: EventCategory;
  starts_at: string;
  ends_at: string | null;
  status: string;
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
    updated_at: row.updated_at,
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

function formatArrivalTime(timestampMs: number | null) {
  if (!timestampMs || !Number.isFinite(timestampMs)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestampMs));
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
          <Text style={styles.cardKicker}>{getEventLifecycle(event) === "live" ? "Live event" : "Upcoming event"}</Text>
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
          <NoxaIconButton
            accessibilityLabel="Close event preview"
            icon="close"
            iconSize={18}
            onPress={onClose}
            size={40}
            variant="ghost"
          />
        </View>
      </View>
      <View style={styles.eventActions}>
        <NoxaButton
          onPress={() =>
            router.push({
              pathname: "/event-details",
              params: { id: event.id },
            })
          }
          size="md"
          style={styles.eventDetailsButton}
          title="View details"
          variant="ghost"
        />
        <NoxaButton
          accessibilityLabel="Route to event"
          disabled={!canRoute}
          leadingIcon={<Ionicons name="navigate" size={15} color={colors.text} />}
          onPress={onRoute}
          size="md"
          style={styles.eventPrimaryButton}
          title="Route"
        />
      </View>
    </View>
  );
}

function RouteDestinationCard({
  event,
  status,
  topOffset,
}: {
  event: EventMarkerRow;
  status: RouteStatus;
  topOffset: number;
}) {
  return (
    <View
      accessibilityLabel={`Navigation to ${event.title}`}
      style={[styles.routeDestinationCard, { top: topOffset }]}
    >
      <View style={styles.routeDestinationIcon}>
        <Ionicons name="navigate" size={25} color={colors.text} />
      </View>
      <View style={styles.routeDestinationCopy}>
        <Text style={styles.routeDestinationEyebrow}>
          {status === "loading" ? "BUILDING ROUTE" : "NAVIGATING TO"}
        </Text>
        <Text numberOfLines={1} style={styles.routeDestinationTitle}>
          {event.title}
        </Text>
        <Text numberOfLines={1} style={styles.routeDestinationMeta}>
          {event.location_name ?? "Event destination"}
        </Text>
      </View>
      <View style={styles.routeBrandMark}>
        <Text style={styles.routeBrandText}>NOXA</Text>
      </View>
    </View>
  );
}

function RouteCard({
  event,
  route,
  status,
  message,
  arrivalAtMs,
  bottomOffset,
  following,
  canFollow,
  expanded,
  onClose,
  onFollowToggle,
  onOverview,
  onEventDetails,
  onSearch,
  onRetry,
  onExpandedChange,
}: {
  event: EventMarkerRow;
  route: RouteResult | null;
  status: RouteStatus;
  message: string | null;
  arrivalAtMs: number | null;
  bottomOffset: number;
  following: boolean;
  canFollow: boolean;
  expanded: boolean;
  onClose: () => void;
  onFollowToggle: () => void;
  onOverview: () => void;
  onEventDetails: () => void;
  onSearch: () => void;
  onRetry: () => void;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const loading = status === "loading";
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -24) onExpandedChange(true);
          else if (gesture.dy > 24) onExpandedChange(false);
        },
      }),
    [onExpandedChange],
  );

  return (
    <View
      accessibilityLabel={`Trip controls for ${event.title}`}
      style={[
        styles.routeCard,
        expanded && styles.routeCardExpanded,
        { bottom: bottomOffset },
      ]}
    >
      <Pressable
        accessibilityLabel={expanded ? "Collapse trip controls" : "Expand trip controls"}
        accessibilityRole="button"
        onPress={() => onExpandedChange(!expanded)}
        style={styles.routeHandleHitArea}
        {...panResponder.panHandlers}
      >
        <View style={styles.routeHandle} />
      </Pressable>

      {loading ? (
        <View style={styles.routeStatusRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <View style={styles.routeStatusCopy}>
            <Text style={styles.routeStatusTitle}>Building route</Text>
            <Text style={styles.routeStatusText}>Finding a drivable route to the event.</Text>
          </View>
        </View>
      ) : route ? (
        <>
          <View style={styles.navigationSummary}>
            <View style={styles.navigationPrimary}>
              <Text style={styles.tripValue}>~{formatDuration(route.durationSeconds)}</Text>
              <Text numberOfLines={1} style={styles.tripSecondaryLine}>
                {formatDistance(route.distanceMeters)} · arrive {formatArrivalTime(arrivalAtMs)}
              </Text>
            </View>

            <TouchableOpacity
              accessibilityLabel="Show route overview"
              accessibilityRole="button"
              activeOpacity={0.82}
              onPress={onOverview}
              style={styles.routeRoundAction}
            >
              <Ionicons name="git-branch-outline" size={22} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityLabel="Exit route"
              accessibilityRole="button"
              activeOpacity={0.82}
              onPress={onClose}
              style={styles.routeExitButton}
            >
              <Ionicons name="close" size={19} color={colors.text} />
              <Text style={styles.routeExitText}>Exit</Text>
            </TouchableOpacity>
          </View>

          {expanded ? (
            <View style={styles.routeExpandedContent}>
              <View style={styles.routeDivider} />

              {canFollow ? (
                <TouchableOpacity
                  accessibilityLabel={
                    following ? "Stop following current location" : "Follow current location"
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: following }}
                  activeOpacity={0.82}
                  onPress={onFollowToggle}
                  style={styles.routeExpandedRow}
                >
                  <View style={styles.routeExpandedIcon}>
                    <Ionicons
                      name={following ? "navigate" : "navigate-outline"}
                      size={20}
                      color={following ? colors.primaryHover : colors.text}
                    />
                  </View>
                  <View style={styles.routeExpandedCopy}>
                    <Text style={styles.routeExpandedTitle}>
                      {following ? "Following" : "Recenter & follow"}
                    </Text>
                    <Text style={styles.routeExpandedMeta}>
                      {following ? "Camera follows your course" : "Keep the route centered on you"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                accessibilityLabel="Route overview"
                accessibilityRole="button"
                activeOpacity={0.82}
                onPress={onOverview}
                style={styles.routeExpandedRow}
              >
                <View style={styles.routeExpandedIcon}>
                  <Ionicons name="map-outline" size={20} color={colors.text} />
                </View>
                <View style={styles.routeExpandedCopy}>
                  <Text style={styles.routeExpandedTitle}>Route overview</Text>
                  <Text style={styles.routeExpandedMeta}>Fit the full route on the map</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityLabel="Open event details"
                accessibilityRole="button"
                activeOpacity={0.82}
                onPress={onEventDetails}
                style={styles.routeExpandedRow}
              >
                <View style={styles.routeExpandedIcon}>
                  <Ionicons name="calendar-outline" size={20} color={colors.text} />
                </View>
                <View style={styles.routeExpandedCopy}>
                  <Text style={styles.routeExpandedTitle}>Event details</Text>
                  <Text numberOfLines={1} style={styles.routeExpandedMeta}>{event.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityLabel="Search NOXA"
                accessibilityRole="button"
                activeOpacity={0.82}
                onPress={onSearch}
                style={styles.routeExpandedRow}
              >
                <View style={styles.routeExpandedIcon}>
                  <Ionicons name="search-outline" size={20} color={colors.text} />
                </View>
                <View style={styles.routeExpandedCopy}>
                  <Text style={styles.routeExpandedTitle}>Search</Text>
                  <Text style={styles.routeExpandedMeta}>Find people, Crews and Events</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.routeStatusCopy}>
            <Text style={styles.routeStatusTitle}>Route unavailable</Text>
            <Text style={styles.routeStatusText}>
              {message ?? "The route could not be built right now."}
            </Text>
          </View>
          <View style={styles.routeErrorActions}>
            {status === "error" ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.82}
                onPress={onRetry}
                style={styles.routeRetryButton}
              >
                <Text style={styles.routeFollowText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              accessibilityLabel="Exit route"
              accessibilityRole="button"
              activeOpacity={0.82}
              onPress={onClose}
              style={styles.routeExitButton}
            >
              <Ionicons name="close" size={19} color={colors.text} />
              <Text style={styles.routeExitText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
  const [routeSheetExpanded, setRouteSheetExpanded] = useState(false);
  const [routeArrivalAtMs, setRouteArrivalAtMs] = useState<number | null>(null);
  const [isCameraAwayFromUser, setIsCameraAwayFromUser] = useState(false);
  const routeRequestKeyRef = useRef<string | null>(null);
  const routeRequestIdRef = useRef(0);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const driverLocationRef = useRef<LatLng | null>(null);
  const eventsRef = useRef<EventMarkerRow[]>([]);
  const isMountedRef = useRef(true);
  const locationRequestInFlightRef = useRef(false);
  const locationPositionRequestRef = useRef<Promise<Location.LocationObject> | null>(null);
  const liveDriveStartGenerationRef = useRef(0);
  const isAppForegroundRef = useRef(AppState.currentState === "active");
  const sharingUserIdRef = useRef<string | null>(null);
  const visibilityModeRef = useRef<LocationVisibilityMode>("ghost");
  const latestPresencePayloadRef = useRef<PresenceLocationPayload | null>(null);
  const lastPresenceWriteRef = useRef(0);
  const presenceWriteQueueRef = useRef(Promise.resolve());
  const activeDriversRequestIdRef = useRef(0);
  const activeDriversRefreshInFlightRef = useRef(false);
  const activeDriversRefreshQueuedRef = useRef(false);
  const activeDriversRef = useRef<ActiveDriver[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
  const mapFocusedRef = useRef(false);
  const [isVisibleOnMap, setIsVisibleOnMap] = useState(false);
  const [visibilityMode, setVisibilityMode] =
    useState<LocationVisibilityMode>("ghost");
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [pendingVisibilityMode, setPendingVisibilityMode] =
    useState<LiveDriveVisibilityMode | null>(null);
  const [isStartingLiveDrive, setIsStartingLiveDrive] = useState(false);
  // Privacy: an already-active Live Drive audience never changes without an
  // explicit confirmation. This holds the proposed change only — nothing is
  // mutated until the user confirms.
  const [pendingAudienceChange, setPendingAudienceChange] = useState<{
    from: LiveDriveVisibilityMode;
    to: LiveDriveVisibilityMode;
  } | null>(null);
  const [isChangingAudience, setIsChangingAudience] = useState(false);
  const audienceChangeInFlightRef = useRef(false);
  const [liveDriveExpiresAt, setLiveDriveExpiresAt] = useState<string | null>(null);
  const [liveDriveClock, setLiveDriveClock] = useState(Date.now());
  const [sharingError, setSharingError] = useState<string | null>(null);
  const [activeDrivers, setActiveDrivers] = useState<ActiveDriver[]>([]);
  const [activeDriversRequestState, setActiveDriversRequestState] =
    useState<MapDataRequestState>("loading");
  const [currentProfile, setCurrentProfile] = useState<ProfileMarkerRow | null>(null);
  const [myDriverIds, setMyDriverIds] = useState<Set<string>>(() => new Set());
  const [directInviteDriverIds, setDirectInviteDriverIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [primaryVehicleByUserId, setPrimaryVehicleByUserId] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [mapLens] = useState<MapLens>("all");
  const normalizedFocusEventId = normalizeParam(params.focusEventId);
  const normalizedMapMode = normalizeParam(params.mapMode);
  const focusEventId =
    typeof normalizedFocusEventId === "string" &&
    uuidPattern.test(normalizedFocusEventId)
      ? normalizedFocusEventId
      : null;
  const isRouteMode = normalizedMapMode === "route" && Boolean(focusEventId);
  driverLocationRef.current = driverLocation;
  activeDriversRef.current = activeDrivers;

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

  const invalidateDriverLocation = useCallback(
    (message: string) => {
      driverLocationRef.current = null;
      routeRequestIdRef.current += 1;
      routeAbortControllerRef.current?.abort();
      routeAbortControllerRef.current = null;
      routeRequestKeyRef.current = null;
      if (!isMountedRef.current) return;
      setDriverLocation(null);
      setIsRouteFollowing(false);
      setRoute(null);
      if (isRouteMode) {
        setRouteStatus("error");
        setRouteMessage(message);
      } else {
        setRouteStatus("idle");
        setRouteMessage(null);
      }
    },
    [isRouteMode],
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
          invalidateDriverLocation(
            "Location permission is off. Enable location, then retry.",
          );
          return null;
        }
        if (isMountedRef.current) setPermissionDenied(false);
        let positionRequest = locationPositionRequestRef.current;
        if (!positionRequest) {
          positionRequest = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          locationPositionRequestRef.current = positionRequest;
          void positionRequest.then(
            () => {
              if (locationPositionRequestRef.current === positionRequest)
                locationPositionRequestRef.current = null;
            },
            () => {
              if (locationPositionRequestRef.current === positionRequest)
                locationPositionRequestRef.current = null;
            },
          );
        }
        const position = await positionRequest;
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        driverLocationRef.current = point;
        if (isMountedRef.current) setDriverLocation(point);
        return point;
      } catch {
        invalidateDriverLocation(
          "Current location is unavailable. Check GPS, then retry.",
        );
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
    [invalidateDriverLocation],
  );

  const deletePresence = useCallback(async (userId?: string | null) => {
    const id = userId ?? sharingUserIdRef.current;
    if (!id) return;
    await supabase.from("driver_locations").delete().eq("user_id", id);
  }, []);

  const stopSharing = useCallback(
    async (deleteRow = true) => {
      liveDriveStartGenerationRef.current += 1;
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
        setIsStartingLiveDrive(false);
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
      const startGeneration = ++liveDriveStartGenerationRef.current;
      setSharingError(null);
      setIsStartingLiveDrive(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (
        !isMountedRef.current ||
        liveDriveStartGenerationRef.current !== startGeneration
      )
        return;
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
        const initialLocation = await requestLiveDrivePermissions();
        if (
          !isMountedRef.current ||
          liveDriveStartGenerationRef.current !== startGeneration
        )
          return;
        const liveDriveSession = await startLiveDriveSession(
          userId,
          mode,
          initialLocation,
        );
        if (
          !isMountedRef.current ||
          liveDriveStartGenerationRef.current !== startGeneration
        ) {
          const currentSession = getLiveDriveSession();
          if (currentSession?.expiresAt === liveDriveSession.expiresAt)
            await stopLiveDriveSession(true).catch(() => undefined);
          return;
        }
        visibilityModeRef.current = mode;
        sharingUserIdRef.current = userId;
        setVisibilityMode(mode);
        setLiveDriveExpiresAt(liveDriveSession.expiresAt);
        upsertPresence(userId, initialLocation.coords);
        if (isMountedRef.current) setIsVisibleOnMap(true);
      } catch (error) {
        if (liveDriveStartGenerationRef.current !== startGeneration) return;
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
        if (
          isMountedRef.current &&
          liveDriveStartGenerationRef.current === startGeneration
        ) {
          setIsStartingLiveDrive(false);
          setPendingVisibilityMode(null);
        }
      }
    },
    [deletePresence, upsertPresence],
  );

  // Applies an audience change to an already-active Live Drive. Only ever
  // called after the user has explicitly confirmed it. The existing session
  // expiry is preserved: updateLiveDriveVisibility keeps `expiresAt` as-is, so
  // sharing still ends at the original time and no new 4-hour window is opened.
  const applyAudienceChange = useCallback(
    async (mode: LiveDriveVisibilityMode) => {
      if (audienceChangeInFlightRef.current) return;
      audienceChangeInFlightRef.current = true;
      if (isMountedRef.current) setIsChangingAudience(true);
      try {
        // The session can expire while the confirmation is open. Re-check it
        // rather than trusting the state captured when the sheet was opened.
        const activeSession = getLiveDriveSession();
        const userId = sharingUserIdRef.current ?? activeSession?.userId;
        if (!activeSession || !userId) {
          await stopSharing(true);
          if (isMountedRef.current)
            setSharingError(
              "Your Live Drive session expired. Start a new 4-hour session.",
            );
          return;
        }

        const liveDriveSession = await updateLiveDriveVisibility(mode).catch(
          () => null,
        );
        if (!liveDriveSession) {
          await stopSharing(true);
          if (isMountedRef.current)
            setSharingError(
              "Your Live Drive session expired. Start a new 4-hour session.",
            );
          return;
        }
        // Only now does the active audience actually move.
        visibilityModeRef.current = mode;
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
      } finally {
        audienceChangeInFlightRef.current = false;
        if (isMountedRef.current) {
          setIsChangingAudience(false);
          setPendingAudienceChange(null);
        }
      }
    },
    [stopSharing, writePresencePayload],
  );

  const changeVisibilityMode = useCallback(
    async (mode: LocationVisibilityMode) => {
      setVisibilityMenuOpen(false);
      // Revoking sharing is always immediate and needs no extra confirmation.
      if (mode === "ghost") {
        await stopSharing(true);
        return;
      }

      const activeSession = getLiveDriveSession();
      const userId = sharingUserIdRef.current ?? activeSession?.userId;
      // No active session: the existing start-a-session consent flow applies.
      if (!userId || !activeSession) {
        setPendingVisibilityMode(mode);
        return;
      }

      // Re-selecting the current audience changes nothing.
      if (activeSession.visibilityMode === mode) return;

      // An active audience is changing. Crew and Friends are different
      // audiences, not nested ones, so every non-Ghost to non-Ghost change is
      // treated as a new disclosure and requires explicit consent. Deliberately
      // mutates nothing here — applyAudienceChange owns every write.
      setPendingAudienceChange({ from: activeSession.visibilityMode, to: mode });
    },
    [stopSharing],
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
    if (!(await hasLiveDriveRuntimeAccess())) {
      await stopSharing(true);
      if (isMountedRef.current) {
        setSharingError(
          "Live Drive stopped because location access or GPS is unavailable.",
        );
      }
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
      if (isMountedRef.current) {
        setMyDriverIds(new Set());
        setDirectInviteDriverIds(new Set());
        setPrimaryVehicleByUserId(new Map());
      }
      return;
    }

    const [outgoingResult, incomingResult, membershipResult] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", userId),
      supabase.from("follows").select("follower_id").eq("following_id", userId),
      supabase.from("crew_members").select("crew_id").eq("user_id", userId),
    ]);
    const relationshipError =
      outgoingResult.error || incomingResult.error || membershipResult.error;
    if (relationshipError) {
      console.warn("[map-relationships] trusted-driver refresh failed", {
        code: mapDataErrorCode(relationshipError),
      });
      return;
    }

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
      const crewMembersResult = await supabase
        .from("crew_members")
        .select("user_id")
        .in("crew_id", crewIds)
        .neq("user_id", userId);
      if (crewMembersResult.error) {
        console.warn("[map-relationships] crew relationship refresh failed", {
          code: mapDataErrorCode(crewMembersResult.error),
        });
        return;
      }
      crewMemberIds = ((crewMembersResult.data ?? []) as { user_id: string }[]).map(
        (row) => row.user_id,
      );
    }

    const relevantIds = [...new Set([...mutualIds, ...crewMemberIds])];
    if (isMountedRef.current) {
      setMyDriverIds(new Set(relevantIds));
      setDirectInviteDriverIds(new Set(relevantIds));
    }

    if (relevantIds.length === 0) {
      if (isMountedRef.current) setPrimaryVehicleByUserId(new Map());
      return;
    }

    const vehicleResult = await supabase
      .from("vehicles")
      .select("owner_id,brand,model")
      .in("owner_id", relevantIds)
      .eq("is_public", true)
      .eq("is_primary", true);
    if (vehicleResult.error) {
      console.warn("[map-relationships] primary vehicle refresh failed", {
        code: mapDataErrorCode(vehicleResult.error),
      });
      return;
    }

    const nextVehicles = new Map<string, string>();
    for (const row of (vehicleResult.data ?? []) as PrimaryVehicleRow[]) {
      const label = [row.brand?.trim(), row.model?.trim()].filter(Boolean).join(" ");
      if (label) nextVehicles.set(row.owner_id, label);
    }
    if (isMountedRef.current) setPrimaryVehicleByUserId(nextVehicles);
  }, []);

  const loadEvents = useCallback(async () => {
    if (isMountedRef.current) setEventsRequestState("loading");
    try {
      const now = new Date();
      const feedFloor = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const requestEvents = () =>
        supabase
          .from("events")
          .select("id,title,category,starts_at,ends_at,status,location_name,latitude,longitude")
          .eq("status", "scheduled")
          .or(`starts_at.gte.${feedFloor.toISOString()},ends_at.gt.${now.toISOString()}`)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("starts_at", { ascending: true });

      let result = await requestEvents();

      if (isJwtValidationError(result.error)) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const { error: refreshError } = await refreshSupabaseSessionOnce();
          if (!refreshError) result = await requestEvents();
        }
      }

      const { data, error } = result;

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
      )
        .filter(
          (event): event is EventMarkerRow =>
            typeof event.latitude === "number" &&
            typeof event.longitude === "number",
        )
        .filter((event) => {
          const lifecycle = getEventLifecycle(event);
          return lifecycle === "scheduled" || lifecycle === "live";
        });

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
      currentUserIdRef.current = userId ?? null;
      if (!userId) {
        if (
          isMountedRef.current &&
          activeDriversRequestIdRef.current === requestId
        ) {
          activeDriversRef.current = [];
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
      const currentByUserId = new Map(
        activeDriversRef.current.map((driver) => [driver.user_id, driver]),
      );
      const mergedDrivers = drivers.map((driver) => {
        const current = currentByUserId.get(driver.user_id);
        if (!current) return driver;
        const currentUpdatedAt = Date.parse(current.updated_at);
        const fetchedUpdatedAt = Date.parse(driver.updated_at);
        return Number.isFinite(currentUpdatedAt) &&
          (!Number.isFinite(fetchedUpdatedAt) || currentUpdatedAt > fetchedUpdatedAt)
          ? current
          : driver;
      });

      activeDriversRef.current = mergedDrivers;
      setActiveDrivers(mergedDrivers);
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
    void loadCurrentProfile();
    void loadMyDriverIds();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isActive) return;
        if (event === "SIGNED_OUT" || !session) {
          currentUserIdRef.current = null;
          activeDriversRef.current = [];
          setActiveDrivers([]);
          setCurrentProfile(null);
          setMyDriverIds(new Set());
          setDirectInviteDriverIds(new Set());
          setPrimaryVehicleByUserId(new Map());
          setTimeout(() => {
            if (isActive) void stopSharing(true);
          }, 0);
          return;
        }
        currentUserIdRef.current = session.user.id;
        setTimeout(() => {
          if (!isActive) return;
          void loadCurrentProfile();
          void loadMyDriverIds();
        }, 0);
      },
    );

    return () => {
      isActive = false;
      liveDriveStartGenerationRef.current += 1;
      isMountedRef.current = false;
      mapFocusedRef.current = false;
      activeDriversRequestIdRef.current += 1;
      activeDriversRef.current = [];
      currentUserIdRef.current = null;
      latestPresencePayloadRef.current = null;
      sharingUserIdRef.current = null;
      authListener.subscription.unsubscribe();
    };
  }, [
    loadCurrentProfile,
    loadMyDriverIds,
    restoreLiveDriveSession,
    stopSharing,
  ]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      mapFocusedRef.current = true;
      void loadMyDriverIds();
      void refreshActiveDrivers();

      const refreshInterval = setInterval(() => {
        if (isActive && isAppForegroundRef.current) void refreshActiveDrivers();
      }, DRIVER_LIST_REFRESH_MS);
      const channel = supabase.channel(createDriverLocationsMapTopic());
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        (payload) => {
          if (!isActive || !isAppForegroundRef.current) return;
          const nextRow = payload.new as Partial<ActiveDriverRow>;
          const oldRow = payload.old as Partial<ActiveDriverRow>;
          const userId =
            typeof nextRow.user_id === "string"
              ? nextRow.user_id
              : typeof oldRow.user_id === "string"
                ? oldRow.user_id
                : null;
          if (!userId) {
            void refreshActiveDrivers();
            return;
          }
          if (userId === currentUserIdRef.current) return;

          if (payload.eventType === "DELETE") {
            const nextDrivers = activeDriversRef.current.filter(
              (driver) => driver.user_id !== userId,
            );
            if (nextDrivers.length !== activeDriversRef.current.length) {
              activeDriversRef.current = nextDrivers;
              setActiveDrivers(nextDrivers);
            }
            return;
          }

          const latitude =
            typeof nextRow.latitude === "number" ? nextRow.latitude : Number.NaN;
          const longitude =
            typeof nextRow.longitude === "number" ? nextRow.longitude : Number.NaN;
          const updatedAt =
            typeof nextRow.updated_at === "string" ? nextRow.updated_at : null;
          if (!updatedAt || !hasValidLatLng(latitude, longitude)) {
            void refreshActiveDrivers();
            return;
          }

          const driverIndex = activeDriversRef.current.findIndex(
            (driver) => driver.user_id === userId,
          );
          if (driverIndex < 0) {
            // New or newly-visible drivers still go through the authorized joined
            // SELECT so profile disclosure remains governed by the existing query.
            void refreshActiveDrivers();
            return;
          }

          const current = activeDriversRef.current[driverIndex];
          const currentUpdatedAt = Date.parse(current.updated_at);
          const nextUpdatedAt = Date.parse(updatedAt);
          if (
            Number.isFinite(currentUpdatedAt) &&
            Number.isFinite(nextUpdatedAt) &&
            nextUpdatedAt <= currentUpdatedAt
          ) {
            return;
          }

          const nextDrivers = [...activeDriversRef.current];
          nextDrivers[driverIndex] = {
            ...current,
            latitude,
            longitude,
            updated_at: updatedAt,
          };
          activeDriversRef.current = nextDrivers;
          setActiveDrivers(nextDrivers);
        },
      );
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && isActive) {
          // Close the snapshot-to-subscription gap once, not on every location event.
          void refreshActiveDrivers();
        } else if (
          status === "CHANNEL_ERROR" &&
          isActive &&
          isMountedRef.current
        ) {
          setSharingError(
            (current) => current ?? "Live driver updates are reconnecting.",
          );
        }
      });

      return () => {
        isActive = false;
        mapFocusedRef.current = false;
        clearInterval(refreshInterval);
        void supabase.removeChannel(channel);
      };
    }, [loadMyDriverIds, refreshActiveDrivers]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      isAppForegroundRef.current = nextState === "active";
      if (nextState === "active") {
        void (async () => {
          await loadDriverLocation({ requestPermission: false });
          await restoreLiveDriveSession();
          if (mapFocusedRef.current) {
            await Promise.all([loadMyDriverIds(), refreshActiveDrivers()]);
          }
        })();
      }
    });
    return () => subscription.remove();
  }, [loadDriverLocation, loadMyDriverIds, refreshActiveDrivers, restoreLiveDriveSession]);

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
    setRouteSheetExpanded(false);
    setRouteArrivalAtMs(null);
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
      setRouteArrivalAtMs(
        nextRoute ? Date.now() + Math.max(0, nextRoute.durationSeconds) * 1000 : null,
      );
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
    setRouteSheetExpanded(false);
    setRouteArrivalAtMs(null);
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
      setIsCameraAwayFromUser(true);
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
      setIsCameraAwayFromUser(false);
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

  const resumeRouteFollow = useCallback(() => {
    const point = driverLocationRef.current;
    if (
      routeStatus !== "ready" ||
      !route ||
      !point ||
      !hasValidLatLng(point.latitude, point.longitude)
    ) {
      return;
    }
    setIsCameraAwayFromUser(false);
    mapRef.current?.animateToRegion(pointRegion(point), 250);
    setIsRouteFollowing(true);
  }, [route, routeStatus]);


  const showRouteOverview = useCallback(() => {
    const point = driverLocationRef.current;
    if (
      !route ||
      !point ||
      !hasValidCoordinates(selectedEvent) ||
      !hasValidLatLng(point.latitude, point.longitude)
    ) {
      return;
    }
    setIsRouteFollowing(false);
    setIsCameraAwayFromUser(true);
    fitRouteToMap(
      route.coordinates,
      {
        latitude: selectedEvent.latitude,
        longitude: selectedEvent.longitude,
      },
      point,
    );
  }, [fitRouteToMap, route, selectedEvent]);


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
        username: myDriverIds.has(driver.user_id)
          ? (driver.profile?.username ?? null)
          : null,
        vehicle_label: myDriverIds.has(driver.user_id)
          ? (primaryVehicleByUserId.get(driver.user_id) ?? null)
          : null,
        can_invite_directly: directInviteDriverIds.has(driver.user_id),
        is_relevant: myDriverIds.has(driver.user_id),
        is_dimmed: mapLens === "mine" && !myDriverIds.has(driver.user_id),
      })),
    [
      activeDrivers,
      directInviteDriverIds,
      mapLens,
      myDriverIds,
      primaryVehicleByUserId,
    ],
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
  const pendingAudienceFromLabel = VISIBILITY_MODES.find(
    (mode) => mode.id === pendingAudienceChange?.from,
  )?.label;
  const pendingAudienceToLabel = VISIBILITY_MODES.find(
    (mode) => mode.id === pendingAudienceChange?.to,
  )?.label;
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
  const routeDestinationTop = isRouteMode
    ? insets.top + spacing.sm
    : headerBottom + spacing.sm;
  const noticesTop =
    routeDestinationTop + (isRouteMode && selectedEvent ? 104 : 0);
  const mapDataNoticeTop = noticesTop + (activeNotice ? 46 : 0);
  const eventCardBottom =
    insets.bottom + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + FLOATING_GAP;
  const routeCardBottom = eventCardBottom;
  const controlBottom =
    eventCardBottom +
    (isRouteMode && selectedEvent
      ? routeSheetExpanded
        ? 344
        : 164
      : selectedEvent
        ? 196
        : spacing.sm);
  const showRecenter =
    !isRouteFollowing && (!driverLocation || isCameraAwayFromUser);

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
        onUserPan={() => setIsCameraAwayFromUser(true)}
        onDriverPress={openDriverProfile}
        onEventPress={selectMapboxEvent}
        route={route}
        selectedEventId={selectedEvent?.id ?? null}
      />

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        {!isRouteMode ? (
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

          <View style={styles.headerActions}>
            <NoxaIconButton
              accessibilityHint="Find people, Crews and Events"
              accessibilityLabel="Search NOXA"
              icon="search-outline"
              iconSize={19}
              onPress={() => router.push("/search")}
              size={44}
              variant="overlay"
            />
            <NoxaIconButton
              accessibilityHint="Open notifications and invitations"
              accessibilityLabel="Notifications"
              icon="notifications-outline"
              iconSize={19}
              onPress={() => router.push("/notifications")}
              size={44}
              variant="overlay"
            />
          </View>
        </View>
        ) : null}

        {!isRouteMode && visibilityMenuOpen ? (
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

        {selectedEvent && isRouteMode ? (
          <RouteDestinationCard
            event={selectedEvent}
            status={routeStatus}
            topOffset={routeDestinationTop}
          />
        ) : null}

        {!selectedEvent ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.groupDriveControl,
              { bottom: eventCardBottom + spacing.sm },
            ]}
          >
            <NoxaIconButton
              accessibilityHint="Open Group Drives"
              accessibilityLabel="Group Drives"
              icon="navigate-outline"
              iconSize={19}
              onPress={() => router.push("/group-drives")}
              size={44}
              variant="overlay"
            />
          </View>
        ) : null}

        {isRouteMode && selectedEvent ? (
          <View
            pointerEvents="box-none"
            style={[styles.routeControlStack, { bottom: controlBottom }]}
          >
            <NoxaIconButton
              accessibilityLabel="Recenter and follow"
              disabled={locationLoading || routeStatus !== "ready"}
              icon={isRouteFollowing ? "navigate" : "locate"}
              loading={locationLoading}
              onPress={resumeRouteFollow}
              variant="surface"
            />
            <NoxaIconButton
              accessibilityLabel="Route overview"
              icon="map-outline"
              onPress={showRouteOverview}
              variant="surface"
            />
            <NoxaIconButton
              accessibilityLabel="Search NOXA"
              icon="search-outline"
              onPress={() => router.push("/search")}
              variant="surface"
            />
          </View>
        ) : showRecenter ? (
          <View
            pointerEvents="box-none"
            style={[styles.locationControlStack, { bottom: controlBottom }]}
          >
            <NoxaIconButton
              accessibilityLabel="Recenter map"
              disabled={locationLoading}
              icon="locate"
              loading={locationLoading}
              onPress={recenterMap}
              variant="surface"
            />
          </View>
        ) : null}

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
            arrivalAtMs={routeArrivalAtMs}
            bottomOffset={routeCardBottom}
            following={isRouteFollowing}
            expanded={routeSheetExpanded}
            canFollow={routeStatus === "ready" && Boolean(driverLocation)}
            onClose={closeRouteMode}
            onFollowToggle={toggleRouteFollow}
            onOverview={showRouteOverview}
            onEventDetails={() =>
              router.push({ pathname: "/event-details", params: { id: selectedEvent.id } })
            }
            onSearch={() => router.push("/search")}
            onRetry={retryRoute}
            onExpandedChange={setRouteSheetExpanded}
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

      <Modal
        animationType="fade"
        onRequestClose={() => {
          // Android Back and dismissal are Cancel: nothing has been changed.
          if (!isChangingAudience) setPendingAudienceChange(null);
        }}
        transparent
        visible={pendingAudienceChange !== null}
      >
        <View style={styles.liveDriveModalBackdrop}>
          <View style={styles.liveDriveModalCard}>
            <View style={styles.liveDriveModalIcon}>
              <Ionicons name="eye-outline" size={22} color={colors.primaryHover} />
            </View>
            <Text style={styles.liveDriveModalEyebrow}>PRECISE LOCATION</Text>
            <Text style={styles.liveDriveModalTitle}>Change Live Drive audience?</Text>
            <Text style={styles.liveDriveModalBody}>
              Change who can see your precise location on the live map from{" "}
              {pendingAudienceFromLabel ?? "your current audience"} to{" "}
              {pendingAudienceToLabel ?? "the selected audience"}?
            </Text>
            <Text style={styles.liveDriveModalFootnote}>
              This does not extend your Live Drive. Sharing keeps the current end time
              {liveDriveRemaining ? ` (${liveDriveRemaining} left)` : ""} and stops
              earlier if you select Ghost or sign out.
            </Text>
            <View style={styles.liveDriveModalActions}>
              <TouchableOpacity
                disabled={isChangingAudience}
                onPress={() => setPendingAudienceChange(null)}
                style={styles.liveDriveCancelButton}
              >
                <Text style={styles.liveDriveCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isChangingAudience || !pendingAudienceChange}
                onPress={() => {
                  if (pendingAudienceChange)
                    void applyAudienceChange(pendingAudienceChange.to);
                }}
                style={styles.liveDriveStartButton}
              >
                {isChangingAudience ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Text style={styles.liveDriveStartText}>
                    {pendingAudienceToLabel
                      ? `CHANGE TO ${pendingAudienceToLabel.toUpperCase()}`
                      : "CHANGE AUDIENCE"}
                  </Text>
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
    right: 112,
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
  locationControlStack: {
    position: "absolute",
    right: spacing.md,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  routeControlStack: {
    position: "absolute",
    right: spacing.md,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  groupDriveControl: {
    position: "absolute",
    left: spacing.md,
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
  eventCard: {
    position: "absolute",
    left: 0,
    right: 0,
    padding: spacing.lg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
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
  eventDetailsButton: {
    flex: 1,
  },
  eventPrimaryButton: {
    flex: 1.35,
  },
  routeDestinationCard: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    minHeight: 98,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(7,13,20,0.96)",
    ...shadows.card,
  },
  routeDestinationIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  routeDestinationCopy: { flex: 1, minWidth: 0 },
  routeDestinationEyebrow: {
    color: colors.primaryHover,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  routeDestinationTitle: {
    marginTop: 2,
    color: colors.text,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  routeDestinationMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  routeBrandMark: {
    minWidth: 58,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  routeBrandText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  routeCard: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: 0,
    paddingBottom: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(10,10,14,0.98)",
    ...shadows.card,
  },
  routeCardExpanded: {
    paddingBottom: spacing.lg,
  },
  routeHandleHitArea: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  routeHandle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  routeStatusRow: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  routeStatusCopy: { flex: 1, gap: 4, paddingBottom: spacing.sm },
  routeStatusTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  routeStatusText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  navigationSummary: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  navigationPrimary: { flex: 1, minWidth: 0 },
  tripValue: {
    color: colors.success,
    fontFamily: typography.fontFamily.display,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  tripSecondaryLine: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
  routeRoundAction: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  routeExitButton: {
    minWidth: 92,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  routeExitText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  routeExpandedContent: {
    marginTop: spacing.xs,
  },
  routeDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
    backgroundColor: colors.divider,
  },
  routeExpandedRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  routeExpandedIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  routeExpandedCopy: { flex: 1, minWidth: 0 },
  routeExpandedTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  routeExpandedMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  routeErrorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  routeRetryButton: {
    minWidth: 92,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  routeFollowText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
});
