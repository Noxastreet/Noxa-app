import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, spacing } from '@/src/theme';
import type { VehicleColorOption } from '../vehicleColors';
import { pickerMotion } from '../motion';

type ColorCardProps = {
  color: VehicleColorOption;
  onPress: () => void;
  selected: boolean;
};

export function ColorCard({ color, onPress, selected }: ColorCardProps) {
  const motionKey = `vehicle-picker:color:${color.id}`;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressIn = () => {
    scale.value = withTiming(0.985, { duration: pickerMotion.pressInMs });
  };

  const pressOut = () => {
    scale.value = withSpring(selected ? 1.01 : 1, {
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
        accessibilityLabel={`Select ${color.name}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        testID={motionKey}
        style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}>
        <View style={[styles.swatchRing, selected && styles.swatchRingSelected]}>
          <View style={[styles.swatch, { backgroundColor: color.hex }]} />
        </View>
        <Text numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>{color.name}</Text>
        {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.primaryHover} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  selected: {
    borderBottomColor: colors.borderStrong,
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
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.9,
  },
});