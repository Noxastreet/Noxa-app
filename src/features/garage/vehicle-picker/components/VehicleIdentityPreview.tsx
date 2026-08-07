import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';

import type { SupportedVehicleType } from '@/src/data/vehicleCatalogRegistry';
import { VehicleTypeIcon } from './VehicleTypeIcon';

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
  const resolvedVehicleType = vehicleType ?? 'car';
  const title = [make, model].filter(Boolean).join(' ') || (resolvedVehicleType === 'motorcycle' ? 'MOTORCYCLE' : 'CAR');
  const details = [generation, year ? String(year) : null].filter(Boolean).join(' · ');

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <VehicleTypeIcon vehicleType={resolvedVehicleType} size={20} color={colors.primaryHover} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {details ? <Text numberOfLines={1} style={styles.details}>{details}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceBase,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  details: {
    marginTop: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
});
