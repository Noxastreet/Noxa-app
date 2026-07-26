import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { hasCompletedOnboarding } from '@/src/lib/onboarding';
import { supabase } from '@/src/lib/supabase';

type Destination = '/welcome' | '/onboarding' | '/(tabs)' | null;

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

      setDestination(hasCompletedOnboarding(user.id) ? '/(tabs)' : '/onboarding');
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
