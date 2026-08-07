import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoxaHeader, NoxaScreen } from '@/src/components/ui';
import { loadBlockedUsers, unblockUser, type BlockedUser } from '@/src/lib/moderation';
import { colors, radius, spacing, typography } from '@/src/theme';

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NX'
  );
}

export default function BlockedUsersScreen() {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await loadBlockedUsers());
    } catch {
      setError('Blocked users could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert(
      `Unblock ${user.blocked_display_name}?`,
      'They will be able to find your public NOXA content again. Previous follows are not restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setBusyId(user.blocked_id);
            try {
              await unblockUser(user.blocked_id);
              setUsers((current) => current.filter((item) => item.blocked_id !== user.blocked_id));
            } catch {
              Alert.alert('Unblock failed', 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <NoxaScreen padded={false}>
      <View style={styles.shell}>
        <NoxaHeader
          left={
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          }
          title="BLOCKED USERS"
          subtitle="People hidden from your NOXA experience"
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.explainer}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryHover} />
            <Text style={styles.explainerText}>
              Blocking hides profiles, public content and Live Drive visibility in both directions. Unblocking does not restore old follows.
            </Text>
          </View>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Loading blocked users…</Text>
            </View>
          ) : error ? (
            <Pressable accessibilityRole="button" onPress={() => void load()} style={({ pressed }) => [styles.state, pressed && styles.pressed]}>
              <Ionicons name="cloud-offline-outline" size={25} color={colors.primaryHover} />
              <Text style={styles.stateTitle}>Unable to load</Text>
              <Text style={styles.stateText}>{error} Tap to retry.</Text>
            </Pressable>
          ) : users.length ? (
            <View style={styles.list}>
              {users.map((user, index) => {
                const handle = user.blocked_username
                  ? user.blocked_username.startsWith('@')
                    ? user.blocked_username
                    : `@${user.blocked_username}`
                  : 'NOXA driver';
                const busy = busyId === user.blocked_id;

                return (
                  <View key={user.blocked_id} style={[styles.userRow, index < users.length - 1 && styles.userBorder]}>
                    {user.blocked_avatar_url ? (
                      <Image source={{ uri: user.blocked_avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitials}>{initials(user.blocked_display_name)}</Text>
                      </View>
                    )}
                    <View style={styles.userCopy}>
                      <Text numberOfLines={1} style={styles.userName}>{user.blocked_display_name}</Text>
                      <Text numberOfLines={1} style={styles.userHandle}>{handle}</Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`Unblock ${user.blocked_display_name}`}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => confirmUnblock(user)}
                      style={({ pressed }) => [styles.unblockButton, pressed && styles.pressed, busy && styles.disabled]}>
                      {busy ? <ActivityIndicator color={colors.textMuted} size="small" /> : <Text style={styles.unblockText}>UNBLOCK</Text>}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.state}>
              <Ionicons name="checkmark-circle-outline" size={30} color={colors.textMuted} />
              <Text style={styles.stateTitle}>No blocked users</Text>
              <Text style={styles.stateText}>People you block from profiles or content will appear here.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
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
  },
  content: { gap: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  explainer: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  explainerText: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '600', lineHeight: 18 },
  state: {
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
  },
  stateText: {
    maxWidth: 280,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  userRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  avatar: { width: 44, height: 44, borderRadius: radius.pill },
  avatarFallback: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  avatarInitials: { color: colors.text, fontSize: 12, fontWeight: '900' },
  userCopy: { flex: 1, minWidth: 0 },
  userName: { color: colors.text, fontSize: 13, fontWeight: '900' },
  userHandle: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  unblockButton: {
    minWidth: 82,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  unblockText: { color: colors.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
});