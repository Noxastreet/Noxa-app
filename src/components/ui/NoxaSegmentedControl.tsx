import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { animations, colors, radius, spacing, typography } from '@/src/theme';

type SegmentOption<T extends string> = {
  label: string;
  value: T;
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
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="tablist" style={styles.control}>
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
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    minHeight: 48,
    flexDirection: 'row',
    padding: spacing.xxs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segment: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  segmentSelected: { backgroundColor: colors.surfacePressed },
  label: { ...typography.roles.secondary, fontFamily: typography.fontFamily.body, textAlign: 'center', color: colors.textMuted, fontWeight: '500' },
  labelSelected: { color: colors.text, fontWeight: '600' },
  pressed: { opacity: 0.82, transform: [{ scale: animations.pressedScale }] },
  pressedReduced: { opacity: 0.68 },
});
