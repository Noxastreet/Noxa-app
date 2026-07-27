import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoxaEmptyState, NoxaHeader, NoxaScreen } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type ActivityFilter = 'all' | 'events' | 'social' | 'crews';
type ActivityKind = 'event' | 'follow' | 'crew';

type ActivityItem = {
  id: string;
  sourceId: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  timestamp: string;
  imageUrl: string | null;
  routeId: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type CrewRow = {
  id: string;
  name: string;
  logo_url: string | null;
};

type EventRow = {
  id: string;
  title: string;
  location_name: string;
  starts_at: string;
  cover_image_url: string | null;
};

const filters: { label: string; value: ActivityFilter; kind?: ActivityKind }[] = [
  { label: 'All', value: 'all' },
  { label: 'Events', value: 'events', kind: 'event' },
  { label: 'Social', value: 'social', kind: 'follow' },
  { label: 'Crews', value: 'crews', kind: 'crew' },
];

const activityVisuals: Record<
  ActivityKind,
  { color: string; icon: keyof typeof Ionicons.glyphMap; background: string }
> = {
  follow: {
    color: colors.info,
    icon: 'person-add-outline',
    background: 'rgba(10,132,255,0.12)',
  },
  event: {
    color: colors.primaryHover,
    icon: 'calendar-outline',
    background: colors.primaryMuted,
  },
  crew: {
    color: colors.purple,
    icon: 'people-outline',
    background: 'rgba(191,90,242,0.12)',
  },
};

function BackButton() {
  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      onPress={() => router.back()}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
  );
}

function formatProfileName(profile: ProfileRow | undefined) {
  return profile?.display_name || profile?.username || 'A NOXA driver';
}

function getInitials(value: string) {
  return (
    value
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NX'
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(value),
  );
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function FilterChip({
  isActive,
  label,
  onPress,
}: {
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        isActive && styles.filterChipActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActivityArtwork({ item }: { item: ActivityItem }) {
  const visual = activityVisuals[item.kind];

  return (
    <View style={styles.artworkShell}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.artworkImage} />
      ) : (
        <View style={[styles.artworkFallback, { backgroundColor: visual.background }]}>
          {item.kind === 'follow' ? (
            <Text style={[styles.artworkInitials, { color: visual.color }]}>
              {getInitials(item.title)}
            </Text>
          ) : (
            <Ionicons name={visual.icon} size={21} color={visual.color} />
          )}
        </View>
      )}
      <View style={[styles.typeBadge, { backgroundColor: visual.background }]}>
        <Ionicons name={visual.icon} size={12} color={visual.color} />
      </View>
    </View>
  );
}

