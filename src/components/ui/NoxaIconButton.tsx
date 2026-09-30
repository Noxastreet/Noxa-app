import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { animations, colors, radius, shadows, spacing } from '@/src/theme';

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

  const motionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: reduceMotion ? 1 : scale.value }],
  }));

  const handlePressIn = () => {
    if (isDisabled) return;
    opacity.value = withTiming(
      reduceMotion ? 0.72 : animations.pressOpacity,
      { duration: reduceMotion ? 0 : animations.press },
    );
    scale.value = reduceMotion
      ? 1
      : withSpring(animations.iconPressedScale, animations.spring.press);
  };

  const handlePressOut = () => {
    opacity.value = withTiming(1, { duration: reduceMotion ? 0 : animations.press });
    scale.value = reduceMotion
      ? 1
      : withSpring(1, animations.spring.press);
  };

  const resolvedSize = Math.max(size, 44);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.hitTarget,
        { width: resolvedSize, height: resolvedSize },
        isDisabled && styles.disabled,
      ]}>
      <Animated.View
        style={[
          styles.button,
          styles[variant],
          { width: resolvedSize, height: resolvedSize },
          motionStyle,
        ]}>
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={iconColor} size="small" />
          ) : (
            <Ionicons name={icon} size={iconSize} color={iconColor} />
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: spacing.xs,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  surface: { backgroundColor: colors.surface, borderColor: colors.border, ...shadows.control },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  overlay: { backgroundColor: colors.glass, borderColor: colors.borderStrong, ...shadows.control },
  danger: { backgroundColor: colors.primarySubtle, borderColor: colors.borderAccent },
  disabled: { opacity: 0.44 },
});
