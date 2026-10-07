import { Ionicons } from "@expo/vector-icons";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  ReduceMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  NoxaButton,
  NoxaConfirmationSheet,
  NoxaIconButton,
  NoxaPressableSurface,
  NoxaSurface,
} from "@/src/components/ui";
import { LiveDrivePermissionRecoverySheet } from "@/src/features/map/LiveDrivePermissionRecoverySheet";
import { MapDriverCard } from "@/src/features/map/MapDriverCard";
import {
  createDriverBroadcastTopic,
  DRIVER_BROADCAST_ANIMATION_MS,
  DRIVER_BROADCAST_ANIMATION_TICK_MS,
  DRIVER_BROADCAST_EVENT,
  DRIVER_BROADCAST_LEAVE_EVENT,
  DRIVER_BROADCAST_SEND_MS,
  interpolateDriverPoint,
  MAX_LIVE_DRIVER_CHANNELS,
  parseDriverBroadcastPayload,
} from "@/src/features/map/liveDriverBroadcast";
import {
  DriveTogetherMapLayer,
  type DriveTogetherDestinationSeed,
  type DriveTogetherNavigationOverlay,
} from "@/src/features/group-drive/DriveTogetherMapLayer";
import {
  prepareDriveRoute,
  projectDriveLocation,
  type PreparedDriveRoute,
} from "@/src/features/group-drive/runtime/routeProgress";
import {
  endNoxaNavigationLiveActivity,
  endOrphanedNoxaRouteLiveActivities,
  syncNoxaNavigationLiveActivity,
} from "@/src/features/group-drive/liveActivity";
import { MapboxLiveMapCompat } from "@/src/features/mapbox/MapboxLiveMapCompat";
import type {
  LiveMapHandle,
  MapRegion,
  MapboxDriver,
  MapboxEvent,
} from "@/src/features/mapbox/types";
import {
  getLiveDriveSession,
  hasLiveDriveRuntimeAccess,
  isLiveDriveSessionOwnedByCurrentProcess,
  startLiveDriveBackgroundUpdates,
  startLiveDriveSession,
  stopLiveDriveBackgroundUpdates,
  stopLiveDriveSession,
  updateLiveDriveVisibility,
  type LiveDriveVisibilityMode,
} from "@/src/lib/liveDrive";
import { getEventLifecycle, type EventCategory } from "@/src/lib/eventExperience";
import {
  getSafeLiveDriveStartMessage,
  shouldOfferLiveDriveSettings,
} from "@/src/lib/liveDriveError";
import { requestRequiredLiveDrivePermissions } from "@/src/lib/liveDrivePermissionFlow";
import {
  isJwtValidationError,
  refreshSupabaseSessionOnce,
  supabase,
} from "@/src/lib/supabase";
import { geometry, animations, colors, radius, shadows, spacing, typography } from "@/src/theme";

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
  broadcast_key: string;
  profiles: ProfileMarkerRow | ProfileMarkerRow[] | null;
};
type ActiveDriver = {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  broadcast_key: string;
  profile: ProfileMarkerRow | null;
};
type DriverBroadcastAnimationTarget = {
  from: LatLng;
  to: LatLng;
  startedAt: number;
  updatedAt: string;
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
type RouteManeuver = {
  instruction: string;
  type: string;
  modifier: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationSeconds: number;
};
type RouteResult = {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  maneuvers?: RouteManeuver[];
};
type RouteStatus = "idle" | "loading" | "ready" | "error";
type MapDataRequestState = "loading" | "ready" | "error";

type MapCameraOwner =
  | "free"
  | "selection"
  | "recenter"
  | "route-context"
  | "route-follow"
  | "drive-context"
  | "drive-follow";
type MapLens = "all" | "mine";
type LocationVisibilityMode = "crew" | "friends" | "global" | "ghost";

const THESSALONIKI: LatLng = { latitude: 40.6401, longitude: 22.9444 };
const DEFAULT_DELTA = { latitudeDelta: 0.075, longitudeDelta: 0.075 };
const ACTIVE_DRIVER_WINDOW_MS = 2 * 60 * 1000;
const DRIVER_LOCATION_MIN_WRITE_MS = 10_000;
const DRIVER_LIST_REFRESH_MS = 15 * 1000;
const ROUTE_REQUEST_TIMEOUT_MS = 14_000;
const MAPBOX_LOCATION_STATE_MIN_MS = 750;
const ROUTE_ARRIVAL_METERS = 45;
const NEARBY_RADIUS_METERS = 25_000;
const MAX_MAP_DRIVERS = 200;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    label: "Public",
    description: "Visible to everyone while Live Drive is active",
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
  if (!uuidPattern.test(row.broadcast_key)) return null;
  return {
    user_id: row.user_id,
    latitude: row.latitude,
    longitude: row.longitude,
    updated_at: row.updated_at,
    broadcast_key: row.broadcast_key,
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

function nearbyBounds(point: LatLng, radiusMeters: number) {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeMetersPerDegree =
    111_320 * Math.max(Math.cos((point.latitude * Math.PI) / 180), 0.2);
  const longitudeDelta = radiusMeters / longitudeMetersPerDegree;

  return {
    minLatitude: Math.max(-90, point.latitude - latitudeDelta),
    maxLatitude: Math.min(90, point.latitude + latitudeDelta),
    minLongitude: Math.max(-180, point.longitude - longitudeDelta),
    maxLongitude: Math.min(180, point.longitude + longitudeDelta),
  };
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

function formatArrivalTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  const arrival = new Date(Date.now() + Math.max(0, seconds) * 1000);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(arrival);
}

function prepareEventRoute(route: RouteResult | null): PreparedDriveRoute | null {
  if (!route) return null;
  return prepareDriveRoute(
    {
      type: "LineString",
      coordinates: route.coordinates.map(
        (point) => [point.longitude, point.latitude] as [number, number],
      ),
    },
    route.distanceMeters,
  );
}

function nextEventManeuver(
  route: RouteResult | null,
  prepared: PreparedDriveRoute | null,
  progressFraction: number | null,
) {
  if (!route || !prepared || progressFraction === null) return null;
  let candidate:
    | { maneuver: RouteManeuver; progress: number; distanceMeters: number }
    | null = null;
  for (const maneuver of route.maneuvers ?? []) {
    const projection = projectDriveLocation(
      prepared,
      maneuver.latitude,
      maneuver.longitude,
    );
    if (!projection || projection.progressFraction + 0.002 < progressFraction) continue;
    const distanceMeters = Math.max(
      0,
      route.distanceMeters * (projection.progressFraction - progressFraction),
    );
    if (!candidate || projection.progressFraction < candidate.progress) {
      candidate = {
        maneuver,
        progress: projection.progressFraction,
        distanceMeters,
      };
    }
  }
  return candidate;
}

const MAP_CONTEXT_ENTER = FadeInDown
  .duration(animations.step)
  .reduceMotion(ReduceMotion.System);
const MAP_CONTEXT_EXIT = FadeOutDown
  .duration(animations.fast)
  .reduceMotion(ReduceMotion.System);
const ROUTE_STATE_ENTER = FadeIn
  .duration(animations.micro)
  .reduceMotion(ReduceMotion.System);
const VISIBILITY_MENU_ENTER = FadeIn
  .duration(animations.rootTab)
  .withInitialValues({
    opacity: 0,
    transform: [{ translateY: -6 }, { scale: 0.985 }],
  })
  .reduceMotion(ReduceMotion.System);
const VISIBILITY_MENU_EXIT = FadeOut
  .duration(animations.fast)
  .reduceMotion(ReduceMotion.System);

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
    <Animated.View
      entering={MAP_CONTEXT_ENTER}
      exiting={MAP_CONTEXT_EXIT}
      style={[styles.contextualSheetPosition, { bottom: bottomOffset }]}>
      <NoxaSurface
        corners="top"
        level="sheet"
        style={styles.eventCard}>
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
      </NoxaSurface>
    </Animated.View>
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
  onAddDriver,
  remainingDistanceMeters,
  remainingDurationSeconds,
}: {
  event: EventMarkerRow;
  route: RouteResult | null;
  status: RouteStatus;
  message: string | null;
  bottomOffset: number;
  following: boolean;
  canFollow: boolean;
  remainingDistanceMeters: number | null;
  remainingDurationSeconds: number | null;
  onClose: () => void;
  onFollowToggle: () => void;
  onRetry: () => void;
  onAddDriver: () => void;
}) {
  const loading = status === "loading";
  return (
    <Animated.View
      entering={MAP_CONTEXT_ENTER}
      exiting={MAP_CONTEXT_EXIT}
      style={[styles.contextualSheetPosition, { bottom: bottomOffset }]}>
      <NoxaSurface
        corners="top"
        level="sheet"
        style={styles.routeCard}>
      <View style={styles.routeHeader}>
        <View style={styles.routeTitleWrap}>
          <Text style={styles.cardKicker}>NOXA route</Text>
          <Text style={styles.routeTitle} numberOfLines={1}>
            {event.title}
          </Text>
        </View>
        <NoxaIconButton
          accessibilityLabel="Exit route mode"
          icon="close"
          iconSize={18}
          onPress={onClose}
          size={40}
          variant="ghost"
        />
      </View>
      <View style={styles.routeStateSlot}>
        {loading ? (
          <Animated.View
            entering={ROUTE_STATE_ENTER}
            key="route-loading"
            style={styles.routeStatusRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.routeStatusTextInline}>Building road route…</Text>
          </Animated.View>
        ) : route ? (
          <Animated.View
            entering={ROUTE_STATE_ENTER}
            key="route-ready"
            style={styles.routeMetrics}>
            <Text style={styles.routeMetric}>
              {formatDistance(remainingDistanceMeters ?? route.distanceMeters)}
            </Text>
            <Text style={styles.routeMetricMuted}>•</Text>
            <Text style={styles.routeMetric}>
              ~{formatDuration(remainingDurationSeconds ?? route.durationSeconds)}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View entering={ROUTE_STATE_ENTER} key="route-error">
            <Text style={styles.routeStatusText}>
              {message ?? "Route unavailable. Keep exploring the NOXA map."}
            </Text>
          </Animated.View>
        )}
      </View>
      {route && canFollow ? (
        <NoxaButton
          accessibilityLabel={
            following ? "Stop following current location" : "Follow route"
          }
          leadingIcon={
            <Ionicons
              name={following ? "navigate" : "navigate-outline"}
              size={16}
              color={colors.text}
            />
          }
          onPress={onFollowToggle}
          size="md"
          style={styles.routeFollowButton}
          title={following ? "Following" : "Follow"}
          variant={following ? "primary" : "secondary"}
        />
      ) : null}
      {route ? (
        <NoxaButton
          accessibilityLabel="Add a driver to this event route"
          leadingIcon={<Ionicons name="people-outline" size={16} color={colors.text} />}
          onPress={onAddDriver}
          size="md"
          style={styles.routeFollowButton}
          title="Add driver"
          variant="secondary"
        />
      ) : null}
      {status === "error" ? (
        <NoxaButton
          onPress={onRetry}
          size="sm"
          style={styles.routeRetryButton}
          title="Retry route"
          variant="secondary"
        />
      ) : null}
      </NoxaSurface>
    </Animated.View>
  );
}

