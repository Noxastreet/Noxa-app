import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  type ComponentType,
  type RefAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/src/theme";

import type {
  LiveMapHandle,
  MapboxDriver,
  MapboxLiveMapProps,
} from "./types";
import { getMapboxRuntime } from "./native";

type RealMapboxLiveMap = ComponentType<
  MapboxLiveMapProps & RefAttributes<LiveMapHandle>
>;

function distanceBetweenMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
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

function formatApproximateDistance(meters: number) {
  if (!Number.isFinite(meters)) return "Distance unavailable";
  if (meters < 1_000) return "Less than 1 km away";
  const roundedKilometers = Math.max(1, Math.round(meters / 500) * 0.5);
  return `About ${roundedKilometers.toFixed(roundedKilometers % 1 ? 1 : 0)} km away`;
}

function safeHomeDriver(driver: MapboxDriver): MapboxDriver {
  if (driver.is_relevant) return driver;
  return {
    ...driver,
    label: "NOXA driver",
    avatar_url: null,
    vehicle_label: null,
  };
}

export const MapboxLiveMapCompat = forwardRef<
  LiveMapHandle,
  MapboxLiveMapProps
>((props, ref) => {
  const realMapRef = useRef<LiveMapHandle | null>(null);
  const [RealMapboxLiveMap, setRealMapboxLiveMap] =
    useState<RealMapboxLiveMap | null>(null);
  const [runtime] = useState(getMapboxRuntime);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const usesHomeProgressiveDisclosure =
    props.mapFilter === "all" && !props.isRouteMode;
  const safeActiveDrivers = useMemo(
    () =>
      usesHomeProgressiveDisclosure
        ? props.activeDrivers.map(safeHomeDriver)
        : props.activeDrivers,
    [props.activeDrivers, usesHomeProgressiveDisclosure],
  );
  const selectedDriver = useMemo(
    () =>
      selectedDriverId
        ? safeActiveDrivers.find((driver) => driver.user_id === selectedDriverId) ?? null
        : null,
    [safeActiveDrivers, selectedDriverId],
  );
  const selectedDriverDistance =
    selectedDriver && props.driverLocation
      ? distanceBetweenMeters(props.driverLocation, selectedDriver)
      : null;

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (...args) => {
        realMapRef.current?.animateToRegion(...args);
      },
      fitToCoordinates: (...args) => {
        realMapRef.current?.fitToCoordinates(...args);
      },
    }),
    [],
  );

  useEffect(() => {
    let isMounted = true;
    if (runtime !== "native") return undefined;

    import("./MapboxLiveMap")
      .then((module) => {
        if (isMounted) setRealMapboxLiveMap(() => module.MapboxLiveMap);
      })
      .catch((error) => {
        if (isMounted) {
          console.error("[noxa-mapbox] Failed to load MapboxLiveMap.", error);
          setLoadFailed(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [runtime]);

  useEffect(() => {
    if (selectedDriverId && !selectedDriver) setSelectedDriverId(null);
  }, [selectedDriver, selectedDriverId]);

  if (runtime === "expo-go") {
    return (
      <MapboxFallback
        body="Expo Go does not include the native Mapbox module. Open NOXA in a development or production build to use the map."
        title="Mapbox unavailable in Expo Go"
      />
    );
  }

  if (runtime === "web") {
    return (
      <MapboxFallback
        body="The native NOXA map is available in the iOS and Android app."
        title="Map unavailable on web"
      />
    );
  }

  if (loadFailed) {
    return (
      <MapboxFallback
        body="The native Mapbox module could not be initialized in this build. Restart NOXA and try again."
        title="Map failed to load"
      />
    );
  }

  if (!RealMapboxLiveMap) {
    return (
      <View style={styles.stateView}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  return (
    <View style={styles.mapRoot}>
      <RealMapboxLiveMap
        {...props}
        activeDrivers={safeActiveDrivers}
        onDriverPress={(driverId) => {
          if (usesHomeProgressiveDisclosure) {
            setSelectedDriverId(driverId);
            return;
          }
          props.onDriverPress(driverId);
        }}
        ref={realMapRef}
      />

      {usesHomeProgressiveDisclosure && selectedDriver ? (
        <View pointerEvents="box-none" style={styles.previewLayer}>
          <View style={styles.driverPreview}>
            <View style={styles.driverPreviewIcon}>
              {selectedDriver.is_relevant && selectedDriver.avatar_url ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: selectedDriver.avatar_url }}
                  style={styles.driverPreviewAvatar}
                />
              ) : (
                <Ionicons
                  name={selectedDriver.is_relevant ? "person" : "car-sport"}
                  size={20}
                  color={colors.text}
                />
              )}
            </View>
            <View style={styles.driverPreviewCopy}>
              <Text numberOfLines={1} style={styles.driverPreviewTitle}>
                {selectedDriver.label}
              </Text>
              <Text numberOfLines={1} style={styles.driverPreviewMeta}>
                {selectedDriver.is_relevant
                  ? (selectedDriver.vehicle_label ?? "Known driver")
                  : "Public driver"}
              </Text>
              <Text style={styles.driverPreviewDistance}>
                {selectedDriverDistance === null
                  ? "Distance unavailable — your location is off"
                  : formatApproximateDistance(selectedDriverDistance)}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close driver preview"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => setSelectedDriverId(null)}
              style={({ pressed }) => [
                styles.driverPreviewClose,
                pressed && styles.driverPreviewActionPressed,
              ]}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable
              accessibilityHint="Open this driver's profile"
              accessibilityLabel="View driver profile"
              accessibilityRole="button"
              onPress={() => {
                const driverId = selectedDriver.user_id;
                setSelectedDriverId(null);
                props.onDriverPress(driverId);
              }}
              style={({ pressed }) => [
                styles.driverPreviewAction,
                pressed && styles.driverPreviewActionPressed,
              ]}
            >
              <Text style={styles.driverPreviewActionText}>View profile</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
});

MapboxLiveMapCompat.displayName = "MapboxLiveMapCompat";

function MapboxFallback({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.fallback}>
      <View style={styles.gridLine} />
      <View style={styles.fallbackCard}>
        <View style={styles.iconFrame}>
          <Ionicons name="map" size={24} color={colors.primaryHover} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  stateView: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  previewLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
    paddingBottom: 88,
  },
  driverPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 104,
    padding: spacing.md,
    paddingRight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.96)",
  },
  driverPreviewIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(200,16,46,0.14)",
  },
  driverPreviewAvatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
  },
  driverPreviewCopy: {
    flex: 1,
    minWidth: 0,
  },
  driverPreviewTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  driverPreviewMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  driverPreviewDistance: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  driverPreviewClose: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  driverPreviewAction: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  driverPreviewActionPressed: {
    opacity: 0.78,
  },
  driverPreviewActionText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  gridLine: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    transform: [{ rotate: "-12deg" }, { scale: 1.8 }],
  },
  fallbackCard: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.92)",
  },
  iconFrame: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(200,16,46,0.16)",
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});