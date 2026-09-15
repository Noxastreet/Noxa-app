import 'expo-sqlite/localStorage/install';
import { createClient, type User } from '@supabase/supabase-js';
import { fetch as expoFetch } from 'expo/fetch';

import { requireClientEnv } from '@/src/config/env';

const { supabaseUrl, supabasePublishableKey } = requireClientEnv();

export const SUPABASE_DB_TIMEOUT_MS = 12_000;
export const SUPABASE_HTTP_TIMEOUT_MS = 12_000;

// Expo SDK 54 ships a native Fetch implementation. Keep all Supabase HTTP
// traffic on that transport instead of React Native's legacy global fetch,
// which can leave iOS requests pending across connectivity/lifecycle changes.
// Auth, PostgREST, Storage and Functions all receive this shared fetch.
const supabaseFetch: typeof globalThis.fetch = async (input, init) => {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort();

  if (upstreamSignal?.aborted) {
    controller.abort();
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
  }

  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_HTTP_TIMEOUT_MS);
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  try {
    return (await expoFetch(url, {
      body: init?.body ?? undefined,
      credentials: init?.credentials,
      headers: init?.headers,
      method: init?.method,
      signal: controller.signal,
      redirect: init?.redirect,
      integrity: init?.integrity,
      keepalive: init?.keepalive,
      mode: init?.mode,
      referrer: init?.referrer,
    })) as unknown as Response;
  } finally {
    clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  db: {
    timeout: SUPABASE_DB_TIMEOUT_MS,
  },
  global: {
    fetch: supabaseFetch,
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
