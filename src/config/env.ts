export const CLIENT_ENV_VAR_NAMES = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
] as const;

export type ClientEnvVarName = (typeof CLIENT_ENV_VAR_NAMES)[number];

type ClientEnvironment = Readonly<{
  supabaseUrl: string;
  supabasePublishableKey: string;
  mapboxAccessToken: string;
}>;

export type ClientEnvStatus = Readonly<{
  isReady: boolean;
  missing: readonly ClientEnvVarName[];
  invalid: readonly ClientEnvVarName[];
}>;

export const clientEnv: ClientEnvironment = Object.freeze({
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
  supabasePublishableKey: (
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
  ).trim(),
  mapboxAccessToken: (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '').trim(),
});

function isSupportedSupabaseUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function getClientEnvStatus(): ClientEnvStatus {
  const missing: ClientEnvVarName[] = [];
  const invalid: ClientEnvVarName[] = [];

  if (!clientEnv.supabaseUrl) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  } else if (!isSupportedSupabaseUrl(clientEnv.supabaseUrl)) {
    invalid.push('EXPO_PUBLIC_SUPABASE_URL');
  }

  if (!clientEnv.supabasePublishableKey) {
    missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  if (!clientEnv.mapboxAccessToken) {
    missing.push('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN');
  }

  return Object.freeze({
    isReady: missing.length === 0 && invalid.length === 0,
    missing: Object.freeze(missing),
    invalid: Object.freeze(invalid),
  });
}

export class NoxaEnvironmentError extends Error {
  readonly missing: readonly ClientEnvVarName[];
  readonly invalid: readonly ClientEnvVarName[];

  constructor(status: ClientEnvStatus) {
    const issues = [
      status.missing.length > 0
        ? `missing: ${status.missing.join(', ')}`
        : null,
      status.invalid.length > 0
        ? `invalid: ${status.invalid.join(', ')}`
        : null,
    ].filter(Boolean);

    super(`NOXA environment configuration error (${issues.join('; ')}).`);
    this.name = 'NoxaEnvironmentError';
    this.missing = status.missing;
    this.invalid = status.invalid;
  }
}

export function requireClientEnv(): ClientEnvironment {
  const status = getClientEnvStatus();

  if (!status.isReady) {
    throw new NoxaEnvironmentError(status);
  }

  return clientEnv;
}
