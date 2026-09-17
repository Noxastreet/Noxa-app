import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Platform, Pressable, StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { animations, colors, radius, shadows, spacing } from '@/src/theme';

const minimumTouchTarget = Platform.OS === 'android' ? 48 : 44;

type NoxaIconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'surface' | 'ghost' | 'overlay' | 'danger';
};

export function NoxaIconButton({
  icon,
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  iconSize = 22,
  loading = false,
  onPress,
  size = 44,
  variant = 'surface',
}: NoxaIconButtonProps) {
  const reduceMotion = useReducedMotion();
  const isDisabled = disabled || loading;
  const iconColor = variant === 'danger' ? colors.primaryHover : colors.text;
  const touchTarget = Math.max(size, minimumTouchTarget);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        { width: touchTarget, height: touchTarget },
        pressed && !isDisabled && (reduceMotion ? styles.pressedReduced : styles.pressed),
        isDisabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <Ionicons name={icon} size={iconSize} color={iconColor} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: spacing.xs,
  },
  surface: { backgroundColor: colors.surface, borderColor: colors.border, ...shadows.control },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  overlay: { backgroundColor: colors.glass, borderColor: colors.borderStrong, ...shadows.control },
  danger: { backgroundColor: colors.primarySubtle, borderColor: colors.borderAccent },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: animations.iconPressedScale }],
    backgroundColor: colors.surfacePressed,
  },
  pressedReduced: { opacity: 0.72 },
  disabled: { opacity: 0.44 },
});
