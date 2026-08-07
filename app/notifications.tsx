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

type ActivityFilter = 'all' | 'crews' | 'events' | 'social';
type ActivityKind = 'crew' | 'event' | 'follow';

type ActivityItem = {
  id: string;
  sourceId: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  timestamp: string;
  startsAt?: string;
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
  { label: 'Crews', value: 'crews', kind: 'crew' },
  { label: 'Events', value: 'events', kind: 'event' },
  { label: 'Social', value: 'social', kind: 'follow' },
];

const activityVisuals: Record<
  ActivityKind,
  { color: string; icon: keyof typeof Ionicons.glyphMap; background: string }
> = {
  crew: {
    color: colors.primaryHover,
    icon: 'people-outline',
    background: colors.primarySubtle,
  },
  event: {
    color: colors.primaryHover,
    icon: 'calendar-outline',
    background: colors.primarySubtle,
  },
  follow: {
    color: colors.text,
    icon: 'person-add-outline',
    background: colors.surfaceSoft,
  },
};

function BackButton() {
  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      onPress={() => router.back()}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
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

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
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

function FilterTab({ isActive, label, onPress }: { isActive: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={({ pressed }) => [styles.filterTab, pressed && styles.pressed]}>
      <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{label}</Text>
      <View style={[styles.filterIndicator, isActive && styles.filterIndicatorActive]} />
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
            <Text style={[styles.artworkInitials, { color: visual.color }]}>{getInitials(item.title)}</Text>
          ) : (
            <Ionicons name={visual.icon} size={21} color={visual.color} />
          )}
        </View>
      )}
      <View style={[styles.typeBadge, { backgroundColor: visual.background }]}>
        <Ionicons name={visual.icon} size={11} color={visual.color} />
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
  const meta = item.kind === 'event' && item.startsAt
    ? formatEventDate(item.startsAt)
    : formatRelativeTime(item.timestamp);

  return (
    <Pressable
      accessibilityLabel={`${item.title}. ${item.subtitle}`}
      accessibilityRole="button"
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.activityRow, pressed && styles.rowPressed]}>
      <ActivityArtwork item={item} />
      <View style={styles.activityCopy}>
        <Text numberOfLines={1} style={styles.activityTitle}>{item.title}</Text>
        <Text numberOfLines={2} style={styles.activitySubtitle}>{item.subtitle}</Text>
        {meta ? <Text style={styles.activityMeta}>{meta}</Text> : null}

        {item.kind === 'crew' ? (
          <View style={styles.invitationActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={(event) => {
                event.stopPropagation();
                onRespond(item.sourceId, true);
              }}
              style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed, isBusy && styles.disabled]}>
              <Text style={styles.acceptText}>{isBusy ? 'Working…' : 'Accept'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={(event) => {
                event.stopPropagation();
                onRespond(item.sourceId, false);
              }}
              style={({ pressed }) => [styles.declineButton, pressed && styles.pressed, isBusy && styles.disabled]}>
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
    </Pressable>
  );
}

