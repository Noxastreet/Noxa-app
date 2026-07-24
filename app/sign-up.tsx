import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NoxaAuthField, NoxaAuthScreen } from '@/src/components/auth';
import { NoxaButton } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { colors, typography } from '@/src/theme';

type SignUpErrors = {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  submit?: string;
};

const emailPattern = /^\S+@\S+\.\S+$/;

export default function SignUpScreen() {
  return (
    <NoxaAuthScreen
      footer={
        <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in')} style={styles.switchButton}>
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchLink}>Sign In</Text>
          </Text>
        </Pressable>
      }
      onBack={() => router.back()}
      subtitle="Start your automotive journey today."
      title="Join NOXA.">
      <SignUpForm />
    </NoxaAuthScreen>
  );
}

function SignUpForm() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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

    setSuccessMessage('');
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
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
        router.replace('/(tabs)');
        return;
      }

      if (data.user) {
        setSuccessMessage('Check your email to confirm your NOXA account.');
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
      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

      <View style={styles.submit}>
        <NoxaButton
          disabled={isSubmitting}
          fullWidth
          loading={isSubmitting}
          onPress={handleCreateAccount}
          title="Create Account"
        />
      </View>
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
  success: {
    color: colors.success,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: typography.lineHeight.caption,
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
