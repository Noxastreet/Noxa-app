import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  submitContentReport,
  type ReportReason,
  type ReportTargetType,
} from '@/src/lib/moderation';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

const reasons: { label: string; value: ReportReason }[] = [
  { label: 'Harassment', value: 'harassment' },
  { label: 'Hate speech', value: 'hate_speech' },
  { label: 'Dangerous activity', value: 'dangerous_activity' },
  { label: 'Spam', value: 'spam' },
  { label: 'Impersonation', value: 'impersonation' },
  { label: 'Privacy violation', value: 'privacy' },
  { label: 'Illegal content', value: 'illegal_content' },
  { label: 'Other', value: 'other' },
];

export function ReportModal({
  onClose,
  targetId,
  targetLabel = 'content',
  targetType,
  visible,
}: {
  onClose: () => void;
  targetId: string | null;
  targetLabel?: string;
  targetType: ReportTargetType;
  visible: boolean;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetails('');
    setError(null);
    setSubmitting(false);
  }, [targetId, visible]);

  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async () => {
    if (!reason || !targetId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitContentReport({
        details,
        reason,
        targetId,
        targetType,
      });
      onClose();
      Alert.alert(
        'Report submitted',
        'Thank you. NOXA will review this report and take action when needed.',
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'The report could not be submitted.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <Pressable accessibilityLabel="Close report" onPress={close} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="flag-outline" size={21} color={colors.primaryHover} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>NOXA SAFETY</Text>
              <Text style={styles.title}>Report {targetLabel}</Text>
            </View>
            <Pressable
              accessibilityLabel="Close report"
              accessibilityRole="button"
              onPress={close}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.explainer}>
              Choose the reason that best describes the problem. Reports are private and are not
              shown to the reported user.
            </Text>

            <View style={styles.reasonGrid}>
              {reasons.map((item) => {
                const selected = item.value === reason;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={item.value}
                    onPress={() => setReason(item.value)}
                    style={({ pressed }) => [
                      styles.reasonButton,
                      selected && styles.reasonButtonSelected,
                      pressed && styles.pressed,
                    ]}>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={17}
                      color={selected ? colors.primaryHover : colors.textSubtle}
                    />
                    <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.detailsGroup}>
              <Text style={styles.label}>DETAILS · OPTIONAL</Text>
              <TextInput
                maxLength={1000}
                multiline
                onChangeText={setDetails}
                placeholder="Add context that will help us review the report…"
                placeholderTextColor={colors.textSubtle}
                selectionColor={colors.primary}
                style={styles.detailsInput}
                textAlignVertical="top"
                value={details}
              />
              <Text style={styles.counter}>{details.length}/1000</Text>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={17} color={colors.primaryHover} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!reason || !targetId || submitting}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.submitButton,
                (!reason || !targetId || submitting) && styles.disabled,
                pressed && reason && targetId && !submitting && styles.pressed,
              ]}>
              {submitting ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="flag" size={18} color={colors.text} />
                  <Text style={styles.submitText}>SUBMIT REPORT</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    maxHeight: '88%',
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceBase,
    ...shadows.card,
  },
  handle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    marginVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.textSubtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  explainer: { color: colors.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 19 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reasonButton: {
    minHeight: 44,
    width: '48.7%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reasonButtonSelected: { borderColor: colors.borderAccent, backgroundColor: colors.primarySubtle },
  reasonText: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  reasonTextSelected: { color: colors.text },
  detailsGroup: { gap: spacing.xs },
  label: { color: colors.textSubtle, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  detailsInput: {
    minHeight: 112,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  counter: { color: colors.textSubtle, fontSize: 9, fontWeight: '700', textAlign: 'right' },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: { flex: 1, color: colors.primaryHover, fontSize: 11, fontWeight: '700' },
  submitButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  submitText: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.9 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
