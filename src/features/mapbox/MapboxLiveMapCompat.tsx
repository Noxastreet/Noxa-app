import { Ionicons } from "@expo/vector-icons";
import {
  type ComponentType,
  type RefAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/src/theme";

import type { LiveMapHandle, MapboxLiveMapProps } from "./types";
import { hasMapboxNativeModule } from "./native";

type RealMapboxLiveMap = ComponentType<
  MapboxLiveMapProps & RefAttributes<LiveMapHandle>
>;

export const MapboxLiveMapCompat = forwardRef<
  LiveMapHandle,
  MapboxLiveMapProps
>((props, ref) => {
  const realMapRef = useRef<LiveMapHandle | null>(null);
  const [RealMapboxLiveMap, setRealMapboxLiveMap] =
    useState<RealMapboxLiveMap | null>(null);
  const [canUseMapbox] = useState(hasMapboxNativeModule);
  const [loadFailed, setLoadFailed] = useState(false);

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
    if (!canUseMapbox) return undefined;

    import("./MapboxLiveMap")
      .then((module) => {
        if (isMounted) setRealMapboxLiveMap(() => module.MapboxLiveMap);
      })
      .catch(() => {
        if (isMounted) setLoadFailed(true);
      });

    return () => {
      isMounted = false;
    };
  }, [canUseMapbox]);

  if (!canUseMapbox || loadFailed) {
    return <MapboxDevelopmentFallback />;
  }

  if (!RealMapboxLiveMap) {
    return (
      <View style={styles.stateView}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  return <RealMapboxLiveMap {...props} ref={realMapRef} />;
});

MapboxLiveMapCompat.displayName = "MapboxLiveMapCompat";

function MapboxDevelopmentFallback() {
  return (
    <View style={styles.fallback}>
      <View style={styles.gridLine} />
      <View style={styles.fallbackCard}>
        <View style={styles.iconFrame}>
          <Ionicons name="map" size={24} color={colors.primaryHover} />
        </View>
        <Text style={styles.title}>Mapbox native module unavailable</Text>
        <Text style={styles.body}>
          Mapbox requires a rebuilt custom development client. Expo Go cannot
          load the native @rnmapbox/maps module.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    width: 46,
    height: 46,
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
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
