import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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

function safeHomeDriver(driver: MapboxDriver): MapboxDriver {
  if (driver.is_relevant) return driver;
  return {
    ...driver,
    label: "NOXA driver",
    avatar_url: null,
    username: null,
    vehicle_label: null,
    can_invite_directly: false,
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
      props.activeDrivers.map((driver) => {
        const safeDriver = usesHomeProgressiveDisclosure
          ? safeHomeDriver(driver)
          : driver;
        return {
          ...safeDriver,
          distance_meters: props.driverLocation
            ? distanceBetweenMeters(props.driverLocation, safeDriver)
            : null,
        };
      }),
    [props.activeDrivers, props.driverLocation, usesHomeProgressiveDisclosure],
  );
  const selectedDriver = useMemo(
    () =>
      selectedDriverId
        ? safeActiveDrivers.find((driver) => driver.user_id === selectedDriverId) ?? null
        : null,
    [safeActiveDrivers, selectedDriverId],
  );
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
        selectedDriverId={
          usesHomeProgressiveDisclosure
            ? selectedDriverId
            : (props.selectedDriverId ?? null)
        }
        onMapPress={() => {
          if (usesHomeProgressiveDisclosure) setSelectedDriverId(null);
          props.onMapPress?.();
        }}
        onDriverPress={(driverId) => {
          if (usesHomeProgressiveDisclosure) {
            setSelectedDriverId(driverId);
            return;
          }
          props.onDriverPress(driverId);
        }}
        onDriverProfilePress={(driverId) => {
          if (usesHomeProgressiveDisclosure) setSelectedDriverId(null);
          if (props.onDriverProfilePress) props.onDriverProfilePress(driverId);
          else props.onDriverPress(driverId);
        }}
        onDriverInvitePress={(driverId) => {
          if (usesHomeProgressiveDisclosure) setSelectedDriverId(null);
          if (props.onDriverInvitePress) {
            props.onDriverInvitePress(driverId);
            return;
          }
          router.push({
            pathname: "/group-drives/details",
            params: { inviteUserId: driverId },
          });
        }}
        ref={realMapRef}
      />
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