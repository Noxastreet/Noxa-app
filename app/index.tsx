import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  hasCompletedOnboarding,
  resolveOnboardingCompletion,
} from '@/src/lib/onboarding';
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
  | null;

export default function IndexRoute() {
  const [destination, setDestination] = useState<Destination>(null);

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

      const hadLocalOnboarding = hasCompletedOnboarding(user.id);
      const onboardingComplete = hadLocalOnboarding
        ? true
        : await resolveOnboardingCompletion(user.id);

      if (!isMounted) return;

      if (!onboardingComplete) {
        setDestination('/onboarding');
        return;
      }

      // Existing accounts recovered from durable server profile data may have lost
      // the old device-only visibility marker after reinstall. Recover them into
      // privacy-safe Ghost instead of forcing a completed account through setup.
      if (!hadLocalOnboarding && !hasCompletedVisibilitySetup(user.id)) {
        markVisibilitySetupComplete(user.id, 'ghost');
      }

      setDestination(
        hasCompletedVisibilitySetup(user.id) ? '/(tabs)' : '/visibility-setup',
      );
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!destination) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#E11D2E" />
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
});
