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
import {
  loadBlockedUsers,
  unblockUser,
  type BlockedUser,
} from '@/src/lib/moderation';
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
              setUsers((current) =>
                current.filter((item) => item.blocked_id !== user.blocked_id),
              );
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
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primaryHover} />
            </View>
            <Text style={styles.infoText}>
              Blocked users cannot see your profile or content, follow you, or view your Live Drive.
              Their content is hidden from you too.
            </Text>
          </View>

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Loading safety settings…</Text>
            </View>
          ) : error ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ pressed }) => [styles.stateCard, pressed && styles.pressed]}>
              <Ionicons name="cloud-offline-outline" size={27} color={colors.primaryHover} />
              <Text style={styles.stateTitle}>Unable to load</Text>
              <Text style={styles.stateText}>{error} Tap to retry.</Text>
            </Pressable>
          ) : users.length ? (
            <View style={styles.listCard}>
              {users.map((user, index) => {
                const handle = user.blocked_username
                  ? user.blocked_username.startsWith('@')
                    ? user.blocked_username
                    : `@${user.blocked_username}`
                  : 'NOXA driver';
                return (
                  <View
                    key={user.blocked_id}
                    style={[styles.userRow, index > 0 && styles.userBorder]}>
                    {user.blocked_avatar_url ? (
                      <Image source={{ uri: user.blocked_avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitials}>
                          {initials(user.blocked_display_name)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.userCopy}>
                      <Text numberOfLines={1} style={styles.userName}>
                        {user.blocked_display_name}
                      </Text>
                      <Text numberOfLines={1} style={styles.userHandle}>
                        {handle}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`Unblock ${user.blocked_display_name}`}
                      accessibilityRole="button"
                      disabled={busyId === user.blocked_id}
                      onPress={() => confirmUnblock(user)}
                      style={({ pressed }) => [
                        styles.unblockButton,
                        pressed && styles.pressed,
                        busyId === user.blocked_id && styles.disabled,
                      ]}>
                      {busyId === user.blocked_id ? (
                        <ActivityIndicator color={colors.textMuted} size="small" />
                      ) : (
                        <Text style={styles.unblockText}>UNBLOCK</Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.stateCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={29} color={colors.textSubtle} />
              </View>
              <Text style={styles.stateTitle}>No blocked users</Text>
              <Text style={styles.stateText}>
                People you block from profiles or posts will appear here.
              </Text>
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  infoIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
  },
  infoText: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '600', lineHeight: 17 },
  stateCard: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
  },
  listCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  userRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  userBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  avatar: { width: 44, height: 44, borderRadius: radius.pill },
  avatarFallback: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  avatarInitials: { color: colors.text, fontSize: 12, fontWeight: '900' },
  userCopy: { flex: 1, minWidth: 0 },
  userName: { color: colors.text, fontSize: 13, fontWeight: '900' },
  userHandle: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  unblockButton: {
    minWidth: 84,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  unblockText: { color: colors.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
});
