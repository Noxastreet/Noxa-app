import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '@/src/theme';

export type IdentityOrbSize = 'small' | 'medium' | 'large';

type IdentityOrbProps = {
  size?: IdentityOrbSize;
  selected?: boolean;
  presence?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
};

const SIZE_MAP: Record<IdentityOrbSize, { diameter: number; icon: number; presence: number }> = {
  small: { diameter: 32, icon: 14, presence: 8 },
  medium: { diameter: 44, icon: 19, presence: 10 },
  large: { diameter: 56, icon: 24, presence: 12 },
};

export function IdentityOrb({
  size = 'medium',
  selected = false,
  presence = false,
  accessibilityLabel,
  style,
}: IdentityOrbProps) {
  const metrics = SIZE_MAP[size];

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessible
      style={[
        styles.orb,
        {
          width: metrics.diameter,
          height: metrics.diameter,
          borderRadius: metrics.diameter / 2,
        },
        selected && styles.orbSelected,
        style,
      ]}
    >
      <Ionicons name="car-sport" size={metrics.icon} color={colors.text} />
      {presence ? (
        <View
          style={[
            styles.presence,
            {
              width: metrics.presence,
              height: metrics.presence,
              borderRadius: metrics.presence / 2,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  orbSelected: {
    borderWidth: 2,
    borderColor: colors.borderAccent,
  },
  presence: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    borderWidth: 1.5,
    borderColor: colors.surface,
    backgroundColor: colors.success,
  },
});
