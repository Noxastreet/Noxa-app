import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
} from 'react-native';

import { NoxaBadge, NoxaButton, NoxaScreen } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { animations, colors, radius, shadows, spacing, typography } from '@/src/theme';

type EventRow = {
  id: string;
  title: string;
  location_name: string;
  starts_at: string;
  is_public: boolean;
  cover_image_url: string | null;
};

type EventWithCount = EventRow & { attendeeCount: number };

function useSlideUp(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(animations.entranceDistance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: animations.entrance, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: animations.entrance, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, translateY]);

  return { opacity, transform: [{ translateY }] };
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatEventDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(new Date(value));
}

function formatEventMonth(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(value)).toUpperCase();
}

function EventArtwork({ event, children }: { event: EventWithCount; children: ReactNode }) {
  if (event.cover_image_url) {
    return (
      <ImageBackground
        source={{ uri: event.cover_image_url }}
        resizeMode="cover"
        style={styles.artwork}
        imageStyle={styles.artworkRadius as ImageStyle}>
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.artwork, styles.artworkPlaceholder]}>
      <Ionicons name="flag" size={88} color={colors.primaryMuted} />
      {children}
    </View>
  );
}

function FeaturedEvent({ event }: { event: EventWithCount }) {
  const router = useRouter();
  const entryStyle = useSlideUp(70);

  return (
    <Animated.View style={entryStyle}>
      <Pressable
        accessibilityLabel={`View ${event.title}`}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/event-details', params: { id: event.id } })}
        style={({ pressed }) => [styles.featuredCard, pressed && styles.pressed]}>
        <EventArtwork event={event}>
          <View style={styles.featuredShade} />
          <View style={styles.featuredTopRow}>
            <NoxaBadge label={event.is_public ? 'PUBLIC' : 'PRIVATE'} variant="primary" />
            <View style={styles.dateTile}>
              <Text style={styles.dateDay}>{formatEventDay(event.starts_at)}</Text>
              <Text style={styles.dateMonth}>{formatEventMonth(event.starts_at)}</Text>
            </View>
          </View>
          <View style={styles.featuredCopy}>
            <Text style={styles.featuredTitle}>{event.title}</Text>
            <View style={styles.featuredMetaRow}>
              <Ionicons name="location-outline" size={15} color="rgba(240,240,244,0.72)" />
              <Text numberOfLines={1} style={styles.featuredMeta}>{event.location_name}</Text>
            </View>
            <View style={styles.featuredMetaRow}>
              <Ionicons name="people-outline" size={15} color="rgba(240,240,244,0.72)" />
              <Text style={styles.featuredMeta}>{event.attendeeCount} going</Text>
            </View>
          </View>
        </EventArtwork>
      </Pressable>
    </Animated.View>
  );
}

