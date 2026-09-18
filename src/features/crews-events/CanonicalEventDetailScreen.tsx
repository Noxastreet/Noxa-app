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

import {
  NoxaButton,
  NoxaIconButton,
  NoxaScreen,
  NoxaTopBar,
} from "@/src/components/ui";
import {
  EntityActionSheet,
  type EntityAction,
} from "@/src/features/crews-events/EntityActionSheet";
import {
  CanonicalArtwork,
  CanonicalAvatar,
  CanonicalAvatarStack,
  CanonicalPill,
  CanonicalSectionHeader,
  profileName,
  type CanonicalProfile,
} from "@/src/features/crews-events/CanonicalPrimitives";
import { MapboxEventPreviewCompat } from "@/src/features/mapbox/MapboxEventPreviewCompat";
import { useResponsive } from "@/src/hooks/useResponsive";
import {
  chooseCoverAsset,
  removeEntityCoverObject,
  removeUploadedEntityCover,
  setEntityCover,
  uploadEntityCover,
} from "@/src/lib/entityCover";
import {
  eventLifecycle,
  formatEventDate,
  formatEventTime,
  type EventExperienceRow,
  type EventResponse,
  uuidPattern,
} from "@/src/lib/eventExperience";
import { getCurrentSessionUser, supabase } from "@/src/lib/supabase";
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
  if (event.category === "meet") return "Car meet";
  if (event.category === "drive") return "Drive";
  if (event.category === "track") return "Track";
  return "Event";
}

function lifecycleUrgency(event: EventExperienceRow) {
  const lifecycle = eventLifecycle(event);
  if (lifecycle === "live") return "Live";
  if (lifecycle === "soon") return "Tonight";
  if (lifecycle === "completed") return "Completed";
  if (lifecycle === "cancelled") return "Cancelled";
  const date = new Date(event.starts_at);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? "Today" : "Upcoming";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
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

function EventHeader({ onMore }: { onMore?: () => void }) {
  return (
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
        right={
          onMore ? (
            <NoxaIconButton
              accessibilityLabel="More event actions"
              icon="ellipsis-horizontal"
              onPress={onMore}
              variant="ghost"
            />
          ) : undefined
        }
      />
    </View>
  );
}

function Hero({
  event,
  compact,
}: {
  event: EventExperienceRow;
  attendees: CanonicalProfile[];
  goingCount: number;
  compact: boolean;
}) {
  return (
    <View>
      {event.cover_image_url ? (
        <CanonicalArtwork
          uri={event.cover_image_url}
          style={[styles.hero, compact && styles.heroCompact]}
          imageStyle={styles.heroImage}
          icon="flag-outline"
        />
      ) : null}
      <View style={styles.heroCopy}>
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroCategory}>{categoryLabel(event)}</Text>
          <Text accessible={false} style={styles.heroMetaDot}>·</Text>
          <Text
            style={[
              styles.heroLifecycle,
              eventLifecycle(event) === "live" && styles.heroLifecycleLive,
            ]}
          >
            {lifecycleUrgency(event)}
          </Text>
        </View>
        <Text
          numberOfLines={3}
          style={[styles.heroTitle, compact && styles.heroTitleCompact]}
        >
          {event.title}
        </Text>
      </View>
    </View>
  );
}

function formatEventTimeLine(event: EventExperienceRow) {
  const start = formatEventTime(event.starts_at);
  if (!event.ends_at) return start;
  return `${start}–${formatEventTime(event.ends_at)}`;
}

