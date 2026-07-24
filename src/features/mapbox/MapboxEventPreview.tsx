import Mapbox, { Camera, MapView, MarkerView } from "@rnmapbox/maps";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { colors, radius } from "@/src/theme";

import { MAPBOX_ACCESS_TOKEN, NOXA_MAPBOX_STYLE_URL } from "./config";
import { MapboxStateView } from "./MapboxStateView";
import type { LatLng } from "./types";

if (MAPBOX_ACCESS_TOKEN) Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

export function MapboxEventPreview({ coordinate }: { coordinate: LatLng }) {
  if (!MAPBOX_ACCESS_TOKEN) return <MapboxStateView title="Mapbox token missing" />;
  return (
    <MapView attributionEnabled={false} compassEnabled={false} logoEnabled={false} pitchEnabled={false} pointerEvents="none" rotateEnabled={false} scaleBarEnabled={false} scrollEnabled={false} style={StyleSheet.absoluteFillObject} styleURL={NOXA_MAPBOX_STYLE_URL} zoomEnabled={false}>
      <Camera defaultSettings={{ centerCoordinate: [coordinate.longitude, coordinate.latitude], zoomLevel: 14 }} />
      <MarkerView coordinate={[coordinate.longitude, coordinate.latitude]}>
        <View style={styles.marker}><Ionicons name="flag" size={13} color={colors.text} /></View>
      </MarkerView>
    </MapView>
  );
}

const styles = StyleSheet.create({
  marker: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 2, borderColor: colors.text, backgroundColor: colors.primary },
});
