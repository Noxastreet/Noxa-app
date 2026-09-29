import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

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

export function NoxaSegmentedControl<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: NoxaSegmentedControlProps<T>) {
  const reduceMotion = useReducedMotion();

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
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && (reduceMotion ? styles.pressedReduced : styles.pressed),
            ]}>
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
          </Pressable>
        );
      })}
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
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  segmentSelected: {
    backgroundColor: colors.surfaceRaised,
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
  pressed: { opacity: 0.82, transform: [{ scale: animations.pressedScale }] },
  pressedReduced: { opacity: 0.68 },
});