function EssentialInfo({ event }: { event: EventExperienceRow }) {
  return (
    <View style={styles.infoList}>
      <View style={styles.infoRow}>
        <View style={styles.infoIcon}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoLabel}>Time</Text>
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
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>{event.location_name}</Text>
        </View>
      </View>
      {event.capacity ? (
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Capacity</Text>
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
  const { isCompactHeight, isSmallPhone } = useResponsive();
  const compactLayout = isCompactHeight || isSmallPhone;

  const [event, setEvent] = useState<EventExperienceRow | null>(null);
  const [creator, setCreator] = useState<CanonicalProfile | null>(null);
  const [crew, setCrew] = useState<EventCrew | null>(null);
  const [attendees, setAttendees] = useState<CanonicalProfile[]>([]);
  const [goingCount, setGoingCount] = useState(0);
  const [myResponse, setMyResponse] = useState<EventResponse | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [canManageCover, setCanManageCover] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [organizerEventCount, setOrganizerEventCount] = useState(0);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCanManageCover(false);

    if (!uuidPattern.test(eventId)) {
      setError("This event link is invalid.");
      setLoading(false);
      return;
    }

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
    // The event row is the critical render path. Optional organizer, RSVP,
    // history and gallery data must never keep the whole screen behind
    // “Opening event...” on a slow mobile connection.
    setLoading(false);

    const userId = (await getCurrentSessionUser())?.id ?? null;
    setCurrentUserId(userId);

    const [
      creatorResult,
      crewResult,
      managerResult,
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
      userId && nextEvent.crew_id
        ? supabase
            .from("crew_members")
            .select("role")
            .eq("crew_id", nextEvent.crew_id)
            .eq("user_id", userId)
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

    const managerRole = managerResult.data?.role;
    setCanManageCover(
      Boolean(
        userId &&
          (nextEvent.creator_id === userId ||
            managerRole === "owner" ||
            managerRole === "admin"),
      ),
    );
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
    router.push({ pathname: "/event-editor", params: { id: event.id } });
  }, [event]);

  const deleteEvent = useCallback(async () => {
    if (!event || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    const currentUser = await getCurrentSessionUser();

    if (!currentUser) {
      setIsDeleting(false);
      Alert.alert("Unable to delete event", "You must be signed in to delete this event.");
      return;
    }

    if (currentUser.id !== event.creator_id) {
      setIsDeleting(false);
      Alert.alert("Unable to delete event", "Only the event creator can delete this event.");
      return;
    }

    const { data, error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", event.id)
      .eq("creator_id", currentUser.id)
      .select("id");

    if (deleteError) {
      setIsDeleting(false);
      Alert.alert("Unable to delete event", deleteError.message);
      return;
    }

    if (!data?.length) {
      setIsDeleting(false);
      Alert.alert("Unable to delete event", "No event was deleted. Please try again.");
      return;
    }

    setIsDeleting(false);
    router.replace("/(tabs)/events");
  }, [event, isDeleting]);

  const confirmDeleteEvent = useCallback(() => {
    if (!event || isDeleting) return;

    Alert.alert(
      "Delete event?",
      `“${event.title}” and its attendance, saved, chat, and gallery records will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void deleteEvent() },
      ],
    );
  }, [deleteEvent, event, isDeleting]);

  const changeCover = useCallback(async () => {
    if (!event || !canManageCover || saving) return;
    setSaving(true);
    try {
      const asset = await chooseCoverAsset();
      if (!asset) return;

      const uploaded = await uploadEntityCover(asset, "event", event.id);
      try {
        await setEntityCover("event", event.id, uploaded.publicUrl);
      } catch (coverError) {
        await removeUploadedEntityCover(uploaded.path);
        throw coverError;
      }

      await removeEntityCoverObject(event.cover_image_url, "event", event.id);
      await load();
    } catch (coverError) {
      Alert.alert(
        "Cover not changed",
        coverError instanceof Error
          ? coverError.message
          : "Unable to change this cover.",
      );
    } finally {
      setSaving(false);
    }
  }, [canManageCover, event, load, saving]);

  const removeCover = useCallback(async () => {
    if (!event || !canManageCover || !event.cover_image_url || saving) return;
    setSaving(true);
    try {
      const previous = event.cover_image_url;
      await setEntityCover("event", event.id, null);
      await removeEntityCoverObject(previous, "event", event.id);
      await load();
    } catch (coverError) {
      Alert.alert(
        "Cover not removed",
        coverError instanceof Error
          ? coverError.message
          : "Unable to remove this cover.",
      );
    } finally {
      setSaving(false);
    }
  }, [canManageCover, event, load, saving]);

  const menuActions = useMemo<EntityAction[]>(() => {
    if (!event) return [];

    const actions: EntityAction[] = [];
    if (currentUserId) {
      actions.push({
        key: "save",
        label: isSaved ? "Remove from saved" : "Save event",
        icon: isSaved ? "bookmark" : "bookmark-outline",
        disabled: saving,
        onPress: () => void toggleSaved(),
      });
    }

    actions.push({
      key: "share",
      label: "Share event",
      icon: "share-outline",
      onPress: () => void share(),
    });

    if (isHost) {
      actions.push({
        key: "edit",
        label: "Edit event",
        icon: "create-outline",
        onPress: edit,
      });
    }

    if (canManageCover) {
      actions.push({
        key: "cover",
        label: event.cover_image_url ? "Change cover" : "Choose cover",
        icon: "image-outline",
        disabled: saving,
        onPress: () => void changeCover(),
      });
      if (event.cover_image_url) {
        actions.push({
          key: "remove-cover",
          label: "Remove cover",
          icon: "trash-outline",
          destructive: true,
          disabled: saving,
          onPress: () => void removeCover(),
        });
      }
    }

    if (isHost) {
      actions.push({
        key: "delete",
        label: isDeleting ? "Deleting…" : "Delete event",
        icon: "trash-outline",
        destructive: true,
        disabled: isDeleting,
        onPress: confirmDeleteEvent,
      });
    }

    return actions;
  }, [
    canManageCover,
    changeCover,
    confirmDeleteEvent,
    currentUserId,
    edit,
    event,
    isDeleting,
    isHost,
    isSaved,
    removeCover,
    saving,
    share,
    toggleSaved,
  ]);

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
        <EventHeader />
        <View style={styles.state}>
          <Ionicons name="calendar-outline" size={38} color={colors.primary} />
          <Text style={styles.stateTitle}>Event unavailable</Text>
          <Text style={styles.stateText}>{error || "This event no longer exists."}</Text>
          <NoxaButton
            title="Go back"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </NoxaScreen>
    );
  }

  const goingLabel =
    myResponse === "going"
      ? "YOU'RE GOING"
      : rsvpClosed
        ? "RSVP CLOSED"
        : "I'M GOING";

  return (
    <NoxaScreen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, isHost && styles.contentHost]}
      >
        <EventHeader onMore={() => setActionsOpen(true)} />

        <Hero
          attendees={attendees}
          compact={compactLayout}
          event={event}
          goingCount={goingCount}
        />

        {error ? (
          <Pressable onPress={() => setError(null)} style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primaryHover} />
            <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
          </Pressable>
        ) : null}

        <View style={styles.sectionFirst}>
          <EssentialInfo event={event} />
        </View>

        <View style={styles.detailsSection}>
          <Text style={styles.detailsEyebrow}>About</Text>
          <Text style={styles.detailsText}>
            {event.description ||
              "The organizer has not added a full description yet. Check the location and time before driving."}
          </Text>
          <View style={styles.detailsDivider} />
          <Text style={styles.rulesText}>
            Respect the location, local traffic rules and other drivers.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionHeading}>Location</Text>
            <NoxaButton
              disabled={!validCoordinates(event)}
              leadingIcon={<Ionicons name="navigate-outline" size={16} color={colors.text} />}
              size="sm"
              title="Navigate"
              variant="secondary"
              onPress={navigate}
            />
          </View>
          {validCoordinates(event) ? (
            <View style={styles.mapCard}>
              <MapboxEventPreviewCompat
                coordinate={{ latitude: event.latitude, longitude: event.longitude }}
              />
            </View>
          ) : (
            <Text style={styles.locationUnavailable}>
              Exact map location is not available for this event.
            </Text>
          )}
        </View>

        <View style={styles.sectionDivided}>
          <CanonicalSectionHeader title="Going" action={`${goingCount}`} />
          <View style={styles.goingCard}>
            <CanonicalAvatarStack profiles={attendees} total={goingCount} max={4} size={38} />
            <View style={styles.goingCopy}>
              <Text style={styles.goingTitle}>
                {goingCount
                  ? `${Math.min(goingCount, 3)} familiar ${pluralize(Math.min(goingCount, 3), "driver")} · ${goingCount} total`
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

        <View style={styles.sectionDivided}>
          <CanonicalSectionHeader title="Organizer" />
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
                ORGANIZED BY {crew ? "· CREW" : ""}
              </Text>
              <Text numberOfLines={1} style={styles.organizerTitle}>
                {organizerName}
              </Text>
            </View>
            <Text style={styles.organizerHistory}>
              {organizerEventCount
                ? `${organizerEventCount} past ${pluralize(organizerEventCount, "event")}`
                : "First event"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        </View>

        {galleryPreview.length ? (
          <View style={styles.sectionDivided}>
            <CanonicalSectionHeader title="Photos" action={`${gallery.length}`} />
            <View style={styles.galleryRow}>
              {galleryPreview.map((item) => (
                <Image key={item.id} source={{ uri: item.signedUrl }} style={styles.galleryImage} />
              ))}
            </View>
          </View>
        ) : null}

        {canChat ? (
          <View style={styles.chatButtonWrap}>
            <NoxaButton
              leadingIcon={<Ionicons name="chatbubble-outline" size={17} color={colors.text} />}
              title="Event chat"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: "/event-chat", params: { id: event.id } })
              }
            />
          </View>
        ) : null}
      </ScrollView>

      <EntityActionSheet
        actions={menuActions}
        onClose={() => setActionsOpen(false)}
        title={event.title}
        visible={actionsOpen}
      />

      {!isHost ? (
        <View style={styles.stickyFooter}>
          <NoxaButton
            disabled={rsvpClosed}
            fullWidth
            leadingIcon={myResponse === "going" ? <Ionicons name="checkmark" size={18} color={colors.text} /> : undefined}
            loading={rsvpBusy}
            title={goingLabel}
            variant={myResponse === "going" ? "secondary" : "primary"}
            onPress={toggleGoing}
          />
          {myResponse === "going" ? (
            <Text style={styles.manageHint}>Tap again to cancel attendance</Text>
          ) : null}
        </View>
      ) : null}
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 150 },
  contentHost: { paddingBottom: 80 },
  pressed: { opacity: 0.72 },
  header: { paddingHorizontal: spacing.md },
  hero: {
    height: 120,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  heroCompact: { height: 104 },
  heroImage: { borderRadius: radius.lg },
  heroCopy: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroCategory: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  heroMetaDot: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
  },
  heroLifecycle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  heroLifecycleLive: { color: colors.primaryHover },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: "700",
  },
  heroTitleCompact: { fontSize: 23, lineHeight: 28 },
  errorBanner: {
    minHeight: 48,
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderAccent,
  },
  errorText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 16 },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  sectionFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  sectionDivided: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  sectionHeadingRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sectionHeading: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: "700",
  },
  infoList: { overflow: "hidden" },
  infoRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  infoIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: { flex: 1 },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  infoValue: {
    marginTop: 2,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  mapCard: {
    height: 156,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceBase,
  },
  locationUnavailable: {
    color: colors.textMuted,
    ...typography.v2.body,
  },
  goingCard: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  goingCopy: { flex: 1 },
  goingTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
  goingMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  organizerCard: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  organizerLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
  },
  organizerCopy: { flex: 1 },
  organizerEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  organizerTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  organizerHistory: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  galleryRow: { height: 104, flexDirection: "row", gap: spacing.sm },
  galleryImage: {
    flex: 1,
    height: "100%",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  detailsSection: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  detailsEyebrow: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: "700",
  },
  detailsText: { color: colors.text, ...typography.v2.body },
  detailsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  rulesText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  chatButtonWrap: { marginHorizontal: spacing.md, marginTop: spacing.sm },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  manageHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: "900",
    textAlign: "center",
  },
  stateText: {
    color: colors.textMuted,
    ...typography.v2.body,
    textAlign: "center",
  },
});
