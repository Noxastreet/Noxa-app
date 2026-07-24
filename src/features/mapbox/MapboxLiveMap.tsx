import Mapbox, {
  Camera,
  CircleLayer,
  LineLayer,
  LocationPuck,
  MapView,
  MarkerView,
  ShapeSource,
  SymbolLayer,
  UserTrackingMode,
} from "@rnmapbox/maps";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  type ElementRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/src/theme";

import {
  createDriverFeatureCollection,
  createEventFeatureCollection,
  createRouteFeature,
  toPosition,
} from "./geojson";
import {
  MAPBOX_ACCESS_TOKEN,
  NOXA_MAPBOX_DEFAULT_ZOOM,
  NOXA_MAPBOX_STYLE_URL,
} from "./config";
import type {
  LiveMapHandle,
  MapRegion,
  MapboxLiveMapProps,
} from "./types";

const DEFAULT_ZOOM = NOXA_MAPBOX_DEFAULT_ZOOM;
const ROUTE_ZOOM = 14.5;
const DRIVER_CLUSTER_LIMIT = 80;

if (MAPBOX_ACCESS_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

export const MapboxLiveMap = forwardRef<LiveMapHandle, MapboxLiveMapProps>(
  (
    {
      initialRegion,
      driverLocation,
      activeDrivers,
      events,
      route,
      selectedEventId,
      mapFilter,
      isRouteMode,
      onDriverPress,
      onEventPress,
    },
    ref,
  ) => {
    const cameraRef = useRef<ElementRef<typeof Camera> | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isFollowingUser, setIsFollowingUser] = useState(true);

    const driverFeatures = useMemo(
      () => createDriverFeatureCollection(activeDrivers),
      [activeDrivers],
    );
    const eventFeatures = useMemo(
      () => createEventFeatureCollection(events, selectedEventId),
      [events, selectedEventId],
    );
    const routeFeature = useMemo(() => createRouteFeature(route), [route]);
    const selectedEvent = useMemo(
      () => events.find((event) => event.id === selectedEventId) ?? null,
      [events, selectedEventId],
    );
    const shouldClusterDrivers = activeDrivers.length >= DRIVER_CLUSTER_LIMIT;

    const animateToRegion = useCallback(
      (region: MapRegion, duration = 550) => {
        setIsFollowingUser(false);
        cameraRef.current?.setCamera({
          centerCoordinate: toPosition(region),
          zoomLevel: DEFAULT_ZOOM,
          pitch: isRouteMode ? 48 : 28,
          animationDuration: duration,
          animationMode: "easeTo",
        });
      },
      [isRouteMode],
    );

    const fitToCoordinates: LiveMapHandle["fitToCoordinates"] = useCallback(
      (points, options) => {
        if (points.length < 2) return;
        setIsFollowingUser(false);
        const longitudes = points.map((point) => point.longitude);
        const latitudes = points.map((point) => point.latitude);
        cameraRef.current?.setCamera({
          bounds: {
            ne: [Math.max(...longitudes), Math.max(...latitudes)],
            sw: [Math.min(...longitudes), Math.min(...latitudes)],
          },
          padding: {
            paddingTop: options?.edgePadding?.top ?? 96,
            paddingRight: options?.edgePadding?.right ?? spacing.xl,
            paddingBottom: options?.edgePadding?.bottom ?? 210,
            paddingLeft: options?.edgePadding?.left ?? spacing.xl,
          },
          pitch: isRouteMode ? 50 : 26,
          animationDuration: options?.animated === false ? 0 : 650,
          animationMode: options?.animated === false ? "none" : "easeTo",
        });
      },
      [isRouteMode],
    );

    useImperativeHandle(
      ref,
      () => ({
        animateToRegion,
        fitToCoordinates,
      }),
      [animateToRegion, fitToCoordinates],
    );

    useEffect(() => {
      setIsFollowingUser(Boolean(driverLocation));
    }, [driverLocation]);

    const recenterToUser = useCallback(() => {
      if (!driverLocation) return;
      setIsFollowingUser(true);
    }, [driverLocation]);

    const onDriverSourcePress = useCallback(
      (feature: GeoJSON.Feature) => {
        if (feature.geometry.type !== "Point") return;
        const id = feature.properties?.id;
        if (typeof id === "string") onDriverPress(id);
      },
      [onDriverPress],
    );

    const onEventSourcePress = useCallback(
      (feature: GeoJSON.Feature) => {
        if (feature.geometry.type !== "Point") return;
        const id = feature.properties?.id;
        const event = typeof id === "string"
          ? events.find((candidate) => candidate.id === id)
          : null;
        if (event) onEventPress(event);
      },
      [events, onEventPress],
    );

    if (!MAPBOX_ACCESS_TOKEN) {
      return (
        <View style={styles.stateView}>
          <Text style={styles.stateTitle}>Mapbox token missing</Text>
          <Text style={styles.stateBody}>
            Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN for the native map runtime.
          </Text>
        </View>
      );
    }

    return (
      <View style={StyleSheet.absoluteFillObject}>
        <MapView
          attributionEnabled
          attributionPosition={{ bottom: 84, left: 8 }}
          compassEnabled={false}
          logoEnabled
          logoPosition={{ bottom: 84, right: 8 }}
          onDidFinishLoadingMap={() => {
            setHasError(false);
            setIsLoaded(true);
          }}
          onMapLoadingError={() => {
            setHasError(true);
            setIsLoaded(false);
          }}
          pitchEnabled
          rotateEnabled
          scaleBarEnabled={false}
          style={StyleSheet.absoluteFillObject}
          styleURL={NOXA_MAPBOX_STYLE_URL}
        >
          <Camera
            ref={cameraRef}
            animationDuration={650}
            animationMode="easeTo"
            defaultSettings={{
              centerCoordinate: toPosition(initialRegion),
              zoomLevel: DEFAULT_ZOOM,
              pitch: 28,
            }}
            followPadding={{
              paddingTop: 110,
              paddingRight: spacing.xl,
              paddingBottom: isRouteMode ? 260 : 190,
              paddingLeft: spacing.xl,
            }}
            followPitch={isRouteMode ? 54 : 36}
            followUserLocation={isFollowingUser && Boolean(driverLocation)}
            followUserMode={
              isRouteMode
                ? UserTrackingMode.FollowWithCourse
                : UserTrackingMode.Follow
            }
            followZoomLevel={isRouteMode ? ROUTE_ZOOM : DEFAULT_ZOOM}
          />

          <LocationPuck
            puckBearing={isRouteMode ? "course" : "heading"}
            puckBearingEnabled
            pulsing={{ color: colors.primary, isEnabled: true, radius: 42 }}
            visible={Boolean(driverLocation)}
          />

          {routeFeature ? (
            <ShapeSource id="noxa-route-source" shape={routeFeature}>
              <LineLayer
                id="noxa-route-casing"
                style={{
                  lineCap: "round",
                  lineColor: "rgba(31,6,8,0.82)",
                  lineJoin: "round",
                  lineWidth: 10,
                }}
              />
              <LineLayer
                id="noxa-route-line"
                style={{
                  lineCap: "round",
                  lineColor: colors.primary,
                  lineJoin: "round",
                  lineOpacity: 0.94,
                  lineWidth: 5,
                }}
              />
            </ShapeSource>
          ) : null}

          {mapFilter !== "events" ? (
            <ShapeSource
              cluster={shouldClusterDrivers}
              clusterMaxZoomLevel={14}
              clusterRadius={42}
              hitbox={{ width: 48, height: 48 }}
              id="noxa-drivers-source"
              onPress={(event) => {
                const feature = event.features[0];
                if (feature?.properties?.cluster) return;
                if (feature?.geometry.type === "Point") {
                  onDriverSourcePress(feature);
                }
              }}
              shape={driverFeatures}
            >
              <CircleLayer
                filter={["has", "point_count"]}
                id="noxa-driver-clusters"
                style={{
                  circleColor: "rgba(200,16,46,0.88)",
                  circleRadius: ["step", ["get", "point_count"], 18, 12, 23, 40, 29],
                  circleStrokeColor: "rgba(255,255,255,0.28)",
                  circleStrokeWidth: 1.5,
                }}
              />
              <SymbolLayer
                filter={["has", "point_count"]}
                id="noxa-driver-cluster-count"
                style={{
                  textColor: colors.text,
                  textField: ["get", "point_count_abbreviated"],
                  textSize: 11,
                  textFont: ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                }}
              />
              <CircleLayer
                filter={["!", ["has", "point_count"]]}
                id="noxa-driver-glow"
                style={{
                  circleColor: "rgba(200,16,46,0.22)",
                  circleRadius: 18,
                  circleStrokeColor: "rgba(200,16,46,0.34)",
                  circleStrokeWidth: 1,
                }}
              />
            </ShapeSource>
          ) : null}

          {mapFilter !== "events" && !shouldClusterDrivers
            ? activeDrivers.map((driver) => (
                <MarkerView
                  allowOverlap
                  anchor={{ x: 0.5, y: 0.5 }}
                  coordinate={toPosition(driver)}
                  key={driver.user_id}
                >
                  <TouchableOpacity
                    accessibilityLabel={`${driver.label} is visible on the NOXA map`}
                    activeOpacity={0.82}
                    onPress={() => onDriverPress(driver.user_id)}
                    style={styles.driverMarker}
                  >
                    <View style={styles.driverMarkerAccent} />
                    {driver.avatar_url ? (
                      <Image
                        contentFit="cover"
                        source={{ uri: driver.avatar_url }}
                        style={styles.driverAvatar}
                      />
                    ) : (
                      <Ionicons name="car-sport" size={15} color={colors.text} />
                    )}
                  </TouchableOpacity>
                </MarkerView>
              ))
            : null}

          {mapFilter !== "drivers" || isRouteMode ? (
            <ShapeSource
              hitbox={{ width: 48, height: 48 }}
              id="noxa-events-source"
              onPress={(event) => {
                const feature = event.features[0];
                if (feature?.geometry.type === "Point") onEventSourcePress(feature);
              }}
              shape={eventFeatures}
            >
              <CircleLayer
                id="noxa-event-halo"
                style={{
                  circleColor: [
                    "case",
                    ["==", ["get", "selected"], true],
                    "rgba(255,255,255,0.20)",
                    "rgba(200,16,46,0.24)",
                  ],
                  circleRadius: [
                    "case",
                    ["==", ["get", "selected"], true],
                    22,
                    16,
                  ],
                }}
              />
            </ShapeSource>
          ) : null}

          {mapFilter !== "drivers" || isRouteMode
            ? events.map((event) => (
                <MarkerView
                  allowOverlap
                  anchor={{ x: 0.5, y: 0.5 }}
                  coordinate={toPosition(event)}
                  isSelected={selectedEvent?.id === event.id}
                  key={event.id}
                >
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={() => onEventPress(event)}
                    style={[
                      styles.markerDot,
                      selectedEvent?.id === event.id && styles.markerDotSelected,
                    ]}
                  >
                    <Ionicons name="flag" size={13} color={colors.text} />
                  </TouchableOpacity>
                </MarkerView>
              ))
            : null}
        </MapView>

        {!isLoaded && !hasError ? (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        ) : null}

        {hasError ? (
          <View pointerEvents="box-none" style={styles.errorOverlay}>
            <View style={styles.errorCard}>
              <Text style={styles.stateTitle}>Map unavailable</Text>
              <Text style={styles.stateBody}>
                Check the Mapbox token and native build configuration.
              </Text>
            </View>
          </View>
        ) : null}

        {driverLocation && !isFollowingUser ? (
          <TouchableOpacity
            accessibilityLabel="Follow current location"
            activeOpacity={0.8}
            onPress={recenterToUser}
            style={styles.followChip}
          >
            <Ionicons name="navigate" size={14} color={colors.primaryHover} />
            <Text style={styles.followText}>Follow</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  },
);

MapboxLiveMap.displayName = "MapboxLiveMap";

const styles = StyleSheet.create({
  stateView: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  stateBody: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute",
    left: spacing.md,
    bottom: 118,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.84)",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  errorCard: {
    maxWidth: 280,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(12,12,16,0.94)",
  },
  followChip: {
    position: "absolute",
    right: spacing.md,
    bottom: 118,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(12,12,16,0.88)",
  },
  followText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
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
  driverAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
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
});
