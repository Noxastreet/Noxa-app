import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NoxaScreen } from "@/src/components/ui";
import {
  CanonicalArtwork,
  CanonicalAvatarStack,
  CanonicalPill,
  CanonicalPrimaryButton,
  CanonicalSectionHeader,
  initials,
  type CanonicalProfile,
} from "@/src/features/crews-events/CanonicalPrimitives";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type CrewRole = "owner" | "admin" | "member";
type JoinPolicy = "open" | "approval" | "invite_only";
type CrewFilter = "mine" | "discover";

type CrewRow = {
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
  profiles?:
    | { display_name: string | null; username: string | null }
    | { display_name: string | null; username: string | null }[]
    | null;
};

type CrewMemberRow = {
  crew_id: string;
  user_id: string;
  role: CrewRole;
};

type JoinRequestRow = {
  id: string;
  crew_id: string;
  user_id: string;
  status: string;
};

type CrewEvent = {
  id: string;
  crew_id: string | null;
  title: string;
  location_name: string;
  starts_at: string;
  cover_image_url: string | null;
};

type Crew = CrewRow & {
  ownerName: string;
  memberCount: number;
  currentUserRole: CrewRole | null;
  isCurrentUserMember: boolean;
  pendingJoinRequestId: string | null;
};

function getOwnerName(row: CrewRow) {
  const relation = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return relation?.display_name || relation?.username || "NOXA driver";
}

