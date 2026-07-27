import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { NoxaCompactLogo } from '@/src/components/brand';
import { colors, spacing, typography } from '@/src/theme';

const AUTH_HERO_IMAGE =
  'https://images.unsplash.com/photo-1771726588790-7db55012b68a?w=800&h=600&fit=crop&auto=format';
const AUTH_HERO_SOURCE = { uri: AUTH_HERO_IMAGE };

type NoxaAuthScreenProps = {
  children: ReactNode;
  footer?: ReactNode;
  onBack: () => void;
  subtitle: string;
  title: string;
};

export function NoxaAuthScreen({ children, footer, onBack, subtitle, title }: NoxaAuthScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={AUTH_HERO_SOURCE}
        style={styles.heroImage}
        transition={220}
      />
      <Svg height={260} pointerEvents="none" style={styles.heroGradient} width="100%">
        <Defs>
          <LinearGradient id="authHeroFade" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity="0.42" />
            <Stop offset="0.48" stopColor={colors.background} stopOpacity="0.74" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#authHeroFade)" height="100%" width="100%" />
      </Svg>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, spacing.md) + spacing.sm,
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg,
            },
          ]}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
              <Ionicons color={colors.primaryHover} name="chevron-back" size={22} />
            </Pressable>
            <NoxaCompactLogo size="sm" />
          </View>

          <View style={styles.heroSpace} />

          <View style={styles.body}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            {children}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    opacity: 0.76,
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  heroSpace: {
    height: 82,
  },
  body: {
    flex: 1,
  },
  titleBlock: {
    marginBottom: 28,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 50,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    marginTop: 18,
  },
});
