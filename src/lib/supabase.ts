import 'expo-sqlite/localStorage/install';
import { createClient, type User } from '@supabase/supabase-js';
import { fetch as expoFetch } from 'expo/fetch';

import { requireClientEnv } from '@/src/config/env';

const { supabaseUrl, supabasePublishableKey } = requireClientEnv();

export const SUPABASE_DB_TIMEOUT_MS = 12_000;
export const SUPABASE_HTTP_TIMEOUT_MS = 12_000;
export const SUPABASE_BODY_TIMEOUT_MS = 12_000;

function makeAbortError(message: string) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

async function readResponseBytesViaStream(response: Response) {
  const body = response.body;
  if (!body) return new Uint8Array();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  const readPromise = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      chunks.push(value);
      totalLength += value.byteLength;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  })();

  return await new Promise<Uint8Array>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try {
        reader.releaseLock();
      } catch {
        // The native stream can already be terminal after an iOS network error.
      }
      callback();
    };

    const timeoutId = setTimeout(() => {
      void reader.cancel('Supabase response body timed out').catch(() => undefined);
      finish(() => reject(makeAbortError('Supabase response body timed out.')));
    }, SUPABASE_BODY_TIMEOUT_MS);

    readPromise.then(
      (bytes) => finish(() => resolve(bytes)),
      (error) => finish(() => reject(error)),
    );
  });
}

function bytesToArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function wrapExpoResponse(response: Response): Response {
  let bytesPromise: Promise<Uint8Array> | null = null;
  const readBytes = () => {
    bytesPromise ??= readResponseBytesViaStream(response);
    return bytesPromise;
  };
  const readText = async () => new TextDecoder().decode(await readBytes());
  const readArrayBuffer = async () => bytesToArrayBuffer(await readBytes());

  return new Proxy(response, {
    get(target, property) {
      if (property === 'text') return readText;
      if (property === 'json') {
        return async () => JSON.parse(await readText());
      }
      if (property === 'arrayBuffer') return readArrayBuffer;
      if (property === 'bytes') return readBytes;
      if (property === 'formData') {
        return async () => {
          const params = new URLSearchParams(await readText());
          const formData = new FormData();
          params.forEach((value, key) => formData.append(key, value));
          return formData;
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Response;
}

// Expo SDK 54's buffered response.text()/arrayBuffer() can remain pending on
// iOS when a request fails after the response has been delivered. Supabase
// reads response bodies through those methods, so route all HTTP traffic over
// expo/fetch but consume bodies through its streaming path, which reports the
// same native failure correctly. Independent JS watchdogs bound both the
// initial request and body read even if a native promise never settles.
const supabaseFetch: typeof globalThis.fetch = async (input, init) => {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return await new Promise<Response>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    };
    const finishResolve = (response: Response) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(wrapExpoResponse(response));
    };
    const finishReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abortFromUpstream = () => {
      controller.abort();
      finishReject(makeAbortError('Supabase request was aborted.'));
    };
    const timeoutId = setTimeout(() => {
      controller.abort();
      finishReject(makeAbortError('Supabase request timed out.'));
    }, SUPABASE_HTTP_TIMEOUT_MS);

    if (upstreamSignal?.aborted) {
      abortFromUpstream();
      return;
    }
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });

    void expoFetch(url, {
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
    }).then(
      (response) => finishResolve(response as unknown as Response),
      finishReject,
    );
  });
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
