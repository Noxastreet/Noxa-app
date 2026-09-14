import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import '@/src/features/group-drive/runtime/nativeLocation';
import '@/src/lib/liveDrive';
import {
  acceptPasswordRecoveryUrl,
  isPasswordRecoveryUrl,
} from '@/src/lib/passwordRecoveryLink';
import { supabase } from '@/src/lib/supabase';
import { resetToSignedOutHome } from '@/src/navigation/authNavigation';
import { colors } from '@/src/theme/colors';

SplashScreen.setOptions({
  duration: 350,
  fade: true,
});

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

function AuthDeepLinkBridge() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (!url || !isPasswordRecoveryUrl(url)) return;
    void acceptPasswordRecoveryUrl(url);
  }, [url]);

  return null;
}

function AuthSessionBoundary() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_OUT' || session) return;
      resetToSignedOutHome();
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={noxaTheme}>
        <AuthDeepLinkBridge />
        <AuthSessionBoundary />
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
          <Stack.Screen name="group-drives" />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="event-details" />
          <Stack.Screen name="event-editor" />
          <Stack.Screen name="event-chat" />
          <Stack.Screen name="event-gallery" />
          <Stack.Screen name="event-summary" />
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
