import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  MAPBOX_ACCESS_TOKEN,
  isValidCoordinate,
} from "@/src/features/mapbox/config";
import type { LatLng } from "@/src/features/mapbox/types";
import { colors, radius, spacing } from "@/src/theme";

export type MapPlaceSelection = LatLng & { label: string };

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

type Props = {
  proximity: LatLng | null;
  onSelect: (place: MapPlaceSelection) => void;
};

function createSearchSessionToken() {
  return `noxa-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function suggestionCaption(suggestion: SearchSuggestion) {
  return (
    suggestion.full_address ??
    suggestion.place_formatted ??
    suggestion.feature_type ??
    "Map result"
  );
}

export function MapPlaceSearch({ proximity, onSelect }: Props) {
  const requestRef = useRef(0);
  const sessionTokenRef = useRef(createSearchSessionToken());
  const committedSearchRef = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [retrievingId, setRetrievingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (
      !MAPBOX_ACCESS_TOKEN ||
      trimmed.length < 2 ||
      committedSearchRef.current === trimmed
    ) {
      setSuggestions([]);
      setSearching(false);
      setError(null);
      return;
    }

    const requestId = ++requestRef.current;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: trimmed,
        access_token: MAPBOX_ACCESS_TOKEN,
        session_token: sessionTokenRef.current,
        language: "el,en",
        limit: "4",
      });
      if (isValidCoordinate(proximity)) {
        params.set("proximity", `${proximity.longitude},${proximity.latitude}`);
      }

      setSearching(true);
      setError(null);
      void fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`,
      )
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Search request failed with ${response.status}`);
          }
          return response.json() as Promise<SearchSuggestionResponse>;
        })
        .then((data) => {
          if (requestRef.current !== requestId) return;
          setSuggestions(
            Array.isArray(data.suggestions) ? data.suggestions.slice(0, 4) : [],
          );
        })
        .catch(() => {
          if (requestRef.current !== requestId) return;
          setSuggestions([]);
          setError("Search is unavailable. You can still move the map.");
        })
        .finally(() => {
          if (requestRef.current === requestId) setSearching(false);
        });
    }, 280);

    return () => clearTimeout(timer);
  }, [proximity, query]);

  const onChangeText = useCallback((value: string) => {
    committedSearchRef.current = null;
    setQuery(value);
  }, []);

  const openSuggestion = useCallback(
    async (suggestion: SearchSuggestion) => {
      if (!MAPBOX_ACCESS_TOKEN || retrievingId) return;
      setRetrievingId(suggestion.mapbox_id);
      setError(null);
      try {
        const params = new URLSearchParams({
          access_token: MAPBOX_ACCESS_TOKEN,
          session_token: sessionTokenRef.current,
        });
        const response = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(
            suggestion.mapbox_id,
          )}?${params.toString()}`,
        );
        if (!response.ok) {
          throw new Error(`Search retrieve failed with ${response.status}`);
        }
        const data = (await response.json()) as SearchRetrieveResponse;
        const coordinates = data.features?.[0]?.geometry?.coordinates;
        const coordinate = {
          longitude: Number(coordinates?.[0]),
          latitude: Number(coordinates?.[1]),
        };
        if (!isValidCoordinate(coordinate)) {
          throw new Error("Search result has no valid coordinate");
        }

        const label =
          suggestion.full_address ??
          suggestion.place_formatted ??
          suggestion.name;
        committedSearchRef.current = label.trim();
        setQuery(label);
        setSuggestions([]);
        sessionTokenRef.current = createSearchSessionToken();
        Keyboard.dismiss();
        onSelect({ ...coordinate, label });
      } catch {
        setError("That place could not be opened. Try another result.");
      } finally {
        setRetrievingId(null);
      }
    },
    [onSelect, retrievingId],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.inputShell}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search destination"
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder="Search address or place"
          placeholderTextColor={colors.textSubtle}
          returnKeyType="search"
          selectionColor={colors.primary}
          style={styles.input}
          value={query}
        />
        {searching ? (
          <ActivityIndicator color={colors.textMuted} size="small" />
        ) : query.length ? (
          <Pressable
            accessibilityLabel="Clear destination search"
            hitSlop={8}
            onPress={() => {
              committedSearchRef.current = null;
              setQuery("");
              setSuggestions([]);
              setError(null);
            }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      {suggestions.length ? (
        <View style={styles.results}>
          {suggestions.map((suggestion, index) => (
            <Pressable
              accessibilityRole="button"
              disabled={retrievingId !== null}
              key={suggestion.mapbox_id}
              onPress={() => void openSuggestion(suggestion)}
              style={({ pressed }) => [
                styles.result,
                index < suggestions.length - 1 && styles.resultBorder,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.resultIcon}>
                <Ionicons
                  name="location-outline"
                  size={17}
                  color={colors.textMuted}
                />
              </View>
              <View style={styles.resultCopy}>
                <Text numberOfLines={1} style={styles.resultTitle}>
                  {suggestion.name}
                </Text>
                <Text numberOfLines={1} style={styles.resultCaption}>
                  {suggestionCaption(suggestion)}
                </Text>
              </View>
              {retrievingId === suggestion.mapbox_id ? (
                <ActivityIndicator color={colors.primaryHover} size="small" />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textSubtle}
                />
              )}
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  inputShell: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
  results: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  result: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  resultBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  resultIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  resultCopy: { flex: 1, minWidth: 0 },
  resultTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  resultCaption: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  error: {
    color: colors.primaryHover,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  pressed: { backgroundColor: colors.surfacePressed },
});
