import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { NoxaButton, NoxaHeader, NoxaInput, NoxaScreen } from '@/src/components/ui';
import { normalizeProfileUsername } from '@/src/features/profile/profileIdentityPersistence';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

function validateUsername(value: string) {
  const username = normalizeProfileUsername(value);
  if (username.length < 3 || username.length > 20) {
    return { username, error: 'Username must be 3–20 characters.' };
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { username, error: 'Use only lowercase letters, numbers, and underscores.' };
  }
  return { username, error: null };
}

export default function ChooseUsernameScreen() {
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      router.replace('/welcome');
      return;
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      setError('Profile could not be loaded. Please retry.');
      setIsLoading(false);
      return;
    }

    const existing = normalizeProfileUsername(data?.username ?? '');
    if (existing) {
      router.replace('/(tabs)');
      return;
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (isSaving) return;
    const validation = validateUsername(value);
    if (validation.error) {
      setError(validation.error);
      return;
    }

    setIsSaving(true);
    setError(null);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;
    if (authError || !user) {
      setIsSaving(false);
      router.replace('/welcome');
      return;
    }

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ username: validation.username, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('username', null)
      .select('username')
      .maybeSingle();

    if (updateError) {
      setIsSaving(false);
      setError(updateError.code === '23505' ? 'This username is already taken.' : 'Username could not be saved. Please retry.');
      return;
    }

    if (!data?.username) {
      const { data: current } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
      if (!current?.username) {
        setIsSaving(false);
        setError('Username could not be saved. Please retry.');
        return;
      }
    }

    router.replace('/(tabs)');
  };

  const validation = validateUsername(value);

  return (
    <NoxaScreen padded={false}>
      <View style={styles.shell}>
        <NoxaHeader title="CHOOSE USERNAME" subtitle="One-time account identity" />
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.mark}>
              <View style={styles.markGridHorizontal} />
              <View style={styles.markGridVertical} />
              <Ionicons name="at" size={30} color={colors.primaryHover} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>Claim your NOXA username.</Text>
              <Text style={styles.body}>
                This is your unique public handle. After you confirm it, it stays attached to this account and cannot be casually changed from Edit Profile.
              </Text>
            </View>
            <NoxaInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              hint="3–20 characters · letters, numbers, underscore"
              label="Username"
              maxLength={20}
              onBlur={() => setValue(normalizeProfileUsername(value))}
              onChangeText={(next) => {
                setValue(next);
                setError(null);
              }}
              placeholder="noxa_driver"
              value={value}
            />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <View style={styles.lockNote}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
              <Text style={styles.lockText}>Choose carefully. Username changes are locked after confirmation.</Text>
            </View>
            <NoxaButton
              disabled={Boolean(validation.error) || !value.trim()}
              fullWidth
              loading={isSaving}
              onPress={() => void save()}
              title="Confirm username"
            />
          </View>
        )}
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', gap: spacing.xl, paddingBottom: spacing.xxxl },
  mark: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  markGridHorizontal: { position: 'absolute', left: 10, right: 10, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  markGridVertical: { position: 'absolute', top: 10, bottom: 10, width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  copy: { gap: spacing.sm },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, ...typography.v2.section, fontWeight: '900' },
  body: { maxWidth: 520, color: colors.textMuted, ...typography.v2.body },
  lockNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft },
  lockText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.primaryHover, fontSize: 13, fontWeight: '700' },
});
