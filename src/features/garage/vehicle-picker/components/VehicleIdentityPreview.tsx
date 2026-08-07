import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';

import type { SupportedVehicleType } from '@/src/data/vehicleCatalogRegistry';

type VehicleIdentityPreviewProps = {
  generation?: string | null;
  make?: string | null;
  model?: string | null;
  vehicleType?: SupportedVehicleType | null;
  year?: number | null;
};

export function VehicleIdentityPreview({
  generation,
  make,
  model,
  vehicleType,
  year,
}: VehicleIdentityPreviewProps) {
  const title = [make, model].filter(Boolean).join(' ') || 'YOUR VEHICLE';
  const details = [generation, year ? String(year) : null].filter(Boolean).join(' · ');
  const isMotorcycle = vehicleType === 'motorcycle';

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons
          name={isMotorcycle ? 'speedometer-outline' : 'car-sport-outline'}
          size={28}
          color={colors.primaryHover}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{vehicleType ? vehicleType.toUpperCase() : 'VEHICLE'}</Text>
        <Text numberOfLines={2} style={styles.title}>{title}</Text>
        <Text numberOfLines={1} style={styles.details}>{details || 'Build your NOXA identity'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.hero,
    backgroundColor: colors.surfaceBase,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primarySubtle,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: spacing.xxs,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  details: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
});