function InboxSection({
  title,
  eyebrow,
  items,
  busyInvitationId,
  onOpen,
  onRespond,
}: {
  title: string;
  eyebrow: string;
  items: ActivityItem[];
  busyInvitationId: string | null;
  onOpen: (item: ActivityItem) => void;
  onRespond: (invitationId: string, accept: boolean) => void;
}) {
  if (!items.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Text style={styles.sectionCount}>{items.length}</Text>
      </View>
      <View style={styles.activityList}>
        {items.map((item, index) => (
          <View key={item.id}>
            <ActivityRow
              busyInvitationId={busyInvitationId}
              item={item}
              onOpen={onOpen}
              onRespond={onRespond}
            />
            {index < items.length - 1 ? <View style={styles.rowDivider} /> : null}
          </View>
        ))}
      </View>
    </View>
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
      const profileIds = Array.from(new Set([
        ...followRows.map((row) => row.follower_id),
        ...invitationRows.map((row) => row.invited_by),
      ]));
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
            kind: 'crew',
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
            kind: 'event',
            title: event.title,
            subtitle: event.location_name,
            timestamp: row.joined_at,
            startsAt: event.starts_at,
            imageUrl: event.cover_image_url,
            routeId: row.event_id,
          };
        })
        .filter((item): item is ActivityItem => item !== null)
        .sort((a, b) => new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime());

      setActivities([
        ...invitationActivities,
        ...eventActivities,
        ...followActivities,
      ]);
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

  const needsAttention = useMemo(
    () => visibleActivities.filter((item) => item.kind === 'crew'),
    [visibleActivities],
  );
  const upcoming = useMemo(
    () => visibleActivities.filter((item) => item.kind === 'event'),
    [visibleActivities],
  );
  const community = useMemo(
    () => visibleActivities
      .filter((item) => item.kind === 'follow')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
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
              style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
              <Ionicons name="refresh" size={18} color={colors.textMuted} />
            </Pressable>
          }
          title="NOTIFICATIONS"
          subtitle="Real activity from your NOXA world"
        />

        <View style={styles.filterRow} accessibilityRole="tablist">
          {filters.map((filter) => (
            <FilterTab
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
            <Text style={styles.stateText}>Loading activity…</Text>
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
                  body="Followers, Crew invitations and upcoming Events will appear here."
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/sign-in')}
                  style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
                  <Text style={styles.primaryActionText}>SIGN IN</Text>
                </Pressable>
              </View>
            ) : errorMessage ? (
              <View style={styles.emptyStack}>
                <NoxaEmptyState icon="cloud-offline-outline" title="Notifications unavailable" body={errorMessage} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadActivities()}
                  style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
                  <Text style={styles.primaryActionText}>TRY AGAIN</Text>
                </Pressable>
              </View>
            ) : visibleActivities.length === 0 ? (
              <NoxaEmptyState
                icon="checkmark-circle-outline"
                title={activeFilter === 'all' ? 'You’re all caught up' : `No ${activeFilter} activity`}
                body="New Crew invitations, upcoming Events and community activity will show here automatically."
              />
            ) : (
              <>
                <InboxSection
                  eyebrow="ACTION REQUIRED"
                  title="Needs attention"
                  items={needsAttention}
                  busyInvitationId={busyInvitationId}
                  onOpen={openActivity}
                  onRespond={(invitationId, accept) => void respondToInvitation(invitationId, accept)}
                />
                <InboxSection
                  eyebrow="YOU’RE GOING"
                  title="Upcoming"
                  items={upcoming}
                  busyInvitationId={busyInvitationId}
                  onOpen={openActivity}
                  onRespond={(invitationId, accept) => void respondToInvitation(invitationId, accept)}
                />
                <InboxSection
                  eyebrow="SOCIAL"
                  title="Community"
                  items={community}
                  busyInvitationId={busyInvitationId}
                  onOpen={openActivity}
                  onRespond={(invitationId, accept) => void respondToInvitation(invitationId, accept)}
                />
              </>
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
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  disabled: { opacity: 0.48 },
  filterRow: {
    minHeight: 46,
    flexDirection: 'row',
    marginTop: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
  },
  filterText: {
    paddingBottom: spacing.sm,
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '800',
  },
  filterTextActive: { color: colors.text },
  filterIndicator: {
    width: '100%',
    height: 2,
    backgroundColor: 'transparent',
  },
  filterIndicatorActive: { backgroundColor: colors.primary },
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
    gap: spacing.xxl,
  },
  emptyStack: { gap: spacing.md },
  primaryAction: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  primaryActionText: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  section: { gap: spacing.sm },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionEyebrow: {
    color: colors.primaryHover,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  sectionTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
  },
  sectionCount: {
    color: colors.textSubtle,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  activityList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  activityRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowPressed: { opacity: 0.78 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 64, backgroundColor: colors.divider },
  artworkShell: { width: 48, height: 48 },
  artworkImage: { width: 44, height: 44, borderRadius: radius.pill },
  artworkFallback: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  artworkInitials: { fontSize: 12, fontWeight: '900' },
  typeBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.background,
  },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: colors.text, fontSize: 13, fontWeight: '900', lineHeight: 18 },
  activitySubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  activityMeta: {
    marginTop: spacing.xxs,
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  invitationActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  acceptButton: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  declineButton: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  acceptText: { color: colors.text, fontSize: 10, fontWeight: '900' },
  declineText: { color: colors.textMuted, fontSize: 10, fontWeight: '900' },
});
