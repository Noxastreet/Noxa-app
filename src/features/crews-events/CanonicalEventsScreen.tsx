import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  NoxaButton,
  NoxaIconButton,
  NoxaScreen,
} from '@/src/components/ui';
import { useResponsive } from '@/src/hooks/useResponsive';
import { getEventLifecycle } from '@/src/lib/eventExperience';
import { getCurrentSessionUser, supabase } from '@/src/lib/supabase';
import { colors, spacing, typography } from '@/src/theme';

type EventCategory = 'meet' | 'drive' | 'track' | 'social';

type EventRow = {
  id: string;
  title: string;
  category: EventCategory;
  location_name: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
};

type AttendanceRow = {
  event_id: string;
  user_id: string;
  response: 'going' | 'maybe';
  joined_at?: string;
};

type EventListModel = EventRow & {
  attendeeCount: number;
  myResponse: 'going' | 'maybe' | null;
};

function formatDay(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(
    new Date(value),
  );
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short' })
    .format(new Date(value))
    .replace('.', '');
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(
    new Date(value),
  );
}

function compactLocation(value: string) {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const meaningful = parts.filter(
    (part) => !/^(unnamed\s+road\s*)+$/i.test(part),
  );
  return meaningful[meaningful.length - 1] || parts[parts.length - 1] || 'Location';
}

function eventType(event: EventRow) {
  if (event.category === 'meet') return 'Car meet';
  if (event.category === 'drive') return 'Drive';
  if (event.category === 'track') return 'Track';
  return 'Event';
}

function EventRowItem({ event }: { event: EventListModel }) {
  const lifecycle = getEventLifecycle(event);
  const isLive = lifecycle === 'live';
  const attendanceLabel =
    event.attendeeCount === 1 ? '1 going' : `${event.attendeeCount} going`;
  const typeLabel = eventType(event);
  const showType = event.title.trim().toLowerCase() !== typeLabel.toLowerCase();

  return (
    <Pressable
      accessibilityLabel={`Open ${event.title}`}
      accessibilityRole="button"
      accessibilityHint="Opens event details"
      onPress={() =>
        router.push({ pathname: '/event-details', params: { id: event.id } })
      }
      style={({ pressed }) => [
        styles.eventRow,
        pressed && styles.eventRowPressed,
      ]}
    >
      <View style={styles.dateColumn}>
        <Text style={styles.dateDay}>{formatDay(event.starts_at)}</Text>
        <Text numberOfLines={1} style={styles.dateMonth}>
          {formatMonth(event.starts_at)}
        </Text>
      </View>

      <View style={styles.eventCopy}>
        <View style={styles.titleLine}>
          <Text numberOfLines={2} style={styles.eventTitle}>
            {event.title}
          </Text>
          {isLive ? (
            <View style={styles.liveStatus}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : null}
        </View>

        <Text numberOfLines={1} style={styles.eventTime}>
          {formatWeekday(event.starts_at)} · {formatTime(event.starts_at)}
        </Text>

        <View style={styles.locationLine}>
          <Ionicons
            name="location-outline"
            size={14}
            color={colors.textMuted}
          />
          <Text numberOfLines={1} style={styles.locationText}>
            {compactLocation(event.location_name)}
          </Text>
        </View>

        <View style={styles.metaLine}>
          {showType ? (
            <>
              <Text numberOfLines={1} style={styles.eventType}>
                {typeLabel}
              </Text>
              <Text accessible={false} style={styles.metaDot}>
                ·
              </Text>
            </>
          ) : null}
          {event.myResponse === 'going' ? (
            <View style={styles.goingState}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.primaryHover}
              />
              <Text style={styles.goingStateText}>Going</Text>
            </View>
          ) : (
            <Text numberOfLines={1} style={styles.attendanceText}>
              {attendanceLabel}
            </Text>
          )}
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textSubtle}
      />
    </Pressable>
  );
}

