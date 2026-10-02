import { Platform } from 'react-native';

export function shouldOfferLiveDriveSettings(error: unknown) {
  if (Platform.OS !== 'ios') return false;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('precise location')
    || message.includes('precise gps fix')
    || message.includes('location services are off')
    || message.includes('allow location')
    || message.includes('foreground')
    || message.includes('when in use')
    || message.includes('background location')
    || message.includes('background permission')
    || message.includes('minimized')
  );
}

export function getSafeLiveDriveStartMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('precise location') || message.includes('precise gps fix')) {
    return Platform.OS === 'ios'
      ? 'Enable Precise Location for NOXA in iPhone Settings.'
      : 'Enable precise location for NOXA, then retry.';
  }
  if (message.includes('location services are off')) {
    return Platform.OS === 'ios'
      ? 'Enable iPhone Location Services, then retry.'
      : 'Enable Location Services, then retry.';
  }
  if (
    message.includes('background location')
    || message.includes('background permission')
    || message.includes('minimized')
  ) {
    return Platform.OS === 'ios'
      ? 'Set NOXA Location to Always so visibility can continue when the app is minimized.'
      : 'Allow background location for NOXA, then retry.';
  }
  if (
    message.includes('allow location')
    || message.includes('foreground')
    || message.includes('when in use')
  ) {
    return Platform.OS === 'ios'
      ? 'Allow Location for NOXA in iPhone Settings.'
      : 'Allow Location for NOXA, then retry.';
  }
  return 'Personal map visibility could not start. Check Location settings and retry.';
}
