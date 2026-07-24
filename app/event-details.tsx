import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
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

import { NoxaButton, NoxaScreen } from "@/src/components/ui";
import { MapboxEventPreviewCompat } from "@/src/features/mapbox/MapboxEventPreviewCompat";
import {
  eventLifecycle,
  formatEventDate,
  formatEventDateTime,
  formatEventTime,
  initials,
  lifecycleLabel,
  uuidPattern,
  type EventExperienceRow,
  type EventLifecycle,
  type EventResponse,
} from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

const eventGalleryBucket = "event-gallery";

type CreatorProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
};
type EventCrew = {
  id: string;
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  city: string | null;
};
type AttendanceRow = {
  user_id: string;
  response: EventResponse;
  joined_at: string;
};
type GalleryPreviewRow = {
  id: string;
  object_path: string;
};
type GalleryPreview = GalleryPreviewRow & { signedUrl: string };

function displayName(profile: CreatorProfile | null) {
  return profile?.display_name || profile?.username || "NOXA driver";
}

function HeaderAction({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerAction,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={19} color={colors.text} />
    </Pressable>
  );
}

function LifecycleBadge({ lifecycle }: { lifecycle: EventLifecycle }) {
  const completed = lifecycle === "completed";
  const soon = lifecycle === "soon";
  const neutral = lifecycle === "upcoming";
  return (
    <View
      style={[
        styles.lifecycleBadge,
        completed && styles.lifecycleBadgeComplete,
        soon && styles.lifecycleBadgeSoon,
        neutral && styles.lifecycleBadgeNeutral,
      ]}
    >
      <View
        style={[
          styles.lifecycleDot,
          completed && styles.lifecycleDotComplete,
          soon && styles.lifecycleDotSoon,
          neutral && styles.lifecycleDotNeutral,
        ]}
      />
      <Text
        style={[
          styles.lifecycleText,
          completed && styles.lifecycleTextComplete,
          soon && styles.lifecycleTextSoon,
          neutral && styles.lifecycleTextNeutral,
        ]}
      >
        {lifecycleLabel(lifecycle)}
      </Text>
    </View>
  );
}

