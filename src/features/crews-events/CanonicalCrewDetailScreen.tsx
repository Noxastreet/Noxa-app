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
  EntityActionSheet,
  type EntityAction,
} from "@/src/features/crews-events/EntityActionSheet";
import {
  CanonicalArtwork,
  CanonicalAvatar,
  CanonicalPrimaryButton,
  initials,
  profileName,
  type CanonicalProfile,
} from "@/src/features/crews-events/CanonicalPrimitives";
import {
  chooseCoverAsset,
  removeEntityCoverObject,
  removeUploadedEntityCover,
  setEntityCover,
  uploadEntityCover,
} from "@/src/lib/entityCover";
import { publicErrorMessage } from "@/src/lib/publicError";
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
  return new Intl.DateTimeFormat('en-GB', {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatEstablished(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    month: "short",
    year: "numeric",
  })
    .format(new Date(value));
}

function vehicleName(vehicle: Vehicle) {
  return (
    [vehicle.year, vehicle.brand, vehicle.model].filter(Boolean).join(" ") ||
    "Member vehicle"
  );
}

function joinPolicyLabel(policy: JoinPolicy) {
  if (policy === "open") return "Open";
  if (policy === "approval") return "Approval";
  return "Invite only";
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
        label="Owner"
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
        label="Joined"
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
        label="Requested"
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
        label="Invite only"
        variant="surface"
        onPress={() => undefined}
      />
    );
  }

  return (
    <CanonicalPrimaryButton
      compact
      label={crew.join_policy === "approval" ? "Request" : "Join"}
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
  return (
    <View>
      {artworkUri ? (
        <CanonicalArtwork
          uri={artworkUri}
          style={styles.heroMedia}
          imageStyle={styles.heroImage}
          icon="people-outline"
        />
      ) : null}

      <View style={styles.heroIdentityBlock}>
        <CrewLogo crew={crew} size={56} />
        <View style={styles.heroNameBlock}>
          <Text numberOfLines={2} style={styles.heroTitle}>
            {crew.name}
          </Text>
          <Text numberOfLines={1} style={styles.heroMeta}>
            {crew.city || "Location not set"} · {members.length} {members.length === 1 ? "member" : "members"}
          </Text>
          <Text numberOfLines={1} style={styles.founderName}>
            Founded by {profileName(owner)}
          </Text>
        </View>
        <View style={styles.membershipButton}>{membershipButton}</View>
      </View>
    </View>
  );
}

function TabBar({ value, onChange }: { value: CrewTab; onChange: (tab: CrewTab) => void }) {
  const tabs: { value: CrewTab; label: string }[] = [
    { value: "activity", label: "Activity" },
    { value: "events", label: "Events" },
    { value: "members", label: "Members" },
    { value: "about", label: "About" },
  ];

  return (
    <View style={styles.tabs}>
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
            <Text
              numberOfLines={1}
              style={[styles.tabText, active && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
        <Text style={styles.eventEyebrow}>Upcoming</Text>
        <Text numberOfLines={1} style={styles.eventTitle}>
          {event.title}
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
          <SectionTitle title="Next drive" />
          <EventRow event={events[0]} />
        </>
      ) : null}

      <SectionTitle title="Recent activity" />
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

      <SectionTitle
        title="Garage"
        meta={vehicles.length === 1 ? "1 vehicle" : `${vehicles.length} vehicles`}
      />
      <Pressable
        accessibilityLabel="Open crew garage"
        accessibilityRole="button"
        onPress={() => router.push({ pathname: "/crew-garage", params: { id: crew.id } })}
        style={({ pressed }) => [styles.garageRow, pressed && styles.pressed]}
      >
        <CanonicalArtwork uri={vehicles[0]?.cover_image_url} style={styles.garageThumb} imageStyle={styles.garageThumbImage} icon="car-sport-outline" />
        <View style={styles.garageRowCopy}>
          <Text style={styles.garageTitle}>Garage</Text>
          <Text numberOfLines={1} style={styles.garageMeta}>{vehicles[0] ? vehicleName(vehicles[0]) : "No public vehicles yet"}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Pressable>
    
    </View>
  );
}

