import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  CrewModuleHeader,
  CrewModuleIconButton,
  CrewModuleState,
} from "@/src/components/crew/CrewModuleChrome";
import { NoxaBadge, NoxaScreen } from "@/src/components/ui";
import { uuidPattern } from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type CrewRole = "owner" | "admin" | "member";
type CrewRow = { id: string; name: string };
type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location_name: string;
  starts_at: string;
  ends_at: string | null;
  is_public: boolean;
  status: "scheduled" | "cancelled" | "completed";
  category: string;
  capacity: number | null;
};
type CalendarEvent = EventRow & { goingCount: number };

const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function localDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}`;
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })
    .format(value)
    .toUpperCase();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
    .format(new Date(value));
}

function eventState(event: EventRow) {
  if (event.status === "cancelled") return "CANCELLED";
  if (event.status === "completed") return "COMPLETED";
  const now = Date.now();
  const starts = new Date(event.starts_at).getTime();
  const ends = event.ends_at ? new Date(event.ends_at).getTime() : starts + 3 * 60 * 60 * 1000;
  if (now >= starts && now <= ends) return "LIVE";
  if (now > ends) return "COMPLETED";
  return "UPCOMING";
}

function stateVariant(state: string): "primary" | "success" | "default" | "warning" {
  if (state === "LIVE") return "success";
  if (state === "CANCELLED") return "warning";
  if (state === "UPCOMING") return "primary";
  return "default";
}

function CalendarEventCard({ event }: { event: CalendarEvent }) {
  const state = eventState(event);
  const startsAt = new Date(event.starts_at);
  return (
    <Pressable
      accessibilityLabel={`Open ${event.title}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/event-details", params: { id: event.id } })
      }
      style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}
    >
      <View style={styles.dateTile}>
        <Text style={styles.dateDay}>{String(startsAt.getDate()).padStart(2, "0")}</Text>
        <Text style={styles.dateMonth}>
          {new Intl.DateTimeFormat(undefined, { month: "short" }).format(startsAt).toUpperCase()}
        </Text>
      </View>
      <View style={styles.eventCopy}>
        <View style={styles.eventBadgeRow}>
          <NoxaBadge label={state} variant={stateVariant(state)} />
          <Text style={styles.category}>{event.category.toUpperCase()}</Text>
        </View>
        <Text numberOfLines={2} style={styles.eventTitle}>{event.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.metaText}>{formatTime(event.starts_at)}</Text>
          <View style={styles.metaDot} />
          <Ionicons name="people-outline" size={13} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {event.goingCount}{event.capacity ? ` / ${event.capacity}` : ""} going
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
          <Text numberOfLines={1} style={styles.metaText}>{event.location_name}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function CrewCalendarScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const crewId = typeof params.id === "string" ? params.id : "";
  const initializedMonthRef = useRef(false);
  const [crew, setCrew] = useState<CrewRow | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [role, setRole] = useState<CrewRole | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canView = role !== null;
  const canCreate = role === "owner" || role === "admin";

  const loadCalendar = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    if (!uuidPattern.test(crewId)) {
      setError("Invalid crew link.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (authError || !userId) {
      setError("Sign in to open the crew calendar.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [crewResult, membershipResult] = await Promise.all([
      supabase.from("crews").select("id,name").eq("id", crewId).maybeSingle(),
      supabase
        .from("crew_members")
        .select("role")
        .eq("crew_id", crewId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (crewResult.error || !crewResult.data) {
      setError(crewResult.error?.message ?? "Crew not found.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setCrew(crewResult.data as CrewRow);
    const membershipRole = membershipResult.error
      ? null
      : ((membershipResult.data?.role as CrewRole | undefined) ?? null);
    setRole(membershipRole);
    if (!membershipRole) {
      setEvents([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: eventRows, error: eventsError } = await supabase
      .from("events")
      .select(
        "id,title,description,location_name,starts_at,ends_at,is_public,status,category,capacity",
      )
      .eq("crew_id", crewId)
      .order("starts_at", { ascending: true });
    if (eventsError) {
      setError(eventsError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = (eventRows ?? []) as EventRow[];
    const eventIds = rows.map((event) => event.id);
    const attendeeResult = eventIds.length
      ? await supabase
          .from("event_attendees")
          .select("event_id")
          .in("event_id", eventIds)
          .eq("response", "going")
      : { data: [], error: null };
    if (attendeeResult.error) {
      setError(attendeeResult.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const counts = new Map<string, number>();
    for (const attendee of attendeeResult.data ?? []) {
      counts.set(attendee.event_id, (counts.get(attendee.event_id) ?? 0) + 1);
    }
    const nextEvents = rows.map((event) => ({
      ...event,
      goingCount: counts.get(event.id) ?? 0,
    }));
    setEvents(nextEvents);

    if (!initializedMonthRef.current) {
      const nextUpcoming = nextEvents.find(
        (event) =>
          event.status === "scheduled" && new Date(event.starts_at).getTime() >= Date.now(),
      );
      setVisibleMonth(startOfMonth(nextUpcoming ? new Date(nextUpcoming.starts_at) : new Date()));
      initializedMonthRef.current = true;
    }
    setLoading(false);
    setRefreshing(false);
  }, [crewId]);

  useFocusEffect(
    useCallback(() => {
      void loadCalendar();
    }, [loadCalendar]),
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = localDateKey(new Date(event.starts_at));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const first = startOfMonth(visibleMonth);
    const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const monthEvents = useMemo(() => {
    const key = monthKey(visibleMonth);
    const inMonth = events.filter((event) => monthKey(new Date(event.starts_at)) === key);
    return selectedDate
      ? inMonth.filter((event) => localDateKey(new Date(event.starts_at)) === selectedDate)
      : inMonth;
  }, [events, selectedDate, visibleMonth]);

  const todayKey = localDateKey(new Date());
  const onChangeMonth = useCallback((amount: number) => {
    setVisibleMonth((current) => addMonths(current, amount));
    setSelectedDate(null);
  }, []);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadCalendar(false);
  }, [loadCalendar]);

  return (
    <NoxaScreen padded={false}>
      <CrewModuleHeader
        badge="MEMBERS"
        right={
          <CrewModuleIconButton
            disabled={refreshing}
            icon="refresh"
            label="Refresh crew calendar"
            onPress={onRefresh}
          />
        }
        subtitle={crew?.name ?? "NOXA crew"}
        title="CREW CALENDAR"
      />

      {loading ? (
        <CrewModuleState
          icon="calendar-outline"
          loading
          message="Loading crew dates and attendance."
          title="Loading calendar"
        />
      ) : error ? (
        <CrewModuleState
          actionLabel="Retry"
          icon="cloud-offline-outline"
          message={error}
          onAction={() => void loadCalendar()}
          title="Calendar unavailable"
        />
      ) : !canView ? (
        <CrewModuleState
          icon="lock-closed-outline"
          message="Join this crew to see its private calendar."
          title="Members only"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              onRefresh={onRefresh}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.monthCard}>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityLabel="Previous month"
                accessibilityRole="button"
                onPress={() => onChangeMonth(-1)}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
              </Pressable>
              <View style={styles.monthCopy}>
                <Text style={styles.monthEyebrow}>CREW SCHEDULE</Text>
                <Text style={styles.monthTitle}>{formatMonth(visibleMonth)}</Text>
              </View>
              <Pressable
                accessibilityLabel="Next month"
                accessibilityRole="button"
                onPress={() => onChangeMonth(1)}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {weekdays.map((weekday) => (
                <Text key={weekday} style={styles.weekday}>{weekday}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((date) => {
                const key = localDateKey(date);
                const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
                const hasEvents = (eventsByDay.get(key)?.length ?? 0) > 0;
                const isSelected = selectedDate === key;
                const isToday = todayKey === key;
                return (
                  <Pressable
                    accessibilityLabel={`Select ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)}`}
                    accessibilityRole="button"
                    key={key}
                    onPress={() => setSelectedDate((current) => current === key ? null : key)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !isCurrentMonth && styles.dayTextMuted,
                        isToday && styles.dayTextToday,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {hasEvents ? (
                      <View style={[styles.eventDot, isSelected && styles.eventDotSelected]} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.listHeader}>
            <View>
              <Text style={styles.listEyebrow}>{selectedDate ? "SELECTED DAY" : "THIS MONTH"}</Text>
              <Text style={styles.listTitle}>
                {selectedDate
                  ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(
                      new Date(`${selectedDate}T12:00:00`),
                    )
                  : "CREW EVENTS"}
              </Text>
            </View>
            <View style={styles.listActions}>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{monthEvents.length}</Text>
              </View>
              {canCreate ? (
                <Pressable
                  accessibilityLabel="Create crew event"
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: "/event-editor", params: { crewId } })
                  }
                  style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={17} color={colors.text} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {monthEvents.length ? (
            <View style={styles.eventList}>
              {monthEvents.map((event) => (
                <CalendarEventCard event={event} key={event.id} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={28} color={colors.primaryHover} />
              </View>
              <Text style={styles.emptyTitle}>NO EVENTS HERE</Text>
              <Text style={styles.emptyText}>
                {selectedDate
                  ? "Choose another day or clear the day filter."
                  : canCreate
                    ? "Plan the first crew event for this month."
                    : "There are no crew events in this month."}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  selectedDate
                    ? setSelectedDate(null)
                    : canCreate
                      ? router.push({ pathname: "/event-editor", params: { crewId } })
                      : onChangeMonth(1)
                }
                style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}
              >
                <Text style={styles.emptyActionText}>
                  {selectedDate ? "SHOW MONTH" : canCreate ? "CREATE EVENT" : "NEXT MONTH"}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  monthCard: {
    padding: spacing.md,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  monthHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  monthButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  monthCopy: { flex: 1, alignItems: "center" },
  monthEyebrow: { color: colors.primaryHover, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  monthTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
  },
  weekHeader: { flexDirection: "row", marginTop: spacing.lg, marginBottom: spacing.xs },
  weekday: {
    width: "14.2857%",
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.2857%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: radius.sm,
  },
  dayCellSelected: { backgroundColor: colors.primary },
  dayText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  dayTextMuted: { color: colors.textDisabled },
  dayTextToday: { color: colors.primaryHover, fontWeight: "900" },
  dayTextSelected: { color: colors.text },
  eventDot: { width: 4, height: 4, borderRadius: radius.pill, backgroundColor: colors.primaryHover },
  eventDotSelected: { backgroundColor: colors.text },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listEyebrow: { color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  listTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  listActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  countPill: {
    minWidth: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  countText: { color: colors.textMuted, fontSize: 10, fontWeight: "900" },
  createButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadows.redGlow,
  },
  eventList: { gap: spacing.sm },
  eventCard: {
    minHeight: 126,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dateTile: {
    width: 54,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  dateDay: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 23,
    fontWeight: "900",
  },
  dateMonth: { color: colors.primaryHover, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  eventCopy: { flex: 1, minWidth: 0, gap: 5 },
  eventBadgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  category: { color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  eventTitle: { color: colors.text, fontSize: 14, fontWeight: "900", lineHeight: 19 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { flexShrink: 1, color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  metaDot: { width: 2, height: 2, marginHorizontal: 2, borderRadius: radius.pill, backgroundColor: colors.textSubtle },
  emptyCard: {
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: "900", letterSpacing: 0.8 },
  emptyText: { maxWidth: 260, color: colors.textMuted, fontSize: 12, fontWeight: "700", lineHeight: 18, textAlign: "center" },
  emptyAction: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  emptyActionText: { color: colors.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
