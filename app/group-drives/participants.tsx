import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaAvatar, NoxaButton, NoxaInput, NoxaLoadingState } from '@/src/components/ui';
import {
  GroupDriveHeader,
  GroupDriveStep,
  inviteCrewsToDrive,
  inviteUsersToDrive,
  loadDriveInviteOptions,
  type DriveInviteCrew,
  type DriveInviteFriend,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('') || 'NX';
}

function SelectMark({ selected, disabled }: { selected: boolean; disabled?: boolean }) {
  return (
    <View style={[styles.mark, selected && styles.markSelected, disabled && styles.markDisabled]}>
      <Ionicons
        name={disabled ? 'checkmark' : selected ? 'checkmark' : 'add'}
        size={17}
        color={selected ? colors.text : colors.textMuted}
      />
    </View>
  );
}

function FriendRow({ friend, selected, onPress }: { friend: DriveInviteFriend; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${friend.displayName}, ${friend.unavailable ? 'already invited' : selected ? 'selected' : 'not selected'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected || friend.unavailable, disabled: friend.unavailable }}
      disabled={friend.unavailable}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, pressed && styles.pressed, friend.unavailable && styles.disabled]}>
      <NoxaAvatar initials={initials(friend.displayName)} size={44} />
      <View style={styles.optionCopy}>
        <Text numberOfLines={1} style={styles.optionTitle}>{friend.displayName}</Text>
        <Text style={styles.optionCaption}>{friend.unavailable ? 'Already part of this drive' : 'Mutual friend'}</Text>
      </View>
      <SelectMark selected={selected || friend.unavailable} disabled={friend.unavailable} />
    </Pressable>
  );
}

function CrewRow({ crew, selected, onPress }: { crew: DriveInviteCrew; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${crew.name}, ${crew.memberCount} individual invitations, ${selected ? 'selected' : 'not selected'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}>
      <View style={styles.crewIcon}><Ionicons name="people" size={20} color={colors.text} /></View>
      <View style={styles.optionCopy}>
        <Text numberOfLines={1} style={styles.optionTitle}>{crew.name}</Text>
        <Text style={styles.optionCaption}>
          {crew.memberCount} {crew.memberCount === 1 ? 'member receives' : 'members receive'} individual invites
        </Text>
      </View>
      <SelectMark selected={selected} />
    </Pressable>
  );
}

export default function GroupDriveParticipantsScreen() {
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const editMode = params.mode === 'edit';
  const [friends, setFriends] = useState<DriveInviteFriend[]>([]);
  const [crews, setCrews] = useState<DriveInviteCrew[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [selectedCrews, setSelectedCrews] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const options = await loadDriveInviteOptions(driveSessionId);
      setFriends(options.friends);
      setCrews(options.crews);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Invite options could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [driveSessionId]);

  useEffect(() => { void load(); }, [load]);

  const visibleFriends = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return friends;
    return friends.filter((friend) =>
      [friend.displayName, friend.username].filter(Boolean).some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [friends, query]);

  const recipientCount = useMemo(() => {
    const recipients = new Set(selectedFriends);
    for (const crew of crews) {
      if (!selectedCrews.has(crew.id)) continue;
      for (const userId of crew.eligibleUserIds) recipients.add(userId);
    }
    return recipients.size;
  }, [crews, selectedCrews, selectedFriends]);

  const toggle = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const continueFlow = async () => {
    setSaving(true);
    setError(null);
    try {
      await inviteUsersToDrive(driveSessionId, Array.from(selectedFriends));
      await inviteCrewsToDrive(driveSessionId, Array.from(selectedCrews));
      if (editMode) {
        router.replace({ pathname: '/group-drives/[id]', params: { id: driveSessionId } });
      } else {
        router.replace({ pathname: '/group-drives/schedule', params: { id: driveSessionId } });
      }
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Invitations could not be sent.');
    } finally {
      setSaving(false);
    }
  };

  const selectionCount = selectedFriends.size + selectedCrews.size;
  const buttonTitle = editMode
    ? selectionCount ? 'Send invitations' : 'Done'
    : selectionCount ? 'Send invitations' : 'Continue without invitations';

  return (
    <Screen scroll keyboardAvoiding constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader title={editMode ? 'EDIT PEOPLE' : 'ADD PEOPLE'} subtitle="Each person chooses for themselves" />
      {!editMode ? <GroupDriveStep current={3} label="Participants" /> : null}
      <View style={styles.intro}>
        <Text style={styles.title}>{editMode ? 'Invite more people.' : 'Choose who gets an invitation.'}</Text>
        <Text style={styles.body}>Selecting a Crew sends separate invitations to its current members. Nobody joins automatically.</Text>
      </View>
      <NoxaInput
        autoCapitalize="none"
        label="Find a friend"
        onChangeText={setQuery}
        placeholder="Name or username"
        value={query}
      />
      {loading ? <NoxaLoadingState label="Loading people…" /> : null}
      {!loading ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FRIENDS</Text>
            {visibleFriends.length ? visibleFriends.map((friend) => (
              <FriendRow
                friend={friend}
                key={friend.id}
                selected={selectedFriends.has(friend.id)}
                onPress={() => toggle(setSelectedFriends, friend.id)}
              />
            )) : <Text style={styles.emptyCopy}>No matching mutual friends.</Text>}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR CREWS</Text>
            {crews.length ? crews.map((crew) => (
              <CrewRow
                crew={crew}
                key={crew.id}
                selected={selectedCrews.has(crew.id)}
                onPress={() => toggle(setSelectedCrews, crew.id)}
              />
            )) : <Text style={styles.emptyCopy}>You are not in a Crew with inviteable members.</Text>}
          </View>
        </>
      ) : null}
      <View style={styles.consentNote}>
        <Ionicons name="paper-plane-outline" size={19} color={colors.primaryHover} />
        <Text style={styles.consentText}>
          {editMode
            ? `${recipientCount || 'No'} new ${recipientCount === 1 ? 'person' : 'people'} selected. Existing participants stay unchanged.`
            : `Continue sends ${recipientCount || 'no'} individual ${recipientCount === 1 ? 'invitation' : 'invitations'}. You can also keep this as a draft and invite people later.`}
        </Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <NoxaButton
        disabled={loading}
        fullWidth
        loading={saving}
        onPress={() => void continueFlow()}
        title={buttonTitle}
        trailingIcon={editMode ? undefined : <Ionicons name="arrow-forward" size={18} color={colors.text} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  intro: { gap: spacing.sm, paddingTop: spacing.sm },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, ...typography.v2.section, fontWeight: '900' },
  body: { color: colors.textMuted, ...typography.v2.body },
  section: { gap: spacing.xs },
  sectionLabel: { marginBottom: spacing.xs, color: colors.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  optionRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  optionCaption: { marginTop: 3, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  crewIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  mark: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSoft },
  markSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  markDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  emptyCopy: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingVertical: spacing.sm },
  consentNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySubtle },
  consentText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.primaryHover, fontSize: 13, fontWeight: '700' },
});