function EventsTab({ events }: { events: CrewEvent[] }) {
  return (
    <View style={styles.tabContent}>
      <SectionTitle title="Events" meta={`${events.length} upcoming`} />
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
      <SectionTitle title="Members" meta={`${members.length} total`} />
      {members.length ? (
        <View style={styles.memberList}>
          {members.map((member) => (
            <View key={member.user_id} style={styles.memberRow}>
              <CanonicalAvatar profile={member.profile} size={44} />
              <View style={styles.memberCopy}>
                <Text numberOfLines={1} style={styles.memberName}>
                  {profileName(member.profile)}
                </Text>
                <Text style={styles.memberRole}>{member.role}</Text>
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
      <SectionTitle title="About" />
      <View style={styles.aboutCard}>
        <Text style={styles.aboutText}>
          {crew.description ||
            "This crew has not added its story yet. Respect the road, the people and the location."}
        </Text>
      </View>

      <SectionTitle title="Details" />
      <View style={styles.factsCard}>
        {[
          ["Founder", profileName(owner)],
          ["City", crew.city || "Not specified"],
          ["Visibility", crew.is_public ? "Public" : "Private"],
          ["Membership", joinPolicyLabel(crew.join_policy)],
          ["Established", formatEstablished(crew.created_at)],
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
  const [actionsOpen, setActionsOpen] = useState(false);
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
        publicErrorMessage(
          crewResult.error || memberResult.error || eventResult.error,
          "Crew could not be loaded. Retry.",
        ),
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
    if (detailError)
      setError(
        publicErrorMessage(
          detailError,
          "Some crew details could not be loaded. Retry.",
        ),
      );

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
  const canManageCover = isOwner || myMembership?.role === "admin";

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

    if (result.error)
      setError(publicErrorMessage(result.error, "Crew could not be joined. Retry."));
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
          if (leaveError)
            setError(publicErrorMessage(leaveError, "Crew could not be left. Retry."));
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
    if (requestError)
      setError(publicErrorMessage(requestError, "Request could not be cancelled. Retry."));
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

  const changeCover = useCallback(async () => {
    if (!crew || !canManageCover || busy) return;
    setBusy(true);
    try {
      const asset = await chooseCoverAsset();
      if (!asset) return;

      const uploaded = await uploadEntityCover(asset, "crew", crew.id);
      try {
        await setEntityCover("crew", crew.id, uploaded.publicUrl);
      } catch (coverError) {
        await removeUploadedEntityCover(uploaded.path);
        throw coverError;
      }

      await removeEntityCoverObject(crew.cover_image_url, "crew", crew.id);
      await load();
    } catch (coverError) {
      Alert.alert(
        "Cover not changed",
        publicErrorMessage(coverError, "Unable to change this cover."),
      );
    } finally {
      setBusy(false);
    }
  }, [busy, canManageCover, crew, load]);

  const removeCover = useCallback(async () => {
    if (!crew || !canManageCover || !crew.cover_image_url || busy) return;
    setBusy(true);
    try {
      const previous = crew.cover_image_url;
      await setEntityCover("crew", crew.id, null);
      await removeEntityCoverObject(previous, "crew", crew.id);
      await load();
    } catch (coverError) {
      Alert.alert(
        "Cover not removed",
        publicErrorMessage(coverError, "Unable to remove this cover."),
      );
    } finally {
      setBusy(false);
    }
  }, [busy, canManageCover, crew, load]);

  const menuActions = useMemo<EntityAction[]>(() => {
    if (!crew) return [];

    const actions: EntityAction[] = [];
    if (canManageCover) {
      actions.push({
        key: "cover",
        label: crew.cover_image_url ? "Change cover" : "Choose cover",
        icon: "image-outline",
        disabled: busy,
        onPress: () => void changeCover(),
      });
      if (crew.cover_image_url) {
        actions.push({
          key: "remove-cover",
          label: "Remove cover",
          icon: "trash-outline",
          destructive: true,
          disabled: busy,
          onPress: () => void removeCover(),
        });
      }
    }

    actions.push({
      key: "share",
      label: "Share crew",
      icon: "share-outline",
      onPress: () => void shareCrew(),
    });

    if (isMember && !isOwner) {
      actions.push({
        key: "leave",
        label: "Leave crew",
        icon: "exit-outline",
        destructive: true,
        disabled: busy,
        onPress: leave,
      });
    }

    return actions;
  }, [
    busy,
    canManageCover,
    changeCover,
    crew,
    isMember,
    isOwner,
    leave,
    removeCover,
    shareCrew,
  ]);

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
            label="Go back"
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
        <CrewHeader onMore={() => setActionsOpen(true)} />

        <CrewHero
          artworkUri={artworkUri}
          crew={crew}
          members={members}
          membershipButton={membershipButton}
          owner={owner}
        />

        {error ? (
          <Pressable
            accessibilityLabel="Retry crew loading"
            accessibilityRole="button"
            onPress={() => void load()}
            style={styles.errorBanner}
          >
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

      <EntityActionSheet
        actions={menuActions}
        onClose={() => setActionsOpen(false)}
        title={crew.name}
        visible={actionsOpen}
      />
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 104, gap: spacing.sm },
  pressed: { opacity: 0.72 },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  heroMedia: {
    height: 104,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  heroImage: { borderRadius: radius.lg },
  heroIdentityBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  heroNameBlock: { flex: 1, minWidth: 0 },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: "800",
  },
  heroMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  founderName: {
    marginTop: 2,
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  membershipButton: { alignSelf: "center", minWidth: 96 },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  logoFallbackText: { color: colors.text, fontSize: 15, fontWeight: "800" },
  errorBanner: {
    minHeight: 44,
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  errorText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxs,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  tabTextActive: { color: colors.text, fontWeight: "700" },
  tabContent: { paddingHorizontal: spacing.md, gap: spacing.lg },
  sectionTitleRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: "700",
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  listGap: { gap: 0 },
  eventRow: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  eventArtwork: { width: 64, height: 56, borderRadius: radius.sm },
  eventArtworkImage: { borderRadius: radius.sm },
  eventShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  eventCopy: { flex: 1, minWidth: 0, gap: 2 },
  eventEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  eventTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: "700",
  },
  eventMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  activityCard: { gap: spacing.sm },
  activityLine: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
  activityMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  garageRow: {
    minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider,
  },
  garageThumb: { width: 72, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft },
  garageThumbImage: { borderRadius: radius.sm },
  garageRowCopy: { flex: 1, minWidth: 0 },
  garageTitle: { color: colors.text, ...typography.v2.row, fontWeight: "700" },
  garageMeta: { marginTop: 2, color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  memberList: { overflow: "hidden" },  memberList: { overflow: "hidden" },
  memberRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { color: colors.text, ...typography.v2.row, fontWeight: "600" },
  memberRole: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  aboutCard: { paddingVertical: spacing.xs },
  aboutText: { color: colors.text, ...typography.v2.body },
  factsCard: { overflow: "hidden" },
  factRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  factLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  factValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "right",
  },
  emptyCard: {
    minHeight: 132,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
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
