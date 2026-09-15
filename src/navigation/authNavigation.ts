import { router } from 'expo-router';


function dismissStackIfPossible() {
  if (router.canDismiss()) {
    router.dismissAll();
  }
}

export function resetToAuthenticatedApp(_userId: string) {
  dismissStackIfPossible();
  // Route every authenticated entry through the canonical first-run resolver.
  // Local device storage alone cannot decide whether an account is new.
  router.replace('/');
}

export function resetToSignedOutHome() {
  dismissStackIfPossible();
  router.replace('/welcome');
}

export function resetToSignIn() {
  dismissStackIfPossible();
  router.replace('/sign-in');
}
