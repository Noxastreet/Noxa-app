import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { PushNotificationBridge } from '@/src/features/notifications/PushNotificationBridge';
import { resolveOnboardingCompletion } from '@/src/lib/onboarding';
import { supabase } from '@/src/lib/supabase';
import {
  hasCompletedVisibilitySetup,
  markVisibilitySetupComplete,
} from '@/src/lib/visibilitySetup';
import { colors } from '@/src/theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;
type TabDestination =
  | 'ready'
  | '/welcome'
  | '/'
  | '/onboarding'
  | '/choose-username'
  | '/visibility-setup'
  | null;

function TabIcon({
  name,
  focused,
}: {
  name: IconName;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={name}
        size={focused ? 24 : 23}
        color={focused ? colors.white : colors.textMuted}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
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

      // Returning users should not stare at a full-screen spinner while a
      // non-critical profile lookup crosses the network. A transport failure
      // is not proof that an authenticated user needs first-run setup.
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
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: [
            styles.tabBar,
            {
              bottom: insets.bottom + 8,
            },
          ],
          tabBarItemStyle: styles.tabItem,
          tabBarButton: HapticTab,
          tabBarHideOnKeyboard: true,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Map',
            tabBarAccessibilityLabel: 'Map',
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                name={focused ? 'map' : 'map-outline'}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="crews"
          options={{
            title: 'Crew',
            tabBarAccessibilityLabel: 'Crew',
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                name={focused ? 'people' : 'people-outline'}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="events"
          options={{
            title: 'Events',
            tabBarAccessibilityLabel: 'Events',
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                name={focused ? 'calendar' : 'calendar-outline'}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="garage"
          options={{
            title: 'Garage',
            tabBarAccessibilityLabel: 'Garage',
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                name={focused ? 'car-sport' : 'car-sport-outline'}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarAccessibilityLabel: 'Profile',
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                name={focused ? 'person' : 'person-outline'}
              />
            ),
          }}
        />
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
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 56,
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: 28,
    elevation: 0,
    shadowColor: colors.black,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  tabItem: {
    height: 48,
    paddingVertical: 0,
  },
  iconWrap: {
    width: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  iconWrapActive: {
    backgroundColor: colors.surfacePressed,
  },
});
