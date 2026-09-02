import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaButton, NoxaEmptyState, NoxaLoadingState } from '@/src/components/ui';
import {
  GroupDriveHeader,
  endGroupDrive,
  leaveGroupDriveAndStopLocation,
  loadGroupDriveDetails,
  type GroupDriveDetails,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function ActiveDriveControlsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const [drive, setDrive] = useState<GroupDriveDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driveSessionId) {
      setError('This Group Drive link is invalid.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await loadGroupDriveDetails(driveSessionId);
      if (next.status !== 'active') {
        router.replace({ pathname: '/group-drives/[id]/summary', params: { id: driveSessionId } });
        return;
      }
      setDrive(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Active Drive controls could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [driveSessionId]);

  useEffect(() => { void load(); }, [load]);

  const confirmEnd = () => {
    if (!drive || drive.currentUserId !== drive.hostId || working) return;
    Alert.alert(
      'End this Group Drive?',
      'The drive will be marked completed for everyone. Exact Group Drive location rows are removed by the server and location sharing stops on this device.',
      [
        { text: 'Keep driving', style: 'cancel' },
        {
          text: 'End Drive',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            setError(null);
            try {
              await endGroupDrive(drive.id);
              router.replace({ pathname: '/group-drives/[id]/summary', params: { id: drive.id } });
            } catch (endError) {
              setError(endError instanceof Error ? endError.message : 'Group Drive could not be ended.');
              setWorking(false);
            }
          },
        },
      ],
    );
  };

  const confirmLeave = () => {
    if (!drive || drive.currentUserId === drive.hostId || working) return;
    Alert.alert(
      'Leave this Group Drive?',
      'You will immediately lose access to the Active Drive. Your exact Group Drive location row is removed by the server and location sharing stops on this device.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave Drive',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            setError(null);
            try {
              await leaveGroupDriveAndStopLocation(drive.id);
              router.replace('/group-drives');
            } catch (leaveError) {
              setError(leaveError instanceof Error ? leaveError.message : 'Group Drive could not be left.');
              setWorking(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="ACTIVE DRIVE" />
        <NoxaLoadingState label="Loading drive controls…" />
      </Screen>
    );
  }

  if (!drive) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="ACTIVE DRIVE" />
        <NoxaEmptyState
          icon="alert-circle-outline"
          title="Controls unavailable"
          body={error ?? 'This Active Drive is unavailable.'}
        />
        <NoxaButton fullWidth onPress={() => void load()} title="Retry" variant="secondary" />
        <NoxaButton fullWidth onPress={() => router.replace('/group-drives')} title="Back to Group Drives" variant="ghost" />
      </Screen>
    );
  }

  const isHost = drive.currentUserId === drive.hostId;
  const me = drive.participants.find((participant) => participant.userId === drive.currentUserId);
  const canLeave = !isHost && me?.status === 'active';

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader
        title="ACTIVE DRIVE"
        subtitle={isHost ? 'Host controls' : 'Your drive controls'}
      />

      <View style={styles.hero}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.title}>{drive.title}</Text>
        <Text style={styles.body}>
          Opening the map does not start location sharing. Sharing remains a separate, explicit action on this device.
        </Text>
      </View>

      <View style={styles.actions}>
        <NoxaButton
          fullWidth
          title="Open Active Drive"
          onPress={() => router.push({ pathname: '/group-drives/[id]/active', params: { id: drive.id } })}
        />
        <NoxaButton
          fullWidth
          variant="secondary"
          title="Share my location"
          onPress={() => router.push({ pathname: '/group-drives/[id]/location-sharing', params: { id: drive.id } })}
        />
      </View>

      <View style={styles.privacyCard}>
        <Ionicons name="shield-checkmark-outline" size={21} color={colors.textMuted} />
        <View style={styles.privacyCopy}>
          <Text style={styles.privacyTitle}>Location lifecycle</Text>
          <Text style={styles.privacyBody}>
            End, Leave, Remove, Cancel and expiry remove the relevant exact Group Drive location state on the server. Personal Live Drive is separate.
          </Text>
        </View>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <View style={styles.dangerZone}>
        <Text style={styles.dangerLabel}>{isHost ? 'HOST CONTROL' : 'LEAVE DRIVE'}</Text>
        {isHost ? (
          <NoxaButton fullWidth loading={working} onPress={confirmEnd} title="End Group Drive" variant="danger" />
        ) : canLeave ? (
          <NoxaButton fullWidth loading={working} onPress={confirmLeave} title="Leave Group Drive" variant="danger" />
        ) : (
          <Text style={styles.unavailable}>Your participant access is no longer active.</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  hero: { gap: spacing.sm, paddingTop: spacing.lg },
  livePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.value,
    fontWeight: '900',
  },
  body: { color: colors.textMuted, ...typography.v2.body },
  actions: { gap: spacing.sm },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  privacyCopy: { flex: 1, gap: spacing.xxs },
  privacyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  privacyBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  dangerZone: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  dangerLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  unavailable: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.primaryHover, fontSize: 13, fontWeight: '700' },
});
