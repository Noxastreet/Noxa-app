import 'expo-sqlite/localStorage/install';
import { createClient, type User } from '@supabase/supabase-js';

import { requireClientEnv } from '@/src/config/env';

const { supabaseUrl, supabasePublishableKey } = requireClientEnv();

export const SUPABASE_DB_TIMEOUT_MS = 12_000;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  db: {
    timeout: SUPABASE_DB_TIMEOUT_MS,
  },
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let sessionRefreshPromise: ReturnType<typeof supabase.auth.refreshSession> | null =
  null;
let currentSessionUserPromise: Promise<User | null> | null = null;

export async function getCurrentSessionUser() {
  if (!currentSessionUserPromise) {
    currentSessionUserPromise = supabase.auth
      .getSession()
      .then(({ data }) => data.session?.user ?? null);
  }

  try {
    return await currentSessionUserPromise;
  } finally {
    currentSessionUserPromise = null;
  }
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
