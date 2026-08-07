import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';
import type { VehicleColorOption } from '../vehicleColors';

type ColorCardProps = {
  color: VehicleColorOption;
  onPress: () => void;
  selected: boolean;
};

export function ColorCard({ color, onPress, selected }: ColorCardProps) {
  const motionKey = `vehicle-picker:color:${color.id}`;

  return (
    <Pressable
      accessibilityLabel={`Select ${color.name}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      testID={motionKey}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}>
      <View style={[styles.swatchRing, selected && styles.swatchRingSelected]}>
        <View style={[styles.swatch, { backgroundColor: color.hex }]} />
      </View>
      <Text numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>{color.name}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.primaryHover} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  swatchRing: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  swatchRingSelected: {
    borderColor: colors.primaryHover,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  label: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '800',
  },
  labelSelected: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
