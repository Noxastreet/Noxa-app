import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, spacing } from '@/src/theme';

import { pickerMotion } from '../motion';

type PickerCardFrameProps = {
  accessibilityLabel: string;
  children: ReactNode;
  compact?: boolean;
  motionKey: string;
  onPress: () => void;
  selected?: boolean;
};

/**
 * Private visual primitive only.
 * Semantic vehicle picker cards stay separate so each can own future motion.
 */
export function PickerCardFrame({
  accessibilityLabel,
  children,
  compact = false,
  motionKey,
  onPress,
  selected = false,
}: PickerCardFrameProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressIn = () => {
    scale.value = withTiming(0.985, { duration: pickerMotion.pressInMs });
  };

  const pressOut = () => {
    scale.value = withSpring(1, {
      damping: pickerMotion.pressOutDamping,
      stiffness: pickerMotion.pressOutStiffness,
    });
  };

  return (
    <Animated.View
      entering={pickerMotion.cardEnter}
      layout={pickerMotion.layout}
      style={animatedStyle}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        nativeID={motionKey}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={({ pressed }) => [
          styles.card,
          compact ? styles.compact : styles.regular,
          selected && styles.selected,
          pressed && styles.pressed,
        ]}>
        <View pointerEvents="none" style={styles.content}>
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  regular: {
    minHeight: 72,
    paddingVertical: spacing.sm,
  },
  compact: {
    minHeight: 54,
    paddingVertical: spacing.sm,
  },
  selected: {
    borderBottomColor: colors.borderStrong,
    backgroundColor: colors.primarySubtle,
  },
  pressed: {
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
});