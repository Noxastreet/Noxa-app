import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoxaCompactLogo } from '@/src/components/brand';
import { NoxaButton, NoxaScreen } from '@/src/components/ui';
import {
  getLiveDriveSession,
  requestLiveDrivePermissions,
  startLiveDriveSession,
  stopLiveDriveSession,
} from '@/src/lib/liveDrive';
import { supabase } from '@/src/lib/supabase';
import {
  hasCompletedVisibilitySetup,
  markVisibilitySetupComplete,
  type VisibilitySetupChoice,
} from '@/src/lib/visibilitySetup';
import { colors, radius, spacing, typography } from '@/src/theme';

type PendingChoice = 'global' | 'ghost' | null;

function getSafeLiveDriveError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('development or store build') || message.includes('expo go')) {
    return 'Live Drive needs an installed development or store build. You are still in Ghost.';
  }
  if (message.includes('background location')) {
    return 'Background location was not allowed. You are still in Ghost.';
  }
  if (message.includes('allow location') || message.includes('foreground')) {
    return 'Location access was not allowed. You are still in Ghost.';
  }
  return 'Live Drive could not start. You are still in Ghost.';
}

export default function VisibilitySetupScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      const authenticatedUserId = data.session?.user.id;
      if (error || !authenticatedUserId) {
        router.replace('/welcome');
        return;
      }

      if (hasCompletedVisibilitySetup(authenticatedUserId)) {
        router.replace('/(tabs)');
        return;
      }

      const activeSession = getLiveDriveSession();
      if (activeSession?.userId === authenticatedUserId) {
        markVisibilitySetupComplete(
          authenticatedUserId,
          activeSession.visibilityMode,
        );
        router.replace('/(tabs)');
        return;
      }

      setUserId(authenticatedUserId);
      setIsCheckingSession(false);
    }

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const completeSetup = useCallback(
    (choice: VisibilitySetupChoice) => {
      if (!userId) return;
      markVisibilitySetupComplete(userId, choice);
      router.replace('/(tabs)');
    },
    [userId],
  );

  const continueInGhost = useCallback(async () => {
    if (!userId || pendingChoice) return;

    setPendingChoice('ghost');
    setErrorMessage(null);
    await stopLiveDriveSession(true).catch(() => undefined);
    completeSetup('ghost');
  }, [completeSetup, pendingChoice, userId]);

  const goGlobal = useCallback(async () => {
    if (!userId || pendingChoice) return;

    setPendingChoice('global');
    setErrorMessage(null);

    try {
      const initialLocation = await requestLiveDrivePermissions();
      await startLiveDriveSession(userId, 'global', initialLocation);
      completeSetup('global');
    } catch (error) {
      await stopLiveDriveSession(true).catch(() => undefined);
      setErrorMessage(getSafeLiveDriveError(error));
      setPendingChoice(null);
    }
  }, [completeSetup, pendingChoice, userId]);

  if (isCheckingSession) {
    return (
      <NoxaScreen padded={false}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </NoxaScreen>
    );
  }

  return (
    <NoxaScreen padded={false}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <NoxaCompactLogo size="sm" />
          <Text style={styles.headerLabel}>Visibility</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.copy}>
            <Text maxFontSizeMultiplier={1.5} style={styles.title}>
              Be part of the live map
            </Text>
            <Text maxFontSizeMultiplier={1.6} style={styles.body}>
              Let nearby drivers discover you while you drive. Your location is
              shared for up to 4 hours and can be turned off at any time.
            </Text>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="time-outline" size={18} color={colors.primaryHover} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailTitle}>Temporary by default</Text>
                <Text style={styles.detailBody}>Global sharing stops automatically after 4 hours.</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="eye-off-outline" size={18} color={colors.primaryHover} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailTitle}>Ghost is always available</Text>
                <Text style={styles.detailBody}>Switch off sharing whenever you choose.</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryHover} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailTitle}>Nothing starts automatically</Text>
                <Text style={styles.detailBody}>NOXA asks for location access only after you choose Global.</Text>
              </View>
            </View>
          </View>

          {errorMessage ? (
            <View accessibilityLiveRegion="polite" style={styles.errorNotice}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.primaryHover} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <NoxaButton
            disabled={!userId || pendingChoice !== null}
            fullWidth
            loading={pendingChoice === 'global'}
            onPress={goGlobal}
            title="Go Global for 4 hours"
          />
          <NoxaButton
            disabled={!userId || pendingChoice !== null}
            fullWidth
            loading={pendingChoice === 'ghost'}
            onPress={continueInGhost}
            title="Continue in Ghost"
            variant="secondary"
          />
          <Text maxFontSizeMultiplier={1.5} style={styles.footerNote}>
            You can change visibility from the Map at any time.
          </Text>
        </View>
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  headerLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  copy: {
    maxWidth: 520,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.value,
    fontWeight: '900',
  },
  body: {
    maxWidth: 520,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    ...typography.v2.body,
  },
  detailsCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  detailRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCopy: {
    flex: 1,
    gap: 2,
  },
  detailTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  detailBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 44,
    backgroundColor: colors.divider,
  },
  errorNotice: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderAccent,
  },
  errorText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  footerNote: {
    color: colors.textSubtle,
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