export default function CanonicalEventsScreen() {
  const { gutter } = useResponsive();
  const [events, setEvents] = useState<EventListModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(false);

    const currentUserId = (await getCurrentSessionUser())?.id ?? null;
    const now = new Date();
    const feedFloor = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const eventsResult = await supabase
      .from('events')
      .select(
        'id,title,category,location_name,starts_at,ends_at,status',
      )
      .eq('status', 'scheduled')
      .or(
        `starts_at.gte.${feedFloor.toISOString()},ends_at.gt.${now.toISOString()}`,
      )
      .order('starts_at', { ascending: true });

    if (eventsResult.error) {
      setError(true);
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
      return;
    }

    const baseModels = ((eventsResult.data ?? []) as EventRow[])
      .filter((event) => {
        const lifecycle = getEventLifecycle(event);
        return lifecycle === 'scheduled' || lifecycle === 'live';
      })
      .map((event) => ({
        ...event,
        attendeeCount: 0,
        myResponse: null,
      }));

    setEvents(baseModels);
    setLoading(false);
    setRefreshing(false);
    hasLoadedRef.current = true;

    if (!baseModels.length) return;

    void supabase
      .from('event_attendees')
      .select('event_id,user_id,response,joined_at')
      .in(
        'event_id',
        baseModels.map((event) => event.id),
      )
      .then((attendanceResult) => {
        if (attendanceResult.error) return;

        const attendance = (attendanceResult.data ?? []) as AttendanceRow[];
        const counts = new Map<string, number>();
        const mine = new Map<string, 'going' | 'maybe'>();

        for (const row of attendance) {
          if (row.response === 'going') {
            counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
          }
          if (row.user_id === currentUserId) {
            mine.set(row.event_id, row.response);
          }
        }

        setEvents((current) =>
          current.map((event) => ({
            ...event,
            attendeeCount: counts.get(event.id) ?? 0,
            myResponse: mine.get(event.id) ?? null,
          })),
        );
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(!hasLoadedRef.current);
    }, [load]),
  );


  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading events…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.state}>
          <Ionicons
            name="cloud-offline-outline"
            size={30}
            color={colors.textMuted}
          />
          <Text style={styles.stateTitle}>Events unavailable</Text>
          <Text style={styles.stateText}>
            Check your connection and try again.
          </Text>
          <NoxaButton
            title="Try again"
            size="md"
            onPress={() => void load()}
          />
        </View>
      );
    }

    return (
      <View style={styles.state}>
        <Ionicons
          name="calendar-outline"
          size={30}
          color={colors.textMuted}
        />
        <Text style={styles.stateTitle}>No upcoming events</Text>
        <Text style={styles.stateText}>
          New events will appear here when they are scheduled.
        </Text>
        <NoxaButton
          title="Create event"
          size="md"
          onPress={() => router.push('/event-editor')}
        />
      </View>
    );
  };

  return (
    <NoxaScreen padded={false}>
      <FlatList
        data={events}
        keyExtractor={(event) => event.id}
        renderItem={({ item }) => <EventRowItem event={item} />}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void load(false);
        }}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: gutter },
          !events.length && styles.contentEmpty,
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.screenTitle}>Events</Text>
              <View style={styles.headerActions}>
                {events.length ? (
                  <NoxaIconButton
                    accessibilityLabel="Create event"
                    accessibilityHint="Opens event creation"
                    icon="add"
                    variant="ghost"
                    onPress={() => router.push('/event-editor')}
                  />
                ) : null}
              </View>
            </View>

            {error && events.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading events"
                onPress={() => void load(false)}
                style={({ pressed }) => [
                  styles.inlineError,
                  pressed && styles.inlineErrorPressed,
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.warning}
                />
                <Text style={styles.inlineErrorText}>
                  Some event data may be out of date. Tap to retry.
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={renderEmptyState}
      />
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
    paddingBottom: 112,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  screenTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  eventRow: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  eventRowPressed: {
    opacity: 0.72,
  },
  dateColumn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  dateMonth: {
    maxWidth: 44,
    marginTop: 1,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  eventCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  eventTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
  },
  liveStatus: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  liveText: {
    color: colors.primaryHover,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  eventTime: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
  },
  locationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  locationText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
  },
  metaLine: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eventType: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
  },
  metaDot: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
  },
  attendanceText: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
  },
  goingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  goingStateText: {
    color: colors.primaryHover,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  inlineError: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  inlineErrorPressed: {
    opacity: 0.7,
  },
  inlineErrorText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  state: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    maxWidth: 280,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
