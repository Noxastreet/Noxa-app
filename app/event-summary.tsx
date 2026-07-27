import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NoxaButton, NoxaScreen } from "@/src/components/ui";
import {
  eventLifecycle,
  formatDuration,
  formatEventDate,
  formatEventTime,
  initials,
  uuidPattern,
  type EventExperienceRow,
} from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

const eventGalleryBucket = "event-gallery";

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
};
type VehicleRow = {
  id: string;
  owner_id: string;
  brand: string;
  model: string | null;
  cover_image_url: string | null;
};
type GalleryRow = {
  id: string;
  object_path: string;
  caption: string | null;
};
type GalleryItem = GalleryRow & { signedUrl: string };

function profileName(profile: ProfileRow) {
  return profile.display_name || profile.username || "NOXA driver";
}

export default function EventSummaryScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === "string" ? params.id : "";
  const [event, setEvent] = useState<EventExperienceRow | null>(null);
  const [organizer, setOrganizer] = useState<ProfileRow | null>(null);
  const [attendees, setAttendees] = useState<ProfileRow[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryCount, setGalleryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = useMemo(
    () => Boolean(event && eventLifecycle(event) === "completed"),
    [event],
  );

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!uuidPattern.test(eventId)) {
      setError("Invalid event link.");
      setLoading(false);
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError("Sign in to view this event summary.");
      setLoading(false);
      return;
    }

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError || !eventData) {
      setError(eventError?.message ?? "Event not found.");
      setLoading(false);
      return;
    }
    const nextEvent = eventData as EventExperienceRow;
    setEvent(nextEvent);

    const [organizerResult, attendeeResult, attendeeCountResult, galleryResult, galleryCountResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url,city")
          .eq("id", nextEvent.creator_id)
          .maybeSingle(),
        supabase
          .from("event_attendees")
          .select("user_id")
          .eq("event_id", eventId)
          .eq("response", "going")
          .order("joined_at", { ascending: true })
          .limit(100),
        supabase
          .from("event_attendees")
          .select("event_id", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("response", "going"),
        supabase
          .from("event_gallery_items")
          .select("id,object_path,caption")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("event_gallery_items")
          .select("event_id", { count: "exact", head: true })
          .eq("event_id", eventId),
      ]);

    if (organizerResult.error) setError(organizerResult.error.message);
    else setOrganizer((organizerResult.data as ProfileRow | null) ?? null);
    setAttendeeCount(attendeeCountResult.error ? 0 : (attendeeCountResult.count ?? 0));
    setGalleryCount(galleryCountResult.error ? 0 : (galleryCountResult.count ?? 0));

    const attendeeIds = (attendeeResult.data ?? []).map((row) => row.user_id);
    if (!attendeeResult.error && attendeeIds.length) {
      const [profilesResult, vehiclesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url,city")
          .in("id", attendeeIds),
        supabase
          .from("vehicles")
          .select("id,owner_id,brand,model,cover_image_url")
          .in("owner_id", attendeeIds)
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (profilesResult.error) setError(profilesResult.error.message);
      else {
        const byId = new Map(
          ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
        );
        setAttendees(
          attendeeIds
            .map((id) => byId.get(id))
            .filter((profile): profile is ProfileRow => Boolean(profile)),
        );
      }
      if (vehiclesResult.error) setError(vehiclesResult.error.message);
      else setVehicles((vehiclesResult.data ?? []) as VehicleRow[]);
    } else {
      setAttendees([]);
      setVehicles([]);
    }

    if (galleryResult.error) setError(galleryResult.error.message);
    else {
      const signedItems = await Promise.all(
        ((galleryResult.data ?? []) as GalleryRow[]).map(async (item) => {
          const { data, error: signedError } = await supabase.storage
            .from(eventGalleryBucket)
            .createSignedUrl(item.object_path, 60 * 60);
          if (signedError || !data?.signedUrl) return null;
          return { ...item, signedUrl: data.signedUrl } satisfies GalleryItem;
        }),
      );
      setGallery(signedItems.filter((item): item is GalleryItem => Boolean(item)));
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const shareRecap = useCallback(async () => {
    if (!event || sharing) return;
    setSharing(true);
    try {
      const url = Linking.createURL("/event-summary", { queryParams: { id: event.id } });
      await Share.share({
        title: event.title,
        message: `${event.title} · Event recap\n${formatEventDate(event.starts_at)} · ${event.location_name}\n${url}`,
      });
    } catch {
      setError("The event recap could not be shared.");
    } finally {
      setSharing(false);
    }
  }, [event, sharing]);

  const heroImage = event?.cover_image_url || gallery[0]?.signedUrl || null;
  const stats = event
    ? [
        {
          label: "ATTENDED",
          value: attendeeCount.toString(),
          sub: event.capacity ? `of ${event.capacity}` : "confirmed",
        },
        { label: "VEHICLES", value: vehicles.length.toString(), sub: "public cars" },
        { label: "PHOTOS", value: galleryCount.toString(), sub: "uploaded" },
        { label: "DURATION", value: formatDuration(event.starts_at, event.ends_at), sub: "event time" },
      ]
    : [];

  return (
    <NoxaScreen padded={false}>
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Building the event recap…</Text>
        </View>
      ) : !event ? (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>SUMMARY UNAVAILABLE</Text>
          <Text style={styles.stateText}>{error ?? "Event not found."}</Text>
          <NoxaButton title="GO BACK" onPress={() => router.back()} />
        </View>
      ) : !completed ? (
        <View style={styles.state}>
          <View style={styles.stateIcon}>
            <Ionicons name="time-outline" size={32} color={colors.primaryHover} />
          </View>
          <Text style={styles.stateTitle}>RECAP UNLOCKS AFTER THE EVENT</Text>
          <Text style={styles.stateText}>
            The real attendance, gallery, vehicles, and duration will appear when the event is complete.
          </Text>
          <NoxaButton
            title="BACK TO EVENT"
            onPress={() => router.replace({ pathname: "/event-details", params: { id: event.id } })}
          />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              {heroImage ? (
                <Image source={{ uri: heroImage }} style={styles.heroImage} />
              ) : (
                <View style={[styles.heroImage, styles.heroPlaceholder]}>
                  <Ionicons name="flag" size={62} color={colors.primaryMuted} />
                </View>
              )}
              <View style={styles.heroShade} />
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={21} color={colors.text} />
              </Pressable>
              <View style={styles.heroCopy}>
                <View style={styles.completeBadge}>
                  <View style={styles.completeDot} />
                  <Text style={styles.completeText}>COMPLETED</Text>
                </View>
                <Text numberOfLines={2} style={styles.heroTitle}>{event.title}</Text>
                <Text style={styles.heroMeta}>
                  {formatEventDate(event.starts_at)} · {event.location_name}
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.statCard}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={styles.statSub}>{stat.sub}</Text>
                </View>
              ))}
            </View>

            {event.description && organizer ? (
              <View style={styles.organizerCard}>
                {organizer.avatar_url ? (
                  <Image source={{ uri: organizer.avatar_url }} style={styles.organizerAvatar} />
                ) : (
                  <View style={[styles.organizerAvatar, styles.avatarFallback]}>
                    <Text style={styles.organizerInitials}>{initials(profileName(organizer))}</Text>
                  </View>
                )}
                <View style={styles.organizerCopy}>
                  <Text style={styles.sectionMeta}>ORGANIZER NOTE</Text>
                  <Text style={styles.organizerMessage}>{event.description}</Text>
                </View>
              </View>
            ) : null}

            {gallery.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>HIGHLIGHTS</Text>
                  <Text style={styles.sectionCount}>{galleryCount} PHOTOS</Text>
                </View>
                <ScrollView
                  horizontal
                  contentContainerStyle={styles.horizontalShelf}
                  showsHorizontalScrollIndicator={false}
                >
                  {gallery.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push({ pathname: "/event-gallery", params: { id: event.id } })}
                      style={({ pressed }) => [styles.highlightCard, pressed && styles.pressed]}
                    >
                      <Image source={{ uri: item.signedUrl }} style={styles.highlightImage} />
                      <Text numberOfLines={2} style={styles.highlightCaption}>
                        {item.caption || "NOXA event moment"}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>ATTENDEES</Text>
                <Text style={styles.sectionCount}>{attendeeCount} CONFIRMED</Text>
              </View>
              <View style={styles.listCard}>
                {attendees.slice(0, 8).map((attendee, index) => (
                  <Pressable
                    key={attendee.id}
                    onPress={() => router.push({ pathname: "/driver-profile/[id]", params: { id: attendee.id } })}
                    style={({ pressed }) => [
                      styles.attendeeRow,
                      index < Math.min(attendees.length, 8) - 1 && styles.rowBorder,
                      pressed && styles.pressed,
                    ]}
                  >
                    {attendee.avatar_url ? (
                      <Image source={{ uri: attendee.avatar_url }} style={styles.attendeeAvatar} />
                    ) : (
                      <View style={[styles.attendeeAvatar, styles.avatarFallback]}>
                        <Text style={styles.attendeeInitials}>{initials(profileName(attendee))}</Text>
                      </View>
                    )}
                    <View style={styles.attendeeCopy}>
                      <Text style={styles.attendeeName}>{profileName(attendee)}</Text>
                      <Text style={styles.attendeeCity}>{attendee.city || "NOXA community"}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
                  </Pressable>
                ))}
                {!attendees.length ? (
                  <Text style={styles.listEmpty}>No confirmed attendees were recorded.</Text>
                ) : null}
              </View>
            </View>

            {vehicles.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>VEHICLES SPOTTED</Text>
                  <Text style={styles.sectionCount}>{vehicles.length} PUBLIC</Text>
                </View>
                <ScrollView
                  horizontal
                  contentContainerStyle={styles.horizontalShelf}
                  showsHorizontalScrollIndicator={false}
                >
                  {vehicles.map((vehicle) => (
                    <Pressable
                      key={vehicle.id}
                      onPress={() => router.push({ pathname: "/vehicle-details", params: { id: vehicle.id } })}
                      style={({ pressed }) => [styles.vehicleCard, pressed && styles.pressed]}
                    >
                      {vehicle.cover_image_url ? (
                        <Image source={{ uri: vehicle.cover_image_url }} style={styles.vehicleImage} />
                      ) : (
                        <View style={[styles.vehicleImage, styles.vehiclePlaceholder]}>
                          <Ionicons name="car-sport-outline" size={25} color={colors.primaryHover} />
                        </View>
                      )}
                      <View style={styles.vehicleCopy}>
                        <Text numberOfLines={1} style={styles.vehicleBrand}>{vehicle.brand}</Text>
                        <Text numberOfLines={1} style={styles.vehicleModel}>{vehicle.model || "NOXA build"}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MEETING POINT</Text>
              <View style={styles.routeCard}>
                <View style={styles.routeDot} />
                <View style={styles.routeLine} />
                <View style={styles.routeCopy}>
                  <Text style={styles.routeName}>{event.location_name}</Text>
                  <Text style={styles.routeTime}>
                    {formatEventDate(event.starts_at)} · {formatEventTime(event.starts_at)}
                  </Text>
                  {event.ends_at ? (
                    <Text style={styles.routeEnd}>Ended {formatEventTime(event.ends_at)}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <NoxaButton
              title={sharing ? "SHARING…" : "SHARE RECAP"}
              fullWidth
              disabled={sharing}
              onPress={() => void shareRecap()}
            />
          </View>
        </>
      )}
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 112 },
  hero: { height: 220, overflow: "hidden", backgroundColor: colors.surface },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSoft },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.52)" },
  backButton: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.56)",
  },
  heroCopy: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md, gap: spacing.xs },
  completeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(48,209,88,0.3)",
    backgroundColor: colors.successMuted,
  },
  completeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
  completeText: { color: colors.success, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 30,
    textTransform: "uppercase",
  },
  heroMeta: { color: "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: "700" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.xs,
    padding: spacing.md,
  },
  statCard: {
    width: "48.7%",
    minHeight: 100,
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statValue: { color: colors.text, fontSize: 25, fontWeight: "900", lineHeight: 29 },
  statLabel: { marginTop: 3, color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  statSub: { marginTop: 2, color: colors.textSubtle, fontSize: 10, fontWeight: "700" },
  organizerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  organizerAvatar: { width: 40, height: 40, borderRadius: radius.pill },
  avatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft },
  organizerInitials: { color: colors.text, fontSize: 11, fontWeight: "900" },
  organizerCopy: { flex: 1, gap: spacing.xxs },
  organizerMessage: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  section: { marginTop: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  sectionMeta: { color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  sectionCount: { color: colors.textSubtle, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  horizontalShelf: { gap: spacing.xs, paddingRight: spacing.md },
  highlightCard: {
    width: 160,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  highlightImage: { width: "100%", height: 96, backgroundColor: colors.surfaceSoft },
  highlightCaption: { minHeight: 46, padding: spacing.xs, color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  listCard: {
    paddingHorizontal: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  attendeeRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  attendeeAvatar: { width: 38, height: 38, borderRadius: radius.pill },
  attendeeInitials: { color: colors.text, fontSize: 10, fontWeight: "900" },
  attendeeCopy: { flex: 1 },
  attendeeName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  attendeeCity: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  listEmpty: { padding: spacing.md, color: colors.textMuted, fontSize: 12, textAlign: "center" },
  vehicleCard: {
    width: 124,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  vehicleImage: { width: "100%", height: 76, backgroundColor: colors.surfaceSoft },
  vehiclePlaceholder: { alignItems: "center", justifyContent: "center" },
  vehicleCopy: { padding: spacing.xs },
  vehicleBrand: { color: colors.text, fontSize: 11, fontWeight: "900" },
  vehicleModel: { marginTop: 2, color: colors.textMuted, fontSize: 10 },
  routeCard: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  routeDot: { width: 12, height: 12, marginTop: 3, borderRadius: 6, borderWidth: 3, borderColor: colors.text, backgroundColor: colors.primary },
  routeLine: { width: 2, height: 40, marginHorizontal: spacing.sm, backgroundColor: colors.borderStrong },
  routeCopy: { flex: 1 },
  routeName: { color: colors.text, fontSize: 13, fontWeight: "900" },
  routeTime: { marginTop: 4, color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  routeEnd: { marginTop: 3, color: colors.textSubtle, fontSize: 10, fontWeight: "700" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.glass,
  },
  inlineError: { margin: spacing.md, color: colors.primaryHover, fontSize: 11, fontWeight: "700" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  stateIcon: { width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primaryMuted },
  stateTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.title, fontWeight: "900", textAlign: "center" },
  stateText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  pressed: { opacity: 0.86, transform: [{ translateY: 1 }, { scale: 0.985 }] },
});
