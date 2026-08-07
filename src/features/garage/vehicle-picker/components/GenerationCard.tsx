import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

import type { VehicleGenerationPickerItem } from '../types';
import { PickerCardFrame } from './PickerCardFrame';

type GenerationCardProps = {
  item: VehicleGenerationPickerItem;
  onPress: () => void;
};

export function GenerationCard({ item, onPress }: GenerationCardProps) {
  return (
    <PickerCardFrame
      accessibilityLabel={`Choose generation ${item.label}`}
      compact
      motionKey={item.motionKey}
      onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>GENERATION</Text>
          <Text numberOfLines={1} style={styles.label}>{item.label}</Text>
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
  eyebrow: {
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.85,
  },
  label: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
  },
});
