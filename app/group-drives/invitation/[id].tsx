import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaButton, NoxaEmptyState, NoxaLoadingState } from '@/src/components/ui';
import {
  GroupDriveFact,
  GroupDriveHeader,
  formatDriveDate,
  formatDriveDistance,
  formatDriveDuration,
  getDriveInvitationPreview,
  respondToDriveInvitation,
  type DriveInvitationPreview,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function GroupDriveInvitationScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const invitationId = typeof params.id === 'string' ? params.id : '';
  const [preview, setPreview] = useState<DriveInvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<'join' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!invitationId) {
      setError('This invitation link is invalid.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getDriveInvitationPreview(invitationId);
      if (!data) throw new Error('This invitation expired, was cancelled, or is no longer available.');
      setPreview(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Invitation could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [invitationId]);

  useEffect(() => { void load(); }, [load]);

  const respond = async (accept: boolean) => {
    if (!preview) return;
    setResponding(accept ? 'join' : 'decline');
    setError(null);
    try {
      const changed = await respondToDriveInvitation(invitationId, accept);
      if (!changed) throw new Error('This invitation is no longer available.');
      if (accept) {
        router.replace({ pathname: '/group-drives/[id]', params: { id: preview.driveSessionId } });
      } else {
        router.replace('/group-drives');
      }
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'Invitation could not be updated.');
      setResponding(null);
    }
  };

  const confirmDecline = () => {
    Alert.alert(
      'Decline this invitation?',
      'You will not join this Group Drive. The host will see that you declined.',
      [
        { text: 'Keep invitation', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => void respond(false) },
      ],
    );
  };

  if (loading) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="INVITATION" />
        <NoxaLoadingState label="Loading invitation…" />
      </Screen>
    );
  }

  if (!preview) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="INVITATION" />
        <NoxaEmptyState icon="mail-unread-outline" title="Invitation unavailable" body={error ?? 'This invitation can no longer be opened.'} />
        <NoxaButton fullWidth onPress={() => router.replace('/group-drives')} title="Back to Group Drives" variant="secondary" />
      </Screen>
    );
  }

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader title="INVITATION" subtitle="Limited preview before joining" />
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="navigate" size={27} color={colors.text} /></View>
        <Text style={styles.eyebrow}>PRIVATE GROUP DRIVE</Text>
        <Text style={styles.title}>{preview.title}</Text>
        <Text style={styles.host}>Invited by {preview.hostDisplayName}</Text>
      </View>
      <View style={styles.facts}>
        <GroupDriveFact icon="location-outline" label="Approximate destination" value={preview.approximateDestinationLabel} />
        <GroupDriveFact icon="calendar-outline" label="Timing" value={formatDriveDate(preview.scheduledStartAt)} />
        <GroupDriveFact icon="navigate-outline" label="Distance" value={formatDriveDistance(preview.routeDistanceMeters)} />
        <GroupDriveFact icon="time-outline" label="Estimated drive" value={formatDriveDuration(preview.routeDurationSeconds)} />
      </View>
      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryHover} />
        <Text style={styles.privacyText}>
          Exact start, destination, route and participant list appear only after you join. Joining does not start location sharing.
        </Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <NoxaButton
          fullWidth
          loading={responding === 'join'}
          disabled={responding !== null}
          onPress={() => void respond(true)}
          title="Join Drive"
        />
        <NoxaButton
          fullWidth
          loading={responding === 'decline'}
          disabled={responding !== null}
          onPress={confirmDecline}
          title="Decline"
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  heroIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primary },
  eyebrow: { color: colors.primaryHover, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, ...typography.v2.value, fontWeight: '900', textAlign: 'center' },
  host: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  facts: { borderTopWidth: 1, borderTopColor: colors.divider },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySubtle },
  privacyText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.primaryHover, fontSize: 13, fontWeight: '700' },
  actions: { gap: spacing.xs },
});
