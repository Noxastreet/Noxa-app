import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import '@/src/lib/liveDrive';
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

export default function RootLayout() {
  return (
    <ThemeProvider value={noxaTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="blocked-users" />
        <Stack.Screen name="delete-account" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms-of-service" />
        <Stack.Screen name="search" />
        <Stack.Screen name="(tabs)" />
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
  );
}
