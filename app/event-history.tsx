import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoxaScreen } from '@/src/components/ui';
import { CanonicalPill } from '@/src/features/crews-events/CanonicalPrimitives';
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
  if (event.category === 'meet') return 'CAR MEET';
  if (event.category === 'drive') return 'DRIVE';
  if (event.category === 'track') return 'TRACK';
  return 'EVENT';
}

function lifecycleTone(event: EventExperienceRow) {
  return eventLifecycle(event) === 'cancelled' ? 'neutral' as const : 'success' as const;
}

function lifecycleCopy(event: EventExperienceRow) {
  return eventLifecycle(event) === 'cancelled' ? 'CANCELLED' : 'COMPLETED';
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

  const summary = useMemo(() => {
    const hosted = events.filter((event) => event.relation === 'hosted').length;
    const attended = events.length - hosted;
    return `${hosted} hosted · ${attended} attended`;
  }, [events]);

  return (
    <NoxaScreen padded={false}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>EVENT HISTORY</Text>
          <Text style={styles.subtitle}>{loading ? 'Loading…' : summary}</Text>
        </View>
        <View style={styles.headerSpacer} />
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
              <Text style={styles.retryText}>TRY AGAIN</Text>
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
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.pills}>
                    <CanonicalPill label={lifecycleCopy(event)} tone={lifecycleTone(event)} />
                    <CanonicalPill label={eventType(event)} />
                  </View>
                  <Text style={styles.relation}>
                    {event.relation === 'hosted' ? 'HOSTED' : 'ATTENDED'}
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.eventTitle}>
                  {event.title.toUpperCase()}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {formatEventDate(event.starts_at)} · {formatEventTime(event.starts_at)}
                </Text>
                <View style={styles.footer}>
                  <Text numberOfLines={1} style={styles.location}>
                    {event.location_name}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
                </View>
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
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
  headerCopy: { flex: 1, minWidth: 0 },
  headerSpacer: { width: 42, height: 42 },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    lineHeight: typography.lineHeight.h2,
    fontWeight: '900',
  },
  subtitle: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: 120 },
  list: { gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  relation: { color: colors.textSubtle, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  eventTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  meta: { color: colors.primaryHover, fontSize: 11, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  location: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  stateCard: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    lineHeight: typography.lineHeight.h2,
    fontWeight: '900',
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
  retryText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
