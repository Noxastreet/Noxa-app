import { supabase } from '@/src/lib/supabase';

export type PasswordRecoveryLinkResult = {
  handled: boolean;
  error: string | null;
};

function decodePart(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parseLinkParams(url: string) {
  const values: Record<string, string> = {};
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');
  const chunks = [
    queryStart >= 0
      ? url.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined)
      : '',
    hashStart >= 0 ? url.slice(hashStart + 1) : '',
  ];

  for (const chunk of chunks) {
    for (const pair of chunk.split('&')) {
      if (!pair) continue;
      const separator = pair.indexOf('=');
      const rawKey = separator >= 0 ? pair.slice(0, separator) : pair;
      const rawValue = separator >= 0 ? pair.slice(separator + 1) : '';
      values[decodePart(rawKey)] = decodePart(rawValue);
    }
  }

  return values;
}

export function isPasswordRecoveryUrl(url: string) {
  return (
    url.startsWith('noxa://reset-password') ||
    url.includes('/--/reset-password')
  );
}

export async function acceptPasswordRecoveryUrl(
  url: string,
): Promise<PasswordRecoveryLinkResult> {
  if (!isPasswordRecoveryUrl(url)) {
    return { handled: false, error: null };
  }

  const params = parseLinkParams(url);
  const authError = params.error_description || params.error;
  if (authError) {
    return { handled: true, error: authError };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return { handled: true, error: error?.message ?? null };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    return { handled: true, error: error?.message ?? null };
  }

  if (params.token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: 'recovery',
    });
    return { handled: true, error: error?.message ?? null };
  }

  return { handled: false, error: null };
}
