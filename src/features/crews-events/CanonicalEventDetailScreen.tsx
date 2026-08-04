import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NoxaScreen } from "@/src/components/ui";
import {
  CanonicalArtwork,
  CanonicalAvatar,
  CanonicalAvatarStack,
  CanonicalPill,
  CanonicalPrimaryButton,
  CanonicalSectionHeader,
  profileName,
  type CanonicalProfile,
} from "@/src/features/crews-events/CanonicalPrimitives";
import { MapboxEventPreviewCompat } from "@/src/features/mapbox/MapboxEventPreviewCompat";
import {
  eventLifecycle,
  formatEventDate,
  formatEventTime,
  type EventExperienceRow,
  type EventResponse,
  uuidPattern,
} from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type EventCrew = {
  id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
};

type AttendanceRow = {
  user_id: string;
  response: EventResponse;
  joined_at: string;
};

type GalleryItem = {
  id: string;
  object_path: string;
  signedUrl: string;
};

const galleryBucket = "event-gallery";

function categoryLabel(event: EventExperienceRow) {
  if (event.category === "meet") return "CAR MEET";
  if (event.category === "drive") return "DRIVE";
  if (event.category === "track") return "TRACK";
  return "EVENT";
}

function lifecycleUrgency(event: EventExperienceRow) {
  const lifecycle = eventLifecycle(event);
  if (lifecycle === "live") return "LIVE";
  if (lifecycle === "soon") return "TONIGHT";
  if (lifecycle === "completed") return "COMPLETED";
  if (lifecycle === "cancelled") return "CANCELLED";
  const date = new Date(event.starts_at);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? "TODAY" : "UPCOMING";
}

function validCoordinates(
  event: EventExperienceRow | null,
): event is EventExperienceRow & { latitude: number; longitude: number } {
  return Boolean(
    event &&
      typeof event.latitude === "number" &&
      Number.isFinite(event.latitude) &&
      typeof event.longitude === "number" &&
      Number.isFinite(event.longitude),
  );
}

