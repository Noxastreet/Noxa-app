import Mapbox, { Camera, MapView, type MapState } from "@rnmapbox/maps";
import { Ionicons } from "@expo/vector-icons";
import { type ElementRef, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NoxaInput, NoxaListRow } from "@/src/components/ui";
import { colors, radius, shadows, spacing } from "@/src/theme";

import type { EventLocationPickerProps } from "./EventLocationPicker.types";
import { MAPBOX_ACCESS_TOKEN, NOXA_MAPBOX_DEFAULT_ZOOM, NOXA_MAPBOX_STYLE_URL, isValidCoordinate } from "./config";
import { MapboxStateView } from "./MapboxStateView";
import type { LatLng } from "./types";

if (MAPBOX_ACCESS_TOKEN) Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

type SearchSuggestion = {
  feature_type?: string;
  full_address?: string;
  mapbox_id: string;
  name: string;
  place_formatted?: string;
};

type SearchSuggestionResponse = {
  suggestions?: SearchSuggestion[];
};

type SearchRetrieveResponse = {
  features?: Array<{
    geometry?: { coordinates?: number[] };
  }>;
};

function coordinateFromState(state: MapState): LatLng | null {
  const center = state.properties?.center;
  const coordinate = { longitude: Number(center?.[0]), latitude: Number(center?.[1]) };
  return isValidCoordinate(coordinate) ? coordinate : null;
}

