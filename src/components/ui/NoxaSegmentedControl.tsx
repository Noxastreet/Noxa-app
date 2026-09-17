import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { animations, colors, radius, spacing } from '@/src/theme';

const minimumTouchTarget = Platform.OS === 'android' ? 48 : 44;

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
    minHeight: minimumTouchTarget + spacing.xxs * 2,
    flexDirection: 'row',
    padding: spacing.xxs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segment: {
    minHeight: minimumTouchTarget,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  segmentSelected: { backgroundColor: colors.surfacePressed },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  labelSelected: { color: colors.text, fontWeight: '800' },
  pressed: { opacity: 0.82, transform: [{ scale: animations.pressedScale }] },
  pressedReduced: { opacity: 0.68 },
});
