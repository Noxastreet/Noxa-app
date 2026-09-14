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

export function markOnboardingComplete(userId: string) {
  try {
    localStorage.setItem(getOnboardingKey(userId), 'complete');
    return true;
  } catch {
    // The caller can still continue into the app when local persistence is unavailable.
    return false;
  }
}

/**
 * Reconcile the device-local onboarding marker with durable profile data.
 *
 * TestFlight reinstall/update, a new device, or an older app version can leave an
 * existing account without the local marker even though its identity and city are
 * already complete on the server. In that case, recover once from the profile and
 * restore the fast local marker for later launches.
 */
export async function resolveOnboardingCompletion(userId: string) {
  if (hasCompletedOnboarding(userId)) return true;

  const { data, error } = await supabase
    .from('profiles')
    .select('username,city,country_code')
    .eq('id', userId)
    .maybeSingle();

  if (error) return false;

  const hasServerIdentity = Boolean(
    data?.username?.trim()
      && data?.city?.trim()
      && data?.country_code?.trim(),
  );

  if (hasServerIdentity) {
    markOnboardingComplete(userId);
  }

  return hasServerIdentity;
}
