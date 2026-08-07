import { Alert } from 'react-native';
import { router } from 'expo-router';

import { NoxaScreen } from '@/src/components/ui';
import { VehiclePicker, type VehiclePickerSelection } from '@/src/features/garage/vehicle-picker';

function finishPreview(selection: VehiclePickerSelection) {
  const typeLabel = selection.vehicleType === 'motorcycle' ? 'Motorcycle' : 'Car';

  Alert.alert(
    'Vehicle selected',
    `${typeLabel} selection is working. Garage persistence will be connected after the picker runtime check.`,
    [{ text: 'OK', onPress: () => router.back() }],
  );
}

export default function VehiclePickerPreviewScreen() {
  return (
    <NoxaScreen padded={false}>
      <VehiclePicker onCancel={() => router.back()} onComplete={finishPreview} />
    </NoxaScreen>
  );
}
