import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

import type { VehicleTypePickerItem } from '../types';
import { PickerCardFrame } from './PickerCardFrame';
import { VehicleTypeIcon } from './VehicleTypeIcon';

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
          <VehicleTypeIcon
            vehicleType={item.vehicleType}
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {},
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
