import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Image, ImageBackground, Pressable, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, spacing, typography } from "@/src/theme";

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
  tone?: "neutral" | "accent" | "success";
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === "accent" && styles.pillAccent,
        tone === "success" && styles.pillSuccess,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === "accent" && styles.pillTextStrong,
          tone === "success" && styles.pillTextStrong,
        ]}
      >
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
  if (uri) {
    return (
      <ImageBackground
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
      <View style={styles.fallbackRingLarge} />
      <View style={styles.fallbackRingSmall} />
      <View style={styles.fallbackRoad} />
      <Ionicons name={icon} size={58} color={colors.primaryMuted} />
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
  const name = profileName(profile);
  if (profile?.avatar_url) {
    return (
      <Image
        source={{ uri: profile.avatar_url }}
        style={[
          styles.avatarImage,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: Math.max(9, size * 0.28) }]}>
        {initials(name)}
      </Text>
    </View>
  );
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
      {!visible.length ? (
        <>
          {["AK", "N", "PM"].slice(0, max).map((label, index) => (
            <View
              key={label}
              style={[
                styles.avatarFallback,
                styles.avatarStackItem,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  marginLeft: index > 0 ? -8 : 0,
                },
              ]}
            >
              <Text style={[styles.avatarText, { fontSize: Math.max(9, size * 0.28) }]}>
                {label}
              </Text>
            </View>
          ))}
        </>
      ) : null}
      {remaining > 0 ? (
        <View
          style={[
            styles.avatarMore,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -8,
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
          style={({ pressed }) => pressed && styles.pressed}
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
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        compact && styles.primaryButtonCompact,
        variant === "surface" && styles.primaryButtonSurface,
        variant === "danger" && styles.primaryButtonDanger,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={compact ? 15 : 17}
          color={colors.text}
        />
      ) : null}
      <Text style={[styles.primaryButtonText, compact && styles.primaryButtonTextCompact]}>
        {loading ? "PLEASE WAIT…" : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.42 },
  pill: {
    minHeight: 24,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(6,6,10,0.62)",
  },
  pillAccent: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  pillSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successMuted,
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
    borderRadius: radius.hero,
  },
  fallback: {
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
  sectionHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  sectionAction: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  primaryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  primaryButtonCompact: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  primaryButtonSurface: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  primaryButtonDanger: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  primaryButtonTextCompact: {
    fontSize: 11,
  },
});
