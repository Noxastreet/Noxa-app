import { router } from 'expo-router';

import {
  hasCompletedOnboarding,
  resolveOnboardingCompletion,
} from '@/src/lib/onboarding';
import {
  hasCompletedVisibilitySetup,
  markVisibilitySetupComplete,
} from '@/src/lib/visibilitySetup';

function dismissStackIfPossible() {
  if (router.canDismiss()) {
    router.dismissAll();
  }
}

export async function resetToAuthenticatedApp(userId: string) {
  const hadLocalOnboarding = hasCompletedOnboarding(userId);
  const onboardingComplete = hadLocalOnboarding
    ? true
    : await resolveOnboardingCompletion(userId);

  dismissStackIfPossible();

  if (!onboardingComplete) {
    router.replace('/onboarding');
    return;
  }

  if (!hadLocalOnboarding && !hasCompletedVisibilitySetup(userId)) {
    markVisibilitySetupComplete(userId, 'ghost');
  }

  router.replace(
    hasCompletedVisibilitySetup(userId) ? '/(tabs)' : '/visibility-setup',
  );
}

export function resetToSignedOutHome() {
  dismissStackIfPossible();
  router.replace('/welcome');
}

export function resetToSignIn() {
  dismissStackIfPossible();
  router.replace('/sign-in');
}
