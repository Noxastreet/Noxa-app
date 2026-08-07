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
  initials,
  profileName,
  type CanonicalProfile,
} from "@/src/features/crews-events/CanonicalPrimitives";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type CrewRole = "owner" | "admin" | "member";
type JoinPolicy = "open" | "approval" | "invite_only";
type CrewTab = "activity" | "events" | "members" | "about";

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

function formatEstablished(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  })
    .format(new Date(value))
    .toUpperCase();
}

function vehicleName(vehicle: Vehicle) {
  return (
    [vehicle.year, vehicle.brand, vehicle.model].filter(Boolean).join(" ") ||
    "Member vehicle"
  );
}

function joinPolicyLabel(policy: JoinPolicy) {
  if (policy === "open") return "OPEN JOIN";
  if (policy === "approval") return "APPROVAL";
  return "INVITE ONLY";
}

function CrewLogo({ crew, size = 58 }: { crew: Crew; size?: number }) {
  if (crew.logo_url) {
    return (
      <Image
        source={{ uri: crew.logo_url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={[
        styles.logoFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.logoFallbackText}>{initials(crew.name)}</Text>
    </View>
  );
}

function CrewHeader({ onMore }: { onMore: () => void }) {
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
      <Pressable
        accessibilityLabel="More crew actions"
        accessibilityRole="button"
        onPress={onMore}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
      </Pressable>
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
      label={crew.join_policy === "approval" ? "REQUEST" : "JOIN"}
      loading={busy}
      onPress={onJoin}
    />
  );
}

function CrewHero({
  crew,
  owner,
  members,
  artworkUri,
  membershipButton,
}: {
  crew: Crew;
  owner: CanonicalProfile | null;
  members: Member[];
  artworkUri: string | null;
  membershipButton: ReactNode;
}) {
  const profiles = members
    .map((member) => member.profile)
    .filter((profile): profile is CanonicalProfile => Boolean(profile));

  return (
    <CanonicalArtwork
      uri={artworkUri}
      style={styles.hero}
      imageStyle={styles.heroImage}
      icon="people-outline"
    >
      <View style={styles.heroShadeTop} />
      <View style={styles.heroShadeBottom} />

      <View style={styles.heroTopRow}>
        <View style={styles.heroPills}>
          <CanonicalPill label={crew.is_public ? "PUBLIC" : "PRIVATE"} />
          <CanonicalPill
            label={members.length ? "ACTIVE" : "NEW"}
            tone="accent"
          />
        </View>
        <CanonicalAvatarStack
          profiles={profiles}
          total={members.length}
          max={3}
          size={27}
        />
      </View>

      <View style={styles.heroCopy}>
        <View style={styles.heroIdentity}>
          <CrewLogo crew={crew} />
          <View style={styles.heroNameBlock}>
            <Text numberOfLines={2} style={styles.heroTitle}>
              {crew.name.toUpperCase()}
            </Text>
            <Text numberOfLines={1} style={styles.heroMeta}>
              {(crew.city || "NOXA").toUpperCase()} · {members.length} MEMBERS
            </Text>
          </View>
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.founderBlock}>
            <Text style={styles.founderEyebrow}>FOUNDED BY</Text>
            <Text numberOfLines={1} style={styles.founderName}>
              {profileName(owner)}
            </Text>
          </View>
          <View style={styles.membershipButton}>{membershipButton}</View>
        </View>
      </View>
    </CanonicalArtwork>
  );
}

function TabBar({ value, onChange }: { value: CrewTab; onChange: (tab: CrewTab) => void }) {
  const tabs: { value: CrewTab; label: string }[] = [
    { value: "activity", label: "ACTIVITY" },
    { value: "events", label: "EVENTS" },
    { value: "members", label: "MEMBERS" },
    { value: "about", label: "ABOUT" },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.value)}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

function EventRow({ event }: { event: CrewEvent }) {
  return (
    <Pressable
      accessibilityLabel={`Open ${event.title}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/event-details", params: { id: event.id } })
      }
      style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
    >
      <CanonicalArtwork
        uri={event.cover_image_url}
        style={styles.eventArtwork}
        imageStyle={styles.eventArtworkImage}
        icon="flag-outline"
      >
        <View style={styles.eventShade} />
      </CanonicalArtwork>
      <View style={styles.eventCopy}>
        <Text style={styles.eventEyebrow}>UPCOMING DRIVE</Text>
        <Text numberOfLines={1} style={styles.eventTitle}>
          {event.title.toUpperCase()}
        </Text>
        <Text numberOfLines={1} style={styles.eventMeta}>
          {formatDrive(event.starts_at)} · {event.location_name}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={colors.textSubtle} />
    </Pressable>
  );
}

function ActivityTab({
  crew,
  events,
  members,
  vehicles,
}: {
  crew: Crew;
  events: CrewEvent[];
  members: Member[];
  vehicles: Vehicle[];
}) {
  return (
    <View style={styles.tabContent}>
      {events[0] ? (
        <>
          <SectionTitle title="NEXT FROM THE CREW" />
          <EventRow event={events[0]} />
        </>
      ) : null}

      <SectionTitle title="RECENT ACTIVITY" />
      <View style={styles.activityCard}>
        {events[0] ? (
          <View style={styles.activityLine}>
            <View style={styles.activityIcon}>
              <Ionicons name="calendar-outline" size={17} color={colors.primaryHover} />
            </View>
            <View style={styles.activityCopy}>
              <Text style={styles.activityTitle}>New crew event</Text>
              <Text numberOfLines={1} style={styles.activityMeta}>
                {events[0].title} · {formatDrive(events[0].starts_at)}
              </Text>
            </View>
          </View>
        ) : null}

        {members[0] ? (
          <View style={styles.activityLine}>
            <CanonicalAvatar profile={members[0].profile} size={36} />
            <View style={styles.activityCopy}>
              <Text style={styles.activityTitle}>Member in the crew</Text>
              <Text numberOfLines={1} style={styles.activityMeta}>
                {profileName(members[0].profile)} · {members[0].role}
              </Text>
            </View>
          </View>
        ) : null}

        {!events.length && !members.length ? (
          <Text style={styles.emptyText}>Crew activity will appear here.</Text>
        ) : null}
      </View>

      <SectionTitle title="CREW GARAGE" meta={`${vehicles.length} CARS`} />
      <Pressable
        accessibilityLabel="Open crew garage"
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: "/crew-garage", params: { id: crew.id } })
        }
        style={({ pressed }) => [styles.garageCard, pressed && styles.pressed]}
      >
        <CanonicalArtwork
          uri={vehicles[0]?.cover_image_url}
          style={styles.garageArtwork}
          imageStyle={styles.garageArtworkImage}
          icon="car-sport-outline"
        >
          <View style={styles.garageShade} />
          <View style={styles.garageCopy}>
            <Text style={styles.garageEyebrow}>MEMBER CARS</Text>
            <Text style={styles.garageTitle}>GARAGE</Text>
          </View>
          <View style={styles.garageArrow}>
            <Ionicons name="arrow-forward" size={18} color={colors.text} />
          </View>
        </CanonicalArtwork>
      </Pressable>

      {vehicles.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vehicleList}
        >
          {vehicles.slice(0, 8).map((vehicle) => (
            <View key={vehicle.id} style={styles.vehicleCard}>
              <CanonicalArtwork
                uri={vehicle.cover_image_url}
                style={styles.vehicleArtwork}
                imageStyle={styles.vehicleArtworkImage}
                icon="car-sport-outline"
              />
              <Text numberOfLines={1} style={styles.vehicleTitle}>
                {vehicleName(vehicle)}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function EventsTab({ events }: { events: CrewEvent[] }) {
  return (
    <View style={styles.tabContent}>
      <SectionTitle title="CREW EVENTS" meta={`${events.length} UPCOMING`} />
      {events.length ? (
        <View style={styles.listGap}>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={30} color={colors.primary} />
          <Text style={styles.emptyTitle}>No upcoming events</Text>
          <Text style={styles.emptyText}>The next crew drive will appear here.</Text>
        </View>
      )}
    </View>
  );
}

function MembersTab({ members, ownerId }: { members: Member[]; ownerId: string }) {
  return (
    <View style={styles.tabContent}>
      <SectionTitle title="MEMBERS" meta={`${members.length} TOTAL`} />
      {members.length ? (
        <View style={styles.memberList}>
          {members.map((member) => (
            <View key={member.user_id} style={styles.memberRow}>
              <CanonicalAvatar profile={member.profile} size={44} />
              <View style={styles.memberCopy}>
                <Text numberOfLines={1} style={styles.memberName}>
                  {profileName(member.profile)}
                </Text>
                <Text style={styles.memberRole}>{member.role.toUpperCase()}</Text>
              </View>
              {member.user_id === ownerId ? (
                <Ionicons
                  name="shield-checkmark"
                  size={19}
                  color={colors.primaryHover}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={30} color={colors.primary} />
          <Text style={styles.emptyTitle}>No members yet</Text>
          <Text style={styles.emptyText}>The first drivers will appear here.</Text>
        </View>
      )}
    </View>
  );
}

function AboutTab({ crew, owner }: { crew: Crew; owner: CanonicalProfile | null }) {
  return (
    <View style={styles.tabContent}>
      <SectionTitle title="ABOUT THE CREW" />
      <View style={styles.aboutCard}>
        <Text style={styles.aboutText}>
          {crew.description ||
            "This crew has not added its story yet. Respect the road, the people and the location."}
        </Text>
      </View>

      <SectionTitle title="CREW DETAILS" />
      <View style={styles.factsCard}>
        {[
          ["FOUNDER", profileName(owner)],
          ["CITY", crew.city || "Not specified"],
          ["VISIBILITY", crew.is_public ? "Public" : "Private"],
          ["MEMBERSHIP", joinPolicyLabel(crew.join_policy)],
          ["ESTABLISHED", formatEstablished(crew.created_at)],
        ].map(([label, value]) => (
          <View key={label} style={styles.factRow}>
            <Text style={styles.factLabel}>{label}</Text>
            <Text numberOfLines={1} style={styles.factValue}>
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
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
  const [activeTab, setActiveTab] = useState<CrewTab>("activity");
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
          .limit(8),
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

  const showMore = useCallback(() => {
    if (!crew) return;
    const actions: Parameters<typeof Alert.alert>[2] = [
      { text: "Share crew", onPress: () => void shareCrew() },
    ];

    if (isMember && !isOwner) {
      actions.push({ text: "Leave crew", style: "destructive", onPress: leave });
    }
    actions.push({ text: "Cancel", style: "cancel" });
    Alert.alert(crew.name, undefined, actions);
  }, [crew, isMember, isOwner, leave, shareCrew]);

  const artworkUri = useMemo(
    () =>
      crew?.cover_image_url ||
      events.find((event) => event.cover_image_url)?.cover_image_url ||
      vehicles.find((vehicle) => vehicle.cover_image_url)?.cover_image_url ||
      null,
    [crew?.cover_image_url, events, vehicles],
  );

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
        <CrewHeader onMore={() => undefined} />
        <View style={styles.state}>
          <Ionicons name="people-outline" size={38} color={colors.primary} />
          <Text style={styles.stateTitle}>Crew unavailable</Text>
          <Text style={styles.stateText}>
            {error || "This crew no longer exists."}
          </Text>
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
        <CrewHeader onMore={showMore} />

        <CrewHero
          artworkUri={artworkUri}
          crew={crew}
          members={members}
          membershipButton={membershipButton}
          owner={owner}
        />

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

        <TabBar onChange={setActiveTab} value={activeTab} />

        {activeTab === "activity" ? (
          <ActivityTab
            crew={crew}
            events={events}
            members={members}
            vehicles={vehicles}
          />
        ) : null}
        {activeTab === "events" ? <EventsTab events={events} /> : null}
        {activeTab === "members" ? (
          <MembersTab members={members} ownerId={crew.owner_id} />
        ) : null}
        {activeTab === "about" ? <AboutTab crew={crew} owner={owner} /> : null}
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 104, gap: spacing.md },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  hero: {
    minHeight: 302,
    justifyContent: "flex-end",
    marginHorizontal: spacing.md,
    padding: spacing.md,
    paddingTop: 78,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  heroImage: { borderRadius: radius.hero - 1 },
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
    gap: spacing.md,
  },
  heroPills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  heroCopy: { gap: spacing.md },
  heroIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroNameBlock: { flex: 1, minWidth: 0 },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 29,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.45,
  },
  heroMeta: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  founderBlock: { flex: 1, minWidth: 0 },
  founderEyebrow: {
    color: colors.textSubtle,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  founderName: {
    marginTop: 2,
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  membershipButton: { alignSelf: "flex-end", minWidth: 106 },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  logoFallbackText: { color: colors.text, fontSize: 15, fontWeight: "900" },
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
  tabs: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  tab: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  tabText: {
    color: colors.textSubtle,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.45,
  },
  tabTextActive: { color: colors.text },
  tabContent: { paddingHorizontal: spacing.md, gap: spacing.md },
  sectionTitleRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: 0.25,
  },
  sectionMeta: {
    color: colors.textSubtle,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.35,
  },
  listGap: { gap: spacing.sm },
  eventRow: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  eventArtwork: { width: 76, height: 68, borderRadius: radius.md },
  eventArtworkImage: { borderRadius: radius.md },
  eventShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  eventCopy: { flex: 1, minWidth: 0, gap: 2 },
  eventEyebrow: {
    color: colors.primaryHover,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.45,
  },
  eventTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "900",
  },
  eventMeta: { color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  activityCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activityLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  activityIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
  },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  activityMeta: { color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  garageCard: {
    height: 154,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  garageArtwork: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  garageArtworkImage: { borderRadius: radius.lg - 1 },
  garageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  garageCopy: { gap: 1 },
  garageEyebrow: {
    color: colors.textMuted,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.45,
  },
  garageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  garageArrow: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(20,20,26,0.78)",
  },
  vehicleList: { gap: spacing.sm, paddingRight: spacing.md },
  vehicleCard: { width: 148, gap: spacing.xs },
  vehicleArtwork: { height: 94, borderRadius: radius.md },
  vehicleArtworkImage: { borderRadius: radius.md },
  vehicleTitle: { color: colors.text, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  memberList: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  memberRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: "800" },
  memberRole: {
    color: colors.textSubtle,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  aboutCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  aboutText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  factsCard: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  factRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  factLabel: {
    color: colors.textSubtle,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.45,
  },
  factValue: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  emptyCard: {
    minHeight: 190,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
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
});
