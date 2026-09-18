import { Redirect, Tabs, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PushNotificationBridge } from '@/src/features/notifications/PushNotificationBridge';
import { NoxaFloatingTabBar } from '@/src/components/navigation/NoxaFloatingTabBar';
import { resolveOnboardingCompletion } from '@/src/lib/onboarding';
import { supabase } from '@/src/lib/supabase';
import {
  hasCompletedVisibilitySetup,
  markVisibilitySetupComplete,
} from '@/src/lib/visibilitySetup';
import { colors } from '@/src/theme/colors';

type TabDestination =
  | 'ready'
  | '/welcome'
  | '/'
  | '/onboarding'
  | '/choose-username'
  | '/visibility-setup'
  | null;

export default function TabLayout() {
  const [destination, setDestination] = useState<TabDestination>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

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

      if (onboardingState === 'unknown') {
        setDestination('/');
        return;
      }

      if (
        onboardingState === 'profile' &&
        !hasCompletedVisibilitySetup(user.id)
      ) {
        markVisibilitySetupComplete(user.id, 'ghost');
      }

      const visibilityComplete = hasCompletedVisibilitySetup(user.id);

      if (visibilityComplete) {
        setDestination('ready');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (!profileError && !profile?.username?.trim()) {
        setDestination('/choose-username');
        return;
      }

      if (!visibilityComplete) {
        setDestination('/visibility-setup');
      }
    }

    void checkAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!destination) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (destination !== 'ready') {
    return <Redirect href={destination as Href} />;
  }

  return (
    <>
      <PushNotificationBridge />
      <Tabs
        tabBar={(props) => <NoxaFloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}>
        <Tabs.Screen name="crews" options={{ title: 'Crews' }} />
        <Tabs.Screen name="events" options={{ title: 'Events' }} />
        <Tabs.Screen name="index" options={{ title: 'Map' }} />
        <Tabs.Screen name="garage" options={{ title: 'Garage' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