function EventHeader({
  saved,
  saving,
  onSave,
  onShare,
  isHost,
  onEdit,
}: {
  saved: boolean;
  saving: boolean;
  onSave: () => void;
  onShare: () => void;
  isHost: boolean;
  onEdit: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={23} color={colors.text} />
      </Pressable>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel={saved ? "Remove saved event" : "Save event"}
          accessibilityRole="button"
          disabled={saving}
          onPress={onSave}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={19}
            color={saved ? colors.primaryHover : colors.text}
          />
        </Pressable>
        <Pressable
          accessibilityLabel="Share event"
          accessibilityRole="button"
          onPress={onShare}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={19} color={colors.text} />
        </Pressable>
        {isHost ? (
          <Pressable
            accessibilityLabel="Edit event"
            accessibilityRole="button"
            onPress={onEdit}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Hero({
  event,
  attendees,
  goingCount,
}: {
  event: EventExperienceRow;
  attendees: CanonicalProfile[];
  goingCount: number;
}) {
  return (
    <CanonicalArtwork
      uri={event.cover_image_url}
      style={styles.hero}
      imageStyle={styles.heroImage}
      icon="flag-outline"
    >
      <View style={styles.heroShade} />
      <View style={styles.heroPills}>
        <CanonicalPill label={categoryLabel(event)} />
        <CanonicalPill label={lifecycleUrgency(event)} tone="accent" />
      </View>
      <View style={styles.heroCopy}>
        <Text numberOfLines={3} style={styles.heroTitle}>
          {event.title.toUpperCase()}
        </Text>
        <Text style={styles.heroUrgency}>
          {formatEventTimeLine(event)} · {goingCount} GOING
        </Text>
        <Text numberOfLines={1} style={styles.heroLocation}>
          {event.location_name}
        </Text>
        <View style={styles.heroSocial}>
          <CanonicalAvatarStack
            profiles={attendees}
            total={goingCount}
            max={3}
            size={30}
          />
          <Text numberOfLines={1} style={styles.heroSocialText}>
            {goingCount
              ? `${Math.min(goingCount, 3)} familiar drivers and the community`
              : "Be the first driver to confirm"}
          </Text>
        </View>
      </View>
    </CanonicalArtwork>
  );
}

function formatEventTimeLine(event: EventExperienceRow) {
  const start = formatEventTime(event.starts_at);
  if (!event.ends_at) return start;
  return `${start}–${formatEventTime(event.ends_at)}`;
}

function EssentialInfo({ event }: { event: EventExperienceRow }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoRow}>
        <View style={styles.infoIcon}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoLabel}>TIME</Text>
          <Text style={styles.infoValue}>
            {formatEventDate(event.starts_at)} · {formatEventTimeLine(event)}
          </Text>
        </View>
      </View>
      <View style={styles.infoRow}>
        <View style={styles.infoIcon}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoLabel}>PLACE</Text>
          <Text style={styles.infoValue}>{event.location_name}</Text>
        </View>
      </View>
      {event.capacity ? (
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>CAPACITY</Text>
            <Text style={styles.infoValue}>{event.capacity} confirmed drivers</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function CanonicalEventDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === "string" ? params.id : "";

  const [event, setEvent] = useState<EventExperienceRow | null>(null);
  const [creator, setCreator] = useState<CanonicalProfile | null>(null);
  const [crew, setCrew] = useState<EventCrew | null>(null);
  const [attendees, setAttendees] = useState<CanonicalProfile[]>([]);
  const [goingCount, setGoingCount] = useState(0);
  const [myResponse, setMyResponse] = useState<EventResponse | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [organizerEventCount, setOrganizerEventCount] = useState(0);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!uuidPattern.test(eventId)) {
      setError("This event link is invalid.");
      setLoading(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    setCurrentUserId(userId);

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !eventData) {
      setError(eventError?.message || "Event not found.");
      setLoading(false);
      return;
    }

    const nextEvent = eventData as EventExperienceRow;
    setEvent(nextEvent);

    const [
      creatorResult,
      crewResult,
      attendanceResult,
      savedResult,
      historyResult,
      galleryResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .eq("id", nextEvent.creator_id)
        .maybeSingle(),
      nextEvent.crew_id
        ? supabase
            .from("crews")
            .select("id,name,logo_url,city")
            .eq("id", nextEvent.crew_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("event_attendees")
        .select("user_id,response,joined_at")
        .eq("event_id", nextEvent.id)
        .order("joined_at", { ascending: true }),
      userId
        ? supabase
            .from("saved_events")
            .select("event_id")
            .eq("event_id", nextEvent.id)
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", nextEvent.creator_id)
        .lt("starts_at", nextEvent.starts_at),
      supabase
        .from("event_gallery_items")
        .select("id,object_path")
        .eq("event_id", nextEvent.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const detailError =
      creatorResult.error ||
      crewResult.error ||
      attendanceResult.error ||
      historyResult.error;

    if (detailError) setError(detailError.message);

    setCreator((creatorResult.data as CanonicalProfile | null) ?? null);
    setCrew((crewResult.data as EventCrew | null) ?? null);
    setIsSaved(savedResult.error ? false : Boolean(savedResult.data));
    setOrganizerEventCount(historyResult.count ?? 0);

    const attendanceRows = (attendanceResult.data ?? []) as AttendanceRow[];
    const goingRows = attendanceRows.filter((row) => row.response === "going");
    setGoingCount(goingRows.length);
    setMyResponse(
      attendanceRows.find((row) => row.user_id === userId)?.response ?? null,
    );

    const attendeeIds = goingRows.slice(0, 12).map((row) => row.user_id);
    if (attendeeIds.length) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .in("id", attendeeIds);
      const profileRows = (profileData ?? []) as CanonicalProfile[];
      const byId = new Map(profileRows.map((profile) => [profile.id, profile]));
      setAttendees(
        attendeeIds
          .map((id) => byId.get(id))
          .filter((profile): profile is CanonicalProfile => Boolean(profile)),
      );
    } else {
      setAttendees([]);
    }

    if (galleryResult.error) {
      setGallery([]);
    } else {
      const signed = await Promise.all(
        (galleryResult.data ?? []).map(async (item) => {
          const { data } = await supabase.storage
            .from(galleryBucket)
            .createSignedUrl(item.object_path, 60 * 60);
          return data?.signedUrl
            ? {
                id: item.id,
                object_path: item.object_path,
                signedUrl: data.signedUrl,
              }
            : null;
        }),
      );
      setGallery(signed.filter((item): item is GalleryItem => Boolean(item)));
    }

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isHost = Boolean(event && currentUserId === event.creator_id);
  const rsvpClosed = Boolean(
    event && ["completed", "cancelled"].includes(eventLifecycle(event)),
  );

  const toggleGoing = useCallback(async () => {
    if (!event || !currentUserId || isHost || rsvpBusy || rsvpClosed) return;
    setRsvpBusy(true);
    setError(null);

    const result =
      myResponse === "going"
        ? await supabase
            .from("event_attendees")
            .delete()
            .eq("event_id", event.id)
            .eq("user_id", currentUserId)
        : myResponse
          ? await supabase
              .from("event_attendees")
              .update({ response: "going" })
              .eq("event_id", event.id)
              .eq("user_id", currentUserId)
          : await supabase.from("event_attendees").insert({
              event_id: event.id,
              user_id: currentUserId,
              response: "going",
            });

    if (result.error) setError(result.error.message);
    else await load();
    setRsvpBusy(false);
  }, [currentUserId, event, isHost, load, myResponse, rsvpBusy, rsvpClosed]);

  const toggleSaved = useCallback(async () => {
    if (!event || !currentUserId || saving) return;
    setSaving(true);
    const result = isSaved
      ? await supabase
          .from("saved_events")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", currentUserId)
      : await supabase.from("saved_events").insert({
          event_id: event.id,
          user_id: currentUserId,
        });

    if (result.error) setError(result.error.message);
    else setIsSaved((value) => !value);
    setSaving(false);
  }, [currentUserId, event, isSaved, saving]);

  const navigate = useCallback(() => {
    if (!event || !validCoordinates(event)) return;
    router.replace({
      pathname: "/(tabs)",
      params: { focusEventId: event.id, mapMode: "route" },
    });
  }, [event]);

  const share = useCallback(async () => {
    if (!event) return;
    await Share.share({
      title: event.title,
      message: `${event.title} · ${formatEventDate(event.starts_at)} · ${event.location_name}`,
    });
  }, [event]);

  const edit = useCallback(() => {
    if (!event) return;
    Alert.alert("Manage event", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Edit Event",
        onPress: () =>
          router.push({ pathname: "/event-editor", params: { id: event.id } }),
      },
    ]);
  }, [event]);

  const organizerName = crew?.name || profileName(creator);
  const canChat = isHost || myResponse !== null;
  const galleryPreview = useMemo(() => gallery.slice(0, 3), [gallery]);

  if (loading) {
    return (
      <NoxaScreen>
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Opening event…</Text>
        </View>
      </NoxaScreen>
    );
  }

  if (!event) {
    return (
      <NoxaScreen>
        <EventHeader
          isHost={false}
          onEdit={() => undefined}
          onSave={() => undefined}
          onShare={() => undefined}
          saved={false}
          saving={false}
        />
        <View style={styles.state}>
          <Ionicons name="calendar-outline" size={38} color={colors.primary} />
          <Text style={styles.stateTitle}>Event unavailable</Text>
          <Text style={styles.stateText}>{error || "This event no longer exists."}</Text>
          <CanonicalPrimaryButton
            label="GO BACK"
            variant="surface"
            onPress={() => router.back()}
          />
        </View>
      </NoxaScreen>
    );
  }

  const goingLabel = isHost
    ? "YOU'RE HOSTING"
    : myResponse === "going"
      ? "YOU'RE GOING"
      : rsvpClosed
        ? "RSVP CLOSED"
        : "I'M GOING";

  return (
    <NoxaScreen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <EventHeader
          isHost={isHost}
          onEdit={edit}
          onSave={toggleSaved}
          onShare={share}
          saved={isSaved}
          saving={saving}
        />

        <Hero event={event} attendees={attendees} goingCount={goingCount} />

        {error ? (
          <Pressable onPress={() => setError(null)} style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primaryHover} />
            <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
          </Pressable>
        ) : null}

        <View style={styles.section}>
          <CanonicalSectionHeader title="ESSENTIAL INFO" />
          <EssentialInfo event={event} />
        </View>

        <View style={styles.section}>
          <View style={styles.mapCard}>
            {validCoordinates(event) ? (
              <MapboxEventPreviewCompat
                coordinate={{ latitude: event.latitude, longitude: event.longitude }}
              />
            ) : (
              <CanonicalArtwork style={StyleSheet.absoluteFill} icon="map-outline" />
            )}
            <View style={styles.mapOverlayTop}>
              <Text style={styles.mapMeta}>
                {validCoordinates(event) ? "NOXA MAP PREVIEW" : "LOCATION PREVIEW"}
              </Text>
              <CanonicalPrimaryButton
                compact
                disabled={!validCoordinates(event)}
                icon="navigate"
                label="NAVIGATE"
                onPress={navigate}
              />
            </View>
            <View style={styles.mapRouteLine}>
              <View style={styles.mapRouteStart} />
              <View style={styles.mapRouteTrack} />
              <View style={styles.mapRouteEnd} />
            </View>
            <Text style={styles.mapBrand}>NOXA NAVIGATION</Text>
          </View>
        </View>

        <View style={styles.section}>
          <CanonicalSectionHeader title="WHO'S GOING" action={`${goingCount}`} />
          <View style={styles.goingCard}>
            <CanonicalAvatarStack profiles={attendees} total={goingCount} max={4} size={38} />
            <View style={styles.goingCopy}>
              <Text style={styles.goingTitle}>
                {goingCount
                  ? `${Math.min(goingCount, 3)} familiar drivers · ${goingCount} total`
                  : "No confirmed drivers yet"}
              </Text>
              <Text style={styles.goingMeta}>
                {goingCount
                  ? "Friends, Crew members and other drivers"
                  : "Confirm attendance to appear here"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <CanonicalSectionHeader title="ORGANIZER" />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (crew) {
                router.push({ pathname: "/crew/[id]", params: { id: crew.id } });
              } else if (creator) {
                router.push({ pathname: "/driver-profile/[id]", params: { id: creator.id } });
              }
            }}
            style={({ pressed }) => [styles.organizerCard, pressed && styles.pressed]}
          >
            {crew?.logo_url ? (
              <Image source={{ uri: crew.logo_url }} style={styles.organizerLogo} />
            ) : (
              <CanonicalAvatar profile={creator} size={44} />
            )}
            <View style={styles.organizerCopy}>
              <Text style={styles.organizerEyebrow}>
                ORGANIZED BY {crew ? "· VERIFIED CREW" : ""}
              </Text>
              <Text numberOfLines={1} style={styles.organizerTitle}>
                {organizerName}
              </Text>
            </View>
            <Text style={styles.organizerHistory}>
              {organizerEventCount ? `${organizerEventCount} past events` : "First event"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        </View>

        {galleryPreview.length ? (
          <View style={styles.section}>
            <CanonicalSectionHeader title="PAST ATMOSPHERE" action={`${gallery.length} PHOTOS`} />
            <View style={styles.galleryRow}>
              {galleryPreview.map((item) => (
                <Image key={item.id} source={{ uri: item.signedUrl }} style={styles.galleryImage} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.detailsCard}>
          <Text style={styles.detailsEyebrow}>DETAILS</Text>
          <Text style={styles.detailsText}>
            {event.description ||
              "The organizer has not added a full description yet. Check the location and time before driving."}
          </Text>
          <View style={styles.detailsDivider} />
          <Text style={styles.rulesText}>
            Respect the location, local traffic rules and other drivers.
          </Text>
        </View>

        {canChat ? (
          <View style={styles.chatButtonWrap}>
            <CanonicalPrimaryButton
              icon="chatbubble-outline"
              label="EVENT CHAT"
              variant="surface"
              onPress={() =>
                router.push({ pathname: "/event-chat", params: { id: event.id } })
              }
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.stickyFooter}>
        <CanonicalPrimaryButton
          disabled={isHost || rsvpClosed}
          icon={myResponse === "going" || isHost ? "checkmark" : undefined}
          label={goingLabel}
          loading={rsvpBusy}
          variant={myResponse === "going" || isHost ? "surface" : "accent"}
          onPress={toggleGoing}
        />
        {myResponse === "going" && !isHost ? (
          <Text style={styles.manageHint}>Tap again to cancel attendance</Text>
        ) : null}
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 150, gap: spacing.lg },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  header: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md },
  headerActions: { flexDirection: "row", gap: spacing.xs },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface },
  hero: { minHeight: 286, justifyContent: "space-between", marginHorizontal: spacing.md, padding: spacing.md, borderRadius: radius.hero, borderWidth: 1, borderColor: colors.borderStrong },
  heroImage: { borderRadius: radius.hero - 1 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.66)" },
  heroPills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  heroCopy: { gap: spacing.xs },
  heroTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 30, lineHeight: 34, fontWeight: "900", letterSpacing: -0.5 },
  heroUrgency: { color: colors.primaryHover, fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 0.2 },
  heroLocation: { color: colors.text, fontSize: 13, lineHeight: 18 },
  heroSocial: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroSocialText: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  errorBanner: { minHeight: 48, marginHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderAccent, backgroundColor: colors.primarySubtle },
  errorText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 16 },
  section: { paddingHorizontal: spacing.md, gap: spacing.xs },
  infoCard: { overflow: "hidden", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  infoRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  infoIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: colors.surfaceRaised },
  infoCopy: { flex: 1 },
  infoLabel: { color: colors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.5 },
  infoValue: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  mapCard: { height: 176, overflow: "hidden", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: "#0B1218" },
  mapOverlayTop: { position: "absolute", left: spacing.sm, right: spacing.sm, top: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  mapMeta: { color: colors.text, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.5 },
  mapRouteLine: { position: "absolute", left: 62, right: 62, bottom: 50, flexDirection: "row", alignItems: "center" },
  mapRouteStart: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text },
  mapRouteTrack: { flex: 1, height: 3, backgroundColor: colors.primary },
  mapRouteEnd: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: colors.text, backgroundColor: colors.primary },
  mapBrand: { position: "absolute", left: spacing.sm, bottom: spacing.sm, color: colors.text, fontSize: 8, lineHeight: 10, fontWeight: "900", letterSpacing: 0.5 },
  goingCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  goingCopy: { flex: 1 },
  goingTitle: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  goingMeta: { color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  organizerCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  organizerLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised },
  organizerCopy: { flex: 1 },
  organizerEyebrow: { color: colors.textMuted, fontSize: 8, lineHeight: 11, fontWeight: "900", letterSpacing: 0.4 },
  organizerTitle: { color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: "800" },
  organizerHistory: { color: colors.textMuted, fontSize: 9, lineHeight: 12 },
  galleryRow: { height: 112, flexDirection: "row", gap: spacing.sm },
  galleryImage: { flex: 1, height: "100%", borderRadius: radius.md, backgroundColor: colors.surface },
  detailsCard: { marginHorizontal: spacing.md, gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  detailsEyebrow: { color: colors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.5 },
  detailsText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  detailsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  rulesText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  chatButtonWrap: { marginHorizontal: spacing.md },
  stickyFooter: { position: "absolute", left: 0, right: 0, bottom: 0, gap: spacing.xxs, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.glass },
  manageHint: { color: colors.textMuted, fontSize: 9, lineHeight: 12, textAlign: "center" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  stateTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.h2, lineHeight: typography.lineHeight.h2, fontWeight: "900", textAlign: "center" },
  stateText: { color: colors.textMuted, fontSize: typography.body, lineHeight: typography.lineHeight.body, textAlign: "center" },
});
