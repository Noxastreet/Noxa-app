import Mapbox, {
  Camera,
  CircleLayer,
  Image as MapboxImage,
  Images,
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
import Svg, { Path as SvgPath } from "react-native-svg";

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
const ROUTE_FOLLOW_ZOOM = 16.5;
const DRIVER_CLUSTER_LIMIT = 80;

const NOXA_LOCATION_ARROW_IMAGE = "noxa-location-arrow";
const NOXA_LOCATION_TRANSPARENT_IMAGE = "noxa-location-transparent";

function NoxaNavigationArrowAsset() {
  return (
    <View
      collapsable={false}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg height={44} width={44} viewBox="0 0 44 44">
        <SvgPath
          d="M22 3.5L37 37L22 31.8L7 37L22 3.5Z"
          fill={colors.primary}
          stroke={colors.background}
          strokeLinejoin="round"
          strokeWidth={2}
        />
        <SvgPath
          d="M22 12L28 29L22 26.8L16 29L22 12Z"
          fill={colors.text}
        />
      </Svg>
    </View>
  );
}

function eventIconName(
  category: string | null | undefined,
): keyof typeof Ionicons.glyphMap {
  switch (category) {
    case "social":
      return "people";
    case "meet":
      return "car-sport";
    case "drive":
      return "navigate";
    case "track":
      return "speedometer";
    default:
      return "flag";
  }
}

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
      followUserLocation,
      onFollowUserLocationChange,
      onDriverPress,
      onEventPress,
    },
    ref,
  ) => {
    const cameraRef = useRef<ElementRef<typeof Camera> | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const driverFeatures = useMemo(
      () => createDriverFeatureCollection(activeDrivers),
      [activeDrivers],
    );
    const eventFeatures = useMemo(
      () => createEventFeatureCollection(events, selectedEventId),
      [events, selectedEventId],
    );
    const routeFeature = useMemo(() => createRouteFeature(route), [route]);
    const routeShape = useMemo<
      GeoJSON.FeatureCollection<GeoJSON.LineString> | null
    >(
      () =>
        routeFeature
          ? {
              type: "FeatureCollection",
              features: [routeFeature],
            }
          : null,
      [routeFeature],
    );
    const routeRenderKey = useMemo(() => {
      const coordinates = routeFeature?.geometry.coordinates;
      if (!coordinates || coordinates.length < 2) return null;
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      return [
        coordinates.length,
        first[0],
        first[1],
        last[0],
        last[1],
      ].join(":");
    }, [routeFeature]);
    const selectedEvent = useMemo(
      () => events.find((event) => event.id === selectedEventId) ?? null,
      [events, selectedEventId],
    );
    const shouldClusterDrivers = activeDrivers.length >= DRIVER_CLUSTER_LIMIT;

    useEffect(() => {
      if (!routeShape || !routeRenderKey) return;
      console.info("[noxa-route-render]", {
        coordinateCount: routeShape.features[0]?.geometry.coordinates.length ?? 0,
        isMapLoaded: isLoaded,
        routeRenderKey,
      });
    }, [isLoaded, routeRenderKey, routeShape]);

    const animateToRegion = useCallback(
      (region: MapRegion, duration = 550) => {
        if (followUserLocation) {
          onFollowUserLocationChange(false);
          return;
        }
        cameraRef.current?.setCamera({
          centerCoordinate: toPosition(region),
          zoomLevel: DEFAULT_ZOOM,
          pitch: isRouteMode ? 48 : 28,
          animationDuration: duration,
          animationMode: "easeTo",
        });
      },
      [followUserLocation, isRouteMode, onFollowUserLocationChange],
    );

    const fitToCoordinates: LiveMapHandle["fitToCoordinates"] = useCallback(
      (points, options) => {
        if (followUserLocation) {
          onFollowUserLocationChange(false);
          return;
        }
        const validPoints = points.filter(
          (point) =>
            Number.isFinite(point.latitude) &&
            point.latitude >= -90 &&
            point.latitude <= 90 &&
            Number.isFinite(point.longitude) &&
            point.longitude >= -180 &&
            point.longitude <= 180,
        );
        if (validPoints.length < 2) return;
        const longitudes = validPoints.map((point) => point.longitude);
        const latitudes = validPoints.map((point) => point.latitude);
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
      [followUserLocation, isRouteMode, onFollowUserLocationChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        animateToRegion,
        fitToCoordinates,
      }),
      [animateToRegion, fitToCoordinates],
    );

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
          onCameraChanged={(state) => {
            if (followUserLocation && state.gestures.isGestureActive) {
              onFollowUserLocationChange(false);
            }
          }}
          pitchEnabled
          projection="mercator"
          rotateEnabled
          scaleBarEnabled={false}
          style={StyleSheet.absoluteFillObject}
          styleURL={NOXA_MAPBOX_STYLE_URL}
        >
          <Images>
            <MapboxImage name={NOXA_LOCATION_ARROW_IMAGE}>
              <NoxaNavigationArrowAsset />
            </MapboxImage>

            <MapboxImage name={NOXA_LOCATION_TRANSPARENT_IMAGE}>
              <View
                collapsable={false}
                style={{
                  width: 2,
                  height: 2,
                  backgroundColor: "transparent",
                }}
              />
            </MapboxImage>
          </Images>

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
              paddingBottom: 260,
              paddingLeft: spacing.xl,
            }}
            followPitch={54}
            followUserLocation={
              followUserLocation && Boolean(driverLocation) && isRouteMode
            }
            followUserMode={UserTrackingMode.FollowWithCourse}
            followZoomLevel={ROUTE_FOLLOW_ZOOM}
            onUserTrackingModeChange={(event) => {
              if (
                followUserLocation &&
                !event.nativeEvent.payload.followUserLocation
              ) {
                onFollowUserLocationChange(false);
              }
            }}
          />

          <LocationPuck
            bearingImage={NOXA_LOCATION_ARROW_IMAGE}
            puckBearing={isRouteMode ? "course" : "heading"}
            puckBearingEnabled
            pulsing={{ color: colors.primary, isEnabled: true, radius: 34 }}
            scale={isRouteMode ? 0.84 : 0.74}
            shadowImage={NOXA_LOCATION_TRANSPARENT_IMAGE}
            topImage={NOXA_LOCATION_TRANSPARENT_IMAGE}
            visible={Boolean(driverLocation)}
          />

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
                    style={[
                      styles.driverMarker,
                      driver.is_relevant && styles.driverMarkerRelevant,
                      driver.is_dimmed && styles.driverMarkerDimmed,
                    ]}
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
                    accessibilityLabel={`${event.title} event`}
                    activeOpacity={0.82}
                    onPress={() => onEventPress(event)}
                    style={styles.eventMarkerPressTarget}
                  >
                    <View
                      style={[
                        styles.markerDot,
                        selectedEvent?.id === event.id && styles.markerDotSelected,
                      ]}
                    >
                      <Ionicons
                        name={eventIconName(event.category)}
                        size={15}
                        color={colors.text}
                      />
                    </View>
                  </TouchableOpacity>
                </MarkerView>
              ))
            : null}
          {routeShape && routeRenderKey ? (
            <ShapeSource
              id="noxa-route-source"
              key={`noxa-route-source:${routeRenderKey}`}
              shape={routeShape}
            >
              <LineLayer
                id="noxa-route-casing"
                style={{
                  lineCap: "round",
                  lineColor: "rgba(18,3,5,0.94)",
                  lineJoin: "round",
                  lineWidth: 12,
                }}
              />
              <LineLayer
                id="noxa-route-line"
                style={{
                  lineCap: "round",
                  lineColor: colors.primary,
                  lineJoin: "round",
                  lineOpacity: 0.98,
                  lineWidth: 6,
                }}
              />
            </ShapeSource>
          ) : null}

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
  driverMarkerRelevant: {
    borderColor: colors.primaryHover,
    transform: [{ scale: 1.08 }],
  },
  driverMarkerDimmed: {
    opacity: 0.38,
    borderColor: colors.borderStrong,
    shadowOpacity: 0.12,
    elevation: 1,
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
  eventMarkerPressTarget: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(17,17,22,0.96)",
    shadowColor: colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  markerDotSelected: {
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: colors.primary,
    shadowColor: colors.primaryHover,
    shadowOpacity: 0.5,
    shadowRadius: 9,
    transform: [{ scale: 1.1 }],
  },
});
