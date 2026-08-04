import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NoxaScreen } from "@/src/components/ui";
import {
  CanonicalArtwork,
  CanonicalAvatarStack,
  CanonicalPill,
  CanonicalPrimaryButton,
  CanonicalSectionHeader,
  type CanonicalProfile,
} from "@/src/features/crews-events/CanonicalPrimitives";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type EventCategory = "meet" | "drive" | "track" | "social";

type EventRow = {
  id: string;
  creator_id: string;
  crew_id: string | null;
  title: string;
  description: string | null;
  category: EventCategory;
  location_name: string;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  status: string;
};

type AttendanceRow = {
  event_id: string;
  user_id: string;
  response: "going" | "maybe";
  joined_at?: string;
};

type EventCardModel = EventRow & {
  attendeeCount: number;
  myResponse: "going" | "maybe" | null;
};

function formatDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(
    new Date(value),
  );
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short" })
    .format(new Date(value))
    .toUpperCase();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
    new Date(value),
  );
}

function eventType(event: EventRow) {
  if (event.category === "meet") return "CAR MEET";
  if (event.category === "drive") return "DRIVE";
  if (event.category === "track") return "TRACK";
  return "EVENT";
}

function urgency(event: EventRow) {
  const starts = new Date(event.starts_at).getTime();
  const now = Date.now();
  const diff = starts - now;
  if (diff <= 0) return "LIVE";
  if (diff <= 12 * 60 * 60 * 1000) return "TONIGHT";
  if (diff <= 24 * 60 * 60 * 1000) return "TODAY";
  return "UPCOMING";
}

