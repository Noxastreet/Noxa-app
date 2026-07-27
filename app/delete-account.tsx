import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NoxaAuthField } from '@/src/components/auth';
import { NoxaHeader, NoxaScreen } from '@/src/components/ui';
import { stopLiveDriveSession } from '@/src/lib/liveDrive';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

const confirmationText = 'DELETE';

const consequences = [
  'Your profile, garage, posts, comments, follows, crews, and events will be removed.',
  'Uploaded photos, including content attached to events or crews you own, will be deleted.',
  'Live Drive will stop immediately and your active location will be removed.',
  'This action is permanent and the account cannot be recovered.',
];

export default function DeleteAccountScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setEmail(data.user?.email ?? null);
      setLoadingAccount(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const canDelete =
    Boolean(email && password) && confirmation.trim().toUpperCase() === confirmationText;

  const deleteAccount = async () => {
    if (!email || !canDelete || deleting) return;
    setDeleting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError('Your password is incorrect. Sign in again to confirm account deletion.');
      setDeleting(false);
      return;
    }

    await stopLiveDriveSession(true).catch(() => undefined);
    const { data, error: functionError } = await supabase.functions.invoke<{
      error?: string;
      success?: boolean;
    }>('delete-account', {
      body: { confirmation: confirmationText },
    });

    if (functionError || !data?.success) {
      setError(data?.error ?? functionError?.message ?? 'Your account could not be deleted.');
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    router.replace('/welcome');
  };

  return (
    <NoxaScreen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.shell}>
          <NoxaHeader
            left={
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
            }
            title="DELETE ACCOUNT"
            subtitle="Permanent account and data removal"
          />

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.dangerHero}>
              <View style={styles.dangerIcon}>
                <Ionicons name="warning" size={27} color={colors.primaryHover} />
              </View>
              <Text style={styles.heroEyebrow}>PERMANENT ACTION</Text>
              <Text style={styles.heroTitle}>There is no undo.</Text>
              <Text style={styles.heroText}>
                NOXA will permanently delete the account and associated data from active systems.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>WHAT WILL HAPPEN</Text>
              {consequences.map((item) => (
                <View key={item} style={styles.consequenceRow}>
                  <Ionicons name="remove-circle-outline" size={17} color={colors.primaryHover} />
                  <Text style={styles.consequenceText}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>VERIFY YOUR IDENTITY</Text>
              {loadingAccount ? (
                <ActivityIndicator color={colors.primary} />
              ) : email ? (
                <View style={styles.emailRow}>
                  <Ionicons name="mail-outline" size={17} color={colors.textMuted} />
                  <Text numberOfLines={1} style={styles.emailText}>
                    {email}
                  </Text>
                </View>
              ) : (
                <Text style={styles.errorText}>Sign in again before deleting your account.</Text>
              )}

              <NoxaAuthField
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!deleting}
                label="Current Password"
                onChangeText={setPassword}
                onTogglePassword={() => setPasswordVisible((current) => !current)}
                passwordVisible={passwordVisible}
                placeholder="Your NOXA password"
                secureTextEntry={!passwordVisible}
                textContentType="password"
                value={password}
              />

              <View style={styles.confirmationGroup}>
                <Text style={styles.confirmationLabel}>
                  TYPE <Text style={styles.confirmationWord}>DELETE</Text> TO CONFIRM
                </Text>
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!deleting}
                  maxLength={6}
                  onChangeText={setConfirmation}
                  placeholder="DELETE"
                  placeholderTextColor={colors.textSubtle}
                  selectionColor={colors.primary}
                  style={styles.confirmationInput}
                  value={confirmation}
                />
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.primaryHover} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={!canDelete || deleting}
                onPress={() => void deleteAccount()}
                style={({ pressed }) => [
                  styles.deleteButton,
                  (!canDelete || deleting) && styles.disabled,
                  pressed && canDelete && !deleting && styles.pressed,
                ]}>
                {deleting ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={19} color={colors.text} />
                    <Text style={styles.deleteText}>DELETE ACCOUNT PERMANENTLY</Text>
                  </>
                )}
              </Pressable>
            </View>

            <Text style={styles.footerText}>
              If deletion cannot be completed, contact noxastreetapp@gmail.com from your registered
              email address.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shell: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  dangerHero: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  dangerIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  heroEyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    fontWeight: '900',
    lineHeight: typography.lineHeight.h2,
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.textSubtle, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  consequenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  consequenceText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  emailRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  emailText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  confirmationGroup: { gap: spacing.xs },
  confirmationLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  confirmationWord: { color: colors.primaryHover },
  confirmationInput: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: { flex: 1, color: colors.primaryHover, fontSize: 11, fontWeight: '700', lineHeight: 17 },
  deleteButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  deleteText: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  footerText: {
    paddingHorizontal: spacing.sm,
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
});
