import { Platform } from 'react-native';

export function getSafeLiveDriveStartMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('development or store build') || message.includes('expo go')) {
    return 'Live Drive needs an installed development or store build. You are still in Ghost.';
  }
  if (message.includes('background location') || message.includes('always access')) {
    return Platform.OS === 'ios'
      ? 'Set NOXA Location to Always in iPhone Settings.'
      : 'Enable background location for NOXA, then retry.';
  }
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
    message.includes('allow location')
    || message.includes('foreground')
    || message.includes('when in use')
  ) {
    return Platform.OS === 'ios'
      ? 'Allow Location for NOXA in iPhone Settings.'
      : 'Allow Location for NOXA, then retry.';
  }
  return 'Live Drive could not start. Check Location settings and retry.';
}
