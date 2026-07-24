import { Pressable, StyleSheet, Text } from 'react-native';

import { animations, colors, radius, shadows, spacing } from '@/src/theme';

type NoxaButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'overlay';
type NoxaButtonSize = 'sm' | 'md' | 'lg';

type NoxaButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: NoxaButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  size?: NoxaButtonSize;
};

export function NoxaButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  loading = false,
  size = 'lg',
}: NoxaButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}>
      <Text style={[styles.text, styles[`${size}Text`], styles[`${variant}Text`], isDisabled && styles.disabledText]}>
        {loading ? 'Loading…' : title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sm: { minHeight: 32, paddingHorizontal: spacing.sm },
  md: { minHeight: 44, paddingHorizontal: spacing.lg },
  lg: { minHeight: 54, paddingHorizontal: spacing.xl },
  fullWidth: { width: '100%' },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: colors.primaryMuted, borderColor: colors.borderAccent },
  overlay: { backgroundColor: colors.glass, borderColor: colors.borderStrong, ...shadows.control },
  pressed: { opacity: 0.9, transform: [{ translateY: 1 }, { scale: animations.pressedScale }] },
  disabled: { opacity: 0.45 },
  text: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  smText: { fontSize: 12, lineHeight: 16 },
  mdText: { fontSize: 14, lineHeight: 20 },
  lgText: { fontSize: 15, lineHeight: 22 },
  primaryText: { color: colors.text },
  secondaryText: { color: colors.text },
  ghostText: { color: colors.textMuted },
  dangerText: { color: colors.primaryHover },
  overlayText: { color: colors.text },
  disabledText: { color: colors.textMuted },
});
