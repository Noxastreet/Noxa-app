import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NoxaAuthField, NoxaAuthScreen, NoxaSocialAuth } from '@/src/components/auth';
import { NoxaButton } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { resetToAuthenticatedApp } from '@/src/navigation/authNavigation';
import { colors, radius, spacing, typography } from '@/src/theme';

type SignUpErrors = {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  submit?: string;
};

const emailPattern = /^\S+@\S+\.\S+$/;

export default function SignUpScreen() {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  return (
    <NoxaAuthScreen
      footer={
        <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in')} style={styles.switchButton}>
          <Text style={styles.switchText}>
            {pendingEmail ? 'Already confirmed? ' : 'Already have an account? '}
            <Text style={styles.switchLink}>Sign In</Text>
          </Text>
        </Pressable>
      }
      onBack={() => {
        if (pendingEmail) {
          setPendingEmail(null);
          return;
        }

        router.back();
      }}
      subtitle={
        pendingEmail
          ? `We sent a secure confirmation link to ${pendingEmail}.`
          : 'Start your automotive journey today.'
      }
      title={pendingEmail ? 'Check your inbox.' : 'Join NOXA.'}>
      {pendingEmail ? (
        <EmailConfirmationPending />
      ) : (
        <SignUpForm onConfirmationRequired={setPendingEmail} />
      )}
    </NoxaAuthScreen>
  );
}

function EmailConfirmationPending() {
  return (
    <View style={styles.confirmationState}>
      <View style={styles.confirmationIcon}>
        <Ionicons color={colors.success} name="mail-outline" size={34} />
      </View>
      <Text style={styles.confirmationTitle}>Confirm on this phone</Text>
      <Text style={styles.confirmationText}>
        Tap “Confirm email address” in the newest NOXA email. The link will return you to NOXA and
        open your account automatically.
      </Text>
    </View>
  );
}

function SignUpForm({
  onConfirmationRequired,
}: {
  onConfirmationRequired: (email: string) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const nextErrors: SignUpErrors = {};

    if (!displayName.trim()) {
      nextErrors.displayName = 'Display name is required.';
    }
    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!emailPattern.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords must match.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: Linking.createURL('/auth/callback'),
          data: {
            display_name: displayName.trim(),
          },
        },
      });

      if (error) {
        setErrors({ submit: error.message });
        return;
      }

      if (data.session) {
        resetToAuthenticatedApp(data.session.user.id);
        return;
      }

      if (data.user) {
        onConfirmationRequired(normalizedEmail);
      }
    } catch {
      setErrors({ submit: 'Unable to create your account. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.form}>
      <NoxaAuthField
        editable={!isSubmitting}
        error={errors.displayName}
        label="Full Name"
        onChangeText={setDisplayName}
        placeholder="Matteo Romano"
        returnKeyType="next"
        textContentType="name"
        value={displayName}
      />
      <NoxaAuthField
        autoCapitalize="none"
        autoComplete="email"
        editable={!isSubmitting}
        error={errors.email}
        inputMode="email"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        placeholder="you@example.com"
        returnKeyType="next"
        textContentType="emailAddress"
        value={email}
      />
      <NoxaAuthField
        autoCapitalize="none"
        autoComplete="new-password"
        editable={!isSubmitting}
        error={errors.password}
        label="Password"
        onChangeText={setPassword}
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
        editable={!isSubmitting}
        error={errors.confirmPassword}
        label="Confirm Password"
        onChangeText={setConfirmPassword}
        onTogglePassword={() => setShowPassword((current) => !current)}
        passwordVisible={showPassword}
        placeholder="••••••••"
        returnKeyType="done"
        secureTextEntry={!showPassword}
        textContentType="newPassword"
        value={confirmPassword}
      />

      <Text style={styles.agreement}>
        By creating an account, you confirm you are at least 16 and agree to the NOXA{' '}
        <Text
          accessibilityRole="link"
          onPress={() => router.push('/terms-of-service')}
          style={styles.agreementLink}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text
          accessibilityRole="link"
          onPress={() => router.push('/privacy-policy')}
          style={styles.agreementLink}>
          Privacy Policy
        </Text>
        .
      </Text>
      {errors.submit ? <Text style={styles.error}>{errors.submit}</Text> : null}

      <View style={styles.submit}>
        <NoxaButton
          disabled={isSubmitting}
          fullWidth
          loading={isSubmitting}
          onPress={handleCreateAccount}
          title="Create Account"
        />
      </View>
      <NoxaSocialAuth />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  agreement: {
    color: colors.textSubtle,
    fontFamily: typography.fontFamily.body,
    fontSize: 11,
    lineHeight: 17,
  },
  agreementLink: {
    color: colors.primaryHover,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  error: {
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: typography.lineHeight.caption,
  },
  confirmationState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  confirmationIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.3)',
    backgroundColor: 'rgba(48,209,88,0.12)',
  },
  confirmationTitle: {
    marginTop: spacing.lg,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '800',
    lineHeight: typography.lineHeight.title,
    textAlign: 'center',
  },
  confirmationText: {
    maxWidth: 310,
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
    textAlign: 'center',
  },
  submit: {
    marginTop: 10,
  },
  switchButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  switchLink: {
    color: colors.primaryHover,
    fontWeight: '600',
  },
});
