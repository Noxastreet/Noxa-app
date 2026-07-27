import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NoxaButton } from "@/src/components/ui";
import { colors, radius, spacing, typography } from "@/src/theme";

export function CrewModuleHeader({
  badge,
  right,
  subtitle,
  title,
}: {
  badge?: string;
  right?: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={21} color={colors.text} />
      </Pressable>
      <View style={styles.headerCopy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
          {badge ? (
            <View style={styles.privateBadge}>
              <Ionicons name="lock-closed" size={9} color={colors.primaryHover} />
              <Text style={styles.privateText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function CrewModuleIconButton({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function CrewModuleState({
  actionLabel,
  icon,
  loading,
  message,
  onAction,
  title,
}: {
  actionLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  message: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons name={icon} size={30} color={colors.primaryHover} />
        )}
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
      {actionLabel && onAction ? (
        <NoxaButton onPress={onAction} size="md" title={actionLabel} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surfaceBase,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  headerTitle: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  headerRight: { minWidth: 40, alignItems: "flex-end" },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  privateText: {
    color: colors.primaryHover,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.55,
  },
  state: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateIcon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  stateText: {
    maxWidth: 290,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
});
