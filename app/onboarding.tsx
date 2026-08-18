import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { NoxaCompactLogo } from '@/src/components/brand';
import { NoxaButton, NoxaScreen } from '@/src/components/ui';
import { VehicleFinalizeFlow } from '@/src/features/garage/vehicle-picker/VehicleFinalizeFlow';
import { VehiclePicker, type VehiclePickerSelection } from '@/src/features/garage/vehicle-picker';
import { IntroCardDeck, type IntroCardDeckHandle, type IntroCardPage } from '@/src/features/onboarding/IntroCardDeck';
import { OnboardingIdentitySetup } from '@/src/features/onboarding/OnboardingIdentitySetup';
import { markOnboardingComplete } from '@/src/lib/onboarding';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type OnboardingStage = 'intro' | 'identity' | 'vehicle';

const pages: readonly IntroCardPage[] = [
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
    title: 'Build your identity',
    body: 'Add your profile and Garage now, or finish them later whenever you want.',
  },
];

export default function OnboardingScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === '1';
  const deckRef = useRef<IntroCardDeckHandle>(null);
  const isFinishingRef = useRef(false);
  const [stage, setStage] = useState<OnboardingStage>('intro');
  const [pageIndex, setPageIndex] = useState(0);
  const [vehicleSelection, setVehicleSelection] = useState<VehiclePickerSelection | null>(null);
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
    deckRef.current?.seek(index);
    setPageIndex(index);
  }, []);

  const finish = useCallback(() => {
    if (isFinishingRef.current || !userId) return;

    isFinishingRef.current = true;
    if (isReplay) {
      router.back();
      return;
    }

    markOnboardingComplete(userId);
    router.replace('/(tabs)');
  }, [isReplay, userId]);

  const continueFromIntro = useCallback(() => {
    if (isReplay) {
      finish();
      return;
    }

    setVehicleSelection(null);
    setStage('identity');
  }, [finish, isReplay]);

  const openVehicleSetup = useCallback(() => {
    setVehicleSelection(null);
    setStage('vehicle');
  }, []);

  const backToIntro = useCallback(() => {
    setPageIndex(pages.length - 1);
    setStage('intro');
  }, []);

  const handleBack = useCallback(() => {
    if (stage === 'vehicle') {
      if (vehicleSelection) {
        setVehicleSelection(null);
      } else {
        setStage('identity');
      }
      return true;
    }

    if (stage === 'identity') {
      backToIntro();
      return true;
    }

    if (pageIndex > 0) {
      goToPage(pageIndex - 1);
      return true;
    }

    if (isReplay) router.back();
    return true;
  }, [backToIntro, goToPage, isReplay, pageIndex, stage, vehicleSelection]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  if (isCheckingSession) {
    return <NoxaScreen padded={false}><View style={styles.loading} /></NoxaScreen>;
  }

  if (stage === 'identity' && !isReplay) {
    return (
      <NoxaScreen padded={false}>
        <OnboardingIdentitySetup onContinue={openVehicleSetup} onSkip={openVehicleSetup} />
      </NoxaScreen>
    );
  }

  if (stage === 'vehicle' && !isReplay) {
    return (
      <NoxaScreen padded={false}>
        {vehicleSelection ? (
          <VehicleFinalizeFlow
            onBackToPicker={() => setVehicleSelection(null)}
            onSaved={() => finish()}
            selection={vehicleSelection}
          />
        ) : (
          <VehiclePicker
            onCancel={() => setStage('identity')}
            onComplete={setVehicleSelection}
            onSkip={finish}
          />
        )}
      </NoxaScreen>
    );
  }

  return (
    <NoxaScreen padded={false}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <NoxaCompactLogo size="sm" />
          {isReplay ? <Text style={styles.replayLabel}>REPLAY</Text> : null}
        </View>

        <IntroCardDeck initialIndex={pageIndex} onIndexChange={setPageIndex} pages={pages} ref={deckRef} />

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
                accessibilityLabel={isReplay ? 'Close onboarding replay' : 'Skip introduction'}
                accessibilityRole="button"
                onPress={continueFromIntro}
                style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
                <Text maxFontSizeMultiplier={1.6} style={styles.skipText}>{isReplay ? 'Close' : 'Skip'}</Text>
              </Pressable>
            ) : (
              <View style={styles.skipPlaceholder} />
            )}
          </View>
          <NoxaButton
            disabled={!userId || isFinishingRef.current}
            fullWidth
            onPress={pageIndex === pages.length - 1 ? continueFromIntro : () => deckRef.current?.advance()}
            title={pageIndex === pages.length - 1 ? (isReplay ? 'Done' : 'Set up my profile') : 'Next'}
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  replayLabel: { color: colors.textSubtle, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
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