export default function EventDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === "string" ? params.id : "";
  const [event, setEvent] = useState<EventExperienceRow | null>(null);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [eventCrew, setEventCrew] = useState<EventCrew | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [maybeCount, setMaybeCount] = useState(0);
  const [attendees, setAttendees] = useState<CreatorProfile[]>([]);
  const [myResponse, setMyResponse] = useState<EventResponse | null>(null);
  const [gallery, setGallery] = useState<GalleryPreview[]>([]);
  const [galleryCount, setGalleryCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const isHost = useMemo(
    () => Boolean(event && currentUserId === event.creator_id),
    [currentUserId, event],
  );
  const lifecycle = useMemo(
    () => (event ? eventLifecycle(event) : "upcoming"),
    [event],
  );
  const rsvpClosed = lifecycle === "completed" || lifecycle === "cancelled";
  const canChat = isHost || myResponse !== null;
  const capacityProgress = event?.capacity
    ? Math.min(1, goingCount / event.capacity)
    : 0;

  const loadAttendance = useCallback(
    async (id: string, userId: string | null) => {
      const [goingResult, maybeResult, attendeesResult, mineResult] = await Promise.all([
        supabase
          .from("event_attendees")
          .select("event_id", { count: "exact", head: true })
          .eq("event_id", id)
          .eq("response", "going"),
        supabase
          .from("event_attendees")
          .select("event_id", { count: "exact", head: true })
          .eq("event_id", id)
          .eq("response", "maybe"),
        supabase
          .from("event_attendees")
          .select("user_id,response,joined_at")
          .eq("event_id", id)
          .eq("response", "going")
          .order("joined_at", { ascending: true })
          .limit(4),
        userId
          ? supabase
              .from("event_attendees")
              .select("user_id,response,joined_at")
              .eq("event_id", id)
              .eq("user_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      const attendanceError =
        goingResult.error || maybeResult.error || attendeesResult.error || mineResult.error;
      if (attendanceError) throw attendanceError;
      setGoingCount(goingResult.count ?? 0);
      setMaybeCount(maybeResult.count ?? 0);
      setMyResponse(
        mineResult.data ? (mineResult.data as AttendanceRow).response : null,
      );

      const attendeeIds = ((attendeesResult.data ?? []) as AttendanceRow[]).map(
        (row) => row.user_id,
      );
      if (!attendeeIds.length) {
        setAttendees([]);
        return;
      }
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url,city")
        .in("id", attendeeIds);
      if (profilesError) throw profilesError;
      const byId = new Map(
        ((profileRows ?? []) as CreatorProfile[]).map((profile) => [profile.id, profile]),
      );
      setAttendees(
        attendeeIds
          .map((idValue) => byId.get(idValue))
          .filter((profile): profile is CreatorProfile => Boolean(profile)),
      );
    },
    [],
  );

  const loadGallery = useCallback(async (id: string) => {
    const [itemsResult, countResult] = await Promise.all([
      supabase
        .from("event_gallery_items")
        .select("id,object_path")
        .eq("event_id", id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("event_gallery_items")
        .select("event_id", { count: "exact", head: true })
        .eq("event_id", id),
    ]);
    if (itemsResult.error || countResult.error) {
      throw itemsResult.error || countResult.error;
    }
    setGalleryCount(countResult.count ?? 0);
    const signed = await Promise.all(
      ((itemsResult.data ?? []) as GalleryPreviewRow[]).map(async (item) => {
        const { data, error: signedError } = await supabase.storage
          .from(eventGalleryBucket)
          .createSignedUrl(item.object_path, 60 * 60);
        if (signedError || !data?.signedUrl) return null;
        return { ...item, signedUrl: data.signedUrl } satisfies GalleryPreview;
      }),
    );
    setGallery(signed.filter((item): item is GalleryPreview => Boolean(item)));
  }, []);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    if (!uuidPattern.test(eventId)) {
      setNotFound(true);
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
    if (eventError) {
      setError(eventError.message);
      setLoading(false);
      return;
    }
    if (!eventData) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const nextEvent = eventData as EventExperienceRow;
    setEvent(nextEvent);

    const [profileResult, crewResult, savedResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url,city")
        .eq("id", nextEvent.creator_id)
        .maybeSingle(),
      nextEvent.crew_id
        ? supabase
            .from("crews")
            .select("id,name,logo_url,cover_image_url,city")
            .eq("id", nextEvent.crew_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      userId
        ? supabase
            .from("saved_events")
            .select("event_id")
            .eq("event_id", nextEvent.id)
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const detailError = profileResult.error || crewResult.error;
    if (detailError) setError(detailError.message);
    setCreator((profileResult.data as CreatorProfile | null) ?? null);
    setEventCrew((crewResult.data as EventCrew | null) ?? null);
    setIsSaved(savedResult.error ? false : Boolean(savedResult.data));

    try {
      await Promise.all([
        loadAttendance(nextEvent.id, userId),
        loadGallery(nextEvent.id),
      ]);
    } catch (experienceError) {
      setError(
        experienceError instanceof Error
          ? experienceError.message
          : "The event experience could not be loaded.",
      );
    }
    setLoading(false);
  }, [eventId, loadAttendance, loadGallery]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const setRsvp = useCallback(
    async (response: EventResponse | null) => {
      if (!event || !currentUserId || isHost || busy || rsvpClosed) return;
      if (
        response === "going"
        && myResponse !== "going"
        && event.capacity !== null
        && goingCount >= event.capacity
      ) {
        setError("This event has reached its confirmed capacity.");
        return;
      }
      setBusy(true);
      setError(null);
      const result = response === null
        ? await supabase
            .from("event_attendees")
            .delete()
            .eq("event_id", event.id)
            .eq("user_id", currentUserId)
        : myResponse
          ? await supabase
              .from("event_attendees")
              .update({ response })
              .eq("event_id", event.id)
              .eq("user_id", currentUserId)
          : await supabase
              .from("event_attendees")
              .insert({ event_id: event.id, user_id: currentUserId, response });
      if (result.error) setError(result.error.message);
      else await loadAttendance(event.id, currentUserId);
      setBusy(false);
    },
    [
      busy,
      currentUserId,
      event,
      goingCount,
      isHost,
      loadAttendance,
      myResponse,
      rsvpClosed,
    ],
  );

  const toggleSavedEvent = useCallback(async () => {
    if (!event || !currentUserId || savingEvent) return;
    setSavingEvent(true);
    setError(null);
    const result = isSaved
      ? await supabase
          .from("saved_events")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", currentUserId)
      : await supabase
          .from("saved_events")
          .insert({ event_id: event.id, user_id: currentUserId });
    if (result.error) setError(result.error.message);
    else setIsSaved((current) => !current);
    setSavingEvent(false);
  }, [currentUserId, event, isSaved, savingEvent]);

  const routeOnNoxaMap = useCallback(() => {
    if (!event) return;
    router.replace({
      pathname: "/(tabs)",
      params: { focusEventId: event.id, mapMode: "route" },
    });
  }, [event]);

  const openChat = useCallback(() => {
    if (!event) return;
    if (!canChat) {
      Alert.alert(
        "RSVP required",
        "Choose Going or Maybe before joining the participant chat.",
      );
      return;
    }
    router.push({ pathname: "/event-chat", params: { id: event.id } });
  }, [canChat, event]);

  const confirmDelete = useCallback(() => {
    if (!event || !currentUserId || deleting) return;
    Alert.alert(
      "Delete event?",
      "This removes the event, chat, gallery records, and attendance list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Event",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setError(null);
            const { data: galleryRows, error: galleryError } = await supabase
              .from("event_gallery_items")
              .select("object_path")
              .eq("event_id", event.id);
            if (galleryError) {
              setError(galleryError.message);
              setDeleting(false);
              return;
            }
            const galleryPaths = (galleryRows ?? []).map((row) => row.object_path);
            if (galleryPaths.length) {
              const { error: storageError } = await supabase.storage
                .from(eventGalleryBucket)
                .remove(galleryPaths);
              if (storageError) {
                setError(storageError.message);
                setDeleting(false);
                return;
              }
            }
            const { data, error: deleteError } = await supabase
              .from("events")
              .delete()
              .eq("id", event.id)
              .eq("creator_id", currentUserId)
              .select("id");
            if (deleteError || !data || data.length !== 1) {
              setError(deleteError?.message ?? "Event was not deleted.");
              setDeleting(false);
              return;
            }
            router.replace("/(tabs)/events");
          },
        },
      ],
    );
  }, [currentUserId, deleting, event]);

  const shareEvent = useCallback(async () => {
    if (!event || sharing) return;
    setSharing(true);
    try {
      const eventUrl = Linking.createURL("/event-details", {
        queryParams: { id: event.id },
      });
      await Share.share({
        title: event.title,
        message: `${event.title}\n${formatEventDateTime(event.starts_at)} · ${event.location_name}\n${eventUrl}`,
      });
    } catch {
      setError("The event could not be shared.");
    } finally {
      setSharing(false);
    }
  }, [event, sharing]);

  const bottomLabel = rsvpClosed
    ? lifecycle === "completed" ? "VIEW EVENT SUMMARY" : "EVENT CANCELLED"
    : isHost
      ? "HOSTING"
      : busy
        ? "SAVING…"
        : myResponse === "going"
          ? "CANCEL RSVP"
          : myResponse === "maybe"
            ? "CONFIRM GOING"
            : "RSVP — GOING";

  const bottomAction = useCallback(() => {
    if (!event) return;
    if (lifecycle === "completed") {
      router.push({ pathname: "/event-summary", params: { id: event.id } });
      return;
    }
    if (rsvpClosed || isHost) return;
    void setRsvp(myResponse === "going" ? null : "going");
  }, [event, isHost, lifecycle, myResponse, rsvpClosed, setRsvp]);

  return (
    <NoxaScreen padded={false}>
      <View style={styles.header}>
        <HeaderAction icon="chevron-back" label="Go back" onPress={() => router.back()} />
        <View style={styles.headerActions}>
          <HeaderAction
            disabled={!currentUserId || savingEvent}
            icon={isSaved ? "heart" : "heart-outline"}
            label={isSaved ? "Remove saved event" : "Save event"}
            onPress={() => void toggleSavedEvent()}
          />
          <HeaderAction
            disabled={sharing}
            icon={sharing ? "checkmark" : "share-social-outline"}
            label="Share event"
            onPress={() => void shareEvent()}
          />
          <HeaderAction icon="refresh" label="Refresh event" onPress={() => void loadEvent()} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.fullState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading event…</Text>
          </View>
        ) : notFound ? (
          <View style={styles.fullState}>
            <Text style={styles.stateTitle}>EVENT NOT FOUND</Text>
            <NoxaButton title="BACK TO EVENTS" onPress={() => router.replace("/(tabs)/events")} />
          </View>
        ) : event ? (
          <>
            <View style={styles.hero}>
              {event.cover_image_url ? (
                <Image source={{ uri: event.cover_image_url }} style={styles.heroImage} />
              ) : gallery[0]?.signedUrl ? (
                <Image source={{ uri: gallery[0].signedUrl }} style={styles.heroImage} />
              ) : (
                <View style={[styles.heroImage, styles.heroPlaceholder]}>
                  <Ionicons name="flag" size={72} color={colors.primaryMuted} />
                </View>
              )}
              <View style={styles.heroShade} />
              <View style={styles.heroCopy}>
                <LifecycleBadge lifecycle={lifecycle} />
                <Text numberOfLines={2} style={styles.heroTitle}>{event.title}</Text>
                <View style={styles.heroMetaRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{event.category.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.heroMeta}>
                    {formatEventDate(event.starts_at)} · {formatEventTime(event.starts_at)}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                eventCrew
                  ? router.push({ pathname: "/crew/[id]", params: { id: eventCrew.id } })
                  : router.push({ pathname: "/driver-profile/[id]", params: { id: event.creator_id } })
              }
              style={({ pressed }) => [styles.organizerCard, pressed && styles.pressed]}
            >
              {eventCrew?.logo_url || creator?.avatar_url ? (
                <Image
                  source={{ uri: eventCrew?.logo_url ?? creator?.avatar_url ?? "" }}
                  style={styles.organizerAvatar}
                />
              ) : (
                <View style={[styles.organizerAvatar, styles.avatarFallback]}>
                  <Text style={styles.organizerInitials}>
                    {initials(eventCrew?.name ?? displayName(creator))}
                  </Text>
                </View>
              )}
              <View style={styles.organizerCopy}>
                <Text style={styles.miniLabel}>ORGANIZED BY</Text>
                <Text numberOfLines={1} style={styles.organizerName}>
                  {eventCrew?.name ?? displayName(creator)}
                </Text>
                <Text style={styles.organizerMeta}>
                  {eventCrew?.city ?? creator?.city ?? "NOXA community"}
                </Text>
              </View>
              <View style={styles.viewChip}>
                <Text style={styles.viewChipText}>VIEW</Text>
              </View>
            </Pressable>

            <View style={styles.rsvpCard}>
              <View style={styles.segmented}>
                {([
                  { value: "going" as const, label: "Going" },
                  { value: "maybe" as const, label: "Maybe" },
                  { value: null, label: "Can't" },
                ]).map((option, index) => {
                  const active = isHost
                    ? option.value === "going"
                    : myResponse === option.value;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active, disabled: isHost || rsvpClosed }}
                      disabled={isHost || rsvpClosed || busy}
                      key={option.label}
                      onPress={() => void setRsvp(option.value)}
                      style={({ pressed }) => [
                        styles.segment,
                        index === 0 && styles.segmentFirst,
                        index === 2 && styles.segmentLast,
                        active && styles.segmentActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.capacityRow}>
                <View>
                  <Text style={styles.capacityValue}>
                    {goingCount}{event.capacity ? ` / ${event.capacity}` : ""}
                  </Text>
                  <Text style={styles.capacityLabel}>CONFIRMED</Text>
                </View>
                <Text style={styles.maybeText}>{maybeCount} MAYBE</Text>
              </View>
              {event.capacity ? (
                <View style={styles.capacityTrack}>
                  <View style={[styles.capacityFill, { width: `${capacityProgress * 100}%` }]} />
                </View>
              ) : null}
              <View style={styles.attendanceFooter}>
                <View style={styles.avatarStack}>
                  {attendees.map((attendee, index) =>
                    attendee.avatar_url ? (
                      <Image
                        key={attendee.id}
                        source={{ uri: attendee.avatar_url }}
                        style={[styles.stackAvatar, index > 0 && styles.stackAvatarOverlap]}
                      />
                    ) : (
                      <View
                        key={attendee.id}
                        style={[
                          styles.stackAvatar,
                          styles.avatarFallback,
                          index > 0 && styles.stackAvatarOverlap,
                        ]}
                      >
                        <Text style={styles.stackInitials}>{initials(displayName(attendee))}</Text>
                      </View>
                    ),
                  )}
                </View>
                <Text style={styles.spotsText}>
                  {event.capacity
                    ? `${Math.max(0, event.capacity - goingCount)} spots left`
                    : "Open capacity"}
                </Text>
              </View>
            </View>

            <View style={styles.meetingCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="location" size={15} color={colors.textMuted} />
                  <Text style={styles.sectionTitle}>MEETING POINT</Text>
                </View>
                {canChat ? (
                  <Pressable onPress={routeOnNoxaMap}>
                    <Text style={styles.sectionAction}>ROUTE</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.meetingName}>{event.location_name}</Text>
              <Text style={styles.meetingTime}>Meet by {formatEventTime(event.starts_at)}</Text>
              {event.latitude !== null && event.longitude !== null ? (
                <Pressable
                  accessibilityLabel="Open route on NOXA map"
                  onPress={routeOnNoxaMap}
                  style={({ pressed }) => [styles.mapPreview, pressed && styles.pressed]}
                >
                  <MapboxEventPreviewCompat
                    coordinate={{
                      latitude: event.latitude,
                      longitude: event.longitude,
                    }}
                  />
                  <View style={styles.mapShade} />
                  <View style={styles.mapRouteBadge}>
                    <Ionicons name="navigate" size={14} color={colors.text} />
                    <Text style={styles.mapRouteText}>OPEN NOXA ROUTE</Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  onPress={routeOnNoxaMap}
                  style={({ pressed }) => [styles.mapEmpty, pressed && styles.pressed]}
                >
                  <Ionicons name="map-outline" size={21} color={colors.textSubtle} />
                  <Text style={styles.mapEmptyText}>Open event on NOXA Map</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.gallerySection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>GALLERY · {galleryCount} PHOTOS</Text>
                <Pressable
                  onPress={() => router.push({ pathname: "/event-gallery", params: { id: event.id } })}
                >
                  <Text style={styles.sectionAction}>SEE ALL</Text>
                </Pressable>
              </View>
              {gallery.length ? (
                <View style={styles.galleryPreview}>
                  {gallery.map((item, index) => (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push({ pathname: "/event-gallery", params: { id: event.id } })}
                      style={({ pressed }) => [
                        styles.galleryTile,
                        index === 0 && styles.galleryTileLead,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Image source={{ uri: item.signedUrl }} style={styles.galleryImage} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Pressable
                  onPress={() => router.push({ pathname: "/event-gallery", params: { id: event.id } })}
                  style={({ pressed }) => [styles.galleryEmpty, pressed && styles.pressed]}
                >
                  <Ionicons name="images-outline" size={25} color={colors.primaryHover} />
                  <View style={styles.galleryEmptyCopy}>
                    <Text style={styles.galleryEmptyTitle}>START THE EVENT GALLERY</Text>
                    <Text style={styles.galleryEmptyText}>
                      {canChat ? "Add the first participant photo." : "RSVP to contribute photos."}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
                </Pressable>
              )}
            </View>

            {event.description ? (
              <View style={styles.aboutSection}>
                <Text style={styles.sectionTitle}>ABOUT</Text>
                <Text style={styles.aboutText}>{event.description}</Text>
              </View>
            ) : null}

            {eventCrew ? (
              <Pressable
                onPress={() => router.push({ pathname: "/crew/[id]", params: { id: eventCrew.id } })}
                style={({ pressed }) => [styles.crewCard, pressed && styles.pressed]}
              >
                {eventCrew.cover_image_url || eventCrew.logo_url ? (
                  <Image
                    source={{ uri: eventCrew.cover_image_url ?? eventCrew.logo_url ?? "" }}
                    style={styles.crewImage}
                  />
                ) : (
                  <View style={[styles.crewImage, styles.crewPlaceholder]}>
                    <Ionicons name="people" size={26} color={colors.primaryHover} />
                  </View>
                )}
                <View style={styles.crewCopy}>
                  <Text style={styles.miniLabel}>CREW</Text>
                  <Text style={styles.crewName}>{eventCrew.name}</Text>
                  <Text style={styles.crewMeta}>{eventCrew.city ?? "NOXA crew event"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>
            ) : null}

            {lifecycle === "completed" ? (
              <View style={styles.completedCard}>
                <View style={styles.completedIcon}>
                  <Ionicons name="checkmark" size={22} color={colors.success} />
                </View>
                <Text style={styles.completedTitle}>EVENT COMPLETED</Text>
                <Text style={styles.completedText}>
                  View the real attendance, gallery highlights, vehicles, and duration.
                </Text>
                <NoxaButton
                  title="VIEW EVENT SUMMARY"
                  onPress={() => router.push({ pathname: "/event-summary", params: { id: event.id } })}
                />
              </View>
            ) : null}

            {isHost ? (
              <View style={styles.hostControls}>
                <Text style={styles.sectionTitle}>ORGANIZER CONTROLS</Text>
                <NoxaButton
                  title="EDIT EVENT"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/event-editor", params: { id: event.id } })}
                />
                <NoxaButton
                  title="DELETE EVENT"
                  variant="danger"
                  loading={deleting}
                  onPress={confirmDelete}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => setError(null)}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {event && !loading && !notFound ? (
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityLabel="Open event chat"
            accessibilityRole="button"
            onPress={openChat}
            style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
          >
            <Ionicons
              name="chatbubble-outline"
              size={17}
              color={canChat ? colors.text : colors.textMuted}
            />
            <Text style={[styles.chatText, !canChat && styles.chatTextMuted]}>CHAT</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={(isHost || lifecycle === "cancelled" || busy) && lifecycle !== "completed"}
            onPress={bottomAction}
            style={({ pressed }) => [
              styles.primaryFooterButton,
              (isHost || myResponse === "going" || lifecycle === "cancelled") && styles.footerButtonSecondary,
              lifecycle === "completed" && styles.primaryFooterButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.footerButtonText}>{bottomLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: { flexDirection: "row", gap: spacing.xs },
  headerAction: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.17)",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  content: { paddingBottom: 126, gap: spacing.md },
  hero: { height: 255, overflow: "hidden", backgroundColor: colors.surface },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSoft },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.46)" },
  heroCopy: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md, gap: spacing.xs },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 29,
    fontWeight: "900",
    lineHeight: 31,
    textTransform: "uppercase",
  },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  heroMeta: { flex: 1, color: "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: "700" },
  categoryBadge: { paddingVertical: 4, paddingHorizontal: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.primary },
  categoryText: { color: colors.text, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  lifecycleBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  lifecycleBadgeComplete: { borderColor: "rgba(48,209,88,0.3)", backgroundColor: colors.successMuted },
  lifecycleBadgeSoon: { borderColor: "rgba(255,159,10,0.3)", backgroundColor: colors.warningMuted },
  lifecycleBadgeNeutral: { borderColor: colors.borderStrong, backgroundColor: "rgba(24,24,29,0.78)" },
  lifecycleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryHover },
  lifecycleDotComplete: { backgroundColor: colors.success },
  lifecycleDotSoon: { backgroundColor: colors.warning },
  lifecycleDotNeutral: { backgroundColor: colors.textMuted },
  lifecycleText: { color: colors.primaryHover, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  lifecycleTextComplete: { color: colors.success },
  lifecycleTextSoon: { color: colors.warning },
  lifecycleTextNeutral: { color: colors.textMuted },
  organizerCard: {
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  organizerAvatar: { width: 44, height: 44, borderRadius: radius.md },
  avatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft },
  organizerInitials: { color: colors.text, fontSize: 11, fontWeight: "900" },
  organizerCopy: { flex: 1 },
  miniLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  organizerName: { marginTop: 2, color: colors.text, fontSize: 14, fontWeight: "900" },
  organizerMeta: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  viewChip: { paddingVertical: 6, paddingHorizontal: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceSoft },
  viewChipText: { color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  rsvpCard: {
    marginHorizontal: spacing.md,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segmented: { flexDirection: "row" },
  segment: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
    borderRightWidth: 1,
    borderRightColor: colors.background,
  },
  segmentFirst: { borderTopLeftRadius: radius.md, borderBottomLeftRadius: radius.md },
  segmentLast: { borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md, borderRightWidth: 0 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  segmentTextActive: { color: colors.text, fontWeight: "900" },
  capacityRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  capacityValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  capacityLabel: { marginTop: 1, color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  maybeText: { color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  capacityTrack: { height: 5, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  capacityFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.primary },
  attendanceFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatarStack: { minHeight: 28, flexDirection: "row", alignItems: "center" },
  stackAvatar: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.surface },
  stackAvatarOverlap: { marginLeft: -7 },
  stackInitials: { color: colors.text, fontSize: 7, fontWeight: "900" },
  spotsText: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  meetingCard: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  sectionTitle: { color: colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  sectionAction: { color: colors.primaryHover, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  meetingName: { marginTop: spacing.sm, color: colors.text, fontSize: 14, fontWeight: "900" },
  meetingTime: { marginTop: 3, color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  mapPreview: { height: 96, overflow: "hidden", marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSoft },
  mapShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.18)" },
  mapRouteBadge: {
    position: "absolute",
    right: spacing.xs,
    bottom: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingVertical: 6,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.76)",
  },
  mapRouteText: { color: colors.text, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  mapEmpty: { height: 82, alignItems: "center", justifyContent: "center", gap: spacing.xxs, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSoft },
  mapEmptyText: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  gallerySection: { marginHorizontal: spacing.md, gap: spacing.sm },
  galleryPreview: { height: 92, flexDirection: "row", gap: spacing.xs },
  galleryTile: { flex: 1, overflow: "hidden", borderRadius: radius.md, backgroundColor: colors.surfaceSoft },
  galleryTileLead: { flex: 2 },
  galleryImage: { width: "100%", height: "100%" },
  galleryEmpty: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  galleryEmptyCopy: { flex: 1 },
  galleryEmptyTitle: { color: colors.text, fontSize: 11, fontWeight: "900" },
  galleryEmptyText: { marginTop: 3, color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  aboutSection: { marginHorizontal: spacing.md, gap: spacing.xs },
  aboutText: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  crewCard: {
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  crewImage: { width: 46, height: 46, borderRadius: radius.md },
  crewPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSoft },
  crewCopy: { flex: 1 },
  crewName: { marginTop: 2, color: colors.text, fontSize: 13, fontWeight: "900" },
  crewMeta: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  completedCard: {
    marginHorizontal: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "rgba(48,209,88,0.25)",
    backgroundColor: colors.successMuted,
  },
  completedIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: "rgba(48,209,88,0.12)" },
  completedTitle: { color: colors.success, fontSize: 13, fontWeight: "900", letterSpacing: 0.7 },
  completedText: { marginBottom: spacing.xs, color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  hostControls: {
    marginHorizontal: spacing.md,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  errorCard: {
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: { flex: 1, color: colors.primaryHover, fontSize: 11, fontWeight: "700" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.glass,
  },
  chatButton: {
    minWidth: 96,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  chatText: { color: colors.text, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  chatTextMuted: { color: colors.textMuted },
  primaryFooterButton: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    ...shadows.redGlow,
  },
  footerButtonSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, shadowOpacity: 0 },
  footerButtonText: { color: colors.text, fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  fullState: { minHeight: 520, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  stateTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.title, fontWeight: "900" },
  stateText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.86, transform: [{ translateY: 1 }, { scale: 0.985 }] },
  disabled: { opacity: 0.45 },
});
