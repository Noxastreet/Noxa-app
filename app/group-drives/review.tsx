import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaButton, NoxaEmptyState, NoxaLoadingState } from '@/src/components/ui';
import {
  GroupDriveFact,
  GroupDriveHeader,
  GroupDriveStep,
  formatDriveDate,
  formatDriveDistance,
  formatDriveDuration,
  loadGroupDriveDetails,
  type GroupDriveDetails,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function GroupDriveReviewScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const [drive, setDrive] = useState<GroupDriveDetails | null>(null);
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
      setDrive(await loadGroupDriveDetails(driveSessionId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Group Drive could not be reviewed.');
    } finally {
      setLoading(false);
    }
  }, [driveSessionId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="REVIEW" />
        <NoxaLoadingState label="Preparing review…" />
      </Screen>
    );
  }

  if (!drive || error) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="REVIEW" />
        <NoxaEmptyState icon="alert-circle-outline" title="Review unavailable" body={error ?? 'This Group Drive is unavailable.'} />
        <NoxaButton fullWidth onPress={() => void load()} title="Retry" variant="secondary" />
      </Screen>
    );
  }

  const start = drive.stops.find((stop) => stop.kind === 'start');
  const end = drive.stops.find((stop) => stop.kind === 'end');
  const pendingInvites = drive.invitations.filter((invitation) => invitation.status === 'invited').length;
  const acceptedPeople = drive.participants.filter((participant) => ['accepted', 'active'].includes(participant.status)).length;

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader title="REVIEW" subtitle="Nothing starts without the host" />
      <GroupDriveStep current={5} label="Confirm" />
      <View style={styles.intro}>
        <Text style={styles.title}>{drive.title}</Text>
        {drive.description ? <Text style={styles.body}>{drive.description}</Text> : null}
      </View>
      <View style={styles.routeHero}>
        <View style={styles.routeIcon}><Ionicons name="navigate" size={25} color={colors.text} /></View>
        <View style={styles.routeCopy}>
          <Text style={styles.routeValue}>{formatDriveDistance(drive.routeDistanceMeters)}</Text>
          <Text style={styles.routeMeta}>{formatDriveDuration(drive.routeDurationSeconds)}</Text>
        </View>
      </View>
      <View style={styles.facts}>
        <GroupDriveFact icon="radio-button-on" label="Start" value={start?.label ?? 'Start point'} />
        <GroupDriveFact icon="flag" label="Destination" value={end?.label ?? 'Destination'} />
        <GroupDriveFact icon="time-outline" label="Timing" value={formatDriveDate(drive.scheduledStartAt)} />
        <GroupDriveFact
          icon="people-outline"
          label="People"
          value={`${acceptedPeople} joined · ${pendingInvites} pending`}
        />
      </View>
      <View style={styles.privacyNote}>
        <Ionicons name="lock-closed-outline" size={20} color={colors.primaryHover} />
        <Text style={styles.privacyText}>
          Creating this drive does not start GPS sharing. Active Drive consent and location begin only after a later explicit host start.
        </Text>
      </View>
      <View style={styles.actions}>
        <NoxaButton
          fullWidth
          onPress={() => router.replace({ pathname: '/group-drives/[id]', params: { id: drive.id } })}
          title={drive.status === 'scheduled' ? 'Finish scheduling' : 'Finish setup'}
        />
        <NoxaButton
          fullWidth
          onPress={() => router.push({ pathname: '/group-drives/route', params: { id: drive.id } })}
          title="Edit route"
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  intro: { gap: spacing.sm, paddingTop: spacing.sm },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, ...typography.v2.value, fontWeight: '900' },
  body: { color: colors.textMuted, ...typography.v2.body },
  routeHero: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radius.hero, backgroundColor: colors.surface },
  routeIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primary },
  routeCopy: { flex: 1 },
  routeValue: { color: colors.text, ...typography.v2.value, fontWeight: '900' },
  routeMeta: { marginTop: spacing.xxs, color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  facts: { borderTopWidth: 1, borderTopColor: colors.divider },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySubtle },
  privacyText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  actions: { gap: spacing.xs },
});
