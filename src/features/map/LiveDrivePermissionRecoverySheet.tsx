import { Linking } from 'react-native';

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
  return (
    <NoxaConfirmationSheet
      body={message}
      cancelTitle="Stay in Ghost"
      confirmTitle="Open Settings"
      eyebrow="LOCATION ACCESS"
      footnote="NOXA will remain in Ghost until iOS grants the location access required for Live Drive."
      icon="settings-outline"
      onCancel={onCancel}
      onConfirm={() => {
        void Linking.openSettings();
      }}
      title="Finish location setup"
      visible={visible}
    />
  );
}
