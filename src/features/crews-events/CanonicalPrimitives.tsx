import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";

import { NoxaAvatar, NoxaButton, NoxaCutBackground } from "@/src/components/ui";
import { colors, geometry, radius, spacing, typography } from "@/src/theme";

export type CanonicalProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export function profileName(profile: CanonicalProfile | null | undefined) {
  return profile?.display_name || profile?.username || "Driver";
}

export function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NX"
  );
}

export function CanonicalPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "default" | "accent" | "success";
}) {
  const fill =
    tone === "accent"
      ? colors.primary
      : tone === "success"
        ? colors.successMuted
        : "rgba(6,6,10,0.72)";
  const border =
    tone === "accent"
      ? colors.primary
      : tone === "success"
        ? colors.success
        : colors.borderStrong;

  return (
    <View style={styles.pill}>
      <NoxaCutBackground
        borderColor={border}
        cut={geometry.cut.sm}
        fill={fill}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.pillText,
          (tone === "accent" || tone === "success") && styles.pillTextStrong,
        ]}>
        {label}
      </Text>
    </View>
  );
}

export function CanonicalArtwork({
  uri,
  children,
  style,
  imageStyle,
  icon = "car-sport-outline",
}: {
  uri?: string | null;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (uri && uri !== failedUri) {
    return (
      <ImageBackground
        onError={() => setFailedUri(uri)}
        source={{ uri }}
        resizeMode="cover"
        style={[styles.artwork, style]}
        imageStyle={[styles.artworkImage, imageStyle]}
      >
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.artwork, styles.fallback, style]}>
      <View pointerEvents="none" style={styles.fallbackDecoration}>
        <View style={styles.fallbackRingLarge} />
        <View style={styles.fallbackRingSmall} />
        <View style={styles.fallbackRoad} />
        <View style={styles.fallbackIcon}>
          <Ionicons name={icon} size={58} color={colors.primaryMuted} />
        </View>
      </View>
      {children}
    </View>
  );
}

export function CanonicalAvatar({
  profile,
  size = 34,
}: {
  profile?: CanonicalProfile | null;
  size?: number;
}) {
  return <NoxaAvatar imageUrl={profile?.avatar_url} initials={initials(profileName(profile))} size={size} />;
}

export function CanonicalAvatarStack({
  profiles,
  total,
  max = 3,
  size = 34,
}: {
  profiles?: CanonicalProfile[];
  total?: number;
  max?: number;
  size?: number;
}) {
  const visible = (profiles ?? []).slice(0, max);
  const remaining = Math.max(0, (total ?? visible.length) - visible.length);

  return (
    <View style={styles.avatarStack}>
      {visible.map((profile, index) => (
        <View
          key={profile.id}
          style={[styles.avatarStackItem, index > 0 && { marginLeft: -8 }]}
        >
          <CanonicalAvatar profile={profile} size={size} />
        </View>
      ))}
      {remaining > 0 ? (
        <View
          style={[
            styles.avatarMore,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: visible.length ? -8 : 0,
            },
          ]}
        >
          <Text style={[styles.avatarMoreText, { fontSize: Math.max(9, size * 0.28) }]}>
            +{remaining}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function CanonicalSectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable
          accessibilityRole={onAction ? "button" : undefined}
          disabled={!onAction}
          onPress={onAction}
          style={({ pressed }) => [styles.sectionActionTarget, pressed && styles.pressed]}
        >
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CanonicalPrimaryButton({
  label,
  icon,
  disabled,
  loading,
  onPress,
  variant = "accent",
  compact,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  variant?: "accent" | "surface" | "danger";
  compact?: boolean;
}) {
  if (disabled && label === "YOU'RE HOSTING") return null;

  if (disabled && label === "OWNER") {
    return (
      <View accessibilityLabel="Crew owner" style={styles.ownerStatus}>
        <NoxaCutBackground
          borderColor={colors.border}
          cut={geometry.cut.sm}
          fill="rgba(18,18,24,0.78)"
        />
        <Ionicons name={icon || "shield-checkmark-outline"} size={14} color={colors.textMuted} />
        <Text numberOfLines={1} style={styles.ownerStatusText}>OWNER</Text>
      </View>
    );
  }

  const noxaVariant =
    variant === "surface"
      ? "secondary"
      : variant === "danger"
        ? "danger"
        : "primary";

  return (
    <NoxaButton
      disabled={disabled}
      leadingIcon={icon ? <Ionicons name={icon} size={compact ? 15 : 17} color={colors.text} /> : undefined}
      loading={loading}
      onPress={onPress}
      size={compact ? "sm" : "md"}
      title={label}
      variant={noxaVariant}
    />
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.42 },
  pill: {
    position: "relative",
    minHeight: 26,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    backgroundColor: "transparent",
  },
  pillText: {
    color: colors.text,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  pillTextStrong: { color: colors.text },
  artwork: {
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  artworkImage: {
    borderRadius: 0,
  },
  fallback: {
    position: "relative",
  },
  fallbackDecoration: {
    ...StyleSheet.absoluteFillObject,
  },
  fallbackIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackRingLarge: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 28,
    borderColor: "rgba(200,16,46,0.08)",
    right: -50,
    top: -70,
  },
  fallbackRingSmall: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 14,
    borderColor: "rgba(240,240,244,0.035)",
    left: 28,
    bottom: -20,
  },
  fallbackRoad: {
    position: "absolute",
    width: "120%",
    height: 2,
    bottom: 28,
    backgroundColor: "rgba(240,240,244,0.08)",
    transform: [{ rotate: "-4deg" }],
  },
  avatarImage: {
    borderWidth: 1,
    borderColor: colors.background,
    backgroundColor: colors.surfaceRaised,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.background,
    backgroundColor: colors.surfaceRaised,
  },
  avatarText: {
    color: colors.text,
    fontWeight: "800",
  },
  avatarStack: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarStackItem: {
    borderWidth: 1,
    borderColor: colors.background,
  },
  avatarMore: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.background,
    backgroundColor: colors.surfacePressed,
  },
  avatarMoreText: {
    color: colors.textMuted,
    fontWeight: "800",
  },
  sectionActionTarget: { minWidth: geometry.controlHeight.compact, minHeight: geometry.controlHeight.compact, alignItems: "center", justifyContent: "center" },
  sectionHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.v2.section.fontSize,
    lineHeight: typography.v2.section.lineHeight,
    letterSpacing: typography.v2.section.letterSpacing,
    fontWeight: "900",
  },
  sectionAction: {
    color: colors.textMuted,
    fontSize: typography.v2.label.fontSize,
    lineHeight: typography.v2.label.lineHeight,
    fontWeight: "800",
    letterSpacing: typography.v2.label.letterSpacing,
    textTransform: "uppercase",
  },
  ownerStatus: {
    position: "relative",
    minHeight: 30,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    backgroundColor: "transparent",
  },
  ownerStatusText: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.45,
  },
});
