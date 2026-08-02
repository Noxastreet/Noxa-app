import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/src/lib/supabase';

export const SOCIAL_AUTH_REDIRECT_URI = 'noxa://auth/callback';

export type SocialAuthResult =
  | { status: 'cancelled' }
  | { status: 'success'; userId: string };

export type SocialAuthOptions = {
  expectedUserId?: string;
  loginHint?: string | null;
};

WebBrowser.maybeCompleteAuthSession();

function parseAuthParams(url: string) {
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
      values[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    }
  }

  return values;
}

function getMetadataText(user: User, keys: string[]) {
  for (const key of keys) {
    const value = user.user_metadata?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function syncSocialProfile(user: User, appleDisplayName?: string | null) {
  const displayName =
    appleDisplayName?.trim() ||
    getMetadataText(user, ['display_name', 'full_name', 'name']);
  const avatarUrl = getMetadataText(user, ['avatar_url', 'picture']);

  if (appleDisplayName?.trim()) {
    const normalizedName = appleDisplayName.trim();
    await supabase.auth.updateUser({
      data: {
        display_name: normalizedName,
        full_name: normalizedName,
      },
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name,avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return;
  }

  const updates: { display_name?: string; avatar_url?: string } = {};
  if (displayName && (!profile?.display_name || profile.display_name === 'Driver')) {
    updates.display_name = displayName;
  }
  if (avatarUrl && !profile?.avatar_url) {
    updates.avatar_url = avatarUrl;
  }

  if (!Object.keys(updates).length) {
    return;
  }

  if (profile) {
    await supabase.from('profiles').update(updates).eq('id', user.id);
  } else {
    await supabase.from('profiles').insert({
      id: user.id,
      display_name: updates.display_name ?? 'Driver',
      avatar_url: updates.avatar_url,
    });
  }
}

async function createSessionFromCallback(url: string) {
  const params = parseAuthParams(url);

  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error);
  }

  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });

    if (error) throw error;
    return data.session;
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session;
  }

  throw new Error('The authentication response was incomplete.');
}

async function requireExpectedUser(
  user: User,
  expectedUserId: string | undefined,
  previousSession: Session | null,
) {
  if (!expectedUserId || user.id === expectedUserId) {
    return;
  }

  if (previousSession) {
    await supabase.auth.setSession({
      access_token: previousSession.access_token,
      refresh_token: previousSession.refresh_token,
    });
  } else {
    await supabase.auth.signOut({ scope: 'local' });
  }

  throw new Error('The selected identity does not match the current account.');
}

export async function signInWithGoogle(
  options: SocialAuthOptions = {},
): Promise<SocialAuthResult> {
  const previousSession = options.expectedUserId
    ? (await supabase.auth.getSession()).data.session
    : null;
  const queryParams: Record<string, string> = { prompt: 'select_account' };
  if (options.loginHint?.trim()) {
    queryParams.login_hint = options.loginHint.trim();
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: SOCIAL_AUTH_REDIRECT_URI,
      queryParams,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('Google authentication is unavailable.');

  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    SOCIAL_AUTH_REDIRECT_URI,
  );

  if (result.type !== 'success') {
    return { status: 'cancelled' };
  }

  const session = await createSessionFromCallback(result.url);
  if (!session?.user) throw new Error('Unable to create an authenticated session.');

  await requireExpectedUser(session.user, options.expectedUserId, previousSession);
  await syncSocialProfile(session.user);
  return { status: 'success', userId: session.user.id };
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function signInWithApple(
  options: SocialAuthOptions = {},
): Promise<SocialAuthResult> {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) {
    throw new Error('Apple authentication is unavailable on this device.');
  }

  const rawNonce = bytesToHex(await Crypto.getRandomBytesAsync(32));
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const state = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const previousSession = options.expectedUserId
    ? (await supabase.auth.getSession()).data.session
    : null;

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      state,
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ERR_REQUEST_CANCELED'
    ) {
      return { status: 'cancelled' };
    }
    throw error;
  }

  if (credential.state !== state) {
    throw new Error('Apple authentication could not be verified.');
  }
  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    access_token: credential.authorizationCode ?? undefined,
    nonce: rawNonce,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Unable to create an authenticated session.');

  await requireExpectedUser(data.user, options.expectedUserId, previousSession);
  const appleDisplayName = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName).trim()
    : null;
  await syncSocialProfile(data.user, appleDisplayName);

  return { status: 'success', userId: data.user.id };
}

export function getSocialAuthErrorMessage(provider: 'apple' | 'google', error: unknown) {
  const providerName = provider === 'apple' ? 'Apple' : 'Google';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('network') || message.includes('fetch')) {
    return `Unable to reach ${providerName}. Check your internet connection.`;
  }
  if (message.includes('provider') && (message.includes('disabled') || message.includes('enabled'))) {
    return `${providerName} sign-in is not available yet.`;
  }
  if (message.includes('does not match the current account')) {
    return `Choose the ${providerName} account linked to this NOXA account.`;
  }

  return `Unable to continue with ${providerName}. Please try again.`;
}
