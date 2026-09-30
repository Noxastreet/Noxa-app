import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { NoxaCutBackground } from './NoxaSurface';
import { animations, colors, geometry, spacing, typography } from '@/src/theme';

type SegmentOption<T extends string> = {
  label: string;
  value: T;
  count?: number;
};

type NoxaSegmentedControlProps<T extends string> = {
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  value: T;
};

type SegmentItemProps<T extends string> = {
  onChange: (value: T) => void;
  option: SegmentOption<T>;
  selected: boolean;
};

function SegmentItem<T extends string>({
  onChange,
  option,
  selected,
}: SegmentItemProps<T>) {
  const reduceMotion = useReducedMotion();
  const selectedProgress = useSharedValue(selected ? 1 : 0);
  const pressProgress = useSharedValue(0);

  useEffect(() => {
    selectedProgress.value = reduceMotion
      ? selected ? 1 : 0
      : withSpring(selected ? 1 : 0, animations.spring.surface);
  }, [reduceMotion, selected, selectedProgress]);

  const selectionMotion = useAnimatedStyle(() => ({
    opacity: selectedProgress.value,
    transform: [
      { scale: interpolate(selectedProgress.value, [0, 1], [0.965, 1]) },
    ],
  }));

  const contentMotion = useAnimatedStyle(() => ({
    transform: [
      {
        scale: reduceMotion ? 1 : interpolate(
          pressProgress.value,
          [0, 1],
          [1, animations.pressedScale],
        ),
      },
    ],
  }));

  const handlePressIn = () => {
    pressProgress.value = reduceMotion
      ? 1
      : withSpring(1, animations.spring.press);
  };

  const handlePressOut = () => {
    pressProgress.value = reduceMotion
      ? 0
      : withSpring(0, animations.spring.press);
  };

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={() => onChange(option.value)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.segment}>
      <Animated.View pointerEvents="none" style={[styles.selectionLayer, selectionMotion]}>
        <NoxaCutBackground
          borderColor={colors.borderStrong}
          cut={geometry.cut.sm}
          fill={colors.surfaceRaised}
        />
      </Animated.View>

      <Animated.View style={[styles.segmentContent, contentMotion]}>
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {option.label}
        </Text>
        {typeof option.count === 'number' ? (
          <View style={[styles.count, selected && styles.countSelected]}>
            <Text style={[styles.countText, selected && styles.countTextSelected]}>
              {option.count}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function NoxaSegmentedControl<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: NoxaSegmentedControlProps<T>) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={styles.control}>
      <NoxaCutBackground
        borderColor={colors.border}
        cut={geometry.cut.md}
        fill={colors.surfaceBase}
      />
      {options.map((option) => (
        <SegmentItem
          key={option.value}
          onChange={onChange}
          option={option}
          selected={option.value === value}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    position: 'relative',
    minHeight: 52,
    flexDirection: 'row',
    padding: spacing.xxs,
    gap: spacing.xxs,
  },
  segment: {
    position: 'relative',
    minHeight: 44,
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  selectionLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  segmentContent: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.v2.label.fontSize,
    lineHeight: typography.v2.label.lineHeight,
    letterSpacing: 0.8,
    fontWeight: '900',
  },
  labelSelected: { color: colors.text },
  count: {
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
    borderRadius: 11,
    backgroundColor: colors.surfacePressed,
  },
  countSelected: { backgroundColor: colors.primaryMuted },
  countText: { color: colors.textSubtle, fontSize: 9, fontWeight: '900' },
  countTextSelected: { color: colors.text },
});
