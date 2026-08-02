import { router } from 'expo-router';

import { hasCompletedOnboarding } from '@/src/lib/onboarding';

export function resetToAuthenticatedApp(userId: string) {
  router.dismissAll();
  router.replace(hasCompletedOnboarding(userId) ? '/(tabs)' : '/onboarding');
}

export function resetToSignedOutHome() {
  router.dismissAll();
  router.replace('/welcome');
}

export function resetToSignIn() {
  router.dismissAll();
  router.replace('/sign-in');
}