function formatDrive(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function CrewLogo({ crew, size = 42 }: { crew: Crew; size?: number }) {
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

function actionLabel(crew: Crew) {
  if (crew.currentUserRole === "owner") return "OWNER";
  if (crew.isCurrentUserMember) return "JOINED";
  if (crew.pendingJoinRequestId) return "REQUESTED";
  if (!crew.is_public || crew.join_policy === "invite_only") return "INVITE ONLY";
  if (crew.join_policy === "approval") return "REQUEST";
  return "JOIN";
}

function CrewFilterControl({
  value,
  myCount,
  discoverCount,
  onChange,
}: {
  value: CrewFilter;
  myCount: number;
  discoverCount: number;
  onChange: (value: CrewFilter) => void;
}) {
  return (
    <View style={styles.filterControl}>
      {[
        { value: "mine" as const, label: "YOUR CREWS", count: myCount },
        { value: "discover" as const, label: "DISCOVER", count: discoverCount },
      ].map((item) => {
        const active = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.value)}
            style={({ pressed }) => [
              styles.filterButton,
              active && styles.filterButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.filterText, active && styles.filterTextActive]}>
              {item.label}
            </Text>
            <View style={[styles.filterCount, active && styles.filterCountActive]}>
              <Text
                style={[
                  styles.filterCountText,
                  active && styles.filterCountTextActive,
                ]}
              >
                {item.count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function HeroCrew({
  crew,
  event,
  busy,
  onAction,
}: {
  crew: Crew;
  event: CrewEvent | null;
  busy: boolean;
  onAction: (crew: Crew) => void;
}) {
  const label = actionLabel(crew);
  const canAction = !["OWNER", "INVITE ONLY"].includes(label);
  const artworkUri = crew.cover_image_url || event?.cover_image_url || null;

  return (
    <Pressable
      accessibilityLabel={`Open ${crew.name}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/crew/[id]", params: { id: crew.id } })
      }
      style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}
    >
      <CanonicalArtwork
        uri={artworkUri}
        style={styles.heroArtwork}
        imageStyle={styles.heroArtworkImage}
        icon="people-outline"
      >
        <View style={styles.heroShadeTop} />
        <View style={styles.heroShadeBottom} />

        <View style={styles.heroTopRow}>
          <CanonicalPill
            label={crew.isCurrentUserMember ? "YOUR CREW" : "NEARBY"}
            tone={event ? "accent" : "neutral"}
          />
          <View style={styles.heroMenuButton}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
          </View>
        </View>

        <View style={styles.heroCopy}>
          <View style={styles.heroIdentity}>
            <CrewLogo crew={crew} size={46} />
            <View style={styles.heroNameBlock}>
              <Text numberOfLines={1} style={styles.heroTitle}>
                {crew.name.toUpperCase()}
              </Text>
              <Text numberOfLines={1} style={styles.heroMeta}>
                {(crew.city || "NOXA").toUpperCase()} · {crew.memberCount} MEMBERS
              </Text>
            </View>
          </View>

          {event ? (
            <Text numberOfLines={1} style={styles.heroSignal}>
              NEXT: {event.title.toUpperCase()} · {formatDrive(event.starts_at)}
            </Text>
          ) : null}

          <View style={styles.heroFooter}>
            <View style={styles.organizerBlock}>
              <Text style={styles.organizerEyebrow}>ORGANIZER</Text>
              <Text numberOfLines={1} style={styles.organizerName}>
                {crew.ownerName}
              </Text>
            </View>
            <View style={styles.heroActionArea}>
              <CanonicalAvatarStack total={crew.memberCount} max={3} size={27} />
              <CanonicalPrimaryButton
                compact
                disabled={!canAction || busy}
                loading={busy}
                label={label}
                variant={crew.isCurrentUserMember ? "surface" : "accent"}
                onPress={() => onAction(crew)}
              />
            </View>
          </View>
        </View>
      </CanonicalArtwork>
    </Pressable>
  );
}

function CompactCrewCard({ crew, event }: { crew: Crew; event?: CrewEvent }) {
  return (
    <Pressable
      accessibilityLabel={`Open ${crew.name}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/crew/[id]", params: { id: crew.id } })
      }
      style={({ pressed }) => [styles.compactCard, pressed && styles.pressed]}
    >
      <CanonicalArtwork
        uri={crew.cover_image_url || event?.cover_image_url}
        style={styles.compactArtwork}
        imageStyle={styles.compactArtworkImage}
        icon="car-sport-outline"
      >
        <View style={styles.compactShade} />
        <View style={styles.compactTop}>
          <CanonicalPill
            label={crew.isCurrentUserMember ? "YOURS" : "NEARBY"}
          />
          <Text style={styles.compactMemberCount}>{crew.memberCount}</Text>
        </View>
        <View style={styles.compactBottom}>
          <CrewLogo crew={crew} size={34} />
          <View style={styles.compactCopy}>
            <Text numberOfLines={1} style={styles.compactTitle}>
              {crew.name.toUpperCase()}
            </Text>
            <Text numberOfLines={1} style={styles.compactMeta}>
              {crew.city || "NOXA"} · {crew.ownerName}
            </Text>
          </View>
        </View>
      </CanonicalArtwork>
    </Pressable>
  );
}

function UpcomingDrive({ event, crew }: { event: CrewEvent; crew?: Crew }) {
  const date = new Date(event.starts_at);
  const day = new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();

  return (
    <Pressable
      accessibilityLabel={`Open ${event.title}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/event-details", params: { id: event.id } })
      }
      style={({ pressed }) => [styles.driveCard, pressed && styles.pressed]}
    >
      <View style={styles.dateTile}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
      </View>
      <View style={styles.driveCopy}>
        <Text style={styles.driveEyebrow}>UPCOMING FROM YOUR CREW</Text>
        <Text numberOfLines={1} style={styles.driveTitle}>
          {event.title.toUpperCase()}
        </Text>
        <Text numberOfLines={1} style={styles.driveMeta}>
          {formatDrive(event.starts_at)} · {event.location_name}
        </Text>
        <Text numberOfLines={1} style={styles.driveSignal}>
          {crew ? `Hosted by ${crew.name}` : "Crew members are invited"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

function CreateCrewModal({
  visible,
  creating,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    city: string;
    description: string;
    isPublic: boolean;
    joinPolicy: JoinPolicy;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>("approval");

  const close = () => {
    if (creating) return;
    setName("");
    setCity("");
    setDescription("");
    setIsPublic(true);
    setJoinPolicy("approval");
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      presentationStyle="fullScreen"
      visible={visible}
      onRequestClose={close}
    >
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={close}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.modalTitle}>CREATE CREW</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.modalContent}
        >
          <CanonicalArtwork style={styles.previewCard} icon="people-outline">
            <View style={styles.previewShade} />
            <View style={styles.previewCopy}>
              <View style={styles.previewLogo}>
                <Text style={styles.previewLogoText}>
                  {initials(name || "NOXA")}
                </Text>
              </View>
              <View>
                <Text numberOfLines={1} style={styles.previewTitle}>
                  {(name || "YOUR CREW").toUpperCase()}
                </Text>
                <Text style={styles.previewMeta}>
                  {(city || "YOUR CITY").toUpperCase()}
                </Text>
              </View>
            </View>
          </CanonicalArtwork>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CREW NAME</Text>
            <TextInput
              autoCapitalize="words"
              maxLength={60}
              onChangeText={setName}
              placeholder="Apex Collective"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              style={styles.input}
              value={name}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CITY</Text>
            <TextInput
              autoCapitalize="words"
              maxLength={80}
              onChangeText={setCity}
              placeholder="Thessaloniki"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              style={styles.input}
              value={city}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              maxLength={500}
              multiline
              onChangeText={setDescription}
              placeholder="What brings your crew together?"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              style={[styles.input, styles.textArea]}
              value={description}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>ACCESS</Text>
            <View style={styles.optionRow}>
              {[
                { label: "PUBLIC", value: true },
                { label: "PRIVATE", value: false },
              ].map((option) => (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.value === isPublic }}
                  onPress={() => setIsPublic(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    option.value === isPublic && styles.optionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      option.value === isPublic && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {isPublic ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>JOIN POLICY</Text>
              <View style={styles.optionRow}>
                {[
                  { label: "OPEN", value: "open" as JoinPolicy },
                  { label: "APPROVAL", value: "approval" as JoinPolicy },
                  { label: "INVITE", value: "invite_only" as JoinPolicy },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: option.value === joinPolicy }}
                    onPress={() => setJoinPolicy(option.value)}
                    style={({ pressed }) => [
                      styles.option,
                      option.value === joinPolicy && styles.optionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        option.value === joinPolicy && styles.optionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.modalFooter}>
          <CanonicalPrimaryButton
            disabled={name.trim().length < 2 || creating}
            loading={creating}
            label="CREATE CREW"
            onPress={() =>
              onSubmit({
                name,
                city,
                description,
                isPublic,
                joinPolicy: isPublic ? joinPolicy : "invite_only",
              })
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function CanonicalCrewsScreen() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [events, setEvents] = useState<CrewEvent[]>([]);
  const [profiles, setProfiles] = useState<CanonicalProfile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CrewFilter>("mine");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyCrewId, setBusyCrewId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id ?? null;
    setUserId(currentUserId);

    const requestsQuery = currentUserId
      ? supabase
          .from("crew_join_requests")
          .select("id,crew_id,user_id,status")
          .eq("user_id", currentUserId)
          .eq("status", "pending")
      : Promise.resolve({ data: [], error: null });

    const [crewsResult, membersResult, requestsResult, eventsResult, profilesResult] =
      await Promise.all([
        supabase
          .from("crews")
          .select(
            "id,owner_id,name,description,city,logo_url,cover_image_url,is_public,join_policy,created_at,profiles:owner_id(display_name,username)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("crew_members").select("crew_id,user_id,role"),
        requestsQuery,
        supabase
          .from("events")
          .select("id,crew_id,title,location_name,starts_at,cover_image_url")
          .not("crew_id", "is", null)
          .eq("status", "scheduled")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(8),
        supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .limit(8),
      ]);

    const firstError =
      crewsResult.error ||
      membersResult.error ||
      requestsResult.error ||
      eventsResult.error ||
      profilesResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const memberRows = (membersResult.data ?? []) as CrewMemberRow[];
    const requestRows = (requestsResult.data ?? []) as JoinRequestRow[];
    const rows = (crewsResult.data ?? []) as CrewRow[];
    const memberCount = new Map<string, number>();
    const roleByCrew = new Map<string, CrewRole>();

    for (const member of memberRows) {
      memberCount.set(member.crew_id, (memberCount.get(member.crew_id) ?? 0) + 1);
      if (member.user_id === currentUserId) {
        roleByCrew.set(member.crew_id, member.role);
      }
    }

    const requestByCrew = new Map(
      requestRows.map((request) => [request.crew_id, request.id]),
    );
    const models = rows.map((row) => {
      const role = roleByCrew.get(row.id) ?? null;
      return {
        ...row,
        ownerName: getOwnerName(row),
        memberCount: memberCount.get(row.id) ?? 0,
        currentUserRole: role,
        isCurrentUserMember: role !== null,
        pendingJoinRequestId: requestByCrew.get(row.id) ?? null,
      } satisfies Crew;
    });

    setCrews(models);
    setEvents((eventsResult.data ?? []) as CrewEvent[]);
    setProfiles((profilesResult.data ?? []) as CanonicalProfile[]);
    if (!models.some((crew) => crew.isCurrentUserMember)) setFilter("discover");
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const myCrews = crews.filter((crew) => crew.isCurrentUserMember);
  const discovery = crews.filter((crew) => !crew.isCurrentUserMember);
  const visibleCrews = filter === "mine" ? myCrews : discovery;
  const hero = visibleCrews[0] ?? null;
  const secondaryCrews = visibleCrews.slice(1, 5);
  const nextEvent =
    filter === "mine"
      ? events.find((event) => myCrews.some((crew) => crew.id === event.crew_id)) ?? null
      : null;
  const nextEventCrew = nextEvent
    ? crews.find((crew) => crew.id === nextEvent.crew_id)
    : undefined;

  const eventForCrew = useCallback(
    (crewId: string) => events.find((event) => event.crew_id === crewId),
    [events],
  );

  const handleAction = useCallback(
    async (crew: Crew) => {
      if (!userId || busyCrewId) return;
      const label = actionLabel(crew);

      if (label === "JOINED") {
        Alert.alert("Leave crew?", `Leave ${crew.name}?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: async () => {
              setBusyCrewId(crew.id);
              const { error: leaveError } = await supabase
                .from("crew_members")
                .delete()
                .eq("crew_id", crew.id)
                .eq("user_id", userId);
              if (leaveError) setError(leaveError.message);
              else await load(false);
              setBusyCrewId(null);
            },
          },
        ]);
        return;
      }

      setBusyCrewId(crew.id);
      setError(null);

      if (label === "REQUESTED" && crew.pendingJoinRequestId) {
        const { error: cancelError } = await supabase
          .from("crew_join_requests")
          .delete()
          .eq("id", crew.pendingJoinRequestId);
        if (cancelError) setError(cancelError.message);
      } else if (crew.join_policy === "approval") {
        const { error: requestError } = await supabase
          .from("crew_join_requests")
          .insert({ crew_id: crew.id, user_id: userId, status: "pending" });
        if (requestError) setError(requestError.message);
      } else if (crew.join_policy === "open" && crew.is_public) {
        const { error: joinError } = await supabase
          .from("crew_members")
          .insert({ crew_id: crew.id, user_id: userId, role: "member" });
        if (joinError) setError(joinError.message);
      }

      await load(false);
      setBusyCrewId(null);
    },
    [busyCrewId, load, userId],
  );

  const createCrew = useCallback(
    async (input: {
      name: string;
      city: string;
      description: string;
      isPublic: boolean;
      joinPolicy: JoinPolicy;
    }) => {
      if (!userId || creating) return;
      setCreating(true);
      setError(null);

      const { data, error: createError } = await supabase
        .from("crews")
        .insert({
          owner_id: userId,
          name: input.name.trim(),
          city: input.city.trim() || null,
          description: input.description.trim() || null,
          is_public: input.isPublic,
          join_policy: input.joinPolicy,
        })
        .select("id")
        .single();

      if (createError) {
        setError(createError.message);
        setCreating(false);
        return;
      }

      const { error: membershipError } = await supabase
        .from("crew_members")
        .insert({ crew_id: data.id, user_id: userId, role: "owner" });

      if (membershipError) {
        setError(membershipError.message);
      } else {
        setCreateVisible(false);
        setFilter("mine");
        await load(false);
        router.push({ pathname: "/crew/[id]", params: { id: data.id } });
      }
      setCreating(false);
    },
    [creating, load, userId],
  );

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading crews…</Text>
        </View>
      );
    }

    if (!hero) {
      return (
        <View style={styles.stateCard}>
          <Ionicons name="people-outline" size={36} color={colors.primary} />
          <Text style={styles.stateTitle}>
            {filter === "mine" ? "No crews yet" : "Nothing nearby yet"}
          </Text>
          <Text style={styles.stateText}>
            {filter === "mine"
              ? "Create a crew or discover a community that matches your road."
              : "New public crews will appear here when drivers create them."}
          </Text>
          <CanonicalPrimaryButton
            label={filter === "mine" ? "CREATE CREW" : "REFRESH"}
            variant={filter === "mine" ? "accent" : "surface"}
            onPress={() =>
              filter === "mine" ? setCreateVisible(true) : void load(false)
            }
          />
        </View>
      );
    }

    return (
      <>
        <HeroCrew
          busy={busyCrewId === hero.id}
          crew={hero}
          event={eventForCrew(hero.id) ?? null}
          onAction={handleAction}
        />

        {secondaryCrews.length ? (
          <>
            <CanonicalSectionHeader
              title={filter === "mine" ? "MORE OF YOUR CREWS" : "ACTIVE NEAR YOU"}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {secondaryCrews.map((crew) => (
                <CompactCrewCard
                  key={crew.id}
                  crew={crew}
                  event={eventForCrew(crew.id)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        {nextEvent ? (
          <UpcomingDrive event={nextEvent} crew={nextEventCrew} />
        ) : null}

        <View style={styles.peopleStrip}>
          <View style={styles.peopleCopy}>
            <Text style={styles.peopleEyebrow}>
              {filter === "mine" ? "YOUR COMMUNITY" : "PEOPLE NEARBY"}
            </Text>
            <Text style={styles.peopleText}>
              {filter === "mine"
                ? `${myCrews.length} crew${myCrews.length === 1 ? "" : "s"} connected to your garage`
                : `${discovery.length} public crew${discovery.length === 1 ? "" : "s"} to discover`}
            </Text>
          </View>
          <CanonicalAvatarStack
            profiles={profiles}
            total={profiles.length}
            max={4}
            size={30}
          />
        </View>
      </>
    );
  }, [
    busyCrewId,
    discovery.length,
    eventForCrew,
    filter,
    handleAction,
    hero,
    load,
    loading,
    myCrews.length,
    nextEvent,
    nextEventCrew,
    profiles,
    secondaryCrews,
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
            <Text style={styles.pageTitle}>CREWS</Text>
            <Text style={styles.pageSubtitle}>Find your people. Drive together.</Text>
          </View>
          <Pressable
            accessibilityLabel="Create crew"
            accessibilityRole="button"
            onPress={() => setCreateVisible(true)}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={17} color={colors.text} />
            <Text style={styles.createText}>CREATE</Text>
          </Pressable>
        </View>

        <CrewFilterControl
          discoverCount={discovery.length}
          myCount={myCrews.length}
          onChange={setFilter}
          value={filter}
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

        {content}
      </ScrollView>

      <CreateCrewModal
        creating={creating}
        onClose={() => setCreateVisible(false)}
        onSubmit={createCrew}
        visible={createVisible}
      />
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
  filterControl: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xxs,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterButton: {
    minHeight: 42,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.button,
  },
  filterButtonActive: { backgroundColor: colors.surfaceRaised },
  filterText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.45,
  },
  filterTextActive: { color: colors.text },
  filterCount: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxs,
    borderRadius: 11,
    backgroundColor: colors.surfacePressed,
  },
  filterCountActive: { backgroundColor: colors.primaryMuted },
  filterCountText: { color: colors.textSubtle, fontSize: 9, fontWeight: "900" },
  filterCountTextActive: { color: colors.text },
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
  errorText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 16 },
  stateCard: {
    minHeight: 260,
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
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.hero,
    backgroundColor: colors.background,
  },
  heroArtwork: {
    minHeight: 278,
    justifyContent: "flex-end",
    padding: spacing.md,
    paddingTop: 80,
  },
  heroArtworkImage: { borderRadius: radius.hero - 1 },
  heroShadeTop: {
    ...StyleSheet.absoluteFillObject,
    bottom: "48%",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  heroShadeBottom: {
    ...StyleSheet.absoluteFillObject,
    top: "34%",
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
  heroMenuButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(6,6,10,0.62)",
  },
  heroCopy: { gap: spacing.sm },
  heroIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroNameBlock: { flex: 1 },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroMeta: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  heroSignal: {
    color: colors.primaryHover,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  organizerBlock: { flex: 1, minWidth: 0 },
  organizerEyebrow: {
    color: colors.textSubtle,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.45,
  },
  organizerName: {
    marginTop: 2,
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  heroActionArea: { alignItems: "flex-end", gap: spacing.xs },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  logoFallbackText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  horizontalList: { gap: spacing.md, paddingRight: spacing.md },
  compactCard: {
    width: 190,
    height: 158,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  compactArtwork: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  compactArtworkImage: { borderRadius: radius.lg - 1 },
  compactShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  compactTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  compactMemberCount: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
  },
  compactBottom: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  compactCopy: { flex: 1, minWidth: 0 },
  compactTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 16,
    lineHeight: 19,
    fontWeight: "900",
  },
  compactMeta: { color: colors.textMuted, fontSize: 9, lineHeight: 12 },
  driveCard: {
    minHeight: 126,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
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
    color: colors.primaryHover,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.35,
  },
  driveCopy: { flex: 1, gap: spacing.xxs },
  driveEyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  driveTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
  },
  driveMeta: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  driveSignal: { color: colors.textSubtle, fontSize: 10, lineHeight: 14 },
  peopleStrip: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  peopleCopy: { flex: 1 },
  peopleEyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  peopleText: {
    marginTop: spacing.xxs,
    maxWidth: 230,
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  modalScreen: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  modalContent: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
  previewCard: {
    minHeight: 176,
    justifyContent: "flex-end",
    padding: spacing.md,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  previewCopy: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  previewLogo: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  previewLogoText: { color: colors.text, fontSize: 15, fontWeight: "900" },
  previewTitle: {
    maxWidth: 230,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
  },
  previewMeta: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  field: { gap: spacing.xs },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  option: {
    minHeight: 40,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  optionText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  optionTextActive: { color: colors.text },
  modalFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
});
