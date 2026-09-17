import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaAvatar, NoxaEmptyState, NoxaLoadingState } from '@/src/components/ui';
import {
  GroupDriveHeader,
  loadGroupDriveDetails,
  removeGroupDriveParticipant,
  type DriveParticipant,
  type GroupDriveDetails,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('') || 'NX';
}

function participantName(participant: DriveParticipant) {
  return participant.profile?.displayName ?? 'NOXA driver';
}

export default function ActiveDriveParticipantsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const [drive, setDrive] = useState<GroupDriveDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (!driveSessionId) {
      setDrive(null);
      setError('This Group Drive link is invalid.');
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const next = await loadGroupDriveDetails(driveSessionId);
      if (next.status !== 'active') {
        setDrive(null);
        setError('This Group Drive is no longer active.');
        return;
      }
      setDrive(next);
    } catch (loadError) {
      setDrive(null);
      setError(loadError instanceof Error ? loadError.message : 'Participants could not be loaded.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [driveSessionId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const participants = useMemo(
    () => (drive?.participants ?? []).filter((participant) => participant.status === 'active'),
    [drive?.participants],
  );

  const isHost = Boolean(drive && drive.currentUserId === drive.hostId);

  const confirmRemove = useCallback((participant: DriveParticipant) => {
    if (!drive || !isHost || participant.userId === drive.hostId || removingUserId) return;
    const name = participantName(participant);
    Alert.alert(
      `Remove ${name}?`,
      'They will immediately lose access to this Active Drive. Their exact Group Drive location row is removed by the server. Personal Live Drive is separate.',
      [
        { text: 'Keep participant', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setRemovingUserId(participant.userId);
              setError(null);
              try {
                const removed = await removeGroupDriveParticipant(drive.id, participant.userId);
                await load(false);
                if (!removed) {
                  setError('This participant was already removed or the Group Drive state changed.');
                }
              } catch (removeError) {
                setError(
                  removeError instanceof Error
                    ? removeError.message
                    : 'Participant could not be removed.',
                );
              } finally {
                setRemovingUserId(null);
              }
            })();
          },
        },
      ],
    );
  }, [drive, isHost, load, removingUserId]);

  if (loading) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="PARTICIPANTS" />
        <NoxaLoadingState label="Loading participants…" />
      </Screen>
    );
  }

  if (!drive) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader title="PARTICIPANTS" />
        <NoxaEmptyState
          icon="people-outline"
          title="Participants unavailable"
          body={error ?? 'This Active Drive is unavailable.'}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader
        title="PARTICIPANTS"
        subtitle={`${participants.length} active ${participants.length === 1 ? 'participant' : 'participants'}`}
      />

      <View style={styles.intro}>
        <Text style={styles.title}>{drive.title}</Text>
        <Text style={styles.body}>
          Everyone listed here has Active Drive access. Location sharing remains optional on each device.
        </Text>
      </View>

      {participants.length === 0 ? (
        <NoxaEmptyState
          icon="people-outline"
          title="No active participants"
          body="There are no active participants to show."
        />
      ) : (
        <View style={styles.list}>
          {participants.map((participant) => {
            const name = participantName(participant);
            const isParticipantHost = participant.userId === drive.hostId;
            const isCurrentUser = participant.userId === drive.currentUserId;
            const username = participant.profile?.username?.trim();
            const canRemove = isHost && !isParticipantHost;
            const isRemoving = removingUserId === participant.userId;

            return (
              <View key={participant.userId} style={styles.row}>
                <NoxaAvatar
                  imageUrl={participant.profile?.avatarUrl}
                  initials={initials(name)}
                  size={46}
                />
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={styles.name}>{name}</Text>
                  <Text numberOfLines={1} style={styles.meta}>
                    {isParticipantHost
                      ? 'Host'
                      : isCurrentUser
                        ? 'Participant · You'
                        : 'Participant'}
                    {username ? ` · @${username}` : ''}
                  </Text>
                </View>
                {isParticipantHost ? (
                  <View accessibilityLabel="Group Drive host" style={styles.hostBadge}>
                    <Ionicons name="key-outline" size={15} color={colors.textMuted} />
                  </View>
                ) : canRemove ? (
                  <Pressable
                    accessibilityLabel={`Remove ${name} from Group Drive`}
                    accessibilityRole="button"
                    disabled={Boolean(removingUserId)}
                    onPress={() => confirmRemove(participant)}
                    style={({ pressed }) => [
                      styles.removeButton,
                      pressed && styles.pressed,
                      removingUserId && !isRemoving && styles.disabled,
                    ]}
                  >
                    <Text style={styles.removeText}>{isRemoving ? 'Removing…' : 'Remove'}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {isHost ? (
        <View style={styles.hostNote}>
          <Ionicons name="shield-checkmark-outline" size={19} color={colors.textMuted} />
          <Text style={styles.hostNoteText}>
            Removing someone revokes Group Drive access and clears their exact Group Drive location on the server.
          </Text>
        </View>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  intro: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: '900',
  },
  body: {
    color: colors.textMuted,
    ...typography.v2.body,
  },
  list: {
    gap: 0,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  hostBadge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  removeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  removeText: {
    color: colors.primaryHover,
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.45,
  },
  hostNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  hostNoteText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: colors.primaryHover,
    fontSize: 13,
    fontWeight: '700',
  },
});
