import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  NoxaButton,
  NoxaIconButton,
  NoxaTopBar,
} from "@/src/components/ui";
import { colors, spacing, typography } from "@/src/theme";

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
  const context = [subtitle, badge ? badge.toLowerCase() : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <NoxaTopBar
      left={
        <NoxaIconButton
          accessibilityLabel="Go back"
          icon="chevron-back"
          onPress={() => router.back()}
          variant="ghost"
        />
      }
      right={right}
      subtitle={context}
      title={title}
    />
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
    <NoxaIconButton
      accessibilityLabel={label}
      disabled={disabled}
      icon={icon}
      onPress={onPress}
      variant="ghost"
    />
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
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons name={icon} size={30} color={colors.textMuted} />
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
      {actionLabel && onAction ? (
        <NoxaButton onPress={onAction} size="md" title={actionLabel} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: "800",
    textAlign: "center",
  },
  stateText: {
    maxWidth: 290,
    color: colors.textMuted,
    ...typography.v2.body,
    textAlign: "center",
  },
});
