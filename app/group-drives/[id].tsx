import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  leaveGroupDriveAndStopLocation,
  loadDriveLobbyReadiness,
  loadDriveLobbySnapshot,
  loadGroupDriveDetails,
  setDriveReady,
  startDrive,
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

function isPreActive(status: GroupDriveDetails['status']) {
  return status === 'draft' || status === 'scheduled';
}

function participantSet(participants: Pick<DriveParticipant, 'userId' | 'status'>[]) {
  return participants
    .filter((participant) => participant.status === 'accepted' || participant.status === 'active')
    .map((participant) => participant.userId)
    .sort()
    .join('|');
}

function ParticipantRow({
  participant,
  preActive,
}: {
  participant: DriveParticipant;
  preActive: boolean;
}) {
  const name = participant.profile?.displayName ?? 'NOXA driver';
  const isHost = participant.role === 'host';
  const ready = preActive && !isHost && participant.status === 'accepted' && Boolean(participant.readyAt);
  const waiting = preActive && !isHost && participant.status === 'accepted' && !participant.readyAt;
  const meta = isHost ? 'Host' : ready ? 'Ready' : waiting ? 'Waiting' : participant.status;

  return (
    <View style={styles.personRow}>
      <NoxaAvatar
        imageUrl={participant.profile?.avatarUrl}
        initials={initials(name)}
        size={42}
      />
      <View style={styles.personCopy}>
        <Text numberOfLines={1} style={styles.personName}>{name}</Text>
        <Text style={styles.personMeta}>{meta}</Text>
      </View>
      {isHost ? (
        <Ionicons name="key-outline" size={17} color={colors.textMuted} />
      ) : ready ? (
        <Ionicons name="checkmark-circle" size={19} color={colors.success} />
      ) : waiting ? (
        <Ionicons name="time-outline" size={18} color={colors.textSubtle} />
      ) : null}
    </View>
  );
}

