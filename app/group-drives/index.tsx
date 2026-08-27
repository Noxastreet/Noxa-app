import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  NoxaButton,
  NoxaEmptyState,
  NoxaIconButton,
  NoxaLoadingState,
  NoxaScreen,
} from '@/src/components/ui';
import {
  DriveStatus,
  GroupDriveHeader,
  formatDriveDate,
  formatDriveDistance,
  listMyGroupDrives,
  type GroupDriveListItem,
} from '@/src/features/group-drive';
import { colors, radius, spacing, typography } from '@/src/theme';

function DriveRow({ item }: { item: GroupDriveListItem }) {
  const invited = item.myInvitationStatus === 'invited' && item.invitationId;
  const active = item.sessionStatus === 'active' && item.myParticipantStatus === 'active';
  const terminal = item.sessionStatus === 'completed' || item.sessionStatus === 'cancelled';
  const open = () => {
    if (invited) {
      router.push({ pathname: '/group-drives/invitation/[id]', params: { id: item.invitationId! } });
      return;
    }
    if (terminal) {
      router.push({ pathname: '/group-drives/[id]/summary', params: { id: item.driveSessionId } });
      return;
    }
    if (active) {
      router.push({ pathname: '/group-drives/[id]/active', params: { id: item.driveSessionId } });
      return;
    }
    router.push({ pathname: '/group-drives/[id]', params: { id: item.driveSessionId } });
  };
  const dateValue = terminal ? item.completedAt : item.scheduledStartAt;
  return (
    <Pressable
      accessibilityLabel={`${item.title}, ${item.sessionStatus}`}
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowTop}>
        <DriveStatus status={item.sessionStatus} />
        {invited ? <Text style={styles.invited}>Invitation</Text> : null}
        {active ? <Text style={styles.activeLabel}>Open Active Drive</Text> : null}
        {terminal ? <Text style={styles.terminalLabel}>View summary</Text> : null}
      </View>
      <Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>
      <View style={styles.metaRow}>
        <Ionicons name={terminal ? 'checkmark-circle-outline' : 'time-outline'} size={15} color={colors.textMuted} />
        <Text numberOfLines={1} style={styles.meta}>{formatDriveDate(dateValue)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="navigate-outline" size={15} color={colors.textMuted} />
        <Text style={styles.meta}>{formatDriveDistance(item.routeDistanceMeters)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} style={styles.chevron} />
    </Pressable>
  );
}

export default function GroupDrivesScreen() {
  const [drives, setDrives] = useState<GroupDriveListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setDrives(await listMyGroupDrives());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Group Drives could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeDrive = useMemo(
    () => drives.find((drive) => drive.sessionStatus === 'active' && drive.myParticipantStatus === 'active'),
    [drives],
  );

  return (
    <NoxaScreen padded={false}>
      <FlatList
        contentContainerStyle={styles.content}
        data={drives}
        keyExtractor={(item) => item.driveSessionId}
        renderItem={({ item }) => <DriveRow item={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => void load(true)}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <GroupDriveHeader
              title="GROUP DRIVES"
              subtitle="Private drives with invited people"
              right={
                <NoxaIconButton
                  accessibilityLabel="Refresh Group Drives"
                  icon="refresh"
                  onPress={() => void load(true)}
                  variant="ghost"
                />
              }
            />
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>DRIVE TOGETHER</Text>
              <Text style={styles.heroTitle}>A route shared with the people you choose.</Text>
              <Text style={styles.heroBody}>
                Invite-only by default. Exact route details appear only after a driver joins.
              </Text>
              <NoxaButton
                fullWidth
                leadingIcon={<Ionicons name="add" size={20} color={colors.text} />}
                onPress={() => router.push('/group-drives/details')}
                title="Create Group Drive"
              />
            </View>
            {activeDrive ? (
              <View style={styles.notice}>
                <View style={styles.noticeCopy}>
                  <View style={styles.noticeTitleRow}>
                    <Ionicons name="navigate" size={18} color={colors.primaryHover} />
                    <Text style={styles.noticeTitle}>ACTIVE DRIVE</Text>
                  </View>
                  <Text style={styles.noticeText}>
                    {activeDrive.title} is active. Location sharing still requires your explicit approval on this device.
                  </Text>
                </View>
                <NoxaButton
                  fullWidth
                  title="Share my location"
                  onPress={() => router.push({
                    pathname: '/group-drives/[id]/location-sharing',
                    params: { id: activeDrive.driveSessionId },
                  })}
                />
                <NoxaButton
                  fullWidth
                  variant="secondary"
                  title="Open Active Drive"
                  onPress={() => router.push({
                    pathname: '/group-drives/[id]/active',
                    params: { id: activeDrive.driveSessionId },
                  })}
                />
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>YOUR DRIVES</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <NoxaLoadingState label="Loading Group Drives…" />
          ) : error ? (
            <View style={styles.emptyWrap}>
              <NoxaEmptyState icon="cloud-offline-outline" title="Couldn’t load Group Drives" body={error} />
              <NoxaButton fullWidth onPress={() => void load()} title="Retry" variant="secondary" />
            </View>
          ) : (
            <NoxaEmptyState
              icon="navigate-outline"
              title="No Group Drives yet"
              body="Create a real route and invite friends or Crew members. Nothing is invented here."
            />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  headerBlock: { gap: spacing.lg, marginBottom: spacing.lg },
  hero: { gap: spacing.md, paddingVertical: spacing.lg },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: '900',
  },
  heroBody: { color: colors.textMuted, ...typography.v2.body },
  sectionTitle: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  notice: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  noticeCopy: { gap: spacing.xs },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noticeTitle: { color: colors.primaryHover, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  noticeText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  row: {
    minHeight: 148,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.surfacePressed },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  invited: { color: colors.primaryHover, fontSize: 11, fontWeight: '800' },
  activeLabel: { color: colors.success, fontSize: 11, fontWeight: '800' },
  terminalLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  rowTitle: { marginTop: spacing.md, marginBottom: spacing.sm, color: colors.text, fontSize: 20, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  chevron: { position: 'absolute', right: spacing.md, bottom: spacing.md },
  separator: { height: spacing.sm },
  emptyWrap: { gap: spacing.md },
});