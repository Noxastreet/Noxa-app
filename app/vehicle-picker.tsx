import { router } from 'expo-router';
import { useState } from 'react';

import { NoxaScreen } from '@/src/components/ui';
import {
  VehicleFinalizeFlow,
  VehiclePicker,
  type VehiclePickerSelection,
} from '@/src/features/garage/vehicle-picker';

function closePicker() {
  router.replace('/garage');
}

export default function VehiclePickerScreen() {
  const [selection, setSelection] = useState<VehiclePickerSelection | null>(null);

  return (
    <NoxaScreen padded={false}>
      {selection ? (
        <VehicleFinalizeFlow
          selection={selection}
          onBackToPicker={() => setSelection(null)}
          onSaved={() => router.replace('/garage')}
        />
      ) : (
        <VehiclePicker onCancel={closePicker} onComplete={setSelection} />
      )}
    </NoxaScreen>
  );
}
