import { type ComponentType, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/src/theme";

import type { EventLocationPickerProps } from "./EventLocationPicker.types";
import { MapboxStateView } from "./MapboxStateView";
import { hasMapboxNativeModule } from "./native";

export function MapboxEventLocationPickerCompat(props: EventLocationPickerProps) {
  const insets = useSafeAreaInsets();
  const [Picker, setPicker] = useState<ComponentType<EventLocationPickerProps> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const canUseMapbox = hasMapboxNativeModule();

  useEffect(() => {
    let mounted = true;
    if (!canUseMapbox) return undefined;
    import("./MapboxEventLocationPicker")
      .then((module) => mounted && setPicker(() => module.MapboxEventLocationPicker))
      .catch(() => mounted && setLoadFailed(true));
    return () => { mounted = false; };
  }, [canUseMapbox]);

  if (Picker) return <Picker {...props} />;
  return (
    <View style={styles.screen}>
      <MapboxStateView
        loading={canUseMapbox && !loadFailed}
        title="Mapbox native module unavailable"
        message="Rebuild the NOXA development client to use the event location picker. Expo Go cannot load the native Mapbox module."
      />
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
