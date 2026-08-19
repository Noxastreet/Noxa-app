import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaAvatar, NoxaButton, NoxaEmptyState, NoxaLoadingState } from '@/src/components/ui';
import {
  DriveStatus,
  GroupDriveFact,
  GroupDriveHeader,
  cancelDrive,
  cancelDriveInvitation,
  driveStatusCaption,
  formatDriveDate,
  formatDriveDistance,
  formatDriveDuration,
  leaveDrive,
  loadGroupDriveDetails,
  type DriveInvitation,
  type DriveParticipant,
  type GroupDriveDetails,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('') || 'NX';
}

function exactStopValue(
  stop: GroupDriveDetails['stops'][number] | undefined,
  fallback: string,
) {
  if (!stop) return fallback;
  const coordinates = `${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}`;
  return stop.label ? `${stop.label} · ${coordinates}` : coordinates;
}

function ParticipantRow({ participant }: { participant: DriveParticipant }) {
  const name = participant.profile?.displayName ?? 'NOXA driver';
  return (
    <View style={styles.personRow}>
      <NoxaAvatar initials={initials(name)} size={42} />
      <View style={styles.personCopy}>
        <Text numberOfLines={1} style={styles.personName}>{name}</Text>
        <Text style={styles.personMeta}>{participant.role === 'host' ? 'Host' : participant.status}</Text>
      </View>
      {participant.status === 'accepted' ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
    </View>
  );
}

function InvitationRow({ invitation, onCancel }: { invitation: DriveInvitation; onCancel?: () => void }) {
  const name = invitation.profile?.displayName ?? 'Invited driver';
  return (
    <View style={styles.personRow}>
      <NoxaAvatar initials={initials(name)} size={42} />
      <View style={styles.personCopy}>
        <Text numberOfLines={1} style={styles.personName}>{name}</Text>
        <Text style={styles.personMeta}>{invitation.status}</Text>
      </View>
      {onCancel ? (
        <Pressable accessibilityLabel={`Cancel invitation for ${name}`} onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancelInvite}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function GroupDriveViewScreen() {
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
      setDrive(await loadGroupDriveDetails(driveSessionId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Group Drive could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [driveSessionId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const confirmCancel = () => {
    if (!drive) return;
    Alert.alert(
      'Cancel this Group Drive?',
      'Invitations will stop working. This action cannot be undone.',
      [
        { text: 'Keep Drive', style: 'cancel' },
        {
          text: 'Cancel Drive',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              await cancelDrive(drive.id);
              router.replace('/group-drives');
            } catch (cancelError) {
              setError(cancelError instanceof Error ? cancelError.message : 'Drive could not be cancelled.');
              setWorking(false);
            }
          },
        },
      ],
    );
  };

  const confirmLeave = () => {
    if (!drive) return;
    Alert.alert(
      'Leave this Group Drive?',
      'You will immediately lose access to the route and participant list.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave Drive',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              await leaveDrive(drive.id);
              router.replace('/group-drives');
            } catch (leaveError) {
              setError(leaveError instanceof Error ? leaveError.message : 'Drive could not be left.');
              setWorking(false);
            }
          },
        },
      ],
    );
  };

  const removeInvitation = async (invitationId: string) => {
    setWorking(true);
    setError(null);
    try {
      await cancelDriveInvitation(invitationId);
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Invitation could not be cancelled.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="GROUP DRIVE" />
        <NoxaLoadingState label="Loading Group Drive…" />
      </Screen>
    );
  }

  if (!drive) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="GROUP DRIVE" />
        <NoxaEmptyState icon="alert-circle-outline" title="Drive unavailable" body={error ?? 'You no longer have access to this Group Drive.'} />
        <NoxaButton fullWidth onPress={() => router.replace('/group-drives')} title="Back to Group Drives" variant="secondary" />
      </Screen>
    );
  }

  const isHost = drive.currentUserId === drive.hostId;
  const myParticipant = drive.participants.find((participant) => participant.userId === drive.currentUserId);
  const canEdit = isHost && ['draft', 'scheduled'].includes(drive.status);
  const canLeave = !isHost && myParticipant && ['accepted', 'active'].includes(myParticipant.status) && ['draft', 'scheduled', 'active'].includes(drive.status);
  const start = drive.stops.find((stop) => stop.kind === 'start');
  const end = drive.stops.find((stop) => stop.kind === 'end');
  const pendingInvitations = drive.invitations.filter((invitation) => invitation.status === 'invited');

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader title="GROUP DRIVE" subtitle={isHost ? 'You are the host' : 'Private participant view'} />
      <View style={styles.hero}>
        <DriveStatus status={drive.status} />
        <Text style={styles.title}>{drive.title}</Text>
        <Text style={styles.caption}>{driveStatusCaption(drive.status)}</Text>
        {drive.description ? <Text style={styles.description}>{drive.description}</Text> : null}
      </View>
      {drive.status === 'active' ? (
        <View style={styles.phaseNotice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primaryHover} />
          <Text style={styles.phaseNoticeText}>The live map is not enabled in this review build. This screen does not start background location.</Text>
        </View>
      ) : null}
      <View style={styles.routeSummary}>
        <View>
          <Text style={styles.metric}>{formatDriveDistance(drive.routeDistanceMeters)}</Text>
          <Text style={styles.metricLabel}>DISTANCE</Text>
        </View>
        <View>
          <Text style={styles.metric}>{formatDriveDuration(drive.routeDurationSeconds)}</Text>
          <Text style={styles.metricLabel}>ESTIMATED</Text>
        </View>
      </View>
      <View style={styles.facts}>
        <GroupDriveFact icon="radio-button-on" label="Start" value={exactStopValue(start, 'Route not set')} />
        <GroupDriveFact icon="flag" label="Destination" value={exactStopValue(end, 'Route not set')} />
        <GroupDriveFact icon="time-outline" label="Timing" value={formatDriveDate(drive.scheduledStartAt)} />
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PARTICIPANTS</Text>
          <Text style={styles.sectionCount}>{drive.participants.length}</Text>
        </View>
        {drive.participants.map((participant) => <ParticipantRow key={participant.userId} participant={participant} />)}
      </View>
      {isHost && pendingInvitations.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PENDING INVITATIONS</Text>
            <Text style={styles.sectionCount}>{pendingInvitations.length}</Text>
          </View>
          {pendingInvitations.map((invitation) => (
            <InvitationRow
              invitation={invitation}
              key={invitation.id}
              onCancel={() => void removeInvitation(invitation.id)}
            />
          ))}
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {canEdit ? (
        <View style={styles.actions}>
          <NoxaButton
            fullWidth
            onPress={() => router.push({
              pathname: drive.routeVersion > 0 ? '/group-drives/review' : '/group-drives/route',
              params: { id: drive.id },
            })}
            title={drive.routeVersion > 0 ? 'Review Drive' : 'Continue setup'}
          />
          <NoxaButton
            fullWidth
            onPress={() => router.push({ pathname: '/group-drives/participants', params: { id: drive.id } })}
            title="Invite people"
            variant="secondary"
          />
          <NoxaButton
            fullWidth
            onPress={() => router.push({ pathname: '/group-drives/details', params: { id: drive.id } })}
            title="Edit details"
            variant="ghost"
          />
        </View>
      ) : null}
      {canLeave ? (
        <View style={styles.dangerZone}>
          <NoxaButton fullWidth loading={working} onPress={confirmLeave} title="Leave Drive" variant="danger" />
        </View>
      ) : null}
      {canEdit ? (
        <View style={styles.dangerZone}>
          <Text style={styles.dangerLabel}>HOST CONTROL</Text>
          <NoxaButton fullWidth loading={working} onPress={confirmCancel} title="Cancel Group Drive" variant="danger" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  hero: { gap: spacing.sm, paddingTop: spacing.lg },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, ...typography.v2.value, fontWeight: '900' },
  caption: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  description: { marginTop: spacing.sm, color: colors.textMuted, ...typography.v2.body },
  phaseNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySubtle },
  phaseNoticeText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  routeSummary: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg, paddingVertical: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider },
  metric: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  metricLabel: { marginTop: spacing.xxs, color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  facts: { borderTopWidth: 1, borderTopColor: colors.divider },
  section: { gap: spacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  sectionTitle: { color: colors.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  sectionCount: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  personRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  personMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11, textTransform: 'capitalize' },
  cancelInvite: { color: colors.primaryHover, fontSize: 12, fontWeight: '800', paddingVertical: spacing.sm },
  actions: { gap: spacing.xs },
  dangerZone: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  dangerLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  error: { color: colors.primaryHover, fontSize: 13, fontWeight: '700' },
});
