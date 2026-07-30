import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { hasCompletedOnboarding } from '@/src/lib/onboarding';
import { supabase } from '@/src/lib/supabase';
import { hasCompletedVisibilitySetup } from '@/src/lib/visibilitySetup';

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

      if (!hasCompletedOnboarding(user.id)) {
        setDestination('/onboarding');
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
