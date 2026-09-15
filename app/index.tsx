import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveOnboardingCompletion } from '@/src/lib/onboarding';
import { supabase } from '@/src/lib/supabase';
import {
  hasCompletedVisibilitySetup,
  markVisibilitySetupComplete,
} from '@/src/lib/visibilitySetup';

type Destination =
  | '/welcome'
  | '/onboarding'
  | '/visibility-setup'
  | '/(tabs)'
  | 'retry'
  | null;

export default function IndexRoute() {
  const [destination, setDestination] = useState<Destination>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      const user = data.session?.user;

      if (error || !user) {
        setDestination('/welcome');
        return;
      }

      const onboardingState = await resolveOnboardingCompletion(user.id);
      if (!isMounted) return;

      if (onboardingState === 'incomplete') {
        setDestination('/onboarding');
        return;
      }

      // A server-confirmed returning account may be opening NOXA on a new or
      // cleared install. Restore the privacy-safe local default without
      // replaying first-run visibility setup or starting location sharing.
      if (
        onboardingState === 'profile' &&
        !hasCompletedVisibilitySetup(user.id)
      ) {
        markVisibilitySetupComplete(user.id, 'ghost');
      }

      if (onboardingState === 'unknown') {
        // A transport failure is not proof that this account is new or fully
        // configured. Keep the user out of false onboarding and offer Retry.
        setDestination('retry');
        return;
      }

      setDestination(
        hasCompletedVisibilitySetup(user.id) ? '/(tabs)' : '/visibility-setup',
      );
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, [retryKey]);

  if (!destination) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#E11D2E" />
      </View>
    );
  }

  if (destination === 'retry') {
    return (
      <View style={styles.recovery}>
        <Text style={styles.recoveryTitle}>ACCOUNT CHECK UNAVAILABLE</Text>
        <Text style={styles.recoveryBody}>
          NOXA could not verify your profile setup. Your account has not been changed.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setDestination(null);
            setRetryKey((value) => value + 1);
          }}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}>
          <Text style={styles.retryText}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }

  return <Redirect href={destination as Href} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050608',
  },
  recovery: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 28,
    backgroundColor: '#050608',
  },
  recoveryTitle: { color: '#F4F4F5', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  recoveryBody: { color: '#9A9AA3', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: '#C8102E',
  },
  retryPressed: { opacity: 0.78 },
  retryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
});
