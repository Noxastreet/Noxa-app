import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  NoxaButton,
  NoxaPressableSurface,
  NoxaRootHeader,
  NoxaScreen,
  NoxaSurface,
} from "@/src/components/ui";
import { useResponsive } from "@/src/hooks/useResponsive";
import {
  CanonicalArtwork,
  CanonicalAvatarStack,
  CanonicalPill,
  CanonicalPrimaryButton,
  CanonicalSectionHeader,
  type CanonicalProfile,
} from "@/src/features/crews-events/CanonicalPrimitives";
import { getEventLifecycle } from "@/src/lib/eventExperience";
import { getCurrentSessionUser, supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type EventCategory = "meet" | "drive" | "track" | "social" | "autocross" | "rally" | "drift" | "drag" | "offroad" | "show" | "workshop";

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
  attendeeCount: number | null;
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
    .replace(".", "")
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

function compactLocation(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const meaningful = parts.filter(
    (part) => !/^(unnamed\s+road\s*)+$/i.test(part),
  );
  return meaningful[meaningful.length - 1] || parts[parts.length - 1] || "Location";
}

function eventType(event: EventRow) {
  const labels: Record<EventCategory, string> = {
    meet: "CAR MEET",
    drive: "DRIVE",
    track: "TRACK",
    social: "SOCIAL",
    autocross: "AUTOCROSS",
    rally: "RALLY",
    drift: "DRIFT",
    drag: "DRAG STRIP",
    offroad: "OFF-ROAD",
    show: "CAR SHOW",
    workshop: "WORKSHOP",
  };
  return labels[event.category] ?? "EVENT";
}

function urgency(event: EventRow) {
  if (getEventLifecycle(event) === "live") return "LIVE";
  const starts = new Date(event.starts_at).getTime();
  const diff = starts - Date.now();
  const startDate = new Date(starts);
  const today = new Date();
  if (startDate.toDateString() === today.toDateString()) return "TODAY";
  if (diff > 0 && diff <= 12 * 60 * 60 * 1000) return "SOON";
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
  const responseLabel = event.attendeeCount === null ? "VIEW EVENT" : event.myResponse === "going" ? "GOING ✓" : "I'M GOING";

  return (
    <NoxaPressableSurface
      accessibilityLabel={`Open ${event.title}`}
      accessibilityRole="button"
      contentStyle={styles.heroCard}
      maskChildren
      onPress={() =>
        router.push({ pathname: "/event-details", params: { id: event.id } })
      }
      outsideFill={colors.background}>
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
            <Text numberOfLines={1} style={styles.heroDateMonth}>
              {formatMonth(event.starts_at)}
            </Text>
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Text numberOfLines={2} style={styles.heroTitle}>
            {event.title.toUpperCase()}
          </Text>
          <Text numberOfLines={1} style={styles.heroMeta}>
            {formatTime(event.starts_at)} · {compactLocation(event.location_name)}
          </Text>

          <View style={styles.heroSocialRow}>
            <CanonicalAvatarStack
              profiles={attendees}
              total={event.attendeeCount ?? 0}
              max={3}
              size={28}
            />
            <Text numberOfLines={1} style={styles.heroSocialText}>
              {event.attendeeCount === null
                ? "Attendance unavailable"
                : event.attendeeCount
                ? `${event.attendeeCount} driver${event.attendeeCount === 1 ? "" : "s"} going`
                : "Be the first driver going"}
            </Text>
          </View>

          <View style={styles.heroFooter}>
            <Text numberOfLines={1} style={styles.organizerLine}>
              {event.crew_id ? "CREW EVENT" : "COMMUNITY EVENT"}
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
    </NoxaPressableSurface>
  );
}

function EventListCard({ event }: { event: EventCardModel }) {
  return (
    <NoxaPressableSurface
      accessibilityLabel={`Open ${event.title}`}
      accessibilityRole="button"
      contentStyle={styles.eventCard}
      onPress={() =>
        router.push({ pathname: "/event-details", params: { id: event.id } })
      }>
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
          {compactLocation(event.location_name)}
        </Text>
        <View style={styles.eventBottomRow}>
          <CanonicalPill label={getEventLifecycle(event) === "live" ? "LIVE" : eventType(event)} tone={getEventLifecycle(event) === "live" ? "accent" : "default"} />
          {event.attendeeCount !== null ? <Text style={styles.goingText}>{event.attendeeCount} GOING</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={19} color={colors.textQuiet} />
    </NoxaPressableSurface>
  );
}

function NearbyStrip({ count }: { count: number }) {
  return (
    <NoxaSurface style={styles.nearbyStrip}>
      <View style={styles.nearbyAccent} />
      <View style={styles.nearbyCopy}>
        <Text style={styles.nearbyEyebrow}>THIS WEEK</Text>
        <Text style={styles.nearbyText}>
          {count
            ? `${count} event${count === 1 ? "" : "s"} scheduled this week`
            : "Upcoming events will appear here"}
        </Text>
      </View>
      <Ionicons name="navigate-outline" size={20} color={colors.textMuted} />
    </NoxaSurface>
  );
}

export default function CanonicalEventsScreen() {
  const { gutter } = useResponsive();
  const [events, setEvents] = useState<EventCardModel[]>([]);
  const [heroAttendees, setHeroAttendees] = useState<CanonicalProfile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const loadVersionRef = useRef(0);

  const loadHeroProfiles = useCallback(async (eventId: string, version: number) => {
    const isCurrent = () => loadVersionRef.current === version;
    const { data: attendanceData, error: attendanceError } = await supabase
      .from("event_attendees")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("response", "going")
      .order("joined_at", { ascending: true })
      .limit(4);

    if (!isCurrent()) return;
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

    if (!isCurrent()) return;
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
      const version = ++loadVersionRef.current;
      const isCurrent = () => loadVersionRef.current === version;
      if (showSpinner) setLoading(true);
      setError(null);

      const currentUserId = (await getCurrentSessionUser())?.id ?? null;
      if (!isCurrent()) return;
      setUserId(currentUserId);

      const now = new Date();
      const feedFloor = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const eventsResult = await supabase
        .from("events")
        .select(
          "id,creator_id,crew_id,title,description,category,location_name,starts_at,ends_at,cover_image_url,is_public,status",
        )
        .eq("status", "scheduled")
        .or(`starts_at.gte.${feedFloor.toISOString()},ends_at.gt.${now.toISOString()}`)
        .order("starts_at", { ascending: true });

      if (!isCurrent()) return;
      if (eventsResult.error) {
        setError(eventsResult.error.message || "Events could not be loaded.");
        setLoading(false);
        setRefreshing(false);
        hasLoadedRef.current = true;
        return;
      }

      const baseModels = ((eventsResult.data ?? []) as EventRow[])
        .filter((event) => {
          const lifecycle = getEventLifecycle(event);
          return lifecycle === "scheduled" || lifecycle === "live";
        })
        .map((event) => ({
          ...event,
          attendeeCount: null,
          myResponse: null,
        }));

      setEvents(baseModels);
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;

      setHeroAttendees([]);
      if (baseModels[0]) void loadHeroProfiles(baseModels[0].id, version).catch(() => {
        if (isCurrent()) setHeroAttendees([]);
      });

      void supabase
        .from("event_attendees")
        .select("event_id,user_id,response,joined_at")
        .then((attendanceResult) => {
          if (!isCurrent() || attendanceResult.error) return;

          const attendance = (attendanceResult.data ?? []) as AttendanceRow[];
          const counts = new Map<string, number>();
          const mine = new Map<string, "going" | "maybe">();

          for (const row of attendance) {
            if (row.response === "going") {
              counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
            }
            if (row.user_id === currentUserId) mine.set(row.event_id, row.response);
          }

          setEvents((current) =>
            current.map((event) => ({
              ...event,
              attendeeCount: counts.get(event.id) ?? 0,
              myResponse: mine.get(event.id) ?? null,
            })),
          );
        }, () => { /* Optional attendance remains unavailable. */ });
    },
    [loadHeroProfiles],
  );

  useFocusEffect(
    useCallback(() => {
      void load(!hasLoadedRef.current);
      return () => { loadVersionRef.current += 1; };
    }, [load]),
  );

  const hero = events[0] ?? null;
  const upcoming = events.slice(1, 5);
  const nearbyCount = events.filter((event) => {
    const lifecycle = getEventLifecycle(event);
    if (lifecycle === "live") return true;
    const diff = new Date(event.starts_at).getTime() - Date.now();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const setGoing = useCallback(
    async (event: EventCardModel) => {
      if (!userId || busyEventId) return;
      if (event.attendeeCount === null) {
        router.push({ pathname: "/event-details", params: { id: event.id } });
        return;
      }
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
            : await supabase.from("event_attendees").insert({
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
        <NoxaSurface style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading events…</Text>
        </NoxaSurface>
      );
    }

    if (error && !hero) {
      return (
        <NoxaSurface style={styles.stateCard}>
          <Ionicons name="cloud-offline-outline" size={38} color={colors.primary} />
          <Text style={styles.stateTitle}>Events unavailable</Text>
          <Text style={styles.stateText}>NOXA could not load the event feed.</Text>
          <CanonicalPrimaryButton
            label="TRY AGAIN"
            onPress={() => void load()}
          />
        </NoxaSurface>
      );
    }

    if (!hero) {
      return (
        <NoxaSurface style={styles.stateCard}>
          <Ionicons name="calendar-outline" size={38} color={colors.primary} />
          <Text style={styles.stateTitle}>Nothing scheduled yet</Text>
          <Text style={styles.stateText}>
            Create the first event or Car Meet in your city.
          </Text>
          <CanonicalPrimaryButton
            label="CREATE EVENT"
            onPress={() => router.push("/event-editor")}
          />
        </NoxaSurface>
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
            <CanonicalSectionHeader title="UPCOMING & LIVE" />
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
            <CanonicalSectionHeader title="MORE EVENTS" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.picksList}
            >
              {events.slice(5, 9).map((event) => (
                <NoxaPressableSurface
                  key={event.id}
                  accessibilityRole="button"
                  contentStyle={styles.pickCard}
                  maskChildren
                  onPress={() =>
                    router.push({
                      pathname: "/event-details",
                      params: { id: event.id },
                    })
                  }
                  outsideFill={colors.background}>
                  <CanonicalArtwork
                    uri={event.cover_image_url}
                    style={styles.pickArtwork}
                    imageStyle={styles.pickArtworkImage}
                    icon="flag-outline"
                  >
                    <View style={styles.pickShade} />
                    <CanonicalPill label={urgency(event) === "LIVE" ? "LIVE" : eventType(event)} tone={urgency(event) === "LIVE" ? "accent" : "default"} />
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
                </NoxaPressableSurface>
              ))}
            </ScrollView>
          </>
        ) : null}
      </>
    );
  }, [
    busyEventId,
    error,
    events,
    hero,
    heroAttendees,
    loading,
    load,
    nearbyCount,
    setGoing,
    upcoming,
  ]);

  return (
    <NoxaScreen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
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
        <NoxaRootHeader
          actions={
            <NoxaButton
              accessibilityLabel="Create event"
              leadingIcon={<Ionicons name="add" size={16} color={colors.text} />}
              onPress={() => router.push("/event-editor")}
              size="sm"
              title="CREATE"
              variant="secondary"
            />
          }
          subtitle="What is happening around you."
          title="EVENTS"
        />

        {error && hero ? (
          <NoxaPressableSurface
            accessibilityRole="button"
            contentStyle={styles.errorBanner}
            onPress={() => setError(null)}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={colors.primaryHover}
            />
            <Text numberOfLines={2} style={styles.errorText}>
              {error}
            </Text>
          </NoxaPressableSurface>
        ) : null}

        {content}
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
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
    backgroundColor: "transparent",
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
    backgroundColor: "transparent",
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
    backgroundColor: "transparent",
  },
  heroArtwork: {
    minHeight: 286,
    justifyContent: "flex-end",
    padding: spacing.md,
    paddingTop: 84,
  },
  heroArtworkImage: {},
  heroShadeTop: {
    ...StyleSheet.absoluteFillObject,
    bottom: "48%",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  heroShadeBottom: {
    ...StyleSheet.absoluteFillObject,
    top: "30%",
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  heroTopRow: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  pillRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  heroDate: {
    width: 50,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.text,
  },
  heroDateDay: {
    color: colors.background,
    fontFamily: typography.fontFamily.display,
    fontSize: 23,
    lineHeight: 25,
    fontWeight: "900",
  },
  heroDateMonth: {
    maxWidth: 42,
    color: colors.primary,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.25,
  },
  heroCopy: { gap: spacing.sm },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroMeta: {
    color: colors.textAccent,
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
    backgroundColor: "transparent",
  },
  dateTile: {
    width: 50,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  dateDay: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 23,
    lineHeight: 26,
    fontWeight: "900",
  },
  dateMonth: {
    color: colors.textAccent,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.35,
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
    color: colors.textQuiet,
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
    backgroundColor: "transparent",
  },
  nearbyAccent: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  nearbyCopy: { flex: 1 },
  nearbyEyebrow: {
    color: colors.textAccent,
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
    backgroundColor: "transparent",
  },
  pickArtwork: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  pickArtworkImage: {},
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