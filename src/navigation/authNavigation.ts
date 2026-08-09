import { router } from 'expo-router';

import { hasCompletedOnboarding } from '@/src/lib/onboarding';

function dismissStackIfPossible() {
  if (router.canDismiss()) {
    router.dismissAll();
  }
}

export function resetToAuthenticatedApp(userId: string) {
  dismissStackIfPossible();
  router.replace(hasCompletedOnboarding(userId) ? '/(tabs)' : '/onboarding');
}

export function resetToSignedOutHome() {
  dismissStackIfPossible();
  router.replace('/welcome');
}

export function resetToSignIn() {
  dismissStackIfPossible();
  router.replace('/sign-in');
}
