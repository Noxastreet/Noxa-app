import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { NoxaCompactLogo } from '@/src/components/brand';
import { NoxaButton, NoxaScreen } from '@/src/components/ui';
import { markOnboardingComplete } from '@/src/lib/onboarding';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type OnboardingPage = {
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
};

const pages: readonly OnboardingPage[] = [
  {
    icon: 'map-outline',
    title: 'Find your people',
    body: 'Discover nearby drivers and meetups — right on the map.',
  },
  {
    icon: 'navigate-outline',
    title: 'Drive together',
    body: 'Explore events, join in, and plan your route.',
  },
  {
    icon: 'people-outline',
    title: 'Build your Crew',
    body: 'Bring friends together and create your own community.',
  },
  {
    icon: 'car-sport-outline',
    title: 'Show your garage',
    body: 'Add your cars and make your driver profile your own.',
  },
];

export default function OnboardingScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === '1';
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<OnboardingPage>>(null);
  const isFinishingRef = useRef(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      const authenticatedUserId = data.session?.user.id;
      if (!authenticatedUserId) {
        router.replace('/welcome');
        return;
      }

      setUserId(authenticatedUserId);
      setIsCheckingSession(false);
    }

    void checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const goToPage = useCallback((index: number) => {
    listRef.current?.scrollToIndex({ animated: false, index });
    setPageIndex(index);
  }, []);

  const finish = useCallback(() => {
    if (isFinishingRef.current || !userId) return;

    isFinishingRef.current = true;
    markOnboardingComplete(userId);
    if (isReplay) {
      router.back();
      return;
    }

    router.replace('/(tabs)');
  }, [isReplay, userId]);

  const handleBack = useCallback(() => {
    if (pageIndex > 0) {
      goToPage(pageIndex - 1);
      return true;
    }

    if (isReplay) {
      router.back();
    }
    return true;
  }, [goToPage, isReplay, pageIndex]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setPageIndex(Math.max(0, Math.min(pages.length - 1, nextIndex)));
  };

  if (isCheckingSession) {
    return <NoxaScreen padded={false}><View style={styles.loading} /></NoxaScreen>;
  }

  return (
    <NoxaScreen padded={false}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <NoxaCompactLogo size="sm" />
        </View>

        <FlatList
          ref={listRef}
          data={pages}
          horizontal
          keyExtractor={(item) => item.title}
          onMomentumScrollEnd={handleMomentumEnd}
          pagingEnabled
          renderItem={({ item, index }) => (
            <ScrollView
              accessibilityLabel={`${item.title}. ${item.body}`}
              contentContainerStyle={styles.page}
              showsVerticalScrollIndicator={false}
              style={{ width }}>
              <View style={styles.copy}>
                <View style={styles.iconFrame}>
                  <Text style={styles.step}>0{index + 1}</Text>
                  <Ionicons name={item.icon} size={36} color={colors.text} />
                </View>
                <Text maxFontSizeMultiplier={1.5} style={styles.title}>
                  {item.title}
                </Text>
                <Text maxFontSizeMultiplier={1.6} style={styles.body}>
                  {item.body}
                </Text>
              </View>
            </ScrollView>
          )}
          showsHorizontalScrollIndicator={false}
        />

        <View style={styles.footer}>
          <View style={styles.footerNavigation}>
            <View style={styles.skipPlaceholder} />
            <View
              accessibilityLabel={`Page ${pageIndex + 1} of ${pages.length}`}
              accessible
              style={styles.indicators}>
              {pages.map((page, index) => (
                <View
                  key={page.title}
                  style={[styles.indicator, index === pageIndex && styles.indicatorActive]}
                />
              ))}
            </View>
            {pageIndex < pages.length - 1 ? (
              <Pressable
                accessibilityLabel="Skip onboarding"
                accessibilityRole="button"
                onPress={finish}
                style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
                <Text maxFontSizeMultiplier={1.6} style={styles.skipText}>Skip</Text>
              </Pressable>
            ) : (
              <View style={styles.skipPlaceholder} />
            )}
          </View>
          <NoxaButton
            disabled={!userId || isFinishingRef.current}
            fullWidth
            onPress={pageIndex === pages.length - 1 ? finish : () => goToPage(pageIndex + 1)}
            title={pageIndex === pages.length - 1 ? 'Get started' : 'Next'}
          />
        </View>
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skipButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipPlaceholder: { width: 44, height: 44 },
  skipText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: 13,
    fontWeight: '500',
  },
  pressed: { opacity: 0.65 },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  copy: { maxWidth: 520, gap: spacing.lg },
  iconFrame: {
    width: 88,
    height: 88,
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primarySubtle,
    backgroundColor: colors.surface,
  },
  step: {
    color: colors.textSubtle,
    fontFamily: typography.fontFamily.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.label,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h1,
    fontWeight: '900',
    lineHeight: typography.lineHeight.h1,
    letterSpacing: typography.letterSpacing.tight,
  },
  body: {
    maxWidth: 440,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
  },
  footer: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  footerNavigation: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicators: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.textSubtle,
  },
  indicatorActive: { width: 24, backgroundColor: colors.primary },
});