function ActivityRow({
  busyInvitationId,
  item,
  onOpen,
  onRespond,
}: {
  busyInvitationId: string | null;
  item: ActivityItem;
  onOpen: (item: ActivityItem) => void;
  onRespond: (invitationId: string, accept: boolean) => void;
}) {
  const isBusy = item.kind === 'crew' && busyInvitationId === item.sourceId;

  return (
    <Pressable
      accessibilityLabel={`${item.title}. ${item.subtitle}`}
      accessibilityRole="button"
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.activityRow, pressed && styles.rowPressed]}>
      <ActivityArtwork item={item} />
      <View style={styles.activityCopy}>
        <Text numberOfLines={1} style={styles.activityTitle}>
          {item.title}
        </Text>
        <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
        <Text style={styles.activityTime}>{formatRelativeTime(item.timestamp)}</Text>
        {item.kind === 'crew' ? (
          <View style={styles.invitationActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={(event) => {
                event.stopPropagation();
                onRespond(item.sourceId, true);
              }}
              style={({ pressed }) => [
                styles.invitationButton,
                styles.acceptButton,
                pressed && styles.pressed,
                isBusy && styles.disabled,
              ]}>
              <Text style={styles.acceptText}>{isBusy ? 'Working…' : 'Accept'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={(event) => {
                event.stopPropagation();
                onRespond(item.sourceId, false);
              }}
              style={({ pressed }) => [
                styles.invitationButton,
                styles.declineButton,
                pressed && styles.pressed,
                isBusy && styles.disabled,
              ]}>
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);

  const loadActivities = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const user = authData.user;
      if (!user) {
        setActivities([]);
        setIsSignedIn(false);
        return;
      }

      setIsSignedIn(true);
      const [followsResult, invitationsResult, attendanceResult] = await Promise.all([
        supabase
          .from('follows')
          .select('follower_id,created_at')
          .eq('following_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('crew_invitations')
          .select('id,crew_id,invited_by,created_at')
          .eq('invited_user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('event_attendees')
          .select('event_id,joined_at')
          .eq('user_id', user.id)
          .order('joined_at', { ascending: false })
          .limit(50),
      ]);

      if (followsResult.error) throw followsResult.error;
      if (invitationsResult.error) throw invitationsResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      const followRows = followsResult.data ?? [];
      const invitationRows = invitationsResult.data ?? [];
      const attendanceRows = attendanceResult.data ?? [];
      const profileIds = Array.from(
        new Set([
          ...followRows.map((row) => row.follower_id),
          ...invitationRows.map((row) => row.invited_by),
        ]),
      );
      const crewIds = Array.from(new Set(invitationRows.map((row) => row.crew_id)));
      const eventIds = Array.from(new Set(attendanceRows.map((row) => row.event_id)));

      const profilesById = new Map<string, ProfileRow>();
      if (profileIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id,display_name,username,avatar_url')
          .in('id', profileIds);
        if (error) throw error;
        for (const profile of (data ?? []) as ProfileRow[]) profilesById.set(profile.id, profile);
      }

      const crewsById = new Map<string, CrewRow>();
      if (crewIds.length > 0) {
        const { data, error } = await supabase
          .from('crews')
          .select('id,name,logo_url')
          .in('id', crewIds);
        if (error) throw error;
        for (const crew of (data ?? []) as CrewRow[]) crewsById.set(crew.id, crew);
      }

      const eventsById = new Map<string, EventRow>();
      if (eventIds.length > 0) {
        const { data, error } = await supabase
          .from('events')
          .select('id,title,location_name,starts_at,cover_image_url')
          .in('id', eventIds)
          .eq('status', 'scheduled')
          .gte('starts_at', new Date().toISOString());
        if (error) throw error;
        for (const event of (data ?? []) as EventRow[]) eventsById.set(event.id, event);
      }

      const followActivities: ActivityItem[] = followRows.map((row) => {
        const profile = profilesById.get(row.follower_id);
        return {
          id: `follow-${row.follower_id}`,
          sourceId: row.follower_id,
          kind: 'follow',
          title: formatProfileName(profile),
          subtitle: 'Started following you',
          timestamp: row.created_at,
          imageUrl: profile?.avatar_url ?? null,
          routeId: row.follower_id,
        };
      });

      const invitationActivities: ActivityItem[] = invitationRows
        .map((row): ActivityItem | null => {
          const crew = crewsById.get(row.crew_id);
          if (!crew) return null;
          return {
            id: `crew-${row.id}`,
            sourceId: row.id,
            kind: 'crew' as const,
            title: crew.name,
            subtitle: `${formatProfileName(profilesById.get(row.invited_by))} invited you to join`,
            timestamp: row.created_at,
            imageUrl: crew.logo_url,
            routeId: row.crew_id,
          };
        })
        .filter((item): item is ActivityItem => item !== null);

      const eventActivities: ActivityItem[] = attendanceRows
        .map((row): ActivityItem | null => {
          const event = eventsById.get(row.event_id);
          if (!event) return null;
          return {
            id: `event-${row.event_id}`,
            sourceId: row.event_id,
            kind: 'event' as const,
            title: event.title,
            subtitle: `${formatEventDate(event.starts_at)} · ${event.location_name}`,
            timestamp: row.joined_at,
            imageUrl: event.cover_image_url,
            routeId: row.event_id,
          };
        })
        .filter((item): item is ActivityItem => item !== null);

      setActivities(
        [...invitationActivities, ...followActivities, ...eventActivities].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
      );
    } catch {
      setErrorMessage('Activity could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadActivities();
    }, [loadActivities]),
  );

  const visibleActivities = useMemo(() => {
    const filter = filters.find((item) => item.value === activeFilter);
    return filter?.kind ? activities.filter((item) => item.kind === filter.kind) : activities;
  }, [activeFilter, activities]);

  const sections = useMemo(
    () => [
      { title: 'Today', items: visibleActivities.filter((item) => isToday(item.timestamp)) },
      { title: 'Earlier', items: visibleActivities.filter((item) => !isToday(item.timestamp)) },
    ],
    [visibleActivities],
  );

  const openActivity = (item: ActivityItem) => {
    if (item.kind === 'follow') {
      router.push({ pathname: '/driver-profile/[id]', params: { id: item.routeId } });
    } else if (item.kind === 'crew') {
      router.push({ pathname: '/crew/[id]', params: { id: item.routeId } });
    } else {
      router.push({ pathname: '/event-details', params: { id: item.routeId } });
    }
  };

  const respondToInvitation = async (invitationId: string, accept: boolean) => {
    if (busyInvitationId) return;
    setBusyInvitationId(invitationId);

    const { error } = await supabase.rpc('noxa_respond_to_crew_invitation', {
      target_invitation_id: invitationId,
      accept,
    });

    setBusyInvitationId(null);
    if (error) {
      Alert.alert('Invitation not updated', 'Please try again.');
      return;
    }

    await loadActivities(true);
  };

  return (
    <NoxaScreen padded={false}>
      <View style={styles.shell}>
        <NoxaHeader
          left={<BackButton />}
          right={
            <Pressable
              accessibilityLabel="Refresh activity"
              accessibilityRole="button"
              onPress={() => void loadActivities(true)}
              style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
              <Ionicons name="refresh" size={18} color={colors.textMuted} />
            </Pressable>
          }
          title="ACTIVITY"
          subtitle={activities.length === 1 ? '1 live update' : `${activities.length} live updates`}
        />

        <View style={styles.filterRow}>
          {filters.map((filter) => (
            <FilterChip
              key={filter.value}
              isActive={activeFilter === filter.value}
              label={filter.label}
              onPress={() => setActiveFilter(filter.value)}
            />
          ))}
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading live activity…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                tintColor={colors.primary}
                onRefresh={() => void loadActivities(true)}
              />
            }
            showsVerticalScrollIndicator={false}>
            {!isSignedIn ? (
              <View style={styles.emptyStack}>
                <NoxaEmptyState
                  icon="lock-closed-outline"
                  title="Sign in to see activity"
                  body="Followers, crew invitations, and your upcoming events will appear here."
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/sign-in')}
                  style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}>
                  <Text style={styles.signInText}>SIGN IN</Text>
                </Pressable>
              </View>
            ) : errorMessage ? (
              <View style={styles.emptyStack}>
                <NoxaEmptyState icon="cloud-offline-outline" title="Activity unavailable" body={errorMessage} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadActivities()}
                  style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}>
                  <Text style={styles.signInText}>TRY AGAIN</Text>
                </Pressable>
              </View>
            ) : visibleActivities.length === 0 ? (
              <NoxaEmptyState
                icon="notifications-off-outline"
                title={activeFilter === 'all' ? 'You’re all caught up' : `No ${activeFilter} activity`}
                body="New followers, crew invitations, and upcoming events will show here automatically."
              />
            ) : (
              sections.map((section) =>
                section.items.length > 0 ? (
                  <View key={section.title} style={styles.section}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <View style={styles.activityCard}>
                      {section.items.map((item, index) => (
                        <View key={item.id}>
                          <ActivityRow
                            busyInvitationId={busyInvitationId}
                            item={item}
                            onOpen={openActivity}
                            onRespond={(invitationId, accept) =>
                              void respondToInvitation(invitationId, accept)
                            }
                          />
                          {index < section.items.length - 1 ? <View style={styles.rowDivider} /> : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null,
              )
            )}
          </ScrollView>
        )}
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
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  disabled: { opacity: 0.48 },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  filterChip: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  filterTextActive: { color: colors.text },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stateText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  emptyStack: { gap: spacing.md },
  signInButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  signInText: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  section: { marginBottom: spacing.xxl },
  sectionTitle: {
    marginBottom: spacing.sm,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: typography.letterSpacing.label,
    textTransform: 'uppercase',
  },
  activityCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activityRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surfacePressed },
  rowDivider: { height: 1, marginLeft: 82, backgroundColor: colors.divider },
  artworkShell: { width: 50, height: 50 },
  artworkImage: { width: 46, height: 46, borderRadius: radius.pill },
  artworkFallback: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  artworkInitials: { fontSize: 13, fontWeight: '900' },
  typeBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: colors.text, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  activitySubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  activityTime: {
    marginTop: spacing.xxs,
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  invitationActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  invitationButton: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  acceptButton: { backgroundColor: colors.primary, borderColor: colors.primary },
  declineButton: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong },
  acceptText: { color: colors.text, fontSize: 11, fontWeight: '900' },
  declineText: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
});
