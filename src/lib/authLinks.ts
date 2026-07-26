import type { EmailOtpType } from '@supabase/supabase-js';

import { supabase } from '@/src/lib/supabase';

type AuthLinkResult =
  | {
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

function decodeLinkValue(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

export function parseAuthLinkParams(url: string) {
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
      if (!pair) {
        continue;
      }

      const separator = pair.indexOf('=');
      const rawKey = separator >= 0 ? pair.slice(0, separator) : pair;
      const rawValue = separator >= 0 ? pair.slice(separator + 1) : '';
      values[decodeLinkValue(rawKey)] = decodeLinkValue(rawValue);
    }
  }

  return values;
}

export async function createSessionFromAuthLink(url: string): Promise<AuthLinkResult> {
  const params = parseAuthLinkParams(url);

  if (params.error || params.error_code || params.error_description) {
    return {
      message: 'This confirmation link is invalid or has expired. Request a new email and try again.',
      ok: false,
    };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });

    return error
      ? {
          message: 'NOXA could not finish signing you in. Request a new confirmation email.',
          ok: false,
        }
      : { ok: true };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);

    return error
      ? {
          message: 'NOXA could not finish signing you in. Request a new confirmation email.',
          ok: false,
        }
      : { ok: true };
  }

  if (params.token_hash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as EmailOtpType,
    });

    return error
      ? {
          message: 'This confirmation link is invalid or has expired. Request a new email and try again.',
          ok: false,
        }
      : { ok: true };
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    return { ok: true };
  }

  return {
    message: 'The confirmation link is incomplete. Open the newest email from NOXA and try again.',
    ok: false,
  };
}
