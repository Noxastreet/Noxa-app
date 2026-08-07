import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

import type { VehicleModelPickerItem } from '../types';
import { PickerCardFrame } from './PickerCardFrame';

type ModelCardProps = {
  item: VehicleModelPickerItem;
  onPress: () => void;
};

export function ModelCard({ item, onPress }: ModelCardProps) {
  return (
    <PickerCardFrame
      accessibilityLabel={`Choose ${item.label}`}
      compact
      motionKey={item.motionKey}
      onPress={onPress}>
      <View style={styles.row}>
        <Text numberOfLines={1} style={styles.label}>{item.label}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
      </View>
    </PickerCardFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '800',
  },
});
