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
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.label}>{item.label}</Text>
          <Text style={styles.meta}>{item.hasGenerations ? 'CHOOSE GENERATION NEXT' : 'CHOOSE YEAR NEXT'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
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
  copy: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '800',
  },
  meta: {
    marginTop: 2,
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
});
