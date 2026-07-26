import { router } from 'expo-router';

export function resetToAuthenticatedApp() {
  router.dismissAll();
  router.replace('/(tabs)');
}

export function resetToSignedOutHome() {
  router.dismissAll();
  router.replace('/welcome');
}

export function resetToSignIn() {
  router.dismissAll();
  router.replace('/sign-in');
}
