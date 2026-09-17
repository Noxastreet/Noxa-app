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
import { publicErrorMessage } from '@/src/lib/publicError';
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
  const stateLabel = invited ? 'INVITATION' : active ? 'RESUME' : terminal ? 'SUMMARY' : 'OPEN';

  return (
    <Pressable
      accessibilityLabel={`${item.title}, ${item.sessionStatus}, ${stateLabel.toLowerCase()}`}
      accessibilityRole="button"
      accessibilityHint="Opens this Group Drive"
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowTop}>
        <DriveStatus status={item.sessionStatus} />
        <View style={[
          styles.rowIntent,
          invited && styles.rowIntentAccent,
          active && styles.rowIntentActive,
        ]}>
          <Text style={[
            styles.rowIntentText,
            invited && styles.rowIntentAccentText,
            active && styles.rowIntentActiveText,
          ]}>
            {stateLabel}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
        </View>
      </View>

      <Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text>

      <View style={styles.rowFacts}>
        <View style={styles.metaRow}>
          <Ionicons name={terminal ? 'checkmark-circle-outline' : 'time-outline'} size={16} color={colors.textMuted} />
          <Text numberOfLines={1} style={styles.meta}>{formatDriveDate(dateValue)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="navigate-outline" size={16} color={colors.textMuted} />
          <Text style={styles.meta}>{formatDriveDistance(item.routeDistanceMeters)}</Text>
        </View>
      </View>
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
      setError(publicErrorMessage(loadError, 'Group Drives could not be loaded. Retry.'));
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
            {activeDrive ? (
              <View style={styles.notice}>
                <View style={styles.noticeCopy}>
                  <View style={styles.noticeTitleRow}>
                    <Ionicons name="navigate" size={18} color={colors.primaryHover} />
                    <Text style={styles.noticeTitle}>ACTIVE DRIVE</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.noticeText}>{activeDrive.title}</Text>
                </View>
                <NoxaButton
                  fullWidth
                  title="Resume Active Drive"
                  onPress={() => router.push({
                    pathname: '/group-drives/[id]/active',
                    params: { id: activeDrive.driveSessionId },
                  })}
                />
                <NoxaButton
                  fullWidth
                  variant="secondary"
                  title="Location sharing"
                  onPress={() => router.push({
                    pathname: '/group-drives/[id]/location-sharing',
                    params: { id: activeDrive.driveSessionId },
                  })}
                />
                <NoxaButton
                  fullWidth
                  variant="ghost"
                  title="Drive controls"
                  onPress={() => router.push({
                    pathname: '/group-drives/[id]/controls',
                    params: { id: activeDrive.driveSessionId },
                  })}
                />
              </View>
            ) : null}
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons name="navigate-outline" size={22} color={colors.primaryHover} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>DRIVE TOGETHER</Text>
                <Text style={styles.heroTitle}>Create a private drive.</Text>
                <Text style={styles.heroBody}>Choose the route, people and time. Location sharing starts only with each participant’s consent.</Text>
              </View>
              <NoxaButton
                fullWidth
                leadingIcon={<Ionicons name="add" size={20} color={colors.text} />}
                onPress={() => router.push('/group-drives/details')}
                title="Create Group Drive"
              />
            </View>
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
              body="Create a route, then invite friends or Crew members."
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
  hero: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  heroIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  heroCopy: { gap: spacing.xs },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
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
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  noticeCopy: { gap: spacing.xs },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noticeTitle: { color: colors.primaryHover, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  noticeText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  row: {
    minHeight: 156,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.surfacePressed },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowIntent: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  rowIntentAccent: { borderColor: colors.borderAccent, backgroundColor: colors.primarySubtle },
  rowIntentActive: { borderColor: colors.successBorder, backgroundColor: colors.successSubtle },
  rowIntentText: { color: colors.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  rowIntentAccentText: { color: colors.primaryHover },
  rowIntentActiveText: { color: colors.success },
  rowTitle: { marginTop: spacing.md, marginBottom: spacing.sm, color: colors.text, fontSize: 20, fontWeight: '900' },
  rowFacts: { gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  separator: { height: spacing.sm },
  emptyWrap: { gap: spacing.md },
});
