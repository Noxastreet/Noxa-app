import 'expo-sqlite/localStorage/install';

const ONBOARDING_VERSION = 1;
const ONBOARDING_KEY_PREFIX = 'noxa.onboarding';

function getOnboardingKey(userId: string) {
  return `${ONBOARDING_KEY_PREFIX}.v${ONBOARDING_VERSION}.${userId}`;
}

export function hasCompletedOnboarding(userId: string) {
  try {
    return localStorage.getItem(getOnboardingKey(userId)) === 'complete';
  } catch {
    // A storage failure must not keep an authenticated user out of the app.
    return true;
  }
}

export function markOnboardingComplete(userId: string) {
  try {
    localStorage.setItem(getOnboardingKey(userId), 'complete');
    return true;
  } catch {
    // The caller can still continue into the app when local persistence is unavailable.
    return false;
  }
}
