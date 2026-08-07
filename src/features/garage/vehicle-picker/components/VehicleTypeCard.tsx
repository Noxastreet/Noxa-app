import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';

import type { VehicleTypePickerItem } from '../types';
import { PickerCardFrame } from './PickerCardFrame';

type VehicleTypeCardProps = {
  item: VehicleTypePickerItem;
  onPress: () => void;
  selected?: boolean;
};

export function VehicleTypeCard({ item, onPress, selected = false }: VehicleTypeCardProps) {
  const isCar = item.vehicleType === 'car';

  return (
    <PickerCardFrame
      accessibilityLabel={`Choose ${item.label}`}
      motionKey={item.motionKey}
      onPress={onPress}
      selected={selected}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Ionicons
            name={isCar ? 'car-sport-outline' : 'speedometer-outline'}
            size={28}
            color={selected ? colors.primaryHover : colors.textMuted}
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.caption}>{isCar ? 'Cars' : 'Bikes'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
      </View>
    </PickerCardFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
  },
  iconWrapSelected: {
    backgroundColor: colors.primaryMuted,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  caption: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
});
