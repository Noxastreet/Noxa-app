import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

import type { VehicleMakePickerItem } from '../types';
import { PickerCardFrame } from './PickerCardFrame';

type PopularMakeCardProps = {
  item: VehicleMakePickerItem;
  onPress: () => void;
};

/**
 * Dedicated popular-make surface.
 * Keep separate from MakeCard so future motion can give the popular grid its own choreography.
 */
export function PopularMakeCard({ item, onPress }: PopularMakeCardProps) {
  return (
    <PickerCardFrame
      accessibilityLabel={`Choose popular make ${item.label}`}
      compact
      motionKey={`${item.motionKey}:popular`}
      onPress={onPress}>
      <View style={styles.row}>
        <Text numberOfLines={1} style={styles.label}>{item.label}</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.textSubtle} />
      </View>
    </PickerCardFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    fontWeight: '900',
  },
});
