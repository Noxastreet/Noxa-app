import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { NoxaCompactLogo } from '@/src/components/brand';
import { useResponsive } from '@/src/hooks/useResponsive';
import { NoxaButton } from '@/src/components/ui';
import { colors, spacing, typography } from '@/src/theme';

const WELCOME_HERO_IMAGE =
  'https://images.unsplash.com/photo-1775935925972-8a2bbed63ce4?w=800&h=1200&fit=crop&auto=format';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();

  const headlineSize = Math.min(
    64,
    Math.max(44, responsive.width * 0.144),
  );

  const descriptionMaxWidth = responsive.isTablet
    ? 420
    : Math.min(
        300,
        responsive.width - responsive.gutter * 2,
      );

  return (
    <View style={styles.screen}>
      <Image
        accessibilityLabel="Performance car at night"
        cachePolicy="memory-disk"
        contentFit="cover"
        source={{ uri: WELCOME_HERO_IMAGE }}
        style={StyleSheet.absoluteFillObject}
        transition={220}
      />
      <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFillObject} width="100%">
        <Defs>
          <LinearGradient id="welcomeFade" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity="0.3" />
            <Stop offset="0.25" stopColor={colors.background} stopOpacity="0.1" />
            <Stop offset="0.6" stopColor={colors.background} stopOpacity="0.65" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0.99" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#welcomeFade)" height="100%" width="100%" />
      </Svg>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            width: '100%',
            maxWidth: responsive.contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: responsive.gutter,
            paddingTop:
              Math.max(insets.top, spacing.md) +
              spacing.md,
            paddingBottom:
              Math.max(insets.bottom, spacing.md) +
              spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <NoxaCompactLogo />

        <View
          style={[
            styles.heroSpace,
            {
              minHeight: responsive.isCompactHeight
                ? 72
                : responsive.vertical(150),
            },
          ]}
        />

        <View style={styles.bottomContent}>
          <Text style={styles.eyebrow}>Premium Automotive Community</Text>
          <Text
            style={[
              styles.headline,
              {
                fontSize: headlineSize,
                lineHeight: headlineSize * 0.96,
              },
            ]}>
            YOUR WORLD.{'\n'}
            <Text style={styles.headlineAccent}>ON THE ROAD.</Text>
          </Text>
          <Text
            style={[
              styles.description,
              { maxWidth: descriptionMaxWidth },
            ]}>
            Connect with passionate drivers. Discover exclusive events. Join crews that match your drive.
          </Text>

          <View style={styles.actions}>
            <NoxaButton fullWidth onPress={() => router.push('/sign-up')} title="Create Account" />
            <NoxaButton fullWidth onPress={() => router.push('/sign-in')} title="Sign In" variant="overlay" />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)')}
            style={({ pressed }) => [styles.guestButton, pressed && styles.guestButtonPressed]}>
            <Text style={styles.guestText}>Continue as Guest</Text>
          </Pressable>

          <Text style={styles.legal}>
            By continuing you agree to our Terms of Service{'\n'}and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
  },
  heroSpace: {
    flex: 1,
  },
  bottomContent: {
    width: '100%',
  },
  eyebrow: {
    marginBottom: 8,
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.body,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  headline: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  headlineAccent: {
    color: colors.primary,
  },
  description: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
    color: 'rgba(240,240,244,0.62)',
    fontFamily: typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 22,
  },
  actions: {
    gap: 10,
  },
  guestButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  guestButtonPressed: {
    opacity: 0.6,
  },
  guestText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    fontWeight: '500',
  },
  legal: {
    marginTop: spacing.xs,
    color: colors.textSubtle,
    fontFamily: typography.fontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
