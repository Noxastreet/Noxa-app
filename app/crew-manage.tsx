import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NoxaButton, NoxaScreen } from '@/src/components/ui';
import { CanonicalAvatar, CanonicalPill, type CanonicalProfile } from '@/src/features/crews-events/CanonicalPrimitives';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type CrewRole = 'owner' | 'admin' | 'member';
type Member = { user_id: string; role: CrewRole; profile: CanonicalProfile | null };
type JoinRequest = { id: string; user_id: string; profile: CanonicalProfile | null };
type Crew = { id: string; name: string; owner_id: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nameOf(profile: CanonicalProfile | null) {
  return profile?.display_name || profile?.username || 'NOXA driver';
}

function handleOf(profile: CanonicalProfile | null) {
  if (!profile?.username) return null;
  return profile.username.startsWith('@') ? profile.username : `@${profile.username}`;
}

function MiniAction({ title, danger, disabled, onPress }: { title: string; danger?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.miniAction, danger && styles.miniDanger, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Text style={[styles.miniText, danger && styles.miniDangerText]}>{title}</Text>
    </Pressable>
  );
}

export default function CrewManageScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const crewId = Array.isArray(params.id) ? params.id[0] : params.id || '';
  const [crew, setCrew] = useState<Crew | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<CrewRole | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [inviteUsername, setInviteUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (spinner = true) => {
    if (spinner) setLoading(true);
    setError(null);
    try {
      if (!uuidPattern.test(crewId)) throw new Error('This Crew link is invalid.');
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id;
      if (authError || !currentUserId) throw new Error('Sign in to manage this Crew.');
      setUserId(currentUserId);

      const [crewResult, myMembership] = await Promise.all([
        supabase.from('crews').select('id,name,owner_id').eq('id', crewId).maybeSingle(),
        supabase.from('crew_members').select('role').eq('crew_id', crewId).eq('user_id', currentUserId).maybeSingle(),
      ]);
      if (crewResult.error || myMembership.error) throw crewResult.error ?? myMembership.error;
      if (!crewResult.data) throw new Error('Crew not found.');
      const myRole = (myMembership.data?.role as CrewRole | undefined) ?? null;
      setCrew(crewResult.data as Crew);
      setRole(myRole);
      if (myRole !== 'owner' && myRole !== 'admin') {
        setMembers([]);
        setRequests([]);
        setError('Only Crew owners and admins can manage members.');
        return;
      }

      const [memberResult, requestResult] = await Promise.all([
        supabase.from('crew_members').select('user_id,role').eq('crew_id', crewId),
        supabase.from('crew_join_requests').select('id,user_id').eq('crew_id', crewId).eq('status', 'pending').order('created_at'),
      ]);
      if (memberResult.error || requestResult.error) throw memberResult.error ?? requestResult.error;

      const memberRows = (memberResult.data ?? []) as { user_id: string; role: CrewRole }[];
      const requestRows = (requestResult.data ?? []) as { id: string; user_id: string }[];
      const ids = Array.from(new Set([...memberRows.map((row) => row.user_id), ...requestRows.map((row) => row.user_id)]));
      const profilesResult = ids.length
        ? await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids)
        : { data: [], error: null };
      if (profilesResult.error) throw profilesResult.error;
      const profiles = new Map(((profilesResult.data ?? []) as CanonicalProfile[]).map((profile) => [profile.id, profile]));
      setMembers(memberRows.map((row) => ({ ...row, profile: profiles.get(row.user_id) ?? null })));
      setRequests(requestRows.map((row) => ({ ...row, profile: profiles.get(row.user_id) ?? null })));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Crew management could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [crewId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const memberIds = useMemo(() => new Set(members.map((member) => member.user_id)), [members]);
  const canManage = role === 'owner' || role === 'admin';

  const review = useCallback(async (request: JoinRequest, approve: boolean) => {
    if (busy) return;
    setBusy(request.id);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('noxa_review_crew_join_request', { target_request_id: request.id, approve });
    if (rpcError || data !== true) setError(rpcError?.message ?? 'Request could not be reviewed.');
    else await load(false);
    setBusy(null);
  }, [busy, load]);

  const changeRole = useCallback(async (member: Member) => {
    if (busy || role !== 'owner' || member.role === 'owner') return;
    setBusy(member.user_id);
    setError(null);
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    const { data, error: rpcError } = await supabase.rpc('noxa_set_crew_member_role', {
      target_crew_id: crewId,
      target_user_id: member.user_id,
      target_role: nextRole,
    });
    if (rpcError || data !== true) setError(rpcError?.message ?? 'Member role could not be changed.');
    else await load(false);
    setBusy(null);
  }, [busy, crewId, load, role]);

  const confirmRemove = useCallback((member: Member) => {
    if (busy || member.role === 'owner') return;
    Alert.alert('Remove member?', `${nameOf(member.profile)} will lose access to this Crew.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          setBusy(member.user_id);
          const { data, error: rpcError } = await supabase.rpc('noxa_remove_crew_member', {
            target_crew_id: crewId,
            target_user_id: member.user_id,
          });
          if (rpcError || data !== true) setError(rpcError?.message ?? 'Member could not be removed.');
          else await load(false);
          setBusy(null);
        },
      },
    ]);
  }, [busy, crewId, load]);

  const invite = useCallback(async () => {
    if (busy) return;
    const username = inviteUsername.trim().replace(/^@/, '');
    if (username.length < 2) return;
    setBusy('invite');
    setError(null);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,display_name,username,avatar_url')
      .ilike('username', username)
      .maybeSingle();
    if (profileError || !profile) {
      setError(profileError?.message ?? 'No driver found with that username.');
      setBusy(null);
      return;
    }
    if (profile.id === userId || memberIds.has(profile.id)) {
      setError('That driver is already in this Crew.');
      setBusy(null);
      return;
    }
    const { data, error: inviteError } = await supabase.rpc('noxa_invite_to_crew', {
      target_crew_id: crewId,
      target_user_id: profile.id,
    });
    if (inviteError || !data) setError(inviteError?.message ?? 'Invitation could not be sent.');
    else {
      setInviteUsername('');
      Alert.alert('Invitation sent', `${nameOf(profile as CanonicalProfile)} can accept it from NOXA activity.`);
    }
    setBusy(null);
  }, [busy, crewId, inviteUsername, memberIds, userId]);

  return (
    <NoxaScreen padded={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>CREW MANAGEMENT</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{crew?.name ?? 'Crew'}</Text>
        </View>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={() => { setRefreshing(true); void load(false); }} />}
      >
        {loading ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading management…</Text></View>
        ) : !canManage ? (
          <View style={styles.state}><Ionicons name="lock-closed-outline" size={32} color={colors.primary} /><Text style={styles.stateTitle}>Management unavailable</Text><Text style={styles.muted}>{error}</Text></View>
        ) : (
          <>
            {error ? <Pressable onPress={() => setError(null)} style={styles.error}><Text style={styles.errorText}>{error}</Text></Pressable> : null}

            <View style={styles.quickList}>
              <NoxaButton fullWidth title="Create Crew Event" onPress={() => router.push({ pathname: '/event-editor', params: { crewId } })} />
              <NoxaButton fullWidth title="New Group Drive" variant="secondary" onPress={() => router.push({ pathname: '/group-drives/details', params: { crewId } })} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>JOIN REQUESTS · {requests.length}</Text>
              {requests.length ? requests.map((request) => (
                <View key={request.id} style={styles.row}>
                  <CanonicalAvatar profile={request.profile} size={42} />
                  <View style={styles.copy}><Text numberOfLines={1} style={styles.name}>{nameOf(request.profile)}</Text><Text style={styles.meta}>{handleOf(request.profile) ?? 'Pending request'}</Text></View>
                  <MiniAction title="NO" disabled={busy === request.id} onPress={() => void review(request, false)} />
                  <MiniAction title="YES" disabled={busy === request.id} onPress={() => void review(request, true)} />
                </View>
              )) : <Text style={styles.muted}>No pending requests.</Text>}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>INVITE BY USERNAME</Text>
              <View style={styles.inviteRow}>
                <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setInviteUsername} onSubmitEditing={() => void invite()} placeholder="@username" placeholderTextColor={colors.textSubtle} returnKeyType="send" selectionColor={colors.primary} style={styles.input} value={inviteUsername} />
                <MiniAction title="INVITE" disabled={busy === 'invite' || inviteUsername.trim().length < 2} onPress={() => void invite()} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MEMBERS · {members.length}</Text>
              {members.map((member) => {
                const canRole = role === 'owner' && member.role !== 'owner' && member.user_id !== userId;
                const canRemove = member.role !== 'owner' && member.user_id !== userId && (role === 'owner' || member.role === 'member');
                return (
                  <View key={member.user_id} style={styles.memberBlock}>
                    <View style={styles.rowNoBorder}>
                      <CanonicalAvatar profile={member.profile} size={44} />
                      <View style={styles.copy}><Text numberOfLines={1} style={styles.name}>{nameOf(member.profile)}</Text><Text style={styles.meta}>{handleOf(member.profile) ?? member.role}</Text></View>
                      <CanonicalPill label={member.role.toUpperCase()} tone={member.role === 'owner' ? 'accent' : member.role === 'admin' ? 'success' : 'neutral'} />
                    </View>
                    {canRole || canRemove ? <View style={styles.memberActions}>
                      {canRole ? <MiniAction title={member.role === 'admin' ? 'MAKE MEMBER' : 'MAKE ADMIN'} disabled={busy === member.user_id} onPress={() => void changeRole(member)} /> : null}
                      {canRemove ? <MiniAction danger title="REMOVE" disabled={busy === member.user_id} onPress={() => confirmRemove(member)} /> : null}
                    </View> : null}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.h2, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.xl },
  state: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radius.hero, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stateTitle: { color: colors.text, fontSize: typography.h2, fontWeight: '900' },
  error: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderAccent, backgroundColor: colors.primarySubtle },
  errorText: { color: colors.text, fontSize: 11, lineHeight: 16 },
  quickList: { gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowNoBorder: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 13, fontWeight: '800' },
  meta: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  miniAction: { minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.button, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised },
  miniDanger: { borderColor: colors.borderAccent, backgroundColor: colors.primarySubtle },
  miniText: { color: colors.text, fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
  miniDangerText: { color: colors.primaryHover },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.button, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.text, fontSize: 13 },
  memberBlock: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  memberActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs, paddingBottom: spacing.sm },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
