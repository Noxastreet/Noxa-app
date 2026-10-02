import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import '@/src/features/group-drive/runtime/nativeLocation';
import '@/src/lib/liveDrive';
import { endAllGroupDriveLiveActivities } from '@/src/features/group-drive/liveActivity';
import { supabase } from '@/src/lib/supabase';
import {
  acceptPasswordRecoveryUrl,
  isPasswordRecoveryUrl,
} from '@/src/lib/passwordRecoveryLink';
import { colors } from '@/src/theme/colors';

SplashScreen.setOptions({
  duration: 350,
  fade: true,
});

const detailScreenOptions = {
  animation: 'default' as const,
  gestureEnabled: true,
  presentation: 'card' as const,
  contentStyle: { backgroundColor: colors.background },
};

const noxaTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.accent,
    text: colors.text,
  },
};

function SupabaseAuthLifecycle() {
  useEffect(() => {
    const syncAutoRefresh = (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    syncAutoRefresh(AppState.currentState);
    const subscription = AppState.addEventListener('change', syncAutoRefresh);
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        void endAllGroupDriveLiveActivities();
      }
    });

    return () => {
      subscription.remove();
      authListener.subscription.unsubscribe();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return null;
}

function AuthDeepLinkBridge() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (!url || !isPasswordRecoveryUrl(url)) return;
    void acceptPasswordRecoveryUrl(url);
  }, [url]);

  return null;
}

function DriveTogetherLiveActivityDeepLinkBridge() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (!url) return;
    const match = url.match(
      /^noxa:\/\/drive-together\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i,
    );
    const driveSessionId = match?.[1];
    if (!driveSessionId) return;

    router.push({
      pathname: '/group-drives/[id]/active',
      params: { id: driveSessionId },
    });
  }, [url]);

  return null;
}

function QuickConnectDeepLinkBridge() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (!url) return;
    const match = url.match(
      /^noxa:\/\/quick-connect\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i,
    );
    const token = match?.[1];
    if (!token) return;

    router.push({
      pathname: '/quick-connect',
      params: { mode: 'connect', value: token },
    });
  }, [url]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={noxaTheme}>
        <SupabaseAuthLifecycle />
        <AuthDeepLinkBridge />
        <DriveTogetherLiveActivityDeepLinkBridge />
        <QuickConnectDeepLinkBridge />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="visibility-setup" options={{ gestureEnabled: false }} />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="auth/callback" options={{ gestureEnabled: false }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="blocked-users" />
          <Stack.Screen name="delete-account" />
          <Stack.Screen name="privacy-policy" />
          <Stack.Screen name="terms-of-service" />
          <Stack.Screen name="search" />
          <Stack.Screen name="quick-connect" />
          <Stack.Screen name="group-drives" />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="event-details" options={detailScreenOptions} />
          <Stack.Screen name="driver-profile/[id]" options={detailScreenOptions} />
          <Stack.Screen name="vehicle-details" options={detailScreenOptions} />
          <Stack.Screen name="crew/[id]" options={detailScreenOptions} />
          <Stack.Screen name="event-editor" />
          <Stack.Screen name="event-chat" />
          <Stack.Screen name="event-gallery" />
          <Stack.Screen name="crew-chat" />
          <Stack.Screen name="crew-gallery" />
          <Stack.Screen name="crew-garage" />
          <Stack.Screen name="crew-calendar" />
          <Stack.Screen name="crew-polls" />
          <Stack.Screen name="convoy-setup" />
          <Stack.Screen name="post-editor" />
          <Stack.Screen name="post-details" />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
