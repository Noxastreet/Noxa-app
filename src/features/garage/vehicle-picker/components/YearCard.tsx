import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '@/src/theme';

import type { VehicleYearPickerItem } from '../types';
import { PickerCardFrame } from './PickerCardFrame';

type YearCardProps = {
  item: VehicleYearPickerItem;
  onPress: () => void;
};

export function YearCard({ item, onPress }: YearCardProps) {
  return (
    <PickerCardFrame
      accessibilityLabel={`Choose year ${item.year}`}
      compact
      motionKey={item.motionKey}
      onPress={onPress}>
      <Text style={styles.year}>{item.year}</Text>
    </PickerCardFrame>
  );
}

const styles = StyleSheet.create({
  year: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
});