function EventCard({ event, index }: { event: EventWithCount; index: number }) {
  const router = useRouter();
  const entryStyle = useSlideUp(120 + index * 55);

  return (
    <Animated.View style={[styles.eventCard, entryStyle]}>
      <Pressable
        accessibilityLabel={`View ${event.title}`}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/event-details', params: { id: event.id } })}
        style={({ pressed }) => [styles.eventPressable, pressed && styles.pressed]}>
        {event.cover_image_url ? (
          <ImageBackground source={{ uri: event.cover_image_url }} resizeMode="cover" style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name="calendar" size={28} color={colors.primary} />
          </View>
        )}
        <View style={styles.eventBody}>
          <View style={styles.eventHeader}>
            <NoxaBadge label={event.is_public ? 'PUBLIC' : 'PRIVATE'} variant={event.is_public ? 'primary' : 'default'} />
            <Text style={styles.attendeeText}>{event.attendeeCount} GOING</Text>
          </View>
          <Text numberOfLines={2} style={styles.eventTitle}>{event.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text numberOfLines={1} style={styles.metaText}>{formatEventDate(event.starts_at)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text numberOfLines={1} style={styles.metaText}>{event.location_name}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
      </Pressable>
    </Animated.View>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [savedEventIds, setSavedEventIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'upcoming' | 'saved'>('upcoming');
  const [savedLoadError, setSavedLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    setSavedLoadError(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    const eventsQuery = supabase
      .from('events')
      .select('id,title,location_name,starts_at,is_public,cover_image_url')
      .eq('status', 'scheduled')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true });
    const savedQuery = userId
      ? supabase.from('saved_events').select('event_id').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null });
    const [eventsResult, savedResult] = await Promise.all([eventsQuery, savedQuery]);

    if (eventsResult.error) {
      setError(eventsResult.error.message);
      setEvents([]);
      setSavedEventIds([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = (eventsResult.data ?? []) as EventRow[];
    const ids = rows.map((event) => event.id);
    const counts = new Map<string, number>();

    if (ids.length > 0) {
      const { data: attendeeRows, error: attendeesError } = await supabase.from('event_attendees').select('event_id').in('event_id', ids);

      if (attendeesError) {
        setError(attendeesError.message);
        setEvents([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      for (const attendee of attendeeRows ?? []) {
        counts.set(attendee.event_id, (counts.get(attendee.event_id) ?? 0) + 1);
      }
    }

    setEvents(rows.map((event) => ({ ...event, attendeeCount: counts.get(event.id) ?? 0 })));
    setSavedEventIds(savedResult.error ? [] : (savedResult.data ?? []).map((row) => row.event_id));
    if (savedResult.error) setSavedLoadError('Saved events could not be loaded.');
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadEvents(false);
  }, [loadEvents]);

  const savedIdSet = new Set(savedEventIds);
  const visibleEvents = viewMode === 'saved' ? events.filter((event) => savedIdSet.has(event.id)) : events;
  const visibleSavedCount = events.filter((event) => savedIdSet.has(event.id)).length;
  const nextEvent = visibleEvents[0] ?? null;
  const laterEvents = visibleEvents.slice(1);

  return (
    <NoxaScreen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl tintColor={colors.primary} refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.topBar}>
          <View style={styles.headingBlock}>
            <Text style={styles.pageTitle}>EVENTS</Text>
            <Text style={styles.pageSubtitle}>Discover what&apos;s happening</Text>
          </View>
          <Pressable
            accessibilityLabel="Create Event"
            accessibilityRole="button"
            onPress={() => router.push('/event-editor')}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={17} color={colors.text} />
            <Text style={styles.createText}>CREATE</Text>
          </Pressable>
        </View>

        <View style={styles.filterBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setViewMode('upcoming')}
            style={({ pressed }) => [styles.filterButton, viewMode === 'upcoming' && styles.filterButtonActive, pressed && styles.pressed]}>
            <Ionicons name="calendar-outline" size={16} color={viewMode === 'upcoming' ? colors.primaryHover : colors.textMuted} />
            <Text style={[styles.filterText, viewMode === 'upcoming' && styles.filterTextActive]}>UPCOMING</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setViewMode('saved')}
            style={({ pressed }) => [styles.filterButton, viewMode === 'saved' && styles.filterButtonActive, pressed && styles.pressed]}>
            <Ionicons name={viewMode === 'saved' ? 'heart' : 'heart-outline'} size={16} color={viewMode === 'saved' ? colors.primaryHover : colors.textMuted} />
            <Text style={[styles.filterText, viewMode === 'saved' && styles.filterTextActive]}>SAVED</Text>
            {visibleSavedCount ? <Text style={styles.filterCount}>{visibleSavedCount}</Text> : null}
          </Pressable>
        </View>
        {savedLoadError ? <Text style={styles.savedLoadError}>{savedLoadError}</Text> : null}

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading events…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={28} color={colors.primary} /></View>
            <Text style={styles.stateTitle}>Events unavailable</Text>
            <Text style={styles.stateText}>{error}</Text>
            <NoxaButton title="Retry" size="md" onPress={() => void loadEvents()} />
          </View>
        ) : nextEvent ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>{viewMode === 'saved' ? 'NEXT SAVED' : 'NEXT EVENT'}</Text>
              <Text style={styles.sectionMeta}>{visibleEvents.length} {viewMode === 'saved' ? 'SAVED' : 'UPCOMING'}</Text>
            </View>
            <FeaturedEvent event={nextEvent} />

            {laterEvents.length > 0 ? (
              <>
                <View style={styles.listHeader}>
                  <Text style={styles.sectionTitle}>MORE UPCOMING</Text>
                  <Text style={styles.sectionMeta}>{laterEvents.length} EVENTS</Text>
                </View>
                <View style={styles.eventList}>
                  {laterEvents.map((event, index) => <EventCard key={event.id} event={event} index={index} />)}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.stateCard}>
            <View style={styles.stateIcon}>
              <Ionicons name={viewMode === 'saved' ? 'heart-outline' : 'flag-outline'} size={30} color={colors.primary} />
            </View>
            <Text style={styles.stateTitle}>{viewMode === 'saved' ? 'No saved events' : 'No upcoming events'}</Text>
            <Text style={styles.stateText}>
              {viewMode === 'saved'
                ? 'Save an event from its detail page to find it here.'
                : 'Create the first scheduled NOXA event.'}
            </Text>
            <NoxaButton
              title={viewMode === 'saved' ? 'Browse Events' : 'Create Event'}
              size="md"
              onPress={() => viewMode === 'saved' ? setViewMode('upcoming') : router.push('/event-editor')}
            />
          </View>
        )}
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 144,
    gap: spacing.md,
  },
  topBar: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingBlock: { flex: 1 },
  pageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.hero,
    fontWeight: '900',
    letterSpacing: 0.6,
    lineHeight: typography.lineHeight.hero,
  },
  pageSubtitle: {
    marginTop: -spacing.xs,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  createButton: {
    minHeight: 38,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    ...shadows.redGlow,
  },
  createText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pressed: { opacity: 0.82, transform: [{ translateY: 1 }, { scale: 0.985 }] },
  filterBar: {
    minHeight: 46,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xxs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterButton: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
  },
  filterButtonActive: { backgroundColor: colors.primarySubtle },
  filterText: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  filterTextActive: { color: colors.text },
  filterCount: {
    minWidth: 20,
    paddingHorizontal: spacing.xxs,
    paddingVertical: 2,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
  savedLoadError: { color: colors.primaryHover, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  sectionHeader: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: typography.letterSpacing.label,
  },
  sectionMeta: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  featuredCard: {
    height: 292,
    overflow: 'hidden',
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  artwork: { flex: 1, justifyContent: 'space-between' },
  artworkRadius: { borderRadius: radius.hero },
  artworkPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  featuredShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,6,10,0.42)',
  },
  featuredTopRow: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  dateTile: {
    width: 52,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: 'rgba(6,6,10,0.84)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  dateDay: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 27,
  },
  dateMonth: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  featuredCopy: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  featuredTitle: {
    marginBottom: spacing.sm,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: 34,
    textTransform: 'uppercase',
  },
  featuredMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  featuredMeta: {
    flexShrink: 1,
    color: 'rgba(240,240,244,0.72)',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  listHeader: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  eventList: { gap: spacing.sm },
  eventCard: {
    minHeight: 126,
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: { alignSelf: 'stretch', width: 92, backgroundColor: colors.surfaceSoft },
  thumbnailPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  eventBody: { flex: 1, gap: spacing.xxs, padding: spacing.sm },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  attendeeText: {
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  metaText: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '700', lineHeight: 15 },
  stateCard: {
    minHeight: 260,
    gap: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateIcon: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stateText: { color: colors.textMuted, fontSize: typography.body, fontWeight: '700', textAlign: 'center' },
});
