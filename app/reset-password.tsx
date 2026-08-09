import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { NoxaAuthField, NoxaAuthScreen } from '@/src/components/auth';
import { NoxaButton } from '@/src/components/ui';
import {
  acceptPasswordRecoveryUrl,
  isPasswordRecoveryUrl,
} from '@/src/lib/passwordRecoveryLink';
import { supabase } from '@/src/lib/supabase';
import { colors, spacing, typography } from '@/src/theme';

type RecoveryState = 'verifying' | 'ready' | 'invalid' | 'saved';

export default function ResetPasswordScreen() {
  const incomingUrl = Linking.useLinkingURL();
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
    let invalidTimer: ReturnType<typeof setTimeout> | null = null;

    const markReady = () => {
      if (!active) return;
      if (invalidTimer) clearTimeout(invalidTimer);
      setLinkError(null);
      setRecoveryState('ready');
    };

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) markReady();
    }).data.subscription;

    const verifyRecovery = async () => {
      const { data: existing } = await supabase.auth.getSession();
      if (!active) return;
      if (existing.session) {
        markReady();
        return;
      }

      const initialUrl = incomingUrl ?? (await Linking.getInitialURL());
      if (!active) return;

      if (initialUrl && isPasswordRecoveryUrl(initialUrl)) {
        const result = await acceptPasswordRecoveryUrl(initialUrl);
        if (!active) return;

        if (result.error) {
          setLinkError(result.error);
          setRecoveryState('invalid');
          return;
        }

        if (result.handled) {
          const { data } = await supabase.auth.getSession();
          if (!active) return;
          if (data.session) {
            markReady();
            return;
          }
        }
      }

      // Expo Router can navigate before this screen subscribes to a warm deep-link event.
      // The root bridge receives that event and creates the recovery session; give it a
      // short window before declaring the link invalid.
      invalidTimer = setTimeout(() => {
        void supabase.auth.getSession().then(({ data }) => {
          if (!active) return;
          if (data.session) {
            markReady();
            return;
          }
          setLinkError('The recovery link is incomplete or has expired.');
          setRecoveryState('invalid');
        });
      }, 1500);
    };

    setRecoveryState('verifying');
    setLinkError(null);
    void verifyRecovery();

    return () => {
      active = false;
      if (invalidTimer) clearTimeout(invalidTimer);
      subscription.unsubscribe();
    };
  }, [incomingUrl]);

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
