import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaButton, NoxaInput, NoxaLoadingState } from '@/src/components/ui';
import {
  GroupDriveHeader,
  GroupDriveStep,
  createDriveSession,
  loadGroupDriveDetails,
  updateDriveDetails,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function GroupDriveDetailsEditorScreen() {
  const params = useLocalSearchParams<{ id?: string; crewId?: string; mode?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : null;
  const requestedCrewId = typeof params.crewId === 'string' ? params.crewId : null;
  const editMode = params.mode === 'edit' && Boolean(driveSessionId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [crewId, setCrewId] = useState<string | null>(requestedCrewId);
  const [scheduledStartAt, setScheduledStartAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(driveSessionId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driveSessionId) {
      setCrewId(requestedCrewId);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const drive = await loadGroupDriveDetails(driveSessionId);
      if (drive.hostId !== drive.currentUserId || !['draft', 'scheduled'].includes(drive.status)) {
        throw new Error('Only the host can edit a Group Drive before it starts.');
      }
      setTitle(drive.title);
      setDescription(drive.description ?? '');
      setCrewId(drive.crewId);
      setScheduledStartAt(drive.scheduledStartAt);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Group Drive could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [driveSessionId, requestedCrewId]);

  useEffect(() => { void load(); }, [load]);

  const continueFlow = async () => {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2 || cleanTitle.length > 100) {
      setError('Use a title between 2 and 100 characters.');
      return;
    }
    if (description.length > 1000) {
      setError('Keep the description under 1,000 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = driveSessionId ?? (await createDriveSession(cleanTitle, description));
      if (driveSessionId || crewId) {
        await updateDriveDetails(id, cleanTitle, description, scheduledStartAt, crewId);
      }
      if (editMode) {
        router.replace({ pathname: '/group-drives/[id]', params: { id } });
      } else {
        router.replace({ pathname: '/group-drives/route', params: { id } });
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Group Drive could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <GroupDriveHeader
          title={editMode ? 'EDIT DETAILS' : 'EDIT DRIVE'}
          subtitle="Loading drive"
        />
        <NoxaLoadingState label="Loading Group Drive details" />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader
        title={editMode ? 'EDIT DETAILS' : driveSessionId ? 'EDIT DRIVE' : 'NEW GROUP DRIVE'}
        subtitle={crewId ? 'Crew · invite-only' : 'Invite-only'}
      />
      {!editMode ? <GroupDriveStep current={1} label="Drive details" /> : null}
      <View style={styles.intro}>
        <Text style={styles.title}>{editMode ? 'Update this drive.' : 'Name your drive.'}</Text>
        <Text style={styles.body}>Give invited drivers a clear name and an optional note.</Text>
      </View>
      <View style={styles.form}>
        <NoxaInput
          autoCapitalize="sentences"
          editable={!saving}
          label="Title"
          maxLength={100}
          onChangeText={setTitle}
          placeholder="Night coast drive"
          returnKeyType="next"
          value={title}
        />
        <NoxaInput
          editable={!saving}
          hint={`${description.length}/1000 · optional`}
          label="Description"
          maxLength={1000}
          multiline
          onChangeText={setDescription}
          placeholder="A short note for invited drivers"
          style={styles.descriptionInput}
          textAlignVertical="top"
          value={description}
        />
      </View>
      <View style={styles.privacyNote}>
        <Ionicons name={crewId ? 'people-outline' : 'lock-closed-outline'} size={19} color={colors.primaryHover} />
        <Text style={styles.privacyText}>
          {crewId
            ? 'Connected to your Crew, but still private. Only invited drivers can join.'
            : 'This drive is private. Only invited drivers can join.'}
        </Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.footer}>
        <NoxaButton
          fullWidth
          loading={saving}
          onPress={() => void continueFlow()}
          title={editMode ? 'Save changes' : 'Continue'}
          trailingIcon={editMode ? undefined : <Ionicons name="arrow-forward" size={18} color={colors.text} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  intro: { gap: spacing.sm, paddingTop: spacing.sm },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, ...typography.v2.section, fontWeight: '900' },
  body: { color: colors.textMuted, ...typography.v2.body },
  form: { gap: spacing.lg },
  descriptionInput: { minHeight: 126, paddingTop: spacing.md },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySubtle,
  },
  privacyText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.primaryHover, fontSize: 13, fontWeight: '700' },
  footer: { marginTop: 'auto', paddingTop: spacing.lg },
});
