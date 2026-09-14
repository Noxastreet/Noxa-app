import 'expo-sqlite/localStorage/install';
import { createClient, type User } from '@supabase/supabase-js';

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

let cachedSessionUser: User | null | undefined;
let sessionUserPromise: Promise<User | null> | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedSessionUser = session?.user ?? null;
});

export async function getCurrentSessionUser() {
  if (cachedSessionUser !== undefined) return cachedSessionUser;

  if (!sessionUserPromise) {
    sessionUserPromise = supabase.auth
      .getSession()
      .then(({ data }) => {
        cachedSessionUser = data.session?.user ?? null;
        return cachedSessionUser;
      })
      .finally(() => {
        sessionUserPromise = null;
      });
  }

  return sessionUserPromise;
}

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