function createSearchSessionToken() {
  return `noxa-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function suggestionCaption(suggestion: SearchSuggestion) {
  return suggestion.full_address ?? suggestion.place_formatted ?? suggestion.feature_type ?? "Map result";
}

export function MapboxEventLocationPicker({ confirmLabel = "Confirm Location", headerTitle = "Exact event location", initialCoordinate, isLocating, onCancel, onConfirm, onUseCurrentLocation }: EventLocationPickerProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<ElementRef<typeof Camera> | null>(null);
  const searchRequestRef = useRef(0);
  const searchSessionTokenRef = useRef(createSearchSessionToken());
  const committedSearchRef = useRef<string | null>(null);
  const [selected, setSelected] = useState<LatLng | null>(isValidCoordinate(initialCoordinate) ? initialCoordinate : null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [retrievingId, setRetrievingId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isValidCoordinate(initialCoordinate)) return;
    setSelected(initialCoordinate);
    cameraRef.current?.setCamera({ centerCoordinate: [initialCoordinate.longitude, initialCoordinate.latitude], zoomLevel: NOXA_MAPBOX_DEFAULT_ZOOM, animationDuration: 450, animationMode: "easeTo" });
  }, [initialCoordinate]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!MAPBOX_ACCESS_TOKEN || query.length < 2 || committedSearchRef.current === query) {
      setSearchSuggestions([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const requestId = ++searchRequestRef.current;
    const timer = setTimeout(() => {
      const proximity = selected ?? initialCoordinate;
      const params = new URLSearchParams({
        q: query,
        access_token: MAPBOX_ACCESS_TOKEN,
        session_token: searchSessionTokenRef.current,
        language: "el,en",
        limit: "4",
      });
      if (isValidCoordinate(proximity)) {
        params.set("proximity", `${proximity.longitude},${proximity.latitude}`);
      }

      setIsSearching(true);
      setSearchError(null);
      void fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Search request failed with ${response.status}`);
          return response.json() as Promise<SearchSuggestionResponse>;
        })
        .then((data) => {
          if (searchRequestRef.current !== requestId) return;
          setSearchSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 4) : []);
        })
        .catch(() => {
          if (searchRequestRef.current !== requestId) return;
          setSearchSuggestions([]);
          setSearchError("Search is unavailable right now. You can still place the pin manually.");
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) setIsSearching(false);
        });
    }, 320);

    return () => clearTimeout(timer);
  }, [initialCoordinate, searchQuery, selected]);

  const handleMapIdle = useCallback((state: MapState) => {
    const coordinate = coordinateFromState(state);
    if (coordinate) setSelected(coordinate);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    committedSearchRef.current = null;
    setSearchQuery(value);
  }, []);

  const handleSuggestionPress = useCallback(async (suggestion: SearchSuggestion) => {
    if (!MAPBOX_ACCESS_TOKEN || retrievingId) return;
    setRetrievingId(suggestion.mapbox_id);
    setSearchError(null);
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_ACCESS_TOKEN,
        session_token: searchSessionTokenRef.current,
      });
      const response = await fetch(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(suggestion.mapbox_id)}?${params.toString()}`);
      if (!response.ok) throw new Error(`Search retrieve failed with ${response.status}`);
      const data = await response.json() as SearchRetrieveResponse;
      const coordinates = data.features?.[0]?.geometry?.coordinates;
      const coordinate = {
        longitude: Number(coordinates?.[0]),
        latitude: Number(coordinates?.[1]),
      };
      if (!isValidCoordinate(coordinate)) throw new Error("Search result has no valid coordinate");

      const displayLabel = suggestion.full_address ?? suggestion.name;
      committedSearchRef.current = displayLabel.trim();
      setSearchQuery(displayLabel);
      setSearchSuggestions([]);
      setSelected(coordinate);
      cameraRef.current?.setCamera({
        centerCoordinate: [coordinate.longitude, coordinate.latitude],
        zoomLevel: NOXA_MAPBOX_DEFAULT_ZOOM,
        animationDuration: 520,
        animationMode: "easeTo",
      });
      searchSessionTokenRef.current = createSearchSessionToken();
      Keyboard.dismiss();
    } catch {
      setSearchError("That place could not be opened. Try another result or place the pin manually.");
    } finally {
      setRetrievingId(null);
    }
  }, [retrievingId]);

  if (!MAPBOX_ACCESS_TOKEN) {
    return <View style={styles.screen}><MapboxStateView title="Mapbox token missing" message="Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN for the native map runtime." /><PickerHeader title={headerTitle} top={insets.top + spacing.md} onCancel={onCancel} /></View>;
  }

  const confirmDisabled = !selected || isLocating || hasError || !isLoaded || retrievingId !== null;
  const headerTop = insets.top + spacing.md;
  const searchTop = headerTop + 48 + spacing.sm;

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
      <PickerHeader title={headerTitle} top={headerTop} onCancel={onCancel} />
      {!hasError ? (
        <View style={[styles.searchOverlay, { top: searchTop }]}>
          <NoxaInput
            accessibilityLabel="Search address or place"
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={handleSearchChange}
            placeholder="Search address or place"
            returnKeyType="search"
            value={searchQuery}
            trailing={
              <View style={styles.searchTrailing}>
                {isSearching ? <ActivityIndicator color={colors.textMuted} size="small" /> : <Ionicons name="search" size={18} color={colors.textMuted} />}
              </View>
            }
          />
          {searchSuggestions.length > 0 ? (
            <View style={styles.searchResults}>
              {searchSuggestions.map((suggestion, index) => (
                <NoxaListRow
                  caption={suggestionCaption(suggestion)}
                  disabled={retrievingId !== null}
                  icon="location-outline"
                  isLast={index === searchSuggestions.length - 1}
                  key={suggestion.mapbox_id}
                  label={suggestion.name}
                  onPress={() => void handleSuggestionPress(suggestion)}
                  value={retrievingId === suggestion.mapbox_id ? "Opening…" : undefined}
                />
              ))}
            </View>
          ) : null}
          {searchError ? <Text accessibilityRole="alert" style={styles.searchError}>{searchError}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.footer, { bottom: insets.bottom + spacing.md }]}>
        <Pressable disabled={isLocating || hasError} onPress={onUseCurrentLocation} style={({ pressed }) => [styles.locateButton, pressed && styles.pressed, (isLocating || hasError) && styles.disabled]}>
          {isLocating ? <ActivityIndicator color={colors.primaryHover} size="small" /> : <Ionicons name="navigate" size={16} color={colors.primaryHover} />}
          <Text style={styles.locateText}>{isLocating ? "Locating…" : "Use Current Location"}</Text>
        </Pressable>
        <Pressable disabled={confirmDisabled} onPress={() => selected && onConfirm(selected)} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed, confirmDisabled && styles.disabled]}>
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PickerHeader({ title, top, onCancel }: { title: string; top: number; onCancel: () => void }) {
  return <View style={[styles.header, { top }]}><Pressable accessibilityRole="button" hitSlop={8} onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Text style={styles.title}>{title}</Text><View style={styles.headerSpacer} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { position: "absolute", zIndex: 5, left: spacing.md, right: spacing.md, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(10,12,16,0.92)", ...shadows.card },
  cancelText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  title: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "900", textAlign: "center" },
  headerSpacer: { width: 43 },
  searchOverlay: { position: "absolute", zIndex: 6, left: spacing.md, right: spacing.md, gap: spacing.xs },
  searchTrailing: { width: 44, minHeight: 54, alignItems: "center", justifyContent: "center" },
  searchResults: { maxHeight: 276, overflow: "hidden", borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(10,12,16,0.97)", ...shadows.card },
  searchError: { paddingHorizontal: spacing.xs, color: colors.primaryHover, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  centerPin: { position: "absolute", left: "50%", top: "50%", width: 44, height: 58, alignItems: "center", marginLeft: -22, marginTop: -44 },
  pinHalo: { position: "absolute", top: 2, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(200,16,46,0.20)" },
  pinHead: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 3, borderColor: colors.text, backgroundColor: colors.primary },
  pinStem: { width: 3, height: 14, backgroundColor: colors.text },
  footer: { position: "absolute", zIndex: 4, left: spacing.md, right: spacing.md, gap: spacing.sm, padding: spacing.sm, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(10,12,16,0.94)", ...shadows.card },
  locateButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderAccent, backgroundColor: colors.primaryMuted },
  locateText: { color: colors.primaryHover, fontSize: 12, fontWeight: "900" },
  confirmButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.primary },
  confirmText: { color: colors.text, fontSize: 13, fontWeight: "900", letterSpacing: 0.4 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.48 },
});
