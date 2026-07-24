import Mapbox, { Camera, MapView, type MapState } from "@rnmapbox/maps";
import { Ionicons } from "@expo/vector-icons";
import { type ElementRef, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, shadows, spacing } from "@/src/theme";

import type { EventLocationPickerProps } from "./EventLocationPicker.types";
import { MAPBOX_ACCESS_TOKEN, NOXA_MAPBOX_DEFAULT_ZOOM, NOXA_MAPBOX_STYLE_URL, isValidCoordinate } from "./config";
import { MapboxStateView } from "./MapboxStateView";
import type { LatLng } from "./types";

if (MAPBOX_ACCESS_TOKEN) Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

function coordinateFromState(state: MapState): LatLng | null {
  const center = state.properties?.center;
  const coordinate = { longitude: Number(center?.[0]), latitude: Number(center?.[1]) };
  return isValidCoordinate(coordinate) ? coordinate : null;
}

export function MapboxEventLocationPicker({ initialCoordinate, isLocating, onCancel, onConfirm, onUseCurrentLocation }: EventLocationPickerProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<ElementRef<typeof Camera> | null>(null);
  const [selected, setSelected] = useState<LatLng | null>(isValidCoordinate(initialCoordinate) ? initialCoordinate : null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!isValidCoordinate(initialCoordinate)) return;
    setSelected(initialCoordinate);
    cameraRef.current?.setCamera({ centerCoordinate: [initialCoordinate.longitude, initialCoordinate.latitude], zoomLevel: NOXA_MAPBOX_DEFAULT_ZOOM, animationDuration: 450, animationMode: "easeTo" });
  }, [initialCoordinate]);

  const handleMapIdle = useCallback((state: MapState) => {
    const coordinate = coordinateFromState(state);
    if (coordinate) setSelected(coordinate);
  }, []);

  if (!MAPBOX_ACCESS_TOKEN) {
    return <View style={styles.screen}><MapboxStateView title="Mapbox token missing" message="Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN for the native map runtime." /><PickerHeader top={insets.top + spacing.md} onCancel={onCancel} /></View>;
  }

  const confirmDisabled = !selected || isLocating || hasError || !isLoaded;
  return (
    <View style={styles.screen}>
      <MapView
        attributionEnabled attributionPosition={{ bottom: insets.bottom + 140, left: 8 }}
        compassEnabled={false} logoEnabled logoPosition={{ bottom: insets.bottom + 140, right: 8 }}
        onDidFinishLoadingMap={() => { setHasError(false); setIsLoaded(true); }}
        onMapIdle={handleMapIdle}
        onMapLoadingError={() => { setHasError(true); setIsLoaded(false); }}
        pitchEnabled={false} rotateEnabled={false} scaleBarEnabled={false}
        style={StyleSheet.absoluteFillObject} styleURL={NOXA_MAPBOX_STYLE_URL}
      >
        <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: [initialCoordinate.longitude, initialCoordinate.latitude], zoomLevel: NOXA_MAPBOX_DEFAULT_ZOOM }} />
      </MapView>
      {!isLoaded && !hasError ? <MapboxStateView loading /> : null}
      {hasError ? <MapboxStateView /> : null}
      {!hasError ? (
        <View pointerEvents="none" style={styles.centerPin}>
          <View style={styles.pinHalo} />
          <View style={styles.pinHead}><Ionicons name="location" size={21} color={colors.text} /></View>
          <View style={styles.pinStem} />
        </View>
      ) : null}
      <PickerHeader top={insets.top + spacing.md} onCancel={onCancel} />
      <View style={[styles.footer, { bottom: insets.bottom + spacing.md }]}>
        <Pressable disabled={isLocating || hasError} onPress={onUseCurrentLocation} style={({ pressed }) => [styles.locateButton, pressed && styles.pressed, (isLocating || hasError) && styles.disabled]}>
          {isLocating ? <ActivityIndicator color={colors.primaryHover} size="small" /> : <Ionicons name="navigate" size={16} color={colors.primaryHover} />}
          <Text style={styles.locateText}>{isLocating ? "Locating…" : "Use Current Location"}</Text>
        </Pressable>
        <Pressable disabled={confirmDisabled} onPress={() => selected && onConfirm(selected)} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed, confirmDisabled && styles.disabled]}>
          <Text style={styles.confirmText}>Confirm Location</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PickerHeader({ top, onCancel }: { top: number; onCancel: () => void }) {
  return <View style={[styles.header, { top }]}><Pressable onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Text style={styles.title}>Exact event location</Text><View style={styles.headerSpacer} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { position: "absolute", left: spacing.md, right: spacing.md, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(10,12,16,0.92)", ...shadows.card },
  cancelText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  title: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "900", textAlign: "center" },
  headerSpacer: { width: 43 },
  centerPin: { position: "absolute", left: "50%", top: "50%", width: 44, height: 58, alignItems: "center", marginLeft: -22, marginTop: -44 },
  pinHalo: { position: "absolute", top: 2, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(200,16,46,0.20)" },
  pinHead: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 3, borderColor: colors.text, backgroundColor: colors.primary },
  pinStem: { width: 3, height: 14, backgroundColor: colors.text },
  footer: { position: "absolute", left: spacing.md, right: spacing.md, gap: spacing.sm, padding: spacing.sm, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(10,12,16,0.94)", ...shadows.card },
  locateButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderAccent, backgroundColor: colors.primaryMuted },
  locateText: { color: colors.primaryHover, fontSize: 12, fontWeight: "900" },
  confirmButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.primary },
  confirmText: { color: colors.text, fontSize: 13, fontWeight: "900", letterSpacing: 0.4 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.48 },
});
