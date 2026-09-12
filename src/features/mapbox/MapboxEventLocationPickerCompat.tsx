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
    : runtime === "expo-go"
      ? {
          title: "Location picker unavailable in Expo Go",
          message: "Use a NOXA development or production build to load the native Mapbox picker.",
        }
      : runtime === "web"
        ? {
            title: "Location picker unavailable on web",
            message: "The native location picker is available in the iOS and Android app.",
          }
        : {
            title: "Location picker failed to load",
            message: "The native Mapbox module could not be initialized in this build.",
          };

  return (
    <View style={styles.screen}>
      <MapboxStateView {...state} />
      <Pressable onPress={props.onCancel} style={[styles.cancel, { top: insets.top + spacing.md }]}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  cancel: { position: "absolute", left: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(10,12,16,0.92)" },
  cancelText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
});
