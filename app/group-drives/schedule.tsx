import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaButton, NoxaLoadingState } from '@/src/components/ui';
import {
  GroupDriveHeader,
  GroupDriveStep,
  loadGroupDriveDetails,
  updateDriveDetails,
  type GroupDriveDetails,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

type ScheduleMode = 'ready' | 'scheduled';
type PickerMode = 'date' | 'time';

function nextStart() {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
  return value;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

function ScheduleChoice({
  active,
  caption,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${active ? 'selected' : 'not selected'}`}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, active && styles.choiceActive, pressed && styles.pressed]}>
      <View style={[styles.choiceIcon, active && styles.choiceIconActive]}>
        <Ionicons name={icon} size={20} color={active ? colors.text : colors.textMuted} />
      </View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceLabel}>{label}</Text>
        <Text style={styles.choiceCaption}>{caption}</Text>
      </View>
      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={21} color={active ? colors.primaryHover : colors.textSubtle} />
    </Pressable>
  );
}

export default function GroupDriveScheduleScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const [drive, setDrive] = useState<GroupDriveDetails | null>(null);
  const [mode, setMode] = useState<ScheduleMode>('ready');
  const [scheduledAt, setScheduledAt] = useState(nextStart);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [draftDate, setDraftDate] = useState(nextStart);
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
    try {
      const loaded = await loadGroupDriveDetails(driveSessionId);
      setDrive(loaded);
      if (loaded.scheduledStartAt) {
        const date = new Date(loaded.scheduledStartAt);
        if (!Number.isNaN(date.getTime())) setScheduledAt(date);
        setMode('scheduled');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Schedule could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [driveSessionId]);

  useEffect(() => { void load(); }, [load]);

  const openPicker = (nextMode: PickerMode) => {
    setDraftDate(scheduledAt);
    setPickerMode(nextMode);
  };

  const commitPicker = () => {
    setScheduledAt((current) =>
      pickerMode === 'date'
        ? new Date(draftDate.getFullYear(), draftDate.getMonth(), draftDate.getDate(), current.getHours(), current.getMinutes())
        : new Date(current.getFullYear(), current.getMonth(), current.getDate(), draftDate.getHours(), draftDate.getMinutes()),
    );
    setPickerMode(null);
  };

  const continueFlow = async () => {
    if (!drive) return;
    if (mode === 'scheduled' && scheduledAt.getTime() <= Date.now() + 60_000) {
      setError('Choose a future start time.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateDriveDetails(
        drive.id,
        drive.title,
        drive.description ?? '',
        mode === 'scheduled' ? scheduledAt.toISOString() : null,
        drive.crewId,
      );
      router.replace({ pathname: '/group-drives/review', params: { id: drive.id } });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Schedule could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader title="SCHEDULE" subtitle="Invite-only · no visibility toggle" />
      <GroupDriveStep current={4} label="Timing" />
      <View style={styles.intro}>
        <Text style={styles.title}>Choose when the group gets ready.</Text>
        <Text style={styles.body}>A scheduled time never starts location sharing. The host starts the Active Drive explicitly later.</Text>
      </View>
      {loading ? <NoxaLoadingState label="Loading schedule…" /> : (
        <View accessibilityRole="radiogroup" style={styles.choices}>
          <ScheduleChoice
            active={mode === 'ready'}
            caption="Keep the drive ready until the host starts it"
            icon="flash-outline"
            label="When everyone is ready"
            onPress={() => setMode('ready')}
          />
          <ScheduleChoice
            active={mode === 'scheduled'}
            caption="Show invited drivers a planned start time"
            icon="calendar-outline"
            label="Schedule for later"
            onPress={() => setMode('scheduled')}
          />
        </View>
      )}
      {mode === 'scheduled' && !loading ? (
        <View style={styles.pickers}>
          <Pressable onPress={() => openPicker('date')} style={({ pressed }) => [styles.picker, pressed && styles.pressed]}>
            <Text style={styles.pickerLabel}>DATE</Text>
            <Text style={styles.pickerValue}>{dateFormat.format(scheduledAt)}</Text>
          </Pressable>
          <Pressable onPress={() => openPicker('time')} style={({ pressed }) => [styles.picker, pressed && styles.pressed]}>
            <Text style={styles.pickerLabel}>TIME</Text>
            <Text style={styles.pickerValue}>{timeFormat.format(scheduledAt)}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryHover} />
        <View style={styles.privacyCopy}>
          <Text style={styles.privacyTitle}>Invite-only access</Text>
          <Text style={styles.privacyBody}>There is no Public or Crew-wide visibility mode in the MVP.</Text>
        </View>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <NoxaButton
        disabled={loading || !drive}
        fullWidth
        loading={saving}
        onPress={() => void continueFlow()}
        title="Review route"
        trailingIcon={<Ionicons name="arrow-forward" size={18} color={colors.text} />}
      />
      <Modal animationType="fade" transparent visible={pickerMode !== null} onRequestClose={() => setPickerMode(null)}>
        <View style={styles.backdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => setPickerMode(null)}><Text style={styles.pickerAction}>Cancel</Text></Pressable>
              <Text style={styles.pickerTitle}>Select {pickerMode}</Text>
              <Pressable onPress={commitPicker}><Text style={styles.pickerDone}>Done</Text></Pressable>
            </View>
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              mode={pickerMode ?? 'date'}
              onChange={(_, selected) => { if (selected) setDraftDate(selected); }}
              textColor={colors.text}
              themeVariant="dark"
              value={draftDate}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  intro: { gap: spacing.sm, paddingTop: spacing.sm },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, ...typography.v2.section, fontWeight: '900' },
  body: { color: colors.textMuted, ...typography.v2.body },
  choices: { gap: spacing.sm },
  choice: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  choiceActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySubtle },
  choiceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceSoft },
  choiceIconActive: { backgroundColor: colors.primary },
  choiceCopy: { flex: 1, minWidth: 0 },
  choiceLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  choiceCaption: { marginTop: 3, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  pickers: { flexDirection: 'row', gap: spacing.sm },
  picker: { flex: 1, minHeight: 72, justifyContent: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft },
  pickerLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  pickerValue: { marginTop: spacing.xs, color: colors.text, fontSize: 15, fontWeight: '800' },
  privacyNote: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySubtle },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  privacyBody: { marginTop: 3, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.8 },
  error: { color: colors.primaryHover, fontSize: 13, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  pickerSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.surfaceRaised },
  pickerHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerAction: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  pickerDone: { color: colors.primaryHover, fontSize: 14, fontWeight: '800' },
  pickerTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
});
