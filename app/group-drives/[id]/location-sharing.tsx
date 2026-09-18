import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaButton, NoxaEmptyState, NoxaLoadingState } from '@/src/components/ui';
import {
  acceptGroupDriveLocationDisclosure,
  clearPendingGroupDriveServerAction,
  getGroupDriveLocationSession,
  getPendingGroupDriveServerAction,
  loadActiveDriveLifecycleSnapshot,
  requestGroupDriveLocationPermissions,
  retryGroupDriveLocationCleanup,
  startGroupDriveLocationSession,
  stopGroupDriveLocationSession,
  stopGroupDriveLocationSharing,
  subscribeToActiveDriveAccess,
} from '@/src/features/group-drive';
import { getCurrentSessionUser } from '@/src/lib/supabase';
import { GroupDriveHeader } from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function GroupDriveLocationSharingScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [active, setActive] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!driveSessionId) {
      setError('This Group Drive link is invalid.');
      setLoading(false);
      return;
    }
    try {
      const currentUser = await getCurrentSessionUser();
      if (!currentUser) throw new Error('Sign in to open this Active Drive.');
      await loadActiveDriveLifecycleSnapshot(driveSessionId);
      setCurrentUserId(currentUser.id);
      setActive(true);
      const session = getGroupDriveLocationSession();
      const isSharing = session?.driveSessionId === driveSessionId && session.userId === currentUser.id;
      setSharing(isSharing);

      const pending = getPendingGroupDriveServerAction(
        currentUser.id,
        driveSessionId,
      );
      if (isSharing && pending?.kind === 'clear_location') {
        // A new explicit sharing session supersedes an older cleanup intent for
        // this account only. Other accounts on the device keep their own state.
        clearPendingGroupDriveServerAction(
          currentUser.id,
          'clear_location',
          driveSessionId,
        );
        setCleanupPending(false);
      } else {
        setCleanupPending(pending?.kind === 'clear_location');
      }
      setError(null);
    } catch (loadError) {
      setActive(false);
      setCurrentUserId(null);
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

    void subscribeToActiveDriveAccess(driveSessionId, {
      onAccessRevoked: () => {
        if (disposed) return;
        const revokedUserId = currentUserId;
        setActive(false);
        setSharing(false);
        setCleanupPending(false);
        setError('Your access to this Group Drive ended.');
        void stopGroupDriveLocationSession();
        // Preserve retry state across sign-out/account switches. Clear it only
        // when the same account is still authenticated and server access ended.
        if (revokedUserId) {
          void getCurrentSessionUser().then((user) => {
            if (user?.id === revokedUserId) {
              clearPendingGroupDriveServerAction(
                revokedUserId,
                undefined,
                driveSessionId,
              );
            }
          });
        }
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
  }, [active, currentUserId, driveSessionId]);

  const enableSharing = async () => {
    if (!driveSessionId || !active || !currentUserId) return;
    setWorking(true);
    setError(null);
    try {
      const consent = acceptGroupDriveLocationDisclosure(driveSessionId);
      await requestGroupDriveLocationPermissions();
      await startGroupDriveLocationSession(consent);
      clearPendingGroupDriveServerAction(
        currentUserId,
        'clear_location',
        driveSessionId,
      );
      setCleanupPending(false);
      setSharing(true);
    } catch (shareError) {
      setSharing(false);
      setError(shareError instanceof Error ? shareError.message : 'Location sharing could not be started.');
    } finally {
      setWorking(false);
    }
  };

  const disableSharing = async () => {
    if (!driveSessionId || !active) return;
    setWorking(true);
    setError(null);
    try {
      const result = await stopGroupDriveLocationSharing(driveSessionId);
      setSharing(false);
      setCleanupPending(!result.serverCleared);
      if (!result.serverCleared) {
        setError(
          'Sharing stopped on this device. Removing the last server position is waiting for network confirmation.',
        );
      }
    } catch (stopError) {
      setSharing(false);
      setCleanupPending(true);
      setError(
        stopError instanceof Error
          ? stopError.message
          : 'Sharing stopped on this device. Server cleanup still needs confirmation.',
      );
    } finally {
      setWorking(false);
    }
  };

  const retryCleanup = async () => {
    if (!driveSessionId || !active) return;
    setWorking(true);
    setError(null);
    try {
      const result = await retryGroupDriveLocationCleanup(driveSessionId);
      setCleanupPending(!result.serverCleared);
      if (!result.serverCleared) {
        setError('Server cleanup is still waiting for a working network connection.');
      }
    } catch (cleanupError) {
      setCleanupPending(true);
      setError(cleanupError instanceof Error ? cleanupError.message : 'Server cleanup could not be confirmed.');
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
      <GroupDriveHeader
        title="Location sharing"
        subtitle="Active Group Drive"
      />
      <Text style={styles.title}>Share only when you choose</Text>
      <Text style={styles.body}>
        NOXA shares your precise location only with participants of this active Group Drive.
        Join and Ready never enable sharing. You can stop Group Drive sharing at any time and stay in the drive.
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="people-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowText}>Visible only to authorized active participants.</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowText}>Uses precise location in foreground and background while sharing is active.</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowText}>Personal Live Drive / Ghost is separate from Group Drive sharing.</Text>
        </View>
      </View>

      {sharing ? (
        <View style={styles.statusCard}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>Group Drive sharing is on</Text>
            <Text style={styles.statusBody}>You can stop sharing without leaving this Group Drive.</Text>
          </View>
        </View>
      ) : cleanupPending ? (
        <View style={styles.statusCard}>
          <Ionicons name="cloud-offline-outline" size={22} color={colors.warning} />
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>Sharing is off on this device</Text>
            <Text style={styles.statusBody}>Server cleanup is waiting for confirmation. No new local updates are being sent.</Text>
          </View>
        </View>
      ) : (
        <View style={styles.statusCard}>
          <Ionicons name="location-outline" size={22} color={colors.textMuted} />
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>Group Drive sharing is off</Text>
            <Text style={styles.statusBody}>You remain an active participant without publishing your location.</Text>
          </View>
        </View>
      )}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      {sharing ? (
        <NoxaButton
          fullWidth
          variant="danger"
          loading={working}
          title="Stop Group Drive sharing"
          onPress={() => void disableSharing()}
        />
      ) : cleanupPending ? (
        <NoxaButton
          fullWidth
          variant="secondary"
          loading={working}
          title="Retry server cleanup"
          onPress={() => void retryCleanup()}
        />
      ) : (
        <NoxaButton
          fullWidth
          loading={working}
          title={working ? 'Starting…' : 'Share my location'}
          onPress={() => void enableSharing()}
        />
      )}
      <NoxaButton
        fullWidth
        variant="secondary"
        disabled={working}
        title="Back to Group Drive"
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

  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
  },
  card: {
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
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
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
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
