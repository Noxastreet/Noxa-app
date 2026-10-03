import 'expo-sqlite/localStorage/install';

import { supabase } from '@/src/lib/supabase';

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

export async function markOnboardingComplete(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;

  try {
    localStorage.setItem(getOnboardingKey(userId), 'complete');
  } catch {
    // Server completion is canonical. Local persistence is only a fast path.
  }
  return true;
}


export type OnboardingCompletionState =
  | 'local'
  | 'profile'
  | 'incomplete'
  | 'unknown';

/**
 * Resolve first-run state across installs. The local flag remains the fast
 * path, while a persisted username is the server-side proof that the account
 * already completed NOXA identity setup. New auth users are created with a
 * profile row but without a username, so profile existence alone is not
 * enough to skip onboarding.
 *
 * `unknown` deliberately does not mean "new user": a temporary network error
 * must never force an existing authenticated account back through onboarding.
 */
export async function resolveOnboardingCompletion(
  userId: string,
): Promise<OnboardingCompletionState> {
  if (hasCompletedOnboarding(userId)) return 'local';

  const { data, error } = await supabase
    .from('profiles')
    .select('username,onboarding_completed_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) return 'unknown';

  if (data?.onboarding_completed_at) {
    try {
      localStorage.setItem(getOnboardingKey(userId), 'complete');
    } catch {
      // Server completion remains canonical.
    }
    return 'profile';
  }

  return 'incomplete';
}
