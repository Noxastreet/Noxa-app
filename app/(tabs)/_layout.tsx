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
import { spacing } from '@/src/theme/spacing';

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
  color,
  emphasized = false,
}: {
  name: IconName;
  color: string;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={emphasized ? 27 : 25} color={color} />
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
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: [
            styles.tabBar,
            {
              bottom: insets.bottom,
            },
          ],
          tabBarItemStyle: styles.tabItem,
          tabBarButton: HapticTab,
          tabBarHideOnKeyboard: true,
        }}>
        <Tabs.Screen
          name="crews"
          options={{
            title: 'Crews',
            tabBarAccessibilityLabel: 'Crews',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'people' : 'people-outline'}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="events"
          options={{
            title: 'Events',
            tabBarAccessibilityLabel: 'Events',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'calendar' : 'calendar-outline'}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'Map',
            tabBarAccessibilityLabel: 'Map',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'map' : 'map-outline'}
                color={focused ? colors.accent : color}
                emphasized
              />
            ),
          }}
        />
        <Tabs.Screen
          name="garage"
          options={{
            title: 'Garage',
            tabBarAccessibilityLabel: 'Garage',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'car-sport' : 'car-sport-outline'}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarAccessibilityLabel: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'person' : 'person-outline'}
                color={color}
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
    left: spacing.sm,
    right: spacing.sm,
    height: 64,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: colors.glass,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: 22,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  tabItem: {
    height: 64,
    paddingVertical: 0,
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
