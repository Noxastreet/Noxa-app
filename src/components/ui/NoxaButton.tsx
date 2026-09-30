import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { NoxaCutBackground } from './NoxaSurface';
import { animations, colors, geometry, spacing } from '@/src/theme';

export type NoxaButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'overlay'
  | 'google';
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

function backgroundFor(variant: NoxaButtonVariant) {
  switch (variant) {
    case 'primary':
      return { fill: colors.primary, border: colors.primary };
    case 'secondary':
      return { fill: 'rgba(0,0,0,0)', border: colors.borderStrong };
    case 'danger':
      return { fill: 'rgba(0,0,0,0)', border: colors.borderAccent };
    case 'overlay':
      return { fill: colors.glass, border: colors.borderStrong };
    case 'google':
      return { fill: colors.white, border: '#747775' };
    case 'ghost':
    default:
      return { fill: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)' };
  }
}

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
  const palette = backgroundFor(variant);
  const loadingColor = variant === 'google' ? '#1F1F1F' : colors.text;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // An async action or interrupted gesture can disable the control before press-out.
  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(opacity);
    scale.value = 1;
    opacity.value = 1;
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [isDisabled, opacity, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: reduceMotion ? 1 : scale.value }],
  }));

  const handlePressIn = () => {
    if (isDisabled) return;
    opacity.value = withTiming(
      reduceMotion ? 0.78 : animations.pressOpacity,
      { duration: reduceMotion ? 0 : animations.press },
    );
    scale.value = reduceMotion
      ? 1
      : withSpring(animations.pressedScale, animations.spring.press);
  };

  const handlePressOut = () => {
    opacity.value = withTiming(1, { duration: reduceMotion ? 0 : animations.press });
    scale.value = reduceMotion
      ? 1
      : withSpring(1, animations.spring.press);
  };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.base,
        styles[size],
        fullWidth && styles.fullWidth,
        style,
        isDisabled && styles.disabled,
      ]}>
      <Animated.View
        style={[
          styles.motionLayer,
          styles[`${size}Motion`],
          animatedStyle,
        ]}>
        <NoxaCutBackground
          borderColor={palette.border}
          cut={geometry.cut.sm}
          fill={palette.fill}
        />
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={loadingColor} size="small" style={styles.leadingIcon} />
          ) : leadingIcon ? (
            <View style={styles.leadingIcon}>{leadingIcon}</View>
          ) : null}
          <Text
            numberOfLines={2}
            style={[
              styles.text,
              styles[`${size}Text`],
              styles[`${variant}Text`],
              isDisabled && styles.disabledText,
            ]}>
            {title}
          </Text>
          {!loading && trailingIcon ? <View style={styles.trailingIcon}>{trailingIcon}</View> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
    alignItems: 'stretch',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  sm: { minHeight: geometry.controlHeight.compact },
  md: { minHeight: geometry.controlHeight.standard },
  lg: { minHeight: geometry.controlHeight.primary },
  smMotion: { minHeight: geometry.controlHeight.compact, paddingHorizontal: spacing.sm },
  mdMotion: { minHeight: geometry.controlHeight.standard, paddingHorizontal: spacing.lg },
  lgMotion: { minHeight: geometry.controlHeight.primary, paddingHorizontal: spacing.xl },
  fullWidth: { width: '100%' },
  motionLayer: {
    paddingVertical: spacing.sm,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  leadingIcon: { marginRight: spacing.sm },
  trailingIcon: { marginLeft: spacing.sm },
  disabled: { opacity: 0.42 },
  text: {
    flexShrink: 1,
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  smText: { fontSize: 12, lineHeight: 16 },
  mdText: { fontSize: 14, lineHeight: 20 },
  lgText: { fontSize: 15, lineHeight: 22 },
  primaryText: { color: colors.text },
  secondaryText: { color: colors.text },
  ghostText: { color: colors.textMuted },
  dangerText: { color: colors.textCritical },
  overlayText: { color: colors.text },
  googleText: { color: '#1F1F1F', fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  disabledText: { color: colors.textMuted },
});
