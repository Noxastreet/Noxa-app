import { type ComponentType, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/src/theme";

import type { EventLocationPickerProps } from "./EventLocationPicker.types";
import { MapboxStateView } from "./MapboxStateView";
import { getMapboxRuntime } from "./native";

export function MapboxEventLocationPickerCompat(props: EventLocationPickerProps) {
  const insets = useSafeAreaInsets();
  const [Picker, setPicker] = useState<ComponentType<EventLocationPickerProps> | null>(null);
  const [runtime] = useState(getMapboxRuntime);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (runtime !== "native") return undefined;

    import("./MapboxEventLocationPicker")
      .then((module) => mounted && setPicker(() => module.MapboxEventLocationPicker))
      .catch((error) => {
        if (mounted) {
          console.error("[noxa-mapbox] Failed to load MapboxEventLocationPicker.", error);
          setLoadFailed(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [runtime]);

  if (Picker) return <Picker {...props} />;

  const state = runtime === "native" && !loadFailed
    ? { loading: true }
    : runtime === "web"
      ? {
          title: "Location picker unavailable",
          message: "Open NOXA in the iOS or Android app to choose a map location.",
        }
      : runtime === "expo-go"
        ? {
            title: "Location picker unavailable",
            message: "Open NOXA in a development or production build to choose a map location.",
          }
        : {
            title: "Location picker unavailable",
            message: "The location picker could not load. Restart NOXA and try again.",
          };

  return (
    <View style={styles.screen}>
      <MapboxStateView {...state} />
      <Pressable
        accessibilityLabel="Cancel location selection"
        accessibilityRole="button"
        onPress={props.onCancel}
        style={({ pressed }) => [
          styles.cancel,
          { top: insets.top + spacing.md },
          pressed && styles.cancelPressed,
        ]}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  cancel: {
    position: "absolute",
    left: spacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(10,12,16,0.92)",
  },
  cancelPressed: { opacity: 0.82 },
  cancelText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
});