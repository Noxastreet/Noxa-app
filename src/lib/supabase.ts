import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

import { requireClientEnv } from '@/src/config/env';

const { supabaseUrl, supabasePublishableKey } = requireClientEnv();

const REQUEST_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 250;
const TRANSIENT_READ_STATUSES = new Set([408, 502, 503, 504]);

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function requestMethod(init?: FetchInit) {
  return (init?.method ?? 'GET').toUpperCase();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(input: FetchInput, init?: FetchInit) {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  let detachUpstream: (() => void) | null = null;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      const abort = () => controller.abort();
      upstreamSignal.addEventListener('abort', abort, { once: true });
      detachUpstream = () => upstreamSignal.removeEventListener('abort', abort);
    }
  }

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    detachUpstream?.();
  }
}

async function resilientSupabaseFetch(input: FetchInput, init?: FetchInit) {
  const method = requestMethod(init);
  const canRetry = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  try {
    const response = await fetchWithTimeout(input, init);
    if (
      canRetry &&
      !init?.signal?.aborted &&
      TRANSIENT_READ_STATUSES.has(response.status)
    ) {
      await sleep(RETRY_DELAY_MS);
      return fetchWithTimeout(input, init);
    }
    return response;
  } catch (error) {
    if (!canRetry || init?.signal?.aborted) throw error;
    await sleep(RETRY_DELAY_MS);
    return fetchWithTimeout(input, init);
  }
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  db: {
    retry: false,
  },
  global: {
    fetch: resilientSupabaseFetch,
  },
});

let sessionRefreshPromise: ReturnType<typeof supabase.auth.refreshSession> | null =
  null;

export async function getCurrentSessionUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
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
