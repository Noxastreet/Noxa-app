import 'expo-sqlite/localStorage/install';

const VISIBILITY_SETUP_VERSION = 1;
const VISIBILITY_SETUP_KEY_PREFIX = 'noxa.visibility-setup';

export type VisibilitySetupChoice = 'crew' | 'friends' | 'global' | 'ghost';

type StoredVisibilitySetup = {
  status: 'complete';
  preferredMode: VisibilitySetupChoice;
  completedAt: string;
};

function getVisibilitySetupKey(userId: string) {
  return `${VISIBILITY_SETUP_KEY_PREFIX}.v${VISIBILITY_SETUP_VERSION}.${userId}`;
}

function readVisibilitySetup(userId: string): StoredVisibilitySetup | null {
  try {
    const raw = localStorage.getItem(getVisibilitySetupKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredVisibilitySetup>;
    if (
      parsed.status !== 'complete' ||
      typeof parsed.completedAt !== 'string' ||
      !['crew', 'friends', 'global', 'ghost'].includes(parsed.preferredMode ?? '')
    ) {
      localStorage.removeItem(getVisibilitySetupKey(userId));
      return null;
    }

    return parsed as StoredVisibilitySetup;
  } catch {
    return null;
  }
}

export function hasCompletedVisibilitySetup(userId: string) {
  try {
    return readVisibilitySetup(userId)?.status === 'complete';
  } catch {
    // A storage failure must not keep an authenticated user out of the app.
    return true;
  }
}

export function getPreferredVisibilityMode(userId: string) {
  return readVisibilitySetup(userId)?.preferredMode ?? null;
}

export function markVisibilitySetupComplete(
  userId: string,
  preferredMode: VisibilitySetupChoice,
) {
  try {
    const value: StoredVisibilitySetup = {
      status: 'complete',
      preferredMode,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(getVisibilitySetupKey(userId), JSON.stringify(value));
    return true;
  } catch {
    // The caller can still continue into the app when local persistence is unavailable.
    return false;
  }
}
