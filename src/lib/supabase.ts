import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

import { requireClientEnv } from '@/src/config/env';

const { supabaseUrl, supabasePublishableKey } = requireClientEnv();

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let sessionRefreshPromise: ReturnType<typeof supabase.auth.refreshSession> | null =
  null;

export function isJwtValidationError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'PGRST303',
  );
}

export async function refreshSupabaseSessionOnce() {
  if (!sessionRefreshPromise) {
    sessionRefreshPromise = supabase.auth.refreshSession();
  }

  try {
    return await sessionRefreshPromise;
  } finally {
    sessionRefreshPromise = null;
  }
}