function routeManeuverIcon(modifier: string | null | undefined): keyof typeof Ionicons.glyphMap {
  switch (modifier) {
    case "left":
    case "slight left":
      return "return-up-back";
    case "right":
    case "slight right":
      return "return-up-forward";
    case "uturn":
      return "return-down-back";
    case "straight":
      return "arrow-up";
    default:
      return "navigate";
  }
}

function RouteFocusOverlay({
  event,
  remainingDistanceMeters,
  remainingDurationSeconds,
  nextManeuver,
  following,
  arrived,
  topInset,
  bottomInset,
  onRecenter,
  onExit,
}: {
  event: EventMarkerRow;
  remainingDistanceMeters: number | null;
  remainingDurationSeconds: number | null;
  nextManeuver:
    | { maneuver: RouteManeuver; progress: number; distanceMeters: number }
    | null;
  following: boolean;
  arrived: boolean;
  topInset: number;
  bottomInset: number;
  onRecenter: () => void;
  onExit: () => void;
}) {
  const instruction = arrived
    ? "You have arrived"
    : nextManeuver?.maneuver.instruction || `Continue to ${event.title}`;
  const instructionDistance = arrived
    ? "ARRIVED"
    : nextManeuver
      ? formatDistance(nextManeuver.distanceMeters)
      : null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      <View style={[styles.routeFocusTop, { top: topInset + spacing.sm }]}>
        <NoxaSurface level="overlay" style={styles.routeFocusInstruction}>
          <View style={styles.routeFocusTurnIcon}>
            <Ionicons
              name={
                arrived
                  ? "checkmark"
                  : routeManeuverIcon(nextManeuver?.maneuver.modifier)
              }
              size={24}
              color={arrived ? colors.success : colors.text}
            />
          </View>
          <View style={styles.routeFocusInstructionCopy}>
            {instructionDistance ? (
              <Text style={styles.routeFocusDistance}>{instructionDistance}</Text>
            ) : null}
            <Text numberOfLines={2} style={styles.routeFocusInstructionText}>
              {instruction}
            </Text>
          </View>
        </NoxaSurface>

        <NoxaIconButton
          accessibilityLabel="End route navigation"
          icon="close"
          iconSize={20}
          onPress={onExit}
          size={44}
          variant="overlay"
        />
      </View>

      <View style={[styles.routeFocusBottom, { bottom: bottomInset + spacing.md }]}>
        <NoxaSurface level="overlay" style={styles.routeFocusMetrics}>
          <Text numberOfLines={1} style={styles.routeFocusDestination}>
            {event.title}
          </Text>
          <View style={styles.routeFocusMetricRow}>
            <Text style={styles.routeFocusMetricStrong}>
              {formatDistance(remainingDistanceMeters ?? 0)}
            </Text>
            <View style={styles.routeFocusDot} />
            <Text style={styles.routeFocusMetricStrong}>
              {formatDuration(remainingDurationSeconds ?? 0)}
            </Text>
            <Text style={styles.routeFocusArrival}>
              {remainingDurationSeconds === null
                ? ""
                : `ETA ${formatArrivalTime(remainingDurationSeconds)}`}
            </Text>
          </View>
        </NoxaSurface>

        {!following ? (
          <NoxaIconButton
            accessibilityLabel="Resume route following"
            icon="locate"
            iconSize={20}
            onPress={onRecenter}
            size={50}
            variant="overlay"
          />
        ) : null}
      </View>
    </View>
  );
}