function HeroEvent({
  event,
  attendees,
  busy,
  onRsvp,
}: {
  event: EventCardModel;
  attendees: CanonicalProfile[];
  busy: boolean;
  onRsvp: (event: EventCardModel) => void;
}) {
  const responseLabel = event.myResponse === "going" ? "YOU'RE GOING" : "I'M GOING";

  return (
    <Pressable
      accessibilityLabel={`Open ${event.title}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/event-details", params: { id: event.id } })
      }
      style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}
    >
      <CanonicalArtwork
        uri={event.cover_image_url}
        style={styles.heroArtwork}
        imageStyle={styles.heroArtworkImage}
        icon="flag-outline"
      >
        <View style={styles.heroShadeTop} />
        <View style={styles.heroShadeBottom} />

        <View style={styles.heroTopRow}>
          <View style={styles.pillRow}>
            <CanonicalPill label={urgency(event)} tone="accent" />
            <CanonicalPill label={eventType(event)} />
          </View>
          <View style={styles.heroDate}>
            <Text style={styles.heroDateDay}>{formatDay(event.starts_at)}</Text>
            <Text style={styles.heroDateMonth}>{formatMonth(event.starts_at)}</Text>
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Text numberOfLines={2} style={styles.heroTitle}>
            {event.title.toUpperCase()}
          </Text>
          <Text numberOfLines={1} style={styles.heroUrgency}>
            {formatTime(event.starts_at)} · {event.location_name.toUpperCase()}
          </Text>

          <View style={styles.heroSocialRow}>
            <CanonicalAvatarStack
              profiles={attendees}
              total={event.attendeeCount}
              max={3}
              size={30}
            />
            <Text numberOfLines={1} style={styles.heroSocialText}>
              {event.attendeeCount
                ? `${event.attendeeCount} drivers are going`
                : "Be the first driver going"}
            </Text>
          </View>

          <View style={styles.heroFooter}>
            <Text numberOfLines={1} style={styles.organizerLine}>
              {event.crew_id ? "VERIFIED CREW EVENT" : "COMMUNITY EVENT"}
            </Text>
            <CanonicalPrimaryButton
              compact
              disabled={busy}
              loading={busy}
              label={responseLabel}
              variant={event.myResponse === "going" ? "surface" : "accent"}
              onPress={() => onRsvp(event)}
            />
          </View>
        </View>
      </CanonicalArtwork>
    </Pressable>
  );
}

function EventListCard({ event }: { event: EventCardModel }) {
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
        <Text style={styles.dateDay}>{formatDay(event.starts_at)}</Text>
        <Text style={styles.dateMonth}>{formatMonth(event.starts_at)}</Text>
      </View>
      <View
        style={[
          styles.eventAccent,
          event.category === "meet" && styles.eventAccentMeet,
          event.category === "drive" && styles.eventAccentDrive,
        ]}
      />
      <View style={styles.eventCopy}>
        <Text numberOfLines={1} style={styles.eventTitle}>
          {event.title.toUpperCase()}
        </Text>
        <Text numberOfLines={1} style={styles.eventMeta}>
          {formatWeekday(event.starts_at)} · {formatTime(event.starts_at)} ·{" "}
          {event.location_name}
        </Text>
        <View style={styles.eventBottomRow}>
          <CanonicalPill label={eventType(event)} />
          <Text style={styles.goingText}>{event.attendeeCount} GOING</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={19} color={colors.textSubtle} />
    </Pressable>
  );
}

function NearbyStrip({ count }: { count: number }) {
  return (
    <View style={styles.nearbyStrip}>
      <View style={styles.nearbyAccent} />
      <View style={styles.nearbyCopy}>
        <Text style={styles.nearbyEyebrow}>NEARBY NOW</Text>
        <Text style={styles.nearbyText}>
          {count
            ? `${count} event${count === 1 ? "" : "s"} available around you`
            : "New local events will appear here"}
        </Text>
      </View>
      <Ionicons name="navigate-outline" size={20} color={colors.textMuted} />
    </View>
  );
}

export default function CanonicalEventsScreen() {
  const [events, setEvents] = useState<EventCardModel[]>([]);
  const [heroAttendees, setHeroAttendees] = useState<CanonicalProfile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHeroProfiles = useCallback(async (eventId: string) => {
    const { data: attendanceData, error: attendanceError } = await supabase
      .from("event_attendees")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("response", "going")
      .order("joined_at", { ascending: true })
      .limit(4);

    if (attendanceError) {
      setHeroAttendees([]);
      return;
    }

    const ids = (attendanceData ?? []).map((row) => row.user_id);
    if (!ids.length) {
      setHeroAttendees([]);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", ids);

    const byId = new Map(
      ((profileData ?? []) as CanonicalProfile[]).map((profile) => [
        profile.id,
        profile,
      ]),
    );
    setHeroAttendees(
      ids
        .map((id) => byId.get(id))
        .filter((profile): profile is CanonicalProfile => Boolean(profile)),
    );
  }, []);

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      setError(null);

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id ?? null;
      setUserId(currentUserId);

      const eventsQuery = supabase
        .from("events")
        .select(
          "id,creator_id,crew_id,title,description,category,location_name,starts_at,ends_at,cover_image_url,is_public,status",
        )
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });

      const attendanceQuery = supabase
        .from("event_attendees")
        .select("event_id,user_id,response,joined_at");

      const [eventsResult, attendanceResult] = await Promise.all([
        eventsQuery,
        attendanceQuery,
      ]);

      if (eventsResult.error || attendanceResult.error) {
        setError(
          eventsResult.error?.message ||
            attendanceResult.error?.message ||
            "Events could not be loaded.",
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const attendance = (attendanceResult.data ?? []) as AttendanceRow[];
      const counts = new Map<string, number>();
      const mine = new Map<string, "going" | "maybe">();

      for (const row of attendance) {
        if (row.response === "going") {
          counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
        }
        if (row.user_id === currentUserId) mine.set(row.event_id, row.response);
      }

      const models = ((eventsResult.data ?? []) as EventRow[]).map((event) => ({
        ...event,
        attendeeCount: counts.get(event.id) ?? 0,
        myResponse: mine.get(event.id) ?? null,
      }));

      setEvents(models);
      if (models[0]) await loadHeroProfiles(models[0].id);
      else setHeroAttendees([]);
      setLoading(false);
      setRefreshing(false);
    },
    [loadHeroProfiles],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const hero = events[0] ?? null;
  const upcoming = events.slice(1, 5);
  const nearbyCount = events.filter(
    (event) =>
      new Date(event.starts_at).getTime() - Date.now() <=
      7 * 24 * 60 * 60 * 1000,
  ).length;

  const setGoing = useCallback(
    async (event: EventCardModel) => {
      if (!userId || busyEventId) return;
      setBusyEventId(event.id);
      setError(null);

      const result =
        event.myResponse === "going"
          ? await supabase
              .from("event_attendees")
              .delete()
              .eq("event_id", event.id)
              .eq("user_id", userId)
          : event.myResponse
            ? await supabase
                .from("event_attendees")
                .update({ response: "going" })
                .eq("event_id", event.id)
                .eq("user_id", userId)
            : await supabase
                .from("event_attendees")
                .insert({
                  event_id: event.id,
                  user_id: userId,
                  response: "going",
                });

      if (result.error) setError(result.error.message);
      else await load(false);
      setBusyEventId(null);
    },
    [busyEventId, load, userId],
  );

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading events…</Text>
        </View>
      );
    }

    if (!hero) {
      return (
        <View style={styles.stateCard}>
          <Ionicons name="calendar-outline" size={38} color={colors.primary} />
          <Text style={styles.stateTitle}>Nothing scheduled yet</Text>
          <Text style={styles.stateText}>
            Create the first event or Car Meet in your city.
          </Text>
          <CanonicalPrimaryButton
            label="CREATE EVENT"
            onPress={() => router.push("/event-editor")}
          />
        </View>
      );
    }

    return (
      <>
        <HeroEvent
          attendees={heroAttendees}
          busy={busyEventId === hero.id}
          event={hero}
          onRsvp={setGoing}
        />

        {upcoming.length ? (
          <>
            <CanonicalSectionHeader title="UPCOMING THIS WEEK" action="SEE ALL" />
            <View style={styles.eventList}>
              {upcoming.map((event) => (
                <EventListCard key={event.id} event={event} />
              ))}
            </View>
          </>
        ) : null}

        <NearbyStrip count={nearbyCount} />

        {events.length > 5 ? (
          <>
            <CanonicalSectionHeader title="WEEKEND PICKS" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.picksList}
            >
              {events.slice(5, 9).map((event) => (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/event-details",
                      params: { id: event.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.pickCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <CanonicalArtwork
                    uri={event.cover_image_url}
                    style={styles.pickArtwork}
                    imageStyle={styles.pickArtworkImage}
                    icon="flag-outline"
                  >
                    <View style={styles.pickShade} />
                    <CanonicalPill label={eventType(event)} />
                    <View>
                      <Text numberOfLines={2} style={styles.pickTitle}>
                        {event.title.toUpperCase()}
                      </Text>
                      <Text style={styles.pickMeta}>
                        {formatWeekday(event.starts_at)} ·{" "}
                        {formatTime(event.starts_at)}
                      </Text>
                    </View>
                  </CanonicalArtwork>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </>
    );
  }, [
    busyEventId,
    events,
    hero,
    heroAttendees,
    loading,
    nearbyCount,
    setGoing,
    upcoming,
  ]);

  return (
    <NoxaScreen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
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
        <View style={styles.topBar}>
          <View style={styles.heading}>
            <Text style={styles.pageTitle}>EVENTS</Text>
            <Text style={styles.pageSubtitle}>What is happening around you.</Text>
          </View>
          <Pressable
            accessibilityLabel="Create event"
            accessibilityRole="button"
            onPress={() => router.push("/event-editor")}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={17} color={colors.text} />
            <Text style={styles.createText}>CREATE</Text>
          </Pressable>
        </View>

        {error ? (
          <Pressable onPress={() => setError(null)} style={styles.errorBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={colors.primaryHover}
            />
            <Text numberOfLines={2} style={styles.errorText}>
              {error}
            </Text>
          </Pressable>
        ) : null}

        {content}
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: 136,
    gap: spacing.lg,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  topBar: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heading: { flex: 1 },
  pageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h1,
    lineHeight: typography.lineHeight.h1,
    fontWeight: "900",
    letterSpacing: typography.letterSpacing.tight,
  },
  pageSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeight.caption,
  },
  createButton: {
    minHeight: 36,
    marginTop: spacing.xxs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
  },
  createText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  errorBanner: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  stateCard: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "900",
    textAlign: "center",
  },
  stateText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
    textAlign: "center",
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  heroArtwork: {
    minHeight: 300,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  heroArtworkImage: { borderRadius: radius.hero - 1 },
  heroShadeTop: {
    ...StyleSheet.absoluteFillObject,
    bottom: "52%",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  heroShadeBottom: {
    ...StyleSheet.absoluteFillObject,
    top: "30%",
    backgroundColor: "rgba(0,0,0,0.76)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  heroDate: {
    width: 58,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.text,
  },
  heroDateDay: {
    color: colors.background,
    fontFamily: typography.fontFamily.display,
    fontSize: 27,
    lineHeight: 29,
    fontWeight: "900",
  },
  heroDateMonth: {
    color: colors.primary,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  heroCopy: { gap: spacing.sm },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroUrgency: {
    color: colors.primaryHover,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  heroSocialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroSocialText: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  organizerLine: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  eventList: { gap: spacing.sm },
  eventCard: {
    minHeight: 94,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  dateTile: {
    width: 54,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  dateDay: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "900",
  },
  dateMonth: {
    color: colors.primaryHover,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  eventAccent: {
    width: 2,
    alignSelf: "stretch",
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  eventAccentMeet: { backgroundColor: colors.primaryHover },
  eventAccentDrive: { backgroundColor: colors.warning },
  eventCopy: { flex: 1, gap: spacing.xxs },
  eventTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
  },
  eventMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  eventBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  goingText: {
    color: colors.textSubtle,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  nearbyStrip: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  nearbyAccent: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  nearbyCopy: { flex: 1 },
  nearbyEyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  nearbyText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  picksList: {
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  pickCard: {
    width: 238,
    height: 170,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pickArtwork: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  pickArtworkImage: { borderRadius: radius.lg - 1 },
  pickShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  pickTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "900",
  },
  pickMeta: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
});
