import { FontAwesome5, Ionicons } from '@expo/vector-icons';

import { colors } from '@/src/theme';
import type { SupportedVehicleType } from '@/src/data/vehicleCatalogRegistry';

type VehicleTypeIconProps = {
  color?: string;
  size?: number;
  vehicleType: SupportedVehicleType;
};

export function VehicleTypeIcon({ color = colors.textMuted, size = 24, vehicleType }: VehicleTypeIconProps) {
  if (vehicleType === 'motorcycle') {
    return <FontAwesome5 name="motorcycle" size={size} color={color} />;
  }

  return <Ionicons name="car-sport-outline" size={size} color={color} />;
}
