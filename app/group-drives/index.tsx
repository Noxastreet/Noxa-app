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
        {active ? <Text style={styles.activeLabel}>Resume</Text> : null}
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
              title="Group Drives"
              subtitle="Private routes with invited people"
              right={
                <NoxaIconButton
                  accessibilityLabel="Create Group Drive"
                  accessibilityHint="Starts Group Drive setup"
                  icon="add"
                  onPress={() => router.push('/group-drives/details')}
                  variant="ghost"
                />
              }
            />
            {activeDrive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Resume ${activeDrive.title}`}
                onPress={() => router.push({
                  pathname: '/group-drives/[id]/active',
                  params: { id: activeDrive.driveSessionId },
                })}
                style={({ pressed }) => [styles.activeDriveRow, pressed && styles.rowPressed]}
              >
                <View style={styles.activeDriveIcon}>
                  <Ionicons name="navigate" size={19} color={colors.primaryHover} />
                </View>
                <View style={styles.noticeCopy}>
                  <Text style={styles.noticeTitle}>Active Drive</Text>
                  <Text numberOfLines={1} style={styles.noticeText}>{activeDrive.title}</Text>
                </View>
                <Text style={styles.resumeText}>Resume</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>
            ) : null}
            <View style={styles.listHeading}>
              <Text style={styles.sectionTitle}>Your drives</Text>
              <Text style={styles.sectionMeta}>
                {drives.length === 1 ? '1 drive' : `${drives.length} drives`}
              </Text>
            </View>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerBlock: { gap: spacing.md, marginBottom: spacing.sm },
  activeDriveRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  activeDriveIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeTitle: {
    color: colors.primaryHover,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  noticeText: {
    marginTop: 2,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  resumeText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  listHeading: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  row: {
    minHeight: 100,
    paddingVertical: spacing.md,
    paddingRight: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowPressed: { opacity: 0.72 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  invited: { color: colors.primaryHover, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  activeLabel: { color: colors.success, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  terminalLabel: { color: colors.textMuted, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  rowTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  meta: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  chevron: {
    position: 'absolute',
    right: 0,
    top: '50%',
  },
  separator: { height: 0 },
  emptyWrap: { gap: spacing.md },
});
