import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

import type { VehicleMakePickerItem } from '../types';
import { PickerCardFrame } from './PickerCardFrame';

type MakeCardProps = {
  item: VehicleMakePickerItem;
  onPress: () => void;
};

export function MakeCard({ item, onPress }: MakeCardProps) {
  return (
    <PickerCardFrame
      accessibilityLabel={`Choose ${item.label}`}
      compact
      motionKey={item.motionKey}
      onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.label}>{item.label}</Text>
          {item.popular ? <Text style={styles.meta}>POPULAR</Text> : null}
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
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
