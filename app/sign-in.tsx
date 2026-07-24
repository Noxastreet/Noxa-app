import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NoxaAuthField, NoxaAuthScreen } from '@/src/components/auth';
import { NoxaButton } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { colors, spacing, typography } from '@/src/theme';

type SignInErrors = {
  email?: string;
  password?: string;
  form?: string;
};

const emailPattern = /^\S+@\S+\.\S+$/;

function getSignInErrorMessage(message?: string) {
  if (message === 'Invalid login credentials') {
    return 'Incorrect email or password.';
  }

  if (message === 'Email not confirmed') {
    return 'Confirm your email before signing in.';
  }

  if (message === 'Network request failed') {
    return 'Unable to connect. Check your internet connection.';
  }

  return 'Unable to sign in. Please try again.';
}

export default function SignInScreen() {
  return (
    <NoxaAuthScreen
      footer={
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/sign-up')} style={styles.switchButton}>
            <Text style={styles.switchText}>
              Don&apos;t have an account? <Text style={styles.switchLink}>Sign Up</Text>
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/forgot-password')}
            style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        </View>
      }
      onBack={() => router.back()}
      subtitle="Sign in to continue your journey."
      title="Welcome back.">
      <SignInForm />
    </NoxaAuthScreen>
  );
}

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<SignInErrors>({});

  const validate = () => {
    const nextErrors: SignInErrors = {};

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

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (isLoading || !validate()) {
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setErrors({ form: getSignInErrorMessage(error.message) });
        return;
      }

      if (data.session) {
        router.replace('/(tabs)');
      }
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? getSignInErrorMessage(error.message)
            : 'Unable to sign in. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.form}>
      <NoxaAuthField
        autoCapitalize="none"
        autoComplete="email"
        editable={!isLoading}
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
        autoComplete="password"
        editable={!isLoading}
        error={errors.password}
        label="Password"
        onChangeText={setPassword}
        onTogglePassword={() => setShowPassword((current) => !current)}
        passwordVisible={showPassword}
        placeholder="••••••••"
        returnKeyType="done"
        secureTextEntry={!showPassword}
        textContentType="password"
        value={password}
      />

      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

      <View style={styles.submit}>
        <NoxaButton
          disabled={isLoading}
          fullWidth
          loading={isLoading}
          onPress={handleSignIn}
          title="Sign In"
        />
      </View>
    </View>
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
  },
  footer: {
    alignItems: 'center',
  },
  switchButton: {
    minHeight: 32,
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
  forgotButton: {
    minHeight: 32,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  forgotText: {
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    fontWeight: '500',
  },
});
