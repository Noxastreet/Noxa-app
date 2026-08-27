import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaButton, NoxaEmptyState, NoxaLoadingState } from '@/src/components/ui';
import {
  DriveStatus,
  GroupDriveHeader,
  formatDriveDistance,
  formatDriveDuration,
  loadGroupDriveSummary,
  type GroupDriveSummary,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

function completionLabel(summary: GroupDriveSummary) {
  if (summary.endReason === 'host_completed') return 'Completed by host';
  if (summary.endReason === 'host_cancelled') return 'Cancelled by host';
  if (summary.endReason === 'expired') return 'Ended after the active window expired';
  return summary.sessionStatus === 'completed' ? 'Completed' : 'Cancelled';
}

function completionTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GroupDriveSummaryScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const [summary, setSummary] = useState<GroupDriveSummary | null>(null);
  const [loading, setLoading] = useState(true);
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
      setSummary(await loadGroupDriveSummary(driveSessionId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Drive summary could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [driveSessionId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="DRIVE SUMMARY" />
        <NoxaLoadingState label="Loading drive summary…" />
      </Screen>
    );
  }

  if (!summary) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="DRIVE SUMMARY" />
        <NoxaEmptyState
          icon="alert-circle-outline"
          title="Summary unavailable"
          body={error ?? 'This completed Group Drive is unavailable.'}
        />
        <NoxaButton fullWidth onPress={() => void load()} title="Retry" variant="secondary" />
        <NoxaButton fullWidth onPress={() => router.replace('/group-drives')} title="Back to Group Drives" variant="ghost" />
      </Screen>
    );
  }

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader title="DRIVE SUMMARY" subtitle="Recorded Group Drive outcome" />

      <View style={styles.hero}>
        <DriveStatus status={summary.sessionStatus} />
        <Text style={styles.title}>{summary.title}</Text>
        <View style={styles.outcomeRow}>
          <Ionicons
            name={summary.sessionStatus === 'completed' ? 'checkmark-circle' : 'close-circle-outline'}
            size={18}
            color={summary.sessionStatus === 'completed' ? colors.success : colors.textMuted}
          />
          <Text style={styles.outcome}>{completionLabel(summary)}</Text>
        </View>
        <Text style={styles.completedAt}>{completionTime(summary.completedAt)}</Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metricBlock}>
          <Text style={styles.metric}>{formatDriveDistance(summary.routeDistanceMeters)}</Text>
          <Text style={styles.metricLabel}>PLANNED ROUTE</Text>
        </View>
        <View style={styles.metricBlock}>
          <Text style={styles.metric}>{formatDriveDuration(summary.routeDurationSeconds)}</Text>
          <Text style={styles.metricLabel}>PLANNED TIME</Text>
        </View>
      </View>
      <Text style={styles.truthNote}>
        NOXA does not infer distance driven, speed, rank or arrival history from this summary. These values describe the route that was planned for the Group Drive.
      </Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PARTICIPANTS</Text>
          <Text style={styles.sectionCount}>{summary.participants.length}</Text>
        </View>
        {summary.participants.length ? summary.participants.map((participant) => (
          <View key={participant.userId} style={styles.participantRow}>
            <View style={styles.participantIcon}>
              <Ionicons
                name={participant.role === 'host' ? 'key-outline' : 'person-outline'}
                size={18}
                color={colors.textMuted}
              />
            </View>
            <View style={styles.participantCopy}>
              <Text numberOfLines={1} style={styles.participantName}>{participant.displayName}</Text>
              <Text style={styles.participantMeta}>
                {participant.role === 'host' ? 'Host' : 'Participant'} · {participant.status}
              </Text>
            </View>
          </View>
        )) : (
          <Text style={styles.emptyParticipants}>No participant records are available.</Text>
        )}
      </View>

      <NoxaButton fullWidth onPress={() => router.replace('/group-drives')} title="Back to Group Drives" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  hero: { gap: spacing.sm, paddingTop: spacing.lg },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.value,
    fontWeight: '900',
  },
  outcomeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  outcome: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  completedAt: { color: colors.textSubtle, fontSize: 12, fontWeight: '600' },
  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  metricBlock: { flex: 1, gap: spacing.xxs },
  metric: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  metricLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  truthNote: {
    marginTop: -spacing.md,
    color: colors.textSubtle,
    fontSize: 11,
    lineHeight: 17,
  },
  section: { gap: spacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  sectionCount: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  participantRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  participantIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  participantCopy: { flex: 1, minWidth: 0 },
  participantName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  participantMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11, textTransform: 'capitalize' },
  emptyParticipants: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingVertical: spacing.md },
});
