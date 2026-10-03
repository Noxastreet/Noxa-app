import { Linking, Platform } from 'react-native';

import { NoxaConfirmationSheet } from '@/src/components/ui';

type Props = {
  visible: boolean;
  message: string;
  onCancel: () => void;
};

export function LiveDrivePermissionRecoverySheet({
  visible,
  message,
  onCancel,
}: Props) {
  const isAndroid = Platform.OS === 'android';

  return (
    <NoxaConfirmationSheet
      body={message}
      cancelTitle="Stay in Ghost"
      confirmTitle="Open Settings"
      eyebrow="BACKGROUND LOCATION"
      footnote={
        isAndroid
          ? 'In Location permission, choose “Allow all the time”, then return to NOXA. Public will retry automatically.'
          : 'Set Location to “Always” and keep Precise Location enabled, then return to NOXA. Public will retry automatically.'
      }
      icon="settings-outline"
      onCancel={onCancel}
      onConfirm={() => {
        void Linking.openSettings();
      }}
      title="Stay visible while driving"
      visible={visible}
    />
  );
}
