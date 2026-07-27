import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/src/theme";

export function MapboxStateView({ loading = false, title, message }: {
  loading?: boolean;
  title?: string;
  message?: string;
}) {
  if (loading) {
    return <View style={styles.stateView}><ActivityIndicator color={colors.primary} size="small" /></View>;
  }
  return (
    <View style={styles.fallback}>
      <View style={styles.fallbackCard}>
        <View style={styles.iconFrame}><Ionicons name="map" size={24} color={colors.primaryHover} /></View>
        <Text style={styles.title}>{title ?? "Map unavailable"}</Text>
        <Text style={styles.body}>{message ?? "Check the Mapbox token and native build configuration."}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stateView: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background },
  fallbackCard: { width: "100%", maxWidth: 320, alignItems: "center", padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: "rgba(12,12,16,0.92)" },
  iconFrame: { width: 46, height: 46, alignItems: "center", justifyContent: "center", marginBottom: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderAccent, backgroundColor: "rgba(200,16,46,0.16)" },
  title: { color: colors.text, fontSize: 14, fontWeight: "800", textAlign: "center" },
  body: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: "center" },
});
