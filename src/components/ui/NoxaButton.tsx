import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { animations, colors, radius, shadows, spacing } from '@/src/theme';

export type NoxaButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'overlay' | 'google';
export type NoxaButtonSize = 'sm' | 'md' | 'lg';

type NoxaButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: NoxaButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  size?: NoxaButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function NoxaButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  loading = false,
  size = 'lg',
  leadingIcon,
  trailingIcon,
  accessibilityLabel,
  accessibilityHint,
  style,
}: NoxaButtonProps) {
  const isDisabled = disabled || loading;
  const reduceMotion = useReducedMotion();
  const loadingColor = variant === 'google' ? '#1F1F1F' : colors.text;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        fullWidth && styles.fullWidth,
        style,
        pressed && !isDisabled && (reduceMotion ? styles.pressedReduced : styles.pressed),
        isDisabled && styles.disabled,
      ]}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={loadingColor} size="small" style={styles.leadingIcon} />
        ) : leadingIcon ? (
          <View style={styles.leadingIcon}>{leadingIcon}</View>
        ) : null}
        <Text style={[styles.text, styles[`${size}Text`], styles[`${variant}Text`], isDisabled && styles.disabledText]}>
          {title}
        </Text>
        {!loading && trailingIcon ? <View style={styles.trailingIcon}>{trailingIcon}</View> : null}
      </View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingIcon: {
    marginRight: spacing.sm,
  },
  trailingIcon: {
    marginLeft: spacing.sm,
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: colors.primaryMuted, borderColor: colors.borderAccent },
  overlay: { backgroundColor: colors.glass, borderColor: colors.borderStrong, ...shadows.control },
  google: { backgroundColor: '#FFFFFF', borderColor: '#747775' },
  pressed: { opacity: 0.9, transform: [{ translateY: 1 }, { scale: animations.pressedScale }] },
  pressedReduced: { opacity: 0.82 },
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
  googleText: { color: '#1F1F1F', fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  disabledText: { color: colors.textMuted },
});
