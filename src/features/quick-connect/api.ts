import { supabase } from '@/src/lib/supabase';

export type QuickConnectSession = {
  sessionId: string;
  token: string;
  code: string;
  expiresAt: string;
};

export type QuickConnectPreview = {
  sessionId: string;
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  alreadyFriends: boolean;
  expiresAt: string;
};

export type QuickConnectFriend = {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  friends: true;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Quick Connect response is missing ${field}.`);
  }
  return value;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function formatQuickConnectCode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 10);
  return [normalized.slice(0, 4), normalized.slice(4, 8), normalized.slice(8, 10)]
    .filter(Boolean)
    .join('-');
}

export function quickConnectQrPayload(token: string) {
  return `noxa://quick-connect/${token}`;
}

export function quickConnectValueFromPayload(rawValue: string) {
  const trimmed = rawValue.trim();
  const deepLinkMatch = trimmed.match(
    /^noxa:\/\/quick-connect\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i,
  );
  if (deepLinkMatch) return deepLinkMatch[1];
  return trimmed;
}

export async function createQuickConnectSession(): Promise<QuickConnectSession> {
  const { data, error } = await supabase.rpc('noxa_create_friend_connect');
  if (error) throw new Error(error.message);

  const row = asObject(data);
  if (!row) throw new Error('Quick Connect could not be created.');

  return {
    sessionId: requiredString(row.session_id, 'session_id'),
    token: requiredString(row.token, 'token'),
    code: requiredString(row.code, 'code'),
    expiresAt: requiredString(row.expires_at, 'expires_at'),
  };
}

export async function revokeQuickConnectSession() {
  const { error } = await supabase.rpc('noxa_revoke_friend_connect');
  if (error) throw new Error(error.message);
}

export async function resolveQuickConnect(
  rawValue: string,
): Promise<QuickConnectPreview | null> {
  const presentedValue = quickConnectValueFromPayload(rawValue);
  const { data, error } = await supabase.rpc('noxa_resolve_friend_connect', {
    presented_value: presentedValue,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = asObject(data);
  if (!row) return null;

  return {
    sessionId: requiredString(row.session_id, 'session_id'),
    userId: requiredString(row.user_id, 'user_id'),
    displayName: requiredString(row.display_name, 'display_name'),
    username: nullableString(row.username),
    avatarUrl: nullableString(row.avatar_url),
    alreadyFriends: row.already_friends === true,
    expiresAt: requiredString(row.expires_at, 'expires_at'),
  };
}

export async function redeemQuickConnect(
  sessionId: string,
): Promise<QuickConnectFriend> {
  const { data, error } = await supabase.rpc('noxa_redeem_friend_connect', {
    target_session_id: sessionId,
  });
  if (error) throw new Error(error.message);

  const row = asObject(data);
  if (!row) throw new Error('Quick Connect could not be completed.');

  return {
    userId: requiredString(row.user_id, 'user_id'),
    displayName: requiredString(row.display_name, 'display_name'),
    username: nullableString(row.username),
    avatarUrl: nullableString(row.avatar_url),
    friends: true,
  };
}
