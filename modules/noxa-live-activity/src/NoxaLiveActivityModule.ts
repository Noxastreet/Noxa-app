import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type NativeDriveLiveActivityState = {
  driveSessionId: string;
  destinationTitle: string;
  etaMinutes: number | null;
  remainingDistanceMeters: number | null;
  participantCount: number;
  progress: number | null;
  status: 'active' | 'ending';
};

type NoxaLiveActivityNativeModule = {
  isSupported(): boolean;
  areLiveActivitiesEnabled(): boolean;
  startDriveActivity(state: NativeDriveLiveActivityState): Promise<string | null>;
  updateDriveActivity(state: NativeDriveLiveActivityState): Promise<boolean>;
  endDriveActivity(driveSessionId: string): Promise<boolean>;
  endDriveActivitiesWithPrefixes(prefixes: string[]): Promise<boolean>;
  endAllDriveActivities(): Promise<boolean>;
};

let cachedModule: NoxaLiveActivityNativeModule | null | undefined;

function nativeModule() {
  if (Platform.OS !== 'ios') return null;
  if (cachedModule !== undefined) return cachedModule;

  try {
    cachedModule = requireNativeModule<NoxaLiveActivityNativeModule>('NoxaLiveActivity');
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export function isDriveLiveActivitySupported() {
  return nativeModule()?.isSupported() ?? false;
}

export function areDriveLiveActivitiesEnabled() {
  return nativeModule()?.areLiveActivitiesEnabled() ?? false;
}

export async function startNativeDriveActivity(state: NativeDriveLiveActivityState) {
  return (await nativeModule()?.startDriveActivity(state)) ?? null;
}

export async function updateNativeDriveActivity(state: NativeDriveLiveActivityState) {
  return (await nativeModule()?.updateDriveActivity(state)) ?? false;
}

export async function endNativeDriveActivity(driveSessionId: string) {
  return (await nativeModule()?.endDriveActivity(driveSessionId)) ?? false;
}

export async function endNativeDriveActivitiesWithPrefixes(prefixes: string[]) {
  return (await nativeModule()?.endDriveActivitiesWithPrefixes(prefixes)) ?? false;
}

export async function endAllNativeDriveActivities() {
  return (await nativeModule()?.endAllDriveActivities()) ?? false;
}
