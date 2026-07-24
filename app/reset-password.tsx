import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { NoxaAuthField, NoxaAuthScreen } from '@/src/components/auth';
import { NoxaButton } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { colors, spacing, typography } from '@/src/theme';

type RecoveryState = 'verifying' | 'ready' | 'invalid' | 'saved';

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
      values[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    }
  }

  return values;
}

export default function ResetPasswordScreen() {
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('verifying');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const acceptRecoveryLink = async (url?: string | null) => {
      if (!active) return;

      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        setRecoveryState('ready');
        return;
      }

      if (!url) {
        setLinkError('Open this screen from the password reset email.');
        setRecoveryState('invalid');
        return;
      }

      const params = parseLinkParams(url);
      if (params.error_description) {
        setLinkError(params.error_description);
        setRecoveryState('invalid');
        return;
      }

      let error: { message: string } | null = null;

      if (params.access_token && params.refresh_token) {
        ({ error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        }));
      } else if (params.code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(params.code));
      } else if (params.token_hash) {
        ({ error } = await supabase.auth.verifyOtp({
          token_hash: params.token_hash,
          type: 'recovery',
        }));
      } else {
        error = { message: 'The recovery link is incomplete or has expired.' };
      }

      if (!active) return;
      if (error) {
        setLinkError(error.message);
        setRecoveryState('invalid');
      } else {
        setRecoveryState('ready');
      }
    };

    void Linking.getInitialURL().then(acceptRecoveryLink);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      setRecoveryState('verifying');
      setLinkError(null);
      void acceptRecoveryLink(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const updatePassword = async () => {
    if (isSaving) return;

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordError(undefined);
    setFormError(null);
    setIsSaving(true);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError('Unable to update your password. Request a new reset link and try again.');
      setIsSaving(false);
      return;
    }

    setRecoveryState('saved');
    await supabase.auth.signOut();
    setIsSaving(false);
  };

  const title =
    recoveryState === 'verifying'
      ? 'Verifying link.'
      : recoveryState === 'saved'
        ? 'Password updated.'
        : recoveryState === 'invalid'
          ? 'Link unavailable.'
          : 'Create new password.';

  const subtitle =
    recoveryState === 'saved'
      ? 'Your new password is ready. Sign in to continue.'
      : recoveryState === 'invalid'
        ? linkError ?? 'Request a new password reset email.'
        : 'Use at least 8 characters and choose something unique to NOXA.';

  return (
    <NoxaAuthScreen
      onBack={() => router.replace('/sign-in')}
      subtitle={subtitle}
      title={title}>
      {recoveryState === 'verifying' ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : recoveryState === 'invalid' ? (
        <NoxaButton
          fullWidth
          onPress={() => router.replace('/forgot-password')}
          title="Request New Link"
        />
      ) : recoveryState === 'saved' ? (
        <NoxaButton fullWidth onPress={() => router.replace('/sign-in')} title="Back to Sign In" />
      ) : (
        <View style={styles.form}>
          <NoxaAuthField
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!isSaving}
            error={passwordError}
            label="New Password"
            onChangeText={(value) => {
              setPassword(value);
              if (passwordError) setPasswordError(undefined);
            }}
            onTogglePassword={() => setShowPassword((current) => !current)}
            passwordVisible={showPassword}
            placeholder="••••••••"
            returnKeyType="next"
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            value={password}
          />
          <NoxaAuthField
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!isSaving}
            label="Confirm Password"
            onChangeText={(value) => {
              setConfirmPassword(value);
              if (passwordError) setPasswordError(undefined);
            }}
            onSubmitEditing={() => void updatePassword()}
            onTogglePassword={() => setShowConfirmation((current) => !current)}
            passwordVisible={showConfirmation}
            placeholder="••••••••"
            returnKeyType="done"
            secureTextEntry={!showConfirmation}
            textContentType="newPassword"
            value={confirmPassword}
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.submit}>
            <NoxaButton
              disabled={isSaving}
              fullWidth
              loading={isSaving}
              onPress={() => void updatePassword()}
              title="Update Password"
            />
          </View>
        </View>
      )}
    </NoxaAuthScreen>
  );
}

const styles = StyleSheet.create({
  centerState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: 14,
  },
  submit: {
    marginTop: spacing.sm,
  },
  formError: {
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: typography.lineHeight.caption,
  },
});
