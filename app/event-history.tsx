import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoxaIconButton, NoxaScreen, NoxaTopBar } from '@/src/components/ui';
import {
  eventLifecycle,
  formatEventDate,
  formatEventTime,
  type EventExperienceRow,
  type EventResponse,
} from '@/src/lib/eventExperience';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type AttendanceRow = {
  event_id: string;
  response: EventResponse;
};

type HistoryEvent = EventExperienceRow & {
  relation: 'hosted' | 'attended';
  myResponse: EventResponse | null;
};

function eventType(event: EventExperienceRow) {
  if (event.category === 'meet') return 'Car meet';
  if (event.category === 'drive') return 'Drive';
  if (event.category === 'track') return 'Track';
  return 'Event';
}

function lifecycleCopy(event: EventExperienceRow) {
  return eventLifecycle(event) === 'cancelled' ? 'Cancelled' : 'Completed';
}

export default function EventHistoryScreen() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (authError || !userId) {
        setEvents([]);
        setError('Sign in to view your event history.');
        return;
      }

      const [hostedResult, attendanceResult] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .eq('creator_id', userId)
          .order('starts_at', { ascending: false })
          .limit(50),
        supabase
          .from('event_attendees')
          .select('event_id,response')
          .eq('user_id', userId)
          .limit(100),
      ]);

      if (hostedResult.error || attendanceResult.error) {
        throw hostedResult.error ?? attendanceResult.error;
      }

      const attendance = (attendanceResult.data ?? []) as AttendanceRow[];
      const responseByEvent = new Map(
        attendance.map((row) => [row.event_id, row.response] as const),
      );
      const attendedIds = Array.from(responseByEvent.keys());
      const attendedResult = attendedIds.length
        ? await supabase
            .from('events')
            .select('*')
            .in('id', attendedIds)
            .order('starts_at', { ascending: false })
            .limit(100)
        : { data: [], error: null };

      if (attendedResult.error) throw attendedResult.error;

      const merged = new Map<string, HistoryEvent>();
      for (const row of (attendedResult.data ?? []) as EventExperienceRow[]) {
        merged.set(row.id, {
          ...row,
          relation: 'attended',
          myResponse: responseByEvent.get(row.id) ?? null,
        });
      }
      for (const row of (hostedResult.data ?? []) as EventExperienceRow[]) {
        merged.set(row.id, {
          ...row,
          relation: 'hosted',
          myResponse: responseByEvent.get(row.id) ?? null,
        });
      }

      const historical = Array.from(merged.values())
        .filter((event) => {
          const lifecycle = eventLifecycle(event);
          return lifecycle === 'completed' || lifecycle === 'cancelled';
        })
        .sort(
          (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
        );

      setEvents(historical);
    } catch (loadError) {
      setEvents([]);
      setError(loadError instanceof Error ? loadError.message : 'Event history could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <NoxaScreen padded={false}>
      <View style={styles.header}>
        <NoxaTopBar
          left={
            <NoxaIconButton
              accessibilityLabel="Go back"
              icon="chevron-back"
              onPress={() => router.back()}
              variant="ghost"
            />
          }
          title="Event History"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              void load(false);
            }}
          />
        }
      >
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading event history…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.primary} />
            <Text style={styles.stateTitle}>History unavailable</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="time-outline" size={34} color={colors.primary} />
            <Text style={styles.stateTitle}>No past events yet</Text>
            <Text style={styles.stateText}>
              Events you hosted or joined will appear here after they finish.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {events.map((event) => (
              <Pressable
                key={event.id}
                accessibilityLabel={`Open ${event.title}`}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/event-details', params: { id: event.id } })
                }
                style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
              >
                <View style={styles.eventCopy}>
                  <Text numberOfLines={1} style={styles.eventContext}>
                    {lifecycleCopy(event)} · {eventType(event)} · {event.relation === 'hosted' ? 'Hosted' : 'Attended'}
                  </Text>
                  <Text numberOfLines={2} style={styles.eventTitle}>
                    {event.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.meta}>
                    {formatEventDate(event.starts_at)} · {formatEventTime(event.starts_at)} · {event.location_name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  content: { paddingHorizontal: spacing.md, paddingBottom: 120 },
  list: { gap: 0 },
  eventRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  eventCopy: { flex: 1, minWidth: 0, gap: 2 },
  eventContext: { color: colors.textSubtle, fontSize: 11, lineHeight: 14, fontWeight: '500' },
  eventTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
  },
  meta: { color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  stateCard: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  stateTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: { maxWidth: 290, color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
