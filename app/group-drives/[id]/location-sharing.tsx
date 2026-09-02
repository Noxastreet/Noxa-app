import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaButton, NoxaEmptyState, NoxaLoadingState } from '@/src/components/ui';
import {
  acceptGroupDriveLocationDisclosure,
  getGroupDriveLocationSession,
  loadActiveDriveRealtimeSnapshot,
  requestGroupDriveLocationPermissions,
  startGroupDriveLocationSession,
  stopGroupDriveLocationSession,
  subscribeToActiveDriveRealtime,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function GroupDriveLocationSharingScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [active, setActive] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!driveSessionId) {
      setError('This Group Drive link is invalid.');
      setLoading(false);
      return;
    }
    try {
      await loadActiveDriveRealtimeSnapshot(driveSessionId);
      setActive(true);
      const session = getGroupDriveLocationSession();
      setSharing(session?.driveSessionId === driveSessionId);
      setError(null);
    } catch (loadError) {
      setActive(false);
      setError(loadError instanceof Error ? loadError.message : 'This Active Drive is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [driveSessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!driveSessionId || !active) return;
    let disposed = false;
    let teardown: (() => Promise<void>) | null = null;

    void subscribeToActiveDriveRealtime(driveSessionId, {
      onSnapshot: () => undefined,
      onAccessRevoked: () => {
        if (disposed) return;
        setActive(false);
        setSharing(false);
        setError('Your access to this Group Drive ended.');
        void stopGroupDriveLocationSession();
      },
      onError: (syncError) => {
        if (!disposed) setError(syncError.message);
      },
    }).then((nextTeardown) => {
      if (disposed) void nextTeardown();
      else teardown = nextTeardown;
    });

    return () => {
      disposed = true;
      if (teardown) void teardown();
    };
  }, [active, driveSessionId]);

  const enableSharing = async () => {
    if (!driveSessionId || !active) return;
    setWorking(true);
    setError(null);
    try {
      const consent = acceptGroupDriveLocationDisclosure(driveSessionId);
      await requestGroupDriveLocationPermissions();
      await startGroupDriveLocationSession(consent);
      setSharing(true);
    } catch (shareError) {
      setSharing(false);
      setError(shareError instanceof Error ? shareError.message : 'Location sharing could not be started.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <NoxaLoadingState label="Checking Active Drive…" />
      </Screen>
    );
  }

  if (!active) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <NoxaEmptyState
          icon="location-outline"
          title="Location sharing unavailable"
          body={error ?? 'This Group Drive is no longer active.'}
        />
        <NoxaButton fullWidth variant="secondary" title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <View style={styles.headerIcon}>
        <Ionicons name="navigate" size={26} color={colors.accent} />
      </View>
      <Text style={styles.eyebrow}>ACTIVE DRIVE</Text>
      <Text style={styles.title}>Share location with this Group Drive?</Text>
      <Text style={styles.body}>
        NOXA will share your precise location only with participants of this active Group Drive.
        Join and Ready never enable location sharing. This starts only after you confirm here.
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="people-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowText}>Visible only to authorized active participants.</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowText}>Uses precise location in foreground and background while the drive is active.</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowText}>No speed history, ranking or route-progress telemetry is stored.</Text>
        </View>
      </View>

      {sharing ? (
        <View style={styles.statusCard}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>Location sharing is active</Text>
            <Text style={styles.statusBody}>The background writer will stop if this drive ends or your access is revoked.</Text>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <NoxaButton
        fullWidth
        disabled={working || sharing}
        title={sharing ? 'Location sharing active' : working ? 'Starting…' : 'Share my location'}
        onPress={() => void enableSharing()}
      />
      <NoxaButton
        fullWidth
        variant="secondary"
        disabled={working}
        title={sharing ? 'Back to Group Drive' : 'Not now'}
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.label,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h1,
    fontWeight: '700',
    lineHeight: typography.lineHeight.h1,
    letterSpacing: typography.letterSpacing.tight,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rowText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  statusCopy: {
    flex: 1,
    gap: 3,
  },
  statusTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: typography.lineHeight.body,
  },
  statusBody: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeight.caption,
  },
  error: {
    color: colors.primaryHover,
    fontSize: typography.caption,
    lineHeight: typography.lineHeight.caption,
  },
});
