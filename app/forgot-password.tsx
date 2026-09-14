import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NoxaAuthField, NoxaAuthScreen } from '@/src/components/auth';
import { NoxaButton } from '@/src/components/ui';
import {
  AUTH_EMAIL_RESEND_COOLDOWN_SECONDS,
  PASSWORD_RECOVERY_REDIRECT_URI,
} from '@/src/lib/authRedirects';
import { supabase } from '@/src/lib/supabase';
import { colors, spacing, typography } from '@/src/theme';

const emailPattern = /^\S+@\S+\.\S+$/;

function backToSignIn() {
  router.replace('/sign-in');
}

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const sendResetLink = async (targetEmail?: string) => {
    if (isLoading) return;

    const normalizedEmail = (targetEmail ?? email).trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailError('Email is required.');
      return;
    }
    if (!emailPattern.test(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setEmailError(undefined);
    setFormError(null);
    setStatusMessage(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: PASSWORD_RECOVERY_REDIRECT_URI,
      });

      if (error) {
        setFormError(
          error.message.toLowerCase().includes('rate')
            ? 'Please wait before requesting another reset email.'
            : 'Unable to send the reset email. Please try again.',
        );
        return;
      }

      setSentTo(normalizedEmail);
      setSecondsRemaining(AUTH_EMAIL_RESEND_COOLDOWN_SECONDS);
      if (targetEmail) {
        setStatusMessage('A new password reset email was sent.');
      }
    } catch {
      setFormError('Unable to connect. Check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resendTitle =
    secondsRemaining > 0 ? `Resend in ${secondsRemaining}s` : 'Resend reset email';

  return (
    <NoxaAuthScreen
      onBack={backToSignIn}
      subtitle={
        sentTo
          ? `We sent a reset link to ${sentTo}. Check your spam folder if you do not see it.`
          : "Enter the email address linked to your NOXA account. We'll send you a reset link."
      }
      title={sentTo ? 'Check your inbox.' : 'Reset password.'}>
      {sentTo ? (
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Ionicons color={colors.success} name="checkmark" size={34} />
          </View>
          <View style={styles.successActions}>
            <NoxaButton
              disabled={isLoading || secondsRemaining > 0}
              fullWidth
              loading={isLoading}
              onPress={() => void sendResetLink(sentTo)}
              title={resendTitle}
              variant="secondary"
            />
            <NoxaButton fullWidth onPress={backToSignIn} title="Back to Sign In" variant="secondary" />
          </View>
          {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        </View>
      ) : (
        <View style={styles.form}>
          <NoxaAuthField
            autoCapitalize="none"
            autoComplete="email"
            editable={!isLoading}
            error={emailError}
            inputMode="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={(value) => {
              setEmail(value);
              if (emailError) setEmailError(undefined);
            }}
            onSubmitEditing={() => void sendResetLink()}
            placeholder="you@example.com"
            returnKeyType="send"
            textContentType="emailAddress"
            value={email}
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.submit}>
            <NoxaButton
              disabled={isLoading}
              fullWidth
              loading={isLoading}
              onPress={() => void sendResetLink()}
              title="Send Reset Link"
            />
          </View>

          <Text onPress={backToSignIn} style={styles.backLink}>
            Back to <Text style={styles.backLinkAccent}>Sign In</Text>
          </Text>
        </View>
      )}
    </NoxaAuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  submit: {
    marginTop: 10,
  },
  formError: {
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: typography.lineHeight.caption,
    textAlign: 'center',
  },
  backLink: {
    minHeight: 40,
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 40,
    textAlign: 'center',
  },
  backLinkAccent: {
    color: colors.primaryHover,
    fontWeight: '600',
  },
  successContent: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  successIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.3)',
    backgroundColor: 'rgba(48,209,88,0.12)',
  },
  successActions: {
    width: '100%',
    gap: spacing.sm,
  },
  statusMessage: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.caption,
    lineHeight: typography.lineHeight.caption,
    textAlign: 'center',
  },
});
