import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
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
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type CrewRole = "owner" | "admin" | "member";
type JoinPolicy = "open" | "approval" | "invite_only";

type Crew = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  join_policy: JoinPolicy;
  created_at: string;
};

type Membership = {
  crew_id: string;
  user_id: string;
  role: CrewRole;
  joined_at: string | null;
};

type Member = Membership & {
  profile: CanonicalProfile | null;
};

type Vehicle = {
  id: string;
  owner_id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  cover_image_url: string | null;
};

type CrewEvent = {
  id: string;
  title: string;
  location_name: string;
  starts_at: string;
  cover_image_url: string | null;
};

type JoinRequest = {
  id: string;
  crew_id: string;
  user_id: string;
  status: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDrive(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function vehicleName(vehicle: Vehicle) {
  return (
    [vehicle.year, vehicle.brand, vehicle.model].filter(Boolean).join(" ") ||
    "Member vehicle"
  );
}

function CrewHeader({ onShare }: { onShare: () => void }) {
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
          accessibilityLabel="Share crew"
          accessibilityRole="button"
          onPress={onShare}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={19} color={colors.text} />
        </Pressable>
        <View style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </View>
      </View>
    </View>
  );
}

function MembershipButton({
  crew,
  isMember,
  isOwner,
  request,
  busy,
  onJoin,
  onLeave,
  onCancelRequest,
}: {
  crew: Crew;
  isMember: boolean;
  isOwner: boolean;
  request: JoinRequest | null;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onCancelRequest: () => void;
}) {
  if (isOwner) {
    return (
      <CanonicalPrimaryButton
        compact
        disabled
        icon="shield-checkmark-outline"
        label="OWNER"
        variant="surface"
        onPress={() => undefined}
      />
    );
  }

  if (isMember) {
    return (
      <CanonicalPrimaryButton
        compact
        icon="checkmark"
        label="JOINED"
        loading={busy}
        variant="surface"
        onPress={onLeave}
      />
    );
  }

  if (request) {
    return (
      <CanonicalPrimaryButton
        compact
        label="REQUESTED"
        loading={busy}
        variant="surface"
        onPress={onCancelRequest}
      />
    );
  }

  if (!crew.is_public || crew.join_policy === "invite_only") {
    return (
      <CanonicalPrimaryButton
        compact
        disabled
        icon="lock-closed-outline"
        label="INVITE ONLY"
        variant="surface"
        onPress={() => undefined}
      />
    );
  }

  return (
    <CanonicalPrimaryButton
      compact
      label={crew.join_policy === "approval" ? "REQUEST TO JOIN" : "JOIN CREW"}
      loading={busy}
      onPress={onJoin}
    />
  );
}

function Hero({
  crew,
  owner,
  members,
  membershipButton,
}: {
  crew: Crew;
  owner: CanonicalProfile | null;
  members: Member[];
  membershipButton: ReactNode;
}) {
  const friendCount = Math.min(9, Math.max(0, members.length - 1));
  return (
    <CanonicalArtwork
      uri={crew.cover_image_url}
      style={styles.hero}
      imageStyle={styles.heroImage}
      icon="people-outline"
    >
      <View style={styles.heroShade} />
      <View style={styles.heroTop}>
        <CanonicalPill label={crew.is_public ? "PUBLIC" : "PRIVATE"} />
        <CanonicalPill
          label={members.length ? "ACTIVE" : "NEW"}
          tone="accent"
        />
      </View>
      <View style={styles.heroCopy}>
        <Text numberOfLines={2} style={styles.heroTitle}>
          {crew.name.toUpperCase()}
        </Text>
        <Text style={styles.heroMeta}>
          {(crew.city || "NOXA").toUpperCase()} · {members.length} MEMBERS
        </Text>
        <View style={styles.heroSocial}>
          <CanonicalAvatarStack
            profiles={members
              .map((member) => member.profile)
              .filter((profile): profile is CanonicalProfile => Boolean(profile))}
            total={members.length}
            max={3}
            size={30}
          />
          <Text numberOfLines={1} style={styles.heroSocialText}>
            {friendCount
              ? `${friendCount} drivers inside`
              : `Founded by ${profileName(owner)}`}
          </Text>
        </View>
        <View style={styles.membershipButton}>{membershipButton}</View>
      </View>
    </CanonicalArtwork>
  );
}

function Atmosphere({ images }: { images: string[] }) {
  const cells = [0, 1, 2];
  return (
    <View style={styles.atmosphereRow}>
      {cells.map((index) => (
        <CanonicalArtwork
          key={index}
          uri={images[index]}
          style={styles.atmosphereCell}
          imageStyle={styles.atmosphereImage}
          icon={index === 1 ? "people-outline" : "car-sport-outline"}
        >
          <View style={styles.atmosphereShade} />
        </CanonicalArtwork>
      ))}
    </View>
  );
}

function NextDrive({ event, members }: { event: CrewEvent; members: Member[] }) {
  return (
    <Pressable
      accessibilityLabel={`Open ${event.title}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/event-details", params: { id: event.id } })
      }
      style={({ pressed }) => [styles.nextDrive, pressed && styles.pressed]}
    >
      <View style={styles.nextDriveCopy}>
        <Text style={styles.nextDriveEyebrow}>NEXT DRIVE</Text>
        <Text numberOfLines={1} style={styles.nextDriveTitle}>
          {event.title.toUpperCase()}
        </Text>
        <Text numberOfLines={1} style={styles.nextDriveMeta}>
          {formatDrive(event.starts_at)} · {event.location_name}
        </Text>
        <View style={styles.nextDriveSocial}>
          <CanonicalAvatarStack
            profiles={members
              .map((member) => member.profile)
              .filter((profile): profile is CanonicalProfile => Boolean(profile))}
            total={members.length}
            max={3}
            size={25}
          />
          <Text style={styles.nextDriveSignal}>
            {members.length} members invited
          </Text>
        </View>
      </View>
      <View style={styles.nextDriveArrow}>
        <Ionicons name="chevron-forward" size={22} color={colors.text} />
      </View>
    </Pressable>
  );
}

export default function CanonicalCrewDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const crewId = Array.isArray(params.id) ? params.id[0] : params.id || "";

  const [crew, setCrew] = useState<Crew | null>(null);
  const [owner, setOwner] = useState<CanonicalProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [events, setEvents] = useState<CrewEvent[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myMembership, setMyMembership] = useState<Membership | null>(null);
  const [joinRequest, setJoinRequest] = useState<JoinRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!uuidPattern.test(crewId)) {
      setError("This crew link is invalid.");
      setLoading(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    setCurrentUserId(userId);

    const [crewResult, memberResult, eventResult, requestResult] =
      await Promise.all([
        supabase
          .from("crews")
          .select(
            "id,owner_id,name,description,city,logo_url,cover_image_url,is_public,join_policy,created_at",
          )
          .eq("id", crewId)
          .maybeSingle(),
        supabase
          .from("crew_members")
          .select("crew_id,user_id,role,joined_at")
          .eq("crew_id", crewId)
          .order("joined_at", { ascending: true }),
        supabase
          .from("events")
          .select("id,title,location_name,starts_at,cover_image_url")
          .eq("crew_id", crewId)
          .eq("status", "scheduled")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(5),
        userId
          ? supabase
              .from("crew_join_requests")
              .select("id,crew_id,user_id,status")
              .eq("crew_id", crewId)
              .eq("user_id", userId)
              .eq("status", "pending")
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    if (crewResult.error || memberResult.error || eventResult.error) {
      setError(
        crewResult.error?.message ||
          memberResult.error?.message ||
          eventResult.error?.message ||
          "Crew could not be loaded.",
      );
      setLoading(false);
      return;
    }

    if (!crewResult.data) {
      setError("Crew not found.");
      setLoading(false);
      return;
    }

    const nextCrew = crewResult.data as Crew;
    const membershipRows = (memberResult.data ?? []) as Membership[];
    const memberIds = membershipRows.map((membership) => membership.user_id);

    const [profilesResult, vehiclesResult, ownerResult] = await Promise.all([
      memberIds.length
        ? supabase
            .from("profiles")
            .select("id,display_name,username,avatar_url")
            .in("id", memberIds)
        : Promise.resolve({ data: [], error: null }),
      memberIds.length
        ? supabase
            .from("vehicles")
            .select("id,owner_id,brand,model,year,cover_image_url")
            .in("owner_id", memberIds)
            .eq("is_public", true)
            .limit(12)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .eq("id", nextCrew.owner_id)
        .maybeSingle(),
    ]);

    const detailError =
      profilesResult.error || vehiclesResult.error || ownerResult.error;
    if (detailError) setError(detailError.message);

    const profileRows = (profilesResult.data ?? []) as CanonicalProfile[];
    const byId = new Map(profileRows.map((profile) => [profile.id, profile]));

    setCrew(nextCrew);
    setOwner((ownerResult.data as CanonicalProfile | null) ?? null);
    setMembers(
      membershipRows.map((membership) => ({
        ...membership,
        profile: byId.get(membership.user_id) ?? null,
      })),
    );
    setVehicles((vehiclesResult.data ?? []) as Vehicle[]);
    setEvents((eventResult.data ?? []) as CrewEvent[]);
    setMyMembership(
      membershipRows.find((membership) => membership.user_id === userId) ?? null,
    );
    setJoinRequest((requestResult.data as JoinRequest | null) ?? null);
    setLoading(false);
  }, [crewId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const isOwner = Boolean(crew && currentUserId === crew.owner_id);
  const isMember = myMembership !== null;

  const join = useCallback(async () => {
    if (!crew || !currentUserId || busy) return;
    setBusy(true);
    setError(null);

    const result =
      crew.join_policy === "approval"
        ? await supabase.from("crew_join_requests").insert({
            crew_id: crew.id,
            user_id: currentUserId,
            status: "pending",
          })
        : await supabase.from("crew_members").insert({
            crew_id: crew.id,
            user_id: currentUserId,
            role: "member",
          });

    if (result.error) setError(result.error.message);
    else await load();
    setBusy(false);
  }, [busy, crew, currentUserId, load]);

  const leave = useCallback(() => {
    if (!crew || !currentUserId || busy || isOwner) return;
    Alert.alert("Leave crew?", `Leave ${crew.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          const { error: leaveError } = await supabase
            .from("crew_members")
            .delete()
            .eq("crew_id", crew.id)
            .eq("user_id", currentUserId);
          if (leaveError) setError(leaveError.message);
          else await load();
          setBusy(false);
        },
      },
    ]);
  }, [busy, crew, currentUserId, isOwner, load]);

  const cancelRequest = useCallback(async () => {
    if (!joinRequest || busy) return;
    setBusy(true);
    const { error: requestError } = await supabase
      .from("crew_join_requests")
      .delete()
      .eq("id", joinRequest.id);
    if (requestError) setError(requestError.message);
    else await load();
    setBusy(false);
  }, [busy, joinRequest, load]);

  const shareCrew = useCallback(async () => {
    if (!crew) return;
    await Share.share({
      title: crew.name,
      message: `${crew.name} on NOXA${crew.city ? ` · ${crew.city}` : ""}`,
    });
  }, [crew]);

  const memberProfiles = useMemo(
    () =>
      members
        .map((member) => member.profile)
        .filter((profile): profile is CanonicalProfile => Boolean(profile)),
    [members],
  );

  const atmosphereImages = useMemo(() => {
    const values = [
      crew?.cover_image_url,
      ...events.map((event) => event.cover_image_url),
      ...vehicles.map((vehicle) => vehicle.cover_image_url),
    ].filter((value): value is string => Boolean(value));
    return Array.from(new Set(values)).slice(0, 3);
  }, [crew?.cover_image_url, events, vehicles]);

  if (loading) {
    return (
      <NoxaScreen>
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Entering crew…</Text>
        </View>
      </NoxaScreen>
    );
  }

  if (!crew) {
    return (
      <NoxaScreen>
        <CrewHeader onShare={() => undefined} />
        <View style={styles.state}>
          <Ionicons name="people-outline" size={38} color={colors.primary} />
          <Text style={styles.stateTitle}>Crew unavailable</Text>
          <Text style={styles.stateText}>{error || "This crew no longer exists."}</Text>
          <CanonicalPrimaryButton
            label="GO BACK"
            variant="surface"
            onPress={() => router.back()}
          />
        </View>
      </NoxaScreen>
    );
  }

  const membershipButton = (
    <MembershipButton
      busy={busy}
      crew={crew}
      isMember={isMember}
      isOwner={isOwner}
      onCancelRequest={cancelRequest}
      onJoin={join}
      onLeave={leave}
      request={joinRequest}
    />
  );

  return (
    <NoxaScreen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <CrewHeader onShare={shareCrew} />

        <Hero
          crew={crew}
          members={members}
          membershipButton={membershipButton}
          owner={owner}
        />

        {error ? (
          <Pressable onPress={() => setError(null)} style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primaryHover} />
            <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
          </Pressable>
        ) : null}

        <View style={styles.section}>
          <CanonicalSectionHeader title="ATMOSPHERE" />
          <Text style={styles.sectionSubtitle}>
            Cars, drives and people — before words.
          </Text>
          <Atmosphere images={atmosphereImages} />
        </View>

        {events[0] ? <NextDrive event={events[0]} members={members} /> : null}

        <View style={styles.section}>
          <CanonicalSectionHeader title="MEMBERS" action={`${members.length} TOTAL`} />
          <View style={styles.membersCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.membersRow}
            >
              {members.slice(0, 9).map((member) => (
                <Pressable
                  key={member.user_id}
                  accessibilityRole="button"
                  style={styles.memberItem}
                >
                  <CanonicalAvatar profile={member.profile} size={44} />
                  <Text numberOfLines={1} style={styles.memberName}>
                    {profileName(member.profile)}
                  </Text>
                  <Text style={styles.memberRole}>{member.role.toUpperCase()}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {owner ? (
              <View style={styles.founderRow}>
                <CanonicalAvatar profile={owner} size={38} />
                <View style={styles.founderCopy}>
                  <Text style={styles.founderEyebrow}>FOUNDER</Text>
                  <Text style={styles.founderName}>{profileName(owner)}</Text>
                </View>
                <Ionicons name="shield-checkmark" size={18} color={colors.primaryHover} />
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.twoColumn}>
          <View style={styles.activityCard}>
            <Text style={styles.cardEyebrow}>RECENT ACTIVITY</Text>
            {events[0] ? (
              <View style={styles.activityLine}>
                <View style={styles.activityDot} />
                <Text numberOfLines={2} style={styles.activityText}>
                  New drive: {events[0].title}
                </Text>
              </View>
            ) : null}
            {members[0] ? (
              <View style={styles.activityLine}>
                <View style={[styles.activityDot, styles.activityDotSuccess]} />
                <Text numberOfLines={2} style={styles.activityText}>
                  {profileName(members[0].profile)} is in the crew
                </Text>
              </View>
            ) : null}
            {!events.length && !members.length ? (
              <Text style={styles.emptyText}>Activity will appear here.</Text>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: "/crew-garage", params: { id: crew.id } })
            }
            style={({ pressed }) => [styles.garageTile, pressed && styles.pressed]}
          >
            <CanonicalArtwork
              uri={vehicles[0]?.cover_image_url}
              style={styles.garageArtwork}
              imageStyle={styles.garageImage}
              icon="car-sport-outline"
            >
              <View style={styles.garageShade} />
              <Text style={styles.garageTitle}>GARAGE</Text>
              <Text style={styles.garageMeta}>{vehicles.length} CARS</Text>
            </CanonicalArtwork>
          </Pressable>
        </View>

        {vehicles.length ? (
          <View style={styles.section}>
            <CanonicalSectionHeader title="GARAGE GALLERY" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vehiclesRow}
            >
              {vehicles.slice(0, 8).map((vehicle) => (
                <View key={vehicle.id} style={styles.vehicleCard}>
                  <CanonicalArtwork
                    uri={vehicle.cover_image_url}
                    style={styles.vehicleArtwork}
                    imageStyle={styles.vehicleImage}
                    icon="car-sport-outline"
                  />
                  <Text numberOfLines={1} style={styles.vehicleTitle}>
                    {vehicleName(vehicle)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {isMember ? (
          <View style={styles.quickActions}>
            {[
              { icon: "chatbubble-outline" as const, label: "CHAT", route: "/crew-chat" as const },
              { icon: "images-outline" as const, label: "GALLERY", route: "/crew-gallery" as const },
              { icon: "calendar-outline" as const, label: "CALENDAR", route: "/crew-calendar" as const },
            ].map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: action.route, params: { id: crew.id } })
                }
                style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
              >
                <Ionicons name={action.icon} size={20} color={colors.text} />
                <Text style={styles.quickActionText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.aboutCard}>
          <Text style={styles.cardEyebrow}>ABOUT / RULES</Text>
          <Text style={styles.aboutText}>
            {crew.description ||
              "This crew has not added its story yet. Respect the road, the people and the location."}
          </Text>
          <Text style={styles.createdText}>
            ESTABLISHED{" "}
            {new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" })
              .format(new Date(crew.created_at))
              .toUpperCase()}
          </Text>
        </View>
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 80, gap: spacing.lg },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  headerActions: { flexDirection: "row", gap: spacing.xs },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  hero: {
    minHeight: 292,
    justifyContent: "space-between",
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  heroImage: { borderRadius: radius.hero - 1 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.62)" },
  heroTop: { flexDirection: "row", gap: spacing.xs },
  heroCopy: { gap: spacing.sm },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroMeta: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  heroSocial: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroSocialText: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  membershipButton: { alignSelf: "flex-end", minWidth: 128 },
  errorBanner: {
    minHeight: 48,
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 16 },
  section: { paddingHorizontal: spacing.md, gap: spacing.xs },
  sectionSubtitle: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  atmosphereRow: { height: 112, flexDirection: "row", gap: spacing.sm },
  atmosphereCell: { flex: 1, borderRadius: radius.md },
  atmosphereImage: { borderRadius: radius.md },
  atmosphereShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.14)" },
  nextDrive: {
    minHeight: 138,
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  nextDriveCopy: { flex: 1, gap: spacing.xxs },
  nextDriveEyebrow: { color: colors.primaryHover, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.5 },
  nextDriveTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 20, lineHeight: 24, fontWeight: "900" },
  nextDriveMeta: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  nextDriveSocial: { marginTop: spacing.xxs, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  nextDriveSignal: { color: colors.textSubtle, fontSize: 10, lineHeight: 14 },
  nextDriveArrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.surfaceRaised },
  membersCard: { overflow: "hidden", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  membersRow: { gap: spacing.md, padding: spacing.md },
  memberItem: { width: 62, alignItems: "center", gap: spacing.xxs },
  memberName: { width: "100%", color: colors.text, fontSize: 10, lineHeight: 13, fontWeight: "700", textAlign: "center" },
  memberRole: { color: colors.textSubtle, fontSize: 8, lineHeight: 10, fontWeight: "900" },
  founderRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  founderCopy: { flex: 1 },
  founderEyebrow: { color: colors.primaryHover, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.4 },
  founderName: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  twoColumn: { minHeight: 142, marginHorizontal: spacing.md, flexDirection: "row", gap: spacing.sm },
  activityCard: { flex: 1, gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  cardEyebrow: { color: colors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.5 },
  activityLine: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  activityDot: { width: 8, height: 8, marginTop: 4, borderRadius: 4, backgroundColor: colors.primary },
  activityDotSuccess: { backgroundColor: colors.success },
  activityText: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 15 },
  emptyText: { color: colors.textSubtle, fontSize: 11, lineHeight: 15 },
  garageTile: { width: 116, overflow: "hidden", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong },
  garageArtwork: { flex: 1, justifyContent: "flex-end", padding: spacing.sm },
  garageImage: { borderRadius: radius.lg - 1 },
  garageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  garageTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 17, lineHeight: 20, fontWeight: "900" },
  garageMeta: { color: colors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: "700" },
  vehiclesRow: { gap: spacing.sm, paddingRight: spacing.md },
  vehicleCard: { width: 154, gap: spacing.xs },
  vehicleArtwork: { height: 98, borderRadius: radius.md },
  vehicleImage: { borderRadius: radius.md },
  vehicleTitle: { color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  quickActions: { marginHorizontal: spacing.md, flexDirection: "row", gap: spacing.sm },
  quickAction: { flex: 1, minHeight: 66, alignItems: "center", justifyContent: "center", gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  quickActionText: { color: colors.textMuted, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.4 },
  aboutCard: { marginHorizontal: spacing.md, gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  aboutText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  createdText: { color: colors.textSubtle, fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 0.5 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  stateTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.h2, lineHeight: typography.lineHeight.h2, fontWeight: "900", textAlign: "center" },
  stateText: { color: colors.textMuted, fontSize: typography.body, lineHeight: typography.lineHeight.body, textAlign: "center" },
});
