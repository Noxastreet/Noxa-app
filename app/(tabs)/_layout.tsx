import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useGlobalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { PushNotificationBridge } from '@/src/features/notifications/PushNotificationBridge';
import { resolveOnboardingCompletion } from '@/src/lib/onboarding';
import { supabase } from '@/src/lib/supabase';
import {
  hasCompletedVisibilitySetup,
  markVisibilitySetupComplete,
} from '@/src/lib/visibilitySetup';
import { animations } from '@/src/theme/animations';
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
  focused = false,
}: {
  name: IconName;
  color: string;
  emphasized?: boolean;
  focused?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const focusProgress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    const nextValue = focused ? 1 : 0;
    focusProgress.value = reduceMotion
      ? nextValue
      : withTiming(nextValue, {
          duration: animations.micro,
          easing: Easing.out(Easing.cubic),
        });
  }, [focusProgress, focused, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + focusProgress.value * 0.28,
    transform: [
      { translateY: focusProgress.value * -1 },
      { scale: 1 + focusProgress.value * 0.06 },
    ],
  }));

  return (
    <Animated.View style={[styles.iconWrap, animatedStyle]}>
      <Ionicons name={name} size={emphasized ? 24 : 22} color={color} />
    </Animated.View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const params = useGlobalSearchParams<{ mapMode?: string | string[] }>();
  const rawMapMode = Array.isArray(params.mapMode) ? params.mapMode[0] : params.mapMode;
  const navigationMode = rawMapMode === 'route';
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
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSubtle,
          tabBarStyle: navigationMode
            ? { display: 'none' }
            : [
                styles.tabBar,
                {
                  height: 64 + insets.bottom,
                  paddingBottom: Math.max(insets.bottom, spacing.sm),
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
            tabBarLabel: ({ focused }) => <TabLabel label="Crews" focused={focused} />,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? 'people' : 'people-outline'} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="events"
          options={{
            title: 'Events',
            tabBarLabel: ({ focused }) => <TabLabel label="Events" focused={focused} />,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'Map',
            tabBarLabel: ({ focused }) => <TabLabel label="Map" focused={focused} />,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'map' : 'map-outline'}
                color={color}
                emphasized
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="garage"
          options={{
            title: 'Garage',
            tabBarLabel: ({ focused }) => <TabLabel label="Garage" focused={focused} />,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? 'car-sport' : 'car-sport-outline'}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarLabel: ({ focused }) => <TabLabel label="Profile" focused={focused} />,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} />
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
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    backgroundColor: colors.glass,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    elevation: 0,
  },
  tabItem: {
    paddingVertical: 0,
  },
  label: {
    marginTop: 2,
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: colors.text,
    fontWeight: '600',
  },
  iconWrap: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
