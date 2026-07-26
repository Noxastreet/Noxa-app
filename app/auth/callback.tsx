import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { NoxaCompactLogo } from '@/src/components/brand';
import { NoxaButton, NoxaScreen } from '@/src/components/ui';
import { createSessionFromAuthLink } from '@/src/lib/authLinks';
import { resetToAuthenticatedApp, resetToSignIn } from '@/src/navigation/authNavigation';
import { colors, radius, spacing, typography } from '@/src/theme';

type CallbackState = 'verifying' | 'error';

export default function AuthCallbackScreen() {
  const linkingUrl = Linking.useLinkingURL();
  const processedUrlRef = useRef<string | null>(null);
  const [callbackState, setCallbackState] = useState<CallbackState>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!linkingUrl || processedUrlRef.current === linkingUrl) {
      return;
    }

    processedUrlRef.current = linkingUrl;
    let active = true;

    const finishConfirmation = async () => {
      const result = await createSessionFromAuthLink(linkingUrl);

      if (!active) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.message);
        setCallbackState('error');
        return;
      }

      resetToAuthenticatedApp();
    };

    void finishConfirmation();

    return () => {
      active = false;
    };
  }, [linkingUrl]);

  useEffect(() => {
    if (linkingUrl) {
      return;
    }

    const timeout = setTimeout(() => {
      setErrorMessage('Open this screen from the confirmation email sent by NOXA.');
      setCallbackState('error');
    }, 1200);

    return () => clearTimeout(timeout);
  }, [linkingUrl]);

  return (
    <NoxaScreen>
      <View style={styles.screen}>
        <NoxaCompactLogo />

        <View style={styles.state}>
          <View style={[styles.icon, callbackState === 'error' && styles.iconError]}>
            {callbackState === 'verifying' ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : (
              <Ionicons color={colors.primaryHover} name="alert-circle-outline" size={34} />
            )}
          </View>

          <Text style={styles.title}>
            {callbackState === 'verifying' ? 'Confirming your email.' : 'Link unavailable.'}
          </Text>
          <Text style={styles.message}>
            {callbackState === 'verifying'
              ? 'One moment — NOXA is securely opening your account.'
              : errorMessage}
          </Text>

          {callbackState === 'error' ? (
            <View style={styles.action}>
              <NoxaButton fullWidth onPress={resetToSignIn} title="Back to Sign In" />
            </View>
          ) : null}
        </View>
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  icon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.32)',
    backgroundColor: colors.primarySubtle,
  },
  iconError: {
    borderColor: 'rgba(255,69,88,0.32)',
  },
  title: {
    marginTop: spacing.xl,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    fontWeight: '800',
    lineHeight: typography.lineHeight.h2,
    textAlign: 'center',
  },
  message: {
    maxWidth: 310,
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
    textAlign: 'center',
  },
  action: {
    width: '100%',
    maxWidth: 320,
    marginTop: spacing.xxl,
  },
});
