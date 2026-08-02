import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { NoxaAppleAuthButton } from '@/src/components/auth/NoxaAppleAuthButton';
import { NoxaGoogleAuthButton } from '@/src/components/auth/NoxaGoogleAuthButton';
import { hasCompletedOnboarding } from '@/src/lib/onboarding';
import {
  getSocialAuthErrorMessage,
  signInWithApple,
  signInWithGoogle,
} from '@/src/lib/socialAuth';
import { colors, spacing, typography } from '@/src/theme';

type SocialProvider = 'apple' | 'google';

export function NoxaSocialAuth() {
  const [activeProvider, setActiveProvider] = useState<SocialProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (Platform.OS === 'ios') {
      void AppleAuthentication.isAvailableAsync().then((available) => {
        if (mounted) setAppleAvailable(available);
      });
    }

    if (Platform.OS === 'android') {
      void WebBrowser.warmUpAsync();
    }

    return () => {
      mounted = false;
      if (Platform.OS === 'android') {
        void WebBrowser.coolDownAsync();
      }
    };
  }, []);

  const continueAfterAuth = (userId: string) => {
    router.replace(hasCompletedOnboarding(userId) ? '/(tabs)' : '/onboarding');
  };

  const handleProvider = async (provider: SocialProvider) => {
    if (activeProvider) return;

    setActiveProvider(provider);
    setErrorMessage(null);

    try {
      const result = provider === 'google'
        ? await signInWithGoogle()
        : await signInWithApple();

      if (result.status === 'success') {
        continueAfterAuth(result.userId);
      }
    } catch (error) {
      setErrorMessage(getSocialAuthErrorMessage(provider, error));
    } finally {
      setActiveProvider(null);
    }
  };

  const isBusy = activeProvider !== null;

  return (
    <View style={styles.section}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <NoxaGoogleAuthButton
        disabled={isBusy}
        loading={activeProvider === 'google'}
        onPress={() => void handleProvider('google')}
      />

      {appleAvailable ? (
        <NoxaAppleAuthButton
          disabled={isBusy}
          onPress={() => void handleProvider('apple')}
        />
      ) : null}

      {errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
  dividerText: {
    color: colors.textSubtle,
    fontFamily: typography.fontFamily.body,
    fontSize: 11,
    lineHeight: 16,
  },
  error: {
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: typography.lineHeight.caption,
  },
});