function InvitationRow({ invitation, onCancel }: { invitation: DriveInvitation; onCancel?: () => void }) {
  const name = invitation.profile?.displayName ?? 'Invited driver';
  return (
    <View style={styles.personRow}>
      <NoxaAvatar
        imageUrl={invitation.profile?.avatarUrl}
        initials={initials(name)}
        size={42}
      />
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
  const driveRef = useRef<GroupDriveDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergeReadiness = useCallback(
    (currentDrive: GroupDriveDetails, rows: Awaited<ReturnType<typeof loadDriveLobbyReadiness>>) => {
      const readyByUser = new Map(rows.map((row) => [row.userId, row.readyAt]));
      return {
        ...currentDrive,
        participants: currentDrive.participants.map((participant) => ({
          ...participant,
          readyAt: readyByUser.get(participant.userId) ?? null,
        })),
      };
    },
    [],
  );

  const load = useCallback(async () => {
    if (!driveSessionId) {
      setError('This Group Drive link is invalid.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let nextDrive = await loadGroupDriveDetails(driveSessionId);
      if (isPreActive(nextDrive.status)) {
        const rows = await loadDriveLobbyReadiness(driveSessionId);
        nextDrive = mergeReadiness(nextDrive, rows);
      }
      driveRef.current = nextDrive;
      setDrive(nextDrive);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Group Drive could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [driveSessionId, mergeReadiness]);

  const refreshLobby = useCallback(async () => {
    if (!driveSessionId) return;
    try {
      const snapshot = await loadDriveLobbySnapshot(driveSessionId);
      const current = driveRef.current;
      if (!current || !isPreActive(current.status)) return;

      const currentParticipantSet = participantSet(current.participants);
      const snapshotParticipantSet = snapshot.participants.map((participant) => participant.userId).sort().join('|');
      const contextChanged =
        snapshot.sessionStatus !== current.status
        || snapshot.routeVersion !== current.routeVersion
        || snapshot.scheduledStartAt !== current.scheduledStartAt
        || snapshotParticipantSet !== currentParticipantSet;

      if (contextChanged) {
        await load();
        return;
      }

      const nextDrive = mergeReadiness(current, snapshot.participants);
      driveRef.current = nextDrive;
      setDrive(nextDrive);
    } catch {
      // Background Lobby refresh is best-effort. Explicit actions still surface errors.
    }
  }, [driveSessionId, load, mergeReadiness]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    driveRef.current = drive;
  }, [drive]);

  const driveStatus = drive?.status;
  useEffect(() => {
    if (!driveStatus || (driveStatus !== 'draft' && driveStatus !== 'scheduled')) return;
    const interval = setInterval(() => void refreshLobby(), 5000);
    return () => clearInterval(interval);
  }, [driveStatus, refreshLobby]);

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
      'You will immediately lose access to the route and participant list. Any Group Drive location sharing on this device will stop.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave Drive',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              await leaveGroupDriveAndStopLocation(drive.id);
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

  const toggleReady = async () => {
    if (!drive) return;
    const mine = drive.participants.find((participant) => participant.userId === drive.currentUserId);
    if (!mine || mine.role === 'host' || mine.status !== 'accepted' || !isPreActive(drive.status)) return;

    const nextReady = !mine.readyAt;
    setWorking(true);
    setError(null);
    try {
      await setDriveReady(drive.id, nextReady);
      await refreshLobby();
    } catch (readyError) {
      setError(readyError instanceof Error ? readyError.message : 'Ready state could not be updated.');
    } finally {
      setWorking(false);
    }
  };

  const startNow = async () => {
    if (!drive) return;
    setWorking(true);
    setError(null);
    try {
      await startDrive(drive.id);
      await load();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Group Drive could not be started.');
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

  const preActive = isPreActive(drive.status);
  const isHost = drive.currentUserId === drive.hostId;
  const myParticipant = drive.participants.find((participant) => participant.userId === drive.currentUserId);
  const canEdit = isHost && preActive;
  const canLeave = !isHost && myParticipant && ['accepted', 'active'].includes(myParticipant.status) && ['draft', 'scheduled', 'active'].includes(drive.status);
  const canToggleReady = !isHost && preActive && myParticipant?.status === 'accepted';
  const isReady = Boolean(myParticipant?.readyAt);
  const acceptedParticipants = drive.participants.filter(
    (participant) => participant.role === 'participant' && participant.status === 'accepted',
  );
  const readyCount = acceptedParticipants.filter((participant) => Boolean(participant.readyAt)).length;
  const waitingCount = acceptedParticipants.length - readyCount;
  const canStart = isHost && preActive && drive.routeVersion > 0 && acceptedParticipants.length > 0;
  const start = drive.stops.find((stop) => stop.kind === 'start');
  const end = drive.stops.find((stop) => stop.kind === 'end');
  const pendingInvitations = drive.invitations.filter((invitation) => invitation.status === 'invited');

  const confirmStart = () => {
    if (!canStart) return;
    const pendingCount = pendingInvitations.length;
    if (waitingCount > 0 || pendingCount > 0) {
      const lines: string[] = [];
      if (waitingCount > 0) {
        lines.push(`${waitingCount} ${waitingCount === 1 ? 'driver is' : 'drivers are'} still waiting.`);
      }
      if (pendingCount > 0) {
        lines.push(`${pendingCount} pending ${pendingCount === 1 ? 'invitation will' : 'invitations will'} be cancelled when the drive starts.`);
      }
      lines.push('Ready is coordination only; starting never grants location consent on another driver’s device.');
      Alert.alert(
        'Start Group Drive?',
        lines.join('\n\n'),
        [
          { text: 'Keep waiting', style: 'cancel' },
          { text: 'Start Drive', onPress: () => void startNow() },
        ],
      );
      return;
    }
    void startNow();
  };

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader
        title={preActive ? 'GROUP DRIVE LOBBY' : 'GROUP DRIVE'}
        subtitle={isHost ? 'You are the host' : 'Private participant view'}
      />
      <View style={styles.hero}>
        <DriveStatus status={drive.status} />
        <Text style={styles.title}>{drive.title}</Text>
        <Text style={styles.caption}>{driveStatusCaption(drive.status)}</Text>
        {drive.description ? <Text style={styles.description}>{drive.description}</Text> : null}
      </View>

      {preActive ? (
        <View style={styles.lobbyLine}>
          <View>
            <Text style={styles.lobbyLabel}>LOBBY</Text>
            <Text style={styles.lobbyValue}>
              {acceptedParticipants.length === 0
                ? 'Waiting for drivers'
                : `${readyCount} ready · ${waitingCount} waiting`}
            </Text>
          </View>
          <Ionicons name="people-outline" size={21} color={colors.textMuted} />
        </View>
      ) : null}

      {drive.status === 'active' ? (
        <View style={styles.phaseNotice}>
          <Ionicons name="navigate-outline" size={20} color={colors.primaryHover} />
          <View style={styles.activeNoticeCopy}>
            <Text style={styles.activeNoticeTitle}>ACTIVE DRIVE</Text>
            <Text style={styles.phaseNoticeText}>
              Open the live route when you are ready. Location sharing remains a separate explicit action on this device.
            </Text>
          </View>
        </View>
      ) : null}

      {drive.status === 'active' ? (
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
          <NoxaButton
            fullWidth
            variant="ghost"
            title="Drive controls"
            onPress={() => router.push({ pathname: '/group-drives/[id]/controls', params: { id: drive.id } })}
          />
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
        {drive.participants.map((participant) => (
          <ParticipantRow key={participant.userId} participant={participant} preActive={preActive} />
        ))}
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

      {canToggleReady ? (
        <View style={styles.actions}>
          <NoxaButton
            fullWidth
            loading={working}
            onPress={() => void toggleReady()}
            title={isReady ? 'Ready · tap to undo' : "I'm ready"}
            variant={isReady ? 'secondary' : 'primary'}
          />
          <Text style={styles.actionHint}>Ready coordinates the Lobby only. It never starts location sharing.</Text>
        </View>
      ) : null}

      {canEdit ? (
        <View style={styles.actions}>
          {canStart ? (
            <NoxaButton
              fullWidth
              loading={working}
              onPress={confirmStart}
              title="Start Drive"
            />
          ) : (
            <NoxaButton
              fullWidth
              onPress={() => router.push({
                pathname: drive.routeVersion > 0 ? '/group-drives/review' : '/group-drives/route',
                params: { id: drive.id },
              })}
              title={drive.routeVersion > 0 ? 'Review Drive' : 'Continue setup'}
            />
          )}
          {canStart ? (
            <NoxaButton
              fullWidth
              onPress={() => router.push({ pathname: '/group-drives/review', params: { id: drive.id } })}
              title="Review route"
              variant="secondary"
            />
          ) : null}
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
  lobbyLine: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  lobbyLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  lobbyValue: { marginTop: 4, color: colors.text, fontSize: 15, fontWeight: '800' },
  phaseNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySubtle },
  activeNoticeCopy: { flex: 1, gap: spacing.xxs },
  activeNoticeTitle: { color: colors.primaryHover, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
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
  actionHint: { color: colors.textSubtle, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  dangerZone: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  dangerLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  error: { color: colors.primaryHover, fontSize: 13, fontWeight: '700' },
});