function DriveTogetherNavigationChrome({
  navigation,
  following,
  panelVisible,
  topInset,
  bottomInset,
  onRecenter,
  onOpenPanel,
}: {
  navigation: DriveTogetherNavigationOverlay;
  following: boolean;
  panelVisible: boolean;
  topInset: number;
  bottomInset: number;
  onRecenter: () => void;
  onOpenPanel: () => void;
}) {
  const instruction =
    navigation.nextInstruction || `Continue to ${navigation.destinationTitle}`;
  const instructionDistance =
    navigation.distanceToNextManeuverMeters === null
      ? null
      : formatDistance(navigation.distanceToNextManeuverMeters);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      <View style={[styles.driveNavigationTop, { top: topInset + spacing.sm }]}>
        <NoxaSurface level="overlay" style={styles.driveNavigationInstruction}>
          <View style={styles.routeFocusTurnIcon}>
            <Ionicons name="navigate" size={24} color={colors.text} />
          </View>
          <View style={styles.routeFocusInstructionCopy}>
            {instructionDistance ? (
              <Text style={styles.routeFocusDistance}>{instructionDistance}</Text>
            ) : null}
            <Text numberOfLines={2} style={styles.routeFocusInstructionText}>
              {instruction}
            </Text>
          </View>
        </NoxaSurface>

        {panelVisible && !following ? (
          <NoxaIconButton
            accessibilityLabel="Recenter Drive Together navigation"
            icon="locate"
            iconSize={20}
            onPress={onRecenter}
            size={44}
            variant="overlay"
          />
        ) : (
          <NoxaIconButton
            accessibilityLabel="Open Drive Together"
            icon="people-outline"
            iconSize={20}
            onPress={onOpenPanel}
            size={44}
            variant="overlay"
          />
        )}
      </View>

      {!panelVisible ? (
        <View style={[styles.driveNavigationBottom, { bottom: bottomInset + spacing.md }]}>
          <TouchableOpacity
            accessibilityLabel="Open Drive Together details"
            accessibilityRole="button"
            activeOpacity={0.82}
            onPress={onOpenPanel}
            style={styles.driveNavigationSummaryPressable}
          >
            <NoxaSurface level="overlay" style={styles.driveNavigationSummary}>
              <Text numberOfLines={1} style={styles.routeFocusDestination}>
                {navigation.destinationTitle}
              </Text>
              <View style={styles.routeFocusMetricRow}>
                <Text style={styles.routeFocusMetricStrong}>
                  {formatDistance(navigation.remainingDistanceMeters ?? 0)}
                </Text>
                <View style={styles.routeFocusDot} />
                <Text style={styles.routeFocusMetricStrong}>
                  {formatDuration(navigation.remainingDurationSeconds ?? 0)}
                </Text>
                <Text style={styles.driveNavigationDrivers}>
                  {navigation.participantCount} drivers
                </Text>
              </View>
            </NoxaSurface>
          </TouchableOpacity>

          {!following ? (
            <NoxaIconButton
              accessibilityLabel="Recenter Drive Together navigation"
              icon="locate"
              iconSize={20}
              onPress={onRecenter}
              size={50}
              variant="overlay"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function LiveMapScreen() {
  const params = useLocalSearchParams<{
    focusEventId?: string | string[];
    mapMode?: string | string[];
    driveInvitationId?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const mapRef = useRef<LiveMapHandle | null>(null);
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);
  const [driveTogetherOpen, setDriveTogetherOpen] = useState(false);
  const [driveTogetherPanelVisible, setDriveTogetherPanelVisible] = useState(false);
  const [driveTogetherDrivers, setDriveTogetherDrivers] = useState<MapboxDriver[]>([]);
  const [driveTogetherQuickStartFriendId, setDriveTogetherQuickStartFriendId] =
    useState<string | null>(null);
  const [driveTogetherInitialDestination, setDriveTogetherInitialDestination] =
    useState<DriveTogetherDestinationSeed | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [isRouteFocusMode, setIsRouteFocusMode] = useState(false);
  const [driveTogetherNavigation, setDriveTogetherNavigation] =
    useState<DriveTogetherNavigationOverlay | null>(null);

  useEffect(() => {
    const hideRootTabs =
      driveTogetherPanelVisible || Boolean(driveTogetherNavigation) || isRouteFocusMode;
    navigation.setOptions({
      tabBarStyle: hideRootTabs ? { display: "none" } : undefined,
    });

    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
    };
  }, [
    driveTogetherNavigation,
    driveTogetherPanelVisible,
    isRouteFocusMode,
    navigation,
  ]);
  const [isDriveTogetherFollowing, setIsDriveTogetherFollowing] = useState(false);
  const [isDriveTogetherDestinationPicking, setIsDriveTogetherDestinationPicking] =
    useState(false);
  const driveTogetherFollowSessionRef = useRef<string | null>(null);
  const driveTogetherMapPickHandlerRef = useRef<((point: LatLng) => void) | null>(null);
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
  const [isCameraAwayFromUser, setIsCameraAwayFromUser] = useState(false);
  const routeRequestKeyRef = useRef<string | null>(null);
  const routeRequestIdRef = useRef(0);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const eventRouteLiveActivityIdRef = useRef<string | null>(null);
  const quickDriveLiveActivityIdRef = useRef<string | null>(null);
  const driverLocationRef = useRef<LatLng | null>(null);
  const lastMapboxLocationCommitRef = useRef(0);
  const eventsRef = useRef<EventMarkerRow[]>([]);
  const isMountedRef = useRef(true);
  const locationRequestInFlightRef = useRef(false);
  const locationPositionRequestRef = useRef<Promise<Location.LocationObject> | null>(null);
  const liveDriveStartGenerationRef = useRef(0);
  const isAppForegroundRef = useRef(AppState.currentState === "active");
  const [isAppForeground, setIsAppForeground] = useState(
    AppState.currentState === "active",
  );
  const sharingUserIdRef = useRef<string | null>(null);
  const visibilityModeRef = useRef<LocationVisibilityMode>("ghost");
  const latestPresencePayloadRef = useRef<PresenceLocationPayload | null>(null);
  const lastPresenceWriteRef = useRef(0);
  const presenceWriteQueueRef = useRef(Promise.resolve());
  const activeDriversRequestIdRef = useRef(0);
  const activeDriversRefreshInFlightRef = useRef(false);
  const activeDriversRefreshQueuedRef = useRef(false);
  const activeDriversRef = useRef<ActiveDriver[]>([]);
  const mapFocusedRef = useRef(false);
  const [isMapFocused, setIsMapFocused] = useState(false);
  const [ownDriverBroadcastKey, setOwnDriverBroadcastKey] =
    useState<string | null>(null);
  const ownDriverBroadcastChannelRef = useRef<RealtimeChannel | null>(null);
  const lastDriverBroadcastSentRef = useRef(0);
  const driverBroadcastTargetsRef = useRef<
    Map<string, DriverBroadcastAnimationTarget>
  >(new Map());
  const [isVisibleOnMap, setIsVisibleOnMap] = useState(false);
  const [visibilityMode, setVisibilityMode] =
    useState<LocationVisibilityMode>("ghost");
  const [showGhostToast, setShowGhostToast] = useState(false);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [pendingVisibilityMode, setPendingVisibilityMode] =
    useState<LiveDriveVisibilityMode | null>(null);
  const [
    pendingLiveDrivePermissionRecovery,
    setPendingLiveDrivePermissionRecovery,
  ] = useState<{ mode: LiveDriveVisibilityMode; message: string } | null>(null);
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
  const [primaryVehicleByUserId, setPrimaryVehicleByUserId] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [mapLens] = useState<MapLens>("all");
  const normalizedFocusEventId = normalizeParam(params.focusEventId);
  const normalizedMapMode = normalizeParam(params.mapMode);
  const normalizedDriveInvitationId = normalizeParam(params.driveInvitationId);
  const focusEventId =
    typeof normalizedFocusEventId === "string" &&
    uuidPattern.test(normalizedFocusEventId)
      ? normalizedFocusEventId
      : null;
  const isRouteMode = normalizedMapMode === "route" && Boolean(focusEventId);
  const mapObjectSelectionLocked =
    isRouteMode
    || isRouteFocusMode
    || driveTogetherPanelVisible
    || Boolean(driveTogetherNavigation);
  driverLocationRef.current = driverLocation;
  activeDriversRef.current = activeDrivers;

  const preparedEventRoute = useMemo(
    () => prepareEventRoute(route),
    [route],
  );
  const eventRouteProjection = useMemo(
    () =>
      preparedEventRoute && driverLocation
        ? projectDriveLocation(
            preparedEventRoute,
            driverLocation.latitude,
            driverLocation.longitude,
          )
        : null,
    [driverLocation, preparedEventRoute],
  );
  const routeRemainingDistanceMeters =
    eventRouteProjection?.remainingMeters ?? route?.distanceMeters ?? null;
  const routeRemainingDurationSeconds =
    route && eventRouteProjection
      ? Math.max(
          0,
          route.durationSeconds * (1 - eventRouteProjection.progressFraction),
        )
      : route?.durationSeconds ?? null;

  useEffect(() => {
    const currentActivityId = eventRouteLiveActivityIdRef.current;

    if (!isRouteMode) {
      eventRouteLiveActivityIdRef.current = null;
      void endOrphanedNoxaRouteLiveActivities();
      return;
    }

    if (routeStatus === "error") {
      if (currentActivityId) {
        eventRouteLiveActivityIdRef.current = null;
        void endNoxaNavigationLiveActivity("event-route", currentActivityId);
      }
      return;
    }

    if (routeStatus !== "ready" || !route || !selectedEvent) return;

    eventRouteLiveActivityIdRef.current = selectedEvent.id;
    void syncNoxaNavigationLiveActivity({
      kind: "event-route",
      id: selectedEvent.id,
      destinationTitle: selectedEvent.title,
      etaSeconds: routeRemainingDurationSeconds,
      remainingDistanceMeters: routeRemainingDistanceMeters,
      participantCount: 1,
      progress: eventRouteProjection?.progressFraction ?? null,
    });
  }, [
    eventRouteProjection?.progressFraction,
    isRouteMode,
    route,
    routeRemainingDistanceMeters,
    routeRemainingDurationSeconds,
    routeStatus,
    selectedEvent,
  ]);
  const routeNextManeuver = useMemo(
    () =>
      nextEventManeuver(
        route,
        preparedEventRoute,
        eventRouteProjection?.progressFraction ?? null,
      ),
    [eventRouteProjection?.progressFraction, preparedEventRoute, route],
  );
  const routeArrived =
    routeRemainingDistanceMeters !== null
    && routeRemainingDistanceMeters <= ROUTE_ARRIVAL_METERS;

  const initialRegion = useMemo(() => pointRegion(THESSALONIKI), []);

  const animateTo = useCallback(
    (region: MapRegion, duration = 550) =>
      mapRef.current?.animateToRegion(region, duration),
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

  const handleMapboxUserLocation = useCallback((point: LatLng) => {
    const now = Date.now();
    const previous = driverLocationRef.current;
    driverLocationRef.current = point;

    const movedMeters = previous
      ? distanceBetweenMeters(previous, point)
      : Infinity;
    if (
      previous
      && now - lastMapboxLocationCommitRef.current < MAPBOX_LOCATION_STATE_MIN_MS
      && movedMeters < 2
    ) {
      return;
    }

    lastMapboxLocationCommitRef.current = now;
    if (isMountedRef.current) setDriverLocation(point);
  }, []);

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

  useEffect(() => {
    const userId = sharingUserIdRef.current;
    const session = getLiveDriveSession();
    if (
      !isAppForegroundRef.current
      || !isVisibleOnMap
      || !userId
      || !session
      || !driverLocation
    ) {
      return;
    }

    // Reuse the existing Mapbox user-location stream. Personal social presence
    // never owns a background GPS task; it only publishes while NOXA is active.
    const payload: PresenceLocationPayload = {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      heading: null,
      speed_mps: null,
      accuracy_meters: null,
      visibility_mode: visibilityModeRef.current,
      share_expires_at: session.expiresAt,
    };
    latestPresencePayloadRef.current = payload;
    void writePresencePayload(userId, payload);
  }, [driverLocation, isVisibleOnMap, writePresencePayload]);

  const startSharing = useCallback(
    async (mode: LiveDriveVisibilityMode) => {
      const startGeneration = ++liveDriveStartGenerationRef.current;
      setSharingError(null);
      setPendingLiveDrivePermissionRecovery(null);
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
        const initialLocation = await requestRequiredLiveDrivePermissions();
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
          const safeMessage = getSafeLiveDriveStartMessage(error);
          setIsVisibleOnMap(false);
          setVisibilityMode("ghost");
          setLiveDriveExpiresAt(null);
          setSharingError(safeMessage);
          if (shouldOfferLiveDriveSettings(error)) {
            setPendingLiveDrivePermissionRecovery({
              mode,
              message: safeMessage,
            });
          }
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
    sharingUserIdRef.current = activeSession.userId;
    visibilityModeRef.current = activeSession.visibilityMode;
    if (isMountedRef.current) {
      setVisibilityMode(activeSession.visibilityMode);
      setLiveDriveExpiresAt(activeSession.expiresAt);
      setIsVisibleOnMap(true);
      setSharingError(null);
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
    if (isMountedRef.current) setMyDriverIds(new Set(relevantIds));

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

      const origin = driverLocationRef.current;
      if (!origin) {
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
      const bounds = nearbyBounds(origin, NEARBY_RADIUS_METERS);

      const { data, error } = await supabase
        .from("driver_locations")
        .select(
          "user_id,latitude,longitude,updated_at,profiles(id,display_name,username,avatar_url)",
        )
        .gte("updated_at", since)
        .neq("user_id", userId)
        .gte("latitude", bounds.minLatitude)
        .lte("latitude", bounds.maxLatitude)
        .gte("longitude", bounds.minLongitude)
        .lte("longitude", bounds.maxLongitude)
        .order("updated_at", { ascending: false })
        .limit(MAX_MAP_DRIVERS);

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
    const storedSession = getLiveDriveSession();
    if (storedSession && !isLiveDriveSessionOwnedByCurrentProcess()) {
      // A fresh JS process means the previous app instance ended. iOS does not
      // guarantee a force-quit callback, so cold launch fails safe to Ghost and
      // deletes any still-present server row before offering visibility again.
      void stopSharing(true);
    } else {
      void restoreLiveDriveSession();
    }
    void loadCurrentProfile();
    void loadMyDriverIds();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isActive) return;
        if (event === "SIGNED_OUT" || !session) {
          activeDriversRef.current = [];
          setActiveDrivers([]);
          setCurrentProfile(null);
          setMyDriverIds(new Set());
          setPrimaryVehicleByUserId(new Map());
          setTimeout(() => {
            if (isActive) void stopSharing(true);
          }, 0);
          return;
        }
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
      return () => {
        isActive = false;
        mapFocusedRef.current = false;
        clearInterval(refreshInterval);
        activeDriversRequestIdRef.current += 1;
      };
    }, [loadMyDriverIds, refreshActiveDrivers]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      isAppForegroundRef.current = nextState === "active";

      // Keep the selected audience alive while NOXA is minimized. Foreground
      // Mapbox owns location while active; the existing personal background
      // task takes over only when the app leaves the foreground.
      if (nextState === "inactive" || nextState === "background") {
        if (getLiveDriveSession()) {
          void startLiveDriveBackgroundUpdates().catch(async () => {
            const accessStillValid = await hasLiveDriveRuntimeAccess();
            if (accessStillValid && getLiveDriveSession()) {
              if (isMountedRef.current) {
                setSharingError(
                  "Live Drive is reconnecting in the background. Your visibility setting is preserved.",
                );
              }
              setTimeout(() => {
                if (
                  !isMountedRef.current
                  || isAppForegroundRef.current
                  || !getLiveDriveSession()
                ) {
                  return;
                }
                void startLiveDriveBackgroundUpdates()
                  .then(() => {
                    if (isMountedRef.current) setSharingError(null);
                  })
                  .catch(() => undefined);
              }, 1_500);
              return;
            }

            await stopSharing(true);
            if (isMountedRef.current) {
              setSharingError(
                "Live Drive stopped because background location access is unavailable.",
              );
            }
          });
        }
        return;
      }

      if (nextState === "active") {
        void (async () => {
          await stopLiveDriveBackgroundUpdates();
          await loadDriverLocation({ requestPermission: false });
          await restoreLiveDriveSession();
          if (mapFocusedRef.current) {
            await Promise.all([loadMyDriverIds(), refreshActiveDrivers()]);
          }
          const recovery = pendingLiveDrivePermissionRecovery;
          if (recovery && isMountedRef.current) {
            setPendingLiveDrivePermissionRecovery(null);
            await startSharing(recovery.mode);
          }
        })();
      }
    });
    return () => subscription.remove();
  }, [
    loadDriverLocation,
    loadMyDriverIds,
    pendingLiveDrivePermissionRecovery,
    refreshActiveDrivers,
    restoreLiveDriveSession,
    startSharing,
    stopSharing,
  ]);

  useEffect(() => {
    if (isVisibleOnMap || sharingError || locationError || permissionDenied) {
      setShowGhostToast(false);
      return;
    }

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const showTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      setShowGhostToast(true);
      hideTimer = setTimeout(() => {
        if (isMountedRef.current) setShowGhostToast(false);
      }, 2800);
    }, 180);

    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isVisibleOnMap, locationError, permissionDenied, sharingError]);

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
    setIsRouteFocusMode(false);
    routeAbortControllerRef.current?.abort();
    routeAbortControllerRef.current = null;
    routeRequestIdRef.current += 1;
    routeRequestKeyRef.current = null;
    setRoute(null);
    setRouteMessage(null);
    setRouteStatus(isRouteMode && focusEventId ? "loading" : "idle");
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
        const readyRoute = nextRoute;
        requestAnimationFrame(() =>
          fitRouteToMap(
            readyRoute.coordinates,
            {
              latitude: selectedEvent.latitude,
              longitude: selectedEvent.longitude,
            },
            origin,
          ),
        );
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
    const activityId = eventRouteLiveActivityIdRef.current;
    if (activityId) {
      eventRouteLiveActivityIdRef.current = null;
      void endNoxaNavigationLiveActivity("event-route", activityId);
    }
    setIsRouteFollowing(false);
    setIsRouteFocusMode(false);
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
    setIsRouteFocusMode(false);
    routeRequestIdRef.current += 1;
    routeAbortControllerRef.current?.abort();
    routeAbortControllerRef.current = null;
    void requestRoute(true);
  }, [requestRoute]);

  const routeToEvent = useCallback((event: EventMarkerRow) => {
    if (driveTogetherNavigation) return;
    setSelectedDriverId(null);
    setIsRouteFollowing(false);
    setIsRouteFocusMode(false);
    if (!hasValidCoordinates(event)) return;
    setSelectedEvent(event);
    setRoute(null);
    setRouteMessage(null);
    setRouteStatus("loading");
    router.setParams({ focusEventId: event.id, mapMode: "route" });
  }, [driveTogetherNavigation]);

  const selectEvent = useCallback(
    (event: EventMarkerRow) => {
      setSelectedDriverId(null);
      setSelectedEvent(event);
      setIsCameraAwayFromUser(true);
      requestAnimationFrame(() =>
        animateTo(eventRegion(event), animations.step),
      );
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
    setIsCameraAwayFromUser(false);
    setIsRouteFocusMode(true);
    setIsRouteFollowing(true);
  }, [
    fitRouteToMap,
    isRouteFollowing,
    isRouteMode,
    route,
    routeStatus,
    selectedEvent,
  ]);

  const recenterRouteFocus = useCallback(() => {
    const point = driverLocationRef.current;
    if (!point || !hasValidLatLng(point.latitude, point.longitude)) return;
    setIsCameraAwayFromUser(false);
    mapRef.current?.animateToRegion(pointRegion(point), 220);
    setIsRouteFollowing(true);
  }, []);

  const recenterDriveTogether = useCallback(() => {
    const point = driverLocationRef.current;
    if (!point || !hasValidLatLng(point.latitude, point.longitude)) return;
    setIsCameraAwayFromUser(false);
    mapRef.current?.animateToRegion(pointRegion(point), 220);
    setIsDriveTogetherFollowing(true);
  }, []);

  const beginDriveTogetherMapPick = useCallback(
    (handler: (point: LatLng) => void) => {
      driveTogetherMapPickHandlerRef.current = handler;
      setIsDriveTogetherDestinationPicking(true);
      setIsDriveTogetherFollowing(false);
      setIsRouteFollowing(false);
    },
    [],
  );

  const endDriveTogetherMapPick = useCallback(() => {
    driveTogetherMapPickHandlerRef.current = null;
    setIsDriveTogetherDestinationPicking(false);
  }, []);

  const handleDriveTogetherMapPress = useCallback((point: LatLng) => {
    const handler = driveTogetherMapPickHandlerRef.current;
    if (!handler) return;
    driveTogetherMapPickHandlerRef.current = null;
    setIsDriveTogetherDestinationPicking(false);
    handler(point);
  }, []);

  const handleDriveTogetherPanelVisibilityChange = useCallback(
    (visible: boolean) => {
      setDriveTogetherPanelVisible(visible);
      if (!visible) {
        setDriveTogetherQuickStartFriendId(null);
        return;
      }

      setSelectedDriverId(null);
      setSelectedEvent(null);
      setIsRouteFollowing(false);
      setIsRouteFocusMode(false);
      routeRequestIdRef.current += 1;
      routeAbortControllerRef.current?.abort();
      routeAbortControllerRef.current = null;
      routeRequestKeyRef.current = null;
      setRoute(null);
      setRouteStatus("idle");
      setRouteMessage(null);
    },
    [],
  );

  const handleDriveTogetherNavigationChange = useCallback(
    (next: DriveTogetherNavigationOverlay | null) => {
      setDriveTogetherNavigation(next);
      if (next) {
        setSelectedDriverId(null);
        setSelectedEvent(null);

        const enteringDrive =
          driveTogetherFollowSessionRef.current !== next.driveSessionId;
        driveTogetherFollowSessionRef.current = next.driveSessionId;
        if (enteringDrive) {
          setIsCameraAwayFromUser(false);
          setIsDriveTogetherFollowing(true);
        }

        setIsRouteFollowing(false);
        setIsRouteFocusMode(false);
        routeRequestIdRef.current += 1;
        routeAbortControllerRef.current?.abort();
        routeAbortControllerRef.current = null;
        routeRequestKeyRef.current = null;
        setRoute(null);
        setRouteStatus("idle");
        setRouteMessage(null);
        router.setParams({ mapMode: undefined, focusEventId: undefined });
      } else {
        driveTogetherFollowSessionRef.current = null;
        setIsDriveTogetherFollowing(false);
      }
    },
    [],
  );

  useEffect(() => {
    const currentActivityId = quickDriveLiveActivityIdRef.current;

    if (!driveTogetherNavigation) {
      if (currentActivityId) {
        quickDriveLiveActivityIdRef.current = null;
        void endNoxaNavigationLiveActivity("quick-drive", currentActivityId);
      }
      return;
    }

    quickDriveLiveActivityIdRef.current = driveTogetherNavigation.driveSessionId;
    void syncNoxaNavigationLiveActivity({
      kind: "quick-drive",
      id: driveTogetherNavigation.driveSessionId,
      destinationTitle: driveTogetherNavigation.destinationTitle,
      etaSeconds: driveTogetherNavigation.remainingDurationSeconds,
      remainingDistanceMeters: driveTogetherNavigation.remainingDistanceMeters,
      participantCount: driveTogetherNavigation.participantCount,
      progress: driveTogetherNavigation.progress,
    });
  }, [driveTogetherNavigation]);

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
  const mapboxDrivers = useMemo<MapboxDriver[]>(() => {
    const merged = new Map<string, MapboxDriver>();
    for (const driver of activeDrivers) {
      merged.set(driver.user_id, {
        user_id: driver.user_id,
        latitude: driver.latitude,
        longitude: driver.longitude,
        label: driverLabel(driver),
        avatar_url: driver.profile?.avatar_url ?? null,
        vehicle_label: myDriverIds.has(driver.user_id)
          ? (primaryVehicleByUserId.get(driver.user_id) ?? null)
          : null,
        is_relevant: myDriverIds.has(driver.user_id),
        is_dimmed: mapLens === "mine" && !myDriverIds.has(driver.user_id),
      });
    }
    // Drive Together uses the existing Home/Map MapView. Its private
    // participant locations override a public Live Drive marker for the same
    // user so we never render duplicate people or create a second map.
    for (const driver of driveTogetherDrivers) merged.set(driver.user_id, driver);
    return Array.from(merged.values());
  }, [
    activeDrivers,
    driveTogetherDrivers,
    mapLens,
    myDriverIds,
    primaryVehicleByUserId,
  ]);
  const selectedDriver = useMemo(
    () => (selectedDriverId
      ? mapboxDrivers.find((driver) => driver.user_id === selectedDriverId) ?? null
      : null),
    [mapboxDrivers, selectedDriverId],
  );
  useEffect(() => {
    if (selectedDriverId && !selectedDriver) setSelectedDriverId(null);
  }, [selectedDriver, selectedDriverId]);

  const selectedDriverProfile = useMemo(
    () => {
      if (!selectedDriverId || !selectedDriver?.is_relevant) {
        return {
          displayName: "NOXA driver",
          username: null,
          avatarUrl: null,
        };
      }
      const driver = activeDrivers.find((candidate) => candidate.user_id === selectedDriverId);
      if (driver?.profile) {
        return {
          displayName: driver.profile.display_name,
          username: driver.profile.username,
          avatarUrl: driver.profile.avatar_url,
        };
      }
      return {
        displayName: selectedDriver.label,
        username: null,
        avatarUrl: selectedDriver.avatar_url,
      };
    },
    [activeDrivers, selectedDriver, selectedDriverId],
  );
  const selectedDriverIsInDrive = Boolean(
    selectedDriverId
    && driveTogetherDrivers.some((driver) => driver.user_id === selectedDriverId),
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
  const driveTogetherEventDestinations = useMemo<DriveTogetherDestinationSeed[]>(
    () =>
      events
        .filter((event) => {
          const lifecycle = getEventLifecycle(event);
          return (
            hasValidCoordinates(event)
            && (lifecycle === "scheduled" || lifecycle === "live")
          );
        })
        .map((event) => ({
          id: event.id,
          latitude: event.latitude,
          longitude: event.longitude,
          label: event.title,
          subtitle: [
            formatEventTime(event.starts_at),
            event.location_name ?? null,
          ]
            .filter(Boolean)
            .join(" • "),
        })),
    [events],
  );
  const openDriverCard = useCallback((driverId: string) => {
    if (mapObjectSelectionLocked) return;

    setVisibilityMenuOpen(false);
    setSelectedEvent(null);
    setSelectedDriverId(driverId);

    const driver = mapboxDrivers.find((candidate) => candidate.user_id === driverId);
    if (driver) {
      const focusRegion = {
        ...pointRegion({
          latitude: driver.latitude,
          longitude: driver.longitude,
        }),
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      };
      requestAnimationFrame(() =>
        animateTo(focusRegion, animations.step),
      );
    }
  }, [animateTo, mapObjectSelectionLocked, mapboxDrivers]);

  const inviteDriverToDriveTogether = useCallback((driverId: string) => {
    setSelectedDriverId(null);
    setDriveTogetherQuickStartFriendId(driverId);
    setDriveTogetherOpen(true);
  }, []);

  const startDriveTogetherForEvent = useCallback((event: EventMarkerRow) => {
    if (!hasValidCoordinates(event)) return;
    setSelectedDriverId(null);
    setDriveTogetherQuickStartFriendId(null);
    setDriveTogetherInitialDestination({
      id: event.id,
      latitude: event.latitude,
      longitude: event.longitude,
      label: event.title,
      subtitle: event.location_name,
    });
    setDriveTogetherOpen(true);
  }, []);
  const selectMapboxEvent = useCallback(
    (event: MapboxEvent) => {
      if (mapObjectSelectionLocked) return;
      const fullEvent = events.find((candidate) => candidate.id === event.id);
      if (fullEvent) selectEvent(fullEvent);
    },
    [events, mapObjectSelectionLocked, selectEvent],
  );

  const handleUserPan = useCallback(() => {
    setIsCameraAwayFromUser(true);
    setIsRouteFollowing(false);
    setIsDriveTogetherFollowing(false);
  }, []);

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
          : sharingError,
      }
    : locationError
      ? { icon: "warning-outline" as const, message: locationError }
      : permissionDenied
        ? {
            icon: "location-outline" as const,
            message: "Location is off. Use Recenter to request access.",
          }
        : null;
  const ghostToastVisible = !isVisibleOnMap && !activeNotice && showGhostToast;
  const noticesTop = headerBottom + spacing.sm;
  const mapDataNoticeTop =
    noticesTop + (activeNotice || ghostToastVisible ? 42 : 0);
  const eventCardBottom =
    insets.bottom + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + FLOATING_GAP;
  const routeCardBottom = eventCardBottom;
  const driveTogetherOwnsNavigation = Boolean(driveTogetherNavigation);
  const effectiveRoute = driveTogetherNavigation?.route ?? route;
  const effectiveRouteMode = driveTogetherOwnsNavigation || isRouteMode;
  const effectiveFollowing = driveTogetherOwnsNavigation
    ? isDriveTogetherFollowing
    : isRouteFollowing;
  const cameraOwner: MapCameraOwner =
    driveTogetherPanelVisible || Boolean(driveTogetherNavigation)
      ? (isDriveTogetherFollowing ? "drive-follow" : "drive-context")
      : isRouteMode || isRouteFocusMode
        ? (isRouteFollowing ? "route-follow" : "route-context")
        : selectedDriverId || selectedEvent
          ? "selection"
          : !isCameraAwayFromUser && Boolean(driverLocation)
            ? "recenter"
            : "free";
  const controlBottom =
    eventCardBottom +
    (isRouteMode && selectedEvent && !driveTogetherNavigation
      ? 276
      : selectedEvent && !driveTogetherNavigation
        ? 196
        : spacing.sm);
  const showRecenter =
    cameraOwner === "free"
    && !effectiveFollowing
    && (!driverLocation || isCameraAwayFromUser);

  return (
    <View style={styles.screen}>
      <MapboxLiveMapCompat
        ref={mapRef}
        activeDrivers={mapboxDrivers}
        driverLocation={driverLocation}
        events={mapboxEvents}
        initialRegion={initialRegion}
        isDestinationPicking={isDriveTogetherDestinationPicking}
        isRouteMode={effectiveRouteMode}
        followUserLocation={effectiveFollowing}
        mapFilter="all"
        onFollowUserLocationChange={
          driveTogetherOwnsNavigation
            ? setIsDriveTogetherFollowing
            : setIsRouteFollowing
        }
        onMapPress={handleDriveTogetherMapPress}
        onUserLocationChange={handleMapboxUserLocation}
        onUserPan={handleUserPan}
        onDriverPress={openDriverCard}
        onEventPress={selectMapboxEvent}
        route={effectiveRoute}
        routeDestination={driveTogetherNavigation?.destination ?? null}
        selectedEventId={selectedEvent?.id ?? null}
        selectedDriverId={selectedDriverId}
      />

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        {!isRouteFocusMode && !driveTogetherNavigation ? (
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

        {!isRouteFocusMode && !driveTogetherNavigation && visibilityMenuOpen ? (
          <Animated.View
            entering={VISIBILITY_MENU_ENTER}
            exiting={VISIBILITY_MENU_EXIT}
            style={[
              styles.visibilityMenuPosition,
              { top: headerBottom + spacing.xs },
            ]}>
            <NoxaSurface level="overlay" style={styles.visibilityMenu}>
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
            </NoxaSurface>
          </Animated.View>
        ) : null}

        {!selectedDriverId && !isRouteFocusMode && !selectedEvent && !driveTogetherPanelVisible && !driveTogetherNavigation ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.groupDriveControl,
              { bottom: eventCardBottom + spacing.sm },
            ]}
          >
            <NoxaIconButton
              accessibilityHint="Invite a friend to drive together"
              accessibilityLabel="Drive Together"
              icon="navigate-outline"
              iconSize={19}
              onPress={() => setDriveTogetherOpen(true)}
              size={44}
              variant="overlay"
            />
          </View>
        ) : null}

        {showRecenter ? (
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

        {!isRouteFocusMode && ghostToastVisible ? (
          <Animated.View
            entering={VISIBILITY_MENU_ENTER}
            exiting={VISIBILITY_MENU_EXIT}
            pointerEvents="none"
            style={[styles.ghostToastWrap, { top: noticesTop }]}
          >
            <NoxaSurface
              accessibilityLiveRegion="polite"
              level="overlay"
              style={styles.ghostToast}
            >
              <Ionicons
                name="eye-off-outline"
                size={14}
                color={colors.primaryHover}
              />
              <Text style={styles.ghostToastText}>
                Ghost mode · Location sharing off
              </Text>
            </NoxaSurface>
          </Animated.View>
        ) : null}

        {!isRouteFocusMode && activeNotice ? (
          <NoxaSurface
            accessibilityLiveRegion="polite"
            level="overlay"
            pointerEvents="none"
            style={[styles.mapNotice, { top: noticesTop }]}>
            <Ionicons
              name={activeNotice.icon}
              size={15}
              color={colors.primaryHover}
            />
            <Text style={styles.mapNoticeText}>{activeNotice.message}</Text>
          </NoxaSurface>
        ) : null}

        {!isRouteFocusMode && mapDataHasError ? (
          <NoxaSurface
            accessibilityLiveRegion="polite"
            level="overlay"
            style={[styles.mapDataNotice, { top: mapDataNoticeTop }]}>
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
            <NoxaButton
              accessibilityLabel="Retry map data"
              onPress={retryMapData}
              size="sm"
              style={styles.mapDataRetryButton}
              title="Retry"
              variant="secondary"
            />
          </NoxaSurface>
        ) : null}

        {!selectedDriverId && !isRouteFocusMode && !driveTogetherPanelVisible && !driveTogetherNavigation && selectedEvent && isRouteMode ? (
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
            onAddDriver={() => startDriveTogetherForEvent(selectedEvent)}
            remainingDistanceMeters={routeRemainingDistanceMeters}
            remainingDurationSeconds={routeRemainingDurationSeconds}
          />
        ) : !selectedDriverId && !isRouteFocusMode && !driveTogetherPanelVisible && !driveTogetherNavigation && selectedEvent ? (
          <EventCard
            event={selectedEvent}
            bottomOffset={eventCardBottom}
            onClose={() => setSelectedEvent(null)}
            onRoute={() => routeToEvent(selectedEvent)}
          />
        ) : null}

        {selectedDriverId && selectedDriver ? (
          <MapDriverCard
            key={`${selectedDriverId}:${Boolean(selectedDriver.is_relevant)}`}
            bottomOffset={eventCardBottom}
            driverId={selectedDriverId}
            fallbackProfile={selectedDriverProfile}
            isInDrive={selectedDriverIsInDrive}
            isRelevant={Boolean(selectedDriver.is_relevant)}
            onClose={() => setSelectedDriverId(null)}
            onInviteToDrive={inviteDriverToDriveTogether}
            onRelationshipChange={() => void loadMyDriverIds()}
          />
        ) : null}

        {driveTogetherNavigation ? (
          <DriveTogetherNavigationChrome
            bottomInset={insets.bottom}
            following={isDriveTogetherFollowing}
            navigation={driveTogetherNavigation}
            onOpenPanel={() => setDriveTogetherOpen(true)}
            onRecenter={recenterDriveTogether}
            panelVisible={driveTogetherPanelVisible}
            topInset={insets.top}
          />
        ) : null}

        {isRouteFocusMode && selectedEvent && route ? (
          <RouteFocusOverlay
            arrived={routeArrived}
            bottomInset={insets.bottom}
            event={selectedEvent}
            following={isRouteFollowing}
            nextManeuver={routeNextManeuver}
            onExit={closeRouteMode}
            onRecenter={recenterRouteFocus}
            remainingDistanceMeters={routeRemainingDistanceMeters}
            remainingDurationSeconds={routeRemainingDurationSeconds}
            topInset={insets.top}
          />
        ) : null}
      </View>

      <DriveTogetherMapLayer
        bottomInset={insets.bottom}
        initialFriendId={driveTogetherQuickStartFriendId}
        initialDestination={driveTogetherInitialDestination}
        eventDestinations={driveTogetherEventDestinations}
        bottomOffset={driveTogetherPanelVisible ? 0 : eventCardBottom + spacing.sm}
        currentLocation={driverLocation}
        following={isDriveTogetherFollowing}
        invitationId={normalizedDriveInvitationId ?? null}
        onBeginMapPick={beginDriveTogetherMapPick}
        onDriversChange={setDriveTogetherDrivers}
        onEndMapPick={endDriveTogetherMapPick}
        onFollowingChange={setIsDriveTogetherFollowing}
        onNavigationChange={handleDriveTogetherNavigationChange}
        onOpenChange={setDriveTogetherOpen}
        onInitialDestinationConsumed={() => setDriveTogetherInitialDestination(null)}
        onPanelVisibilityChange={handleDriveTogetherPanelVisibilityChange}
        open={driveTogetherOpen}
        topOffset={headerBottom + spacing.md}
      />

      <LiveDrivePermissionRecoverySheet
        message={
          pendingLiveDrivePermissionRecovery?.message
          ?? "Live Drive needs background location access to keep you visible when NOXA is minimized."
        }
        onCancel={() => setPendingLiveDrivePermissionRecovery(null)}
        visible={pendingLiveDrivePermissionRecovery !== null}
      />

      <NoxaConfirmationSheet
        body={`NOXA collects and shares your precise location with ${pendingVisibility?.label.toLowerCase() ?? "your selected audience"} while the app is in the background, so they can see you on the live map.`}
        busy={isStartingLiveDrive}
        confirmDisabled={!pendingVisibilityMode}
        confirmTitle="Continue"
        eyebrow="BACKGROUND LOCATION"
        footnote="Sharing continues while NOXA is minimized. It stops after 4 hours, when you select Ghost, when you sign out, or after the app is fully closed and its live presence expires."
        icon="navigate"
        onCancel={() => setPendingVisibilityMode(null)}
        onConfirm={() => {
          if (pendingVisibilityMode) void startSharing(pendingVisibilityMode);
        }}
        title="Stay visible while driving?"
        visible={pendingVisibilityMode !== null}
      />

      <NoxaConfirmationSheet
        body={`Change who can see your precise location on the live map from ${pendingAudienceFromLabel ?? "your current audience"} to ${pendingAudienceToLabel ?? "the selected audience"}?`}
        busy={isChangingAudience}
        confirmDisabled={!pendingAudienceChange}
        confirmTitle={
          pendingAudienceToLabel
            ? `Change to ${pendingAudienceToLabel}`
            : "Change audience"
        }
        eyebrow="PRECISE LOCATION"
        footnote={`This does not extend your Live Drive. Sharing keeps the current end time${liveDriveRemaining ? ` (${liveDriveRemaining} left)` : ""} and stops earlier if you select Ghost or sign out.`}
        icon="eye-outline"
        onCancel={() => setPendingAudienceChange(null)}
        onConfirm={() => {
          if (pendingAudienceChange) void applyAudienceChange(pendingAudienceChange.to);
        }}
        title="Change Live Drive audience?"
        visible={pendingAudienceChange !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden", backgroundColor: colors.background },
  header: {
    position: "absolute",
    zIndex: 40,
    elevation: 40,
    left: spacing.md,
    right: spacing.md,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  identityControl: {
    width: geometry.controlHeight.compact,
    height: geometry.controlHeight.compact,
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
    backgroundColor: colors.textQuiet,
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
    zIndex: 40,
    elevation: 40,
    right: spacing.md,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  groupDriveControl: {
    position: "absolute",
    zIndex: 40,
    elevation: 40,
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
  visibilityMenuPosition: {
    position: "absolute",
    zIndex: 60,
    elevation: 60,
    left: spacing.md,
    width: 264,
  },
  visibilityMenu: {
    width: "100%",
    overflow: "hidden",
    padding: spacing.xs,
    backgroundColor: "transparent",
  },
  visibilityMenuEyebrow: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: 6,
    color: colors.textQuiet,
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
    color: colors.textQuiet,
    fontSize: 8,
    fontWeight: "600",
  },
  ghostToastWrap: {
    position: "absolute",
    zIndex: 50,
    elevation: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  ghostToast: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "transparent",
  },
  ghostToastText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  mapNotice: {
    position: "absolute",
    zIndex: 50,
    elevation: 50,
    left: spacing.md,
    right: spacing.md,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    backgroundColor: "transparent",
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
    zIndex: 50,
    elevation: 50,
    left: spacing.md,
    right: spacing.md,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 7,
    paddingLeft: spacing.sm,
    paddingRight: 7,
    backgroundColor: "transparent",
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
    minWidth: 64,
  },
  mapDataRetryText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
  },
  liveDriveCancelText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  liveDriveStartText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  contextualSheetPosition: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  eventCard: {
    padding: spacing.lg,
    backgroundColor: "transparent",
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
    color: colors.textAccent,
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
    color: colors.textQuiet,
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
  driveNavigationTop: {
    position: "absolute",
    zIndex: 70,
    elevation: 70,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  driveNavigationInstruction: {
    flex: 1,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "transparent",
  },
  driveNavigationBottom: {
    position: "absolute",
    zIndex: 70,
    elevation: 70,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  driveNavigationSummaryPressable: {
    flex: 1,
    minWidth: 0,
  },
  driveNavigationSummary: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "transparent",
  },
  driveNavigationDrivers: {
    marginLeft: "auto",
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  routeFocusTop: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  routeFocusInstruction: {
    flex: 1,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "transparent",
  },
  routeFocusTurnIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: "rgba(200,16,46,0.18)",
  },
  routeFocusInstructionCopy: {
    flex: 1,
    minWidth: 0,
  },
  routeFocusDistance: {
    color: colors.textAccent,
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  routeFocusInstructionText: {
    marginTop: 2,
    color: colors.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
  },
  routeFocusClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(9,9,13,0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    ...shadows.control,
  },
  routeFocusBottom: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  routeFocusMetrics: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "transparent",
  },
  routeFocusDestination: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  routeFocusMetricRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  routeFocusMetricStrong: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  routeFocusDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textQuiet,
  },
  routeFocusArrival: {
    marginLeft: "auto",
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  routeFocusRecenter: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadows.control,
  },
  routeCard: {
    padding: spacing.lg,
    backgroundColor: "transparent",
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
  routeStateSlot: {
    minHeight: 44,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  routeStatusRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  routeStatusText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "500",
    lineHeight: 18,
  },
  routeStatusTextInline: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "500",
  },
  routeMetrics: {
    minHeight: 40,
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
  routeFollowButton: {
    marginTop: spacing.md,
  },
  routeFollowButtonActive: {
    backgroundColor: colors.primary,
  },
  routeFollowText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  routeRetryButton: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
  },
  routeRetryText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "600",
  },
});
