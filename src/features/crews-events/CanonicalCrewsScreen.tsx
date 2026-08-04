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

function ownerName(row: CrewRow) {
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
  return "JOIN CREW";
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

  return (
    <Pressable
      accessibilityLabel={`Open ${crew.name}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/crew/[id]", params: { id: crew.id } })}
      style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}
    >
      <CanonicalArtwork
        uri={crew.cover_image_url}
        style={styles.heroArtwork}
        imageStyle={styles.heroArtworkImage}
        icon="people-outline"
      >
        <View style={styles.heroShadeTop} />
        <View style={styles.heroShadeBottom} />
        <View style={styles.heroTopRow}>
          <CanonicalPill
            label={crew.isCurrentUserMember ? "YOUR CREW" : "FEATURED"}
          />
          <CanonicalPill
            label={event ? "ACTIVE" : "DISCOVER"}
            tone={event ? "accent" : "neutral"}
          />
        </View>
        <View style={styles.heroCopy}>
          <View style={styles.heroIdentity}>
            <CrewLogo crew={crew} size={42} />
            <View style={styles.heroNameBlock}>
              <Text numberOfLines={1} style={styles.heroTitle}>
                {crew.name.toUpperCase()}
              </Text>
              <Text numberOfLines={1} style={styles.heroMeta}>
                {(crew.city || "NOXA").toUpperCase()} · {crew.memberCount} MEMBERS
              </Text>
            </View>
          </View>

          <View style={styles.heroSocialRow}>
            <CanonicalAvatarStack total={crew.memberCount} max={3} size={30} />
            <Text numberOfLines={1} style={styles.heroSignal}>
              {event ? `${event.title} · ${formatDrive(event.starts_at)}` : "New activity this week"}
            </Text>
          </View>

          <CanonicalPrimaryButton
            compact
            disabled={!canAction || busy}
            loading={busy}
            label={label}
            variant={crew.isCurrentUserMember ? "surface" : "accent"}
            onPress={() => onAction(crew)}
          />
        </View>
      </CanonicalArtwork>
    </Pressable>
  );
}

function CompactCrewCard({ crew }: { crew: Crew }) {
  return (
    <Pressable
      accessibilityLabel={`Open ${crew.name}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/crew/[id]", params: { id: crew.id } })}
      style={({ pressed }) => [styles.compactCard, pressed && styles.pressed]}
    >
      <CanonicalArtwork
        uri={crew.cover_image_url}
        style={styles.compactArtwork}
        imageStyle={styles.compactArtworkImage}
        icon="car-sport-outline"
      >
        <View style={styles.compactShade} />
        <View style={styles.compactAccent} />
      </CanonicalArtwork>
      <View style={styles.compactBody}>
        <View style={styles.compactTitleRow}>
          <Text numberOfLines={1} style={styles.compactTitle}>
            {crew.name.toUpperCase()}
          </Text>
          <CrewLogo crew={crew} size={30} />
        </View>
        <Text numberOfLines={1} style={styles.compactMeta}>
          {crew.city || "NOXA"} · {crew.memberCount}
        </Text>
        <Text numberOfLines={1} style={styles.compactSignal}>
          {crew.pendingJoinRequestId
            ? "Join request pending"
            : crew.isCurrentUserMember
              ? "Your community"
              : crew.join_policy === "open"
                ? "Open to join"
                : "Active this week"}
        </Text>
      </View>
    </Pressable>
  );
}

function UpcomingDrive({ event, crew }: { event: CrewEvent; crew?: Crew }) {
  const date = new Date(event.starts_at);
  const day = new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" })
    .format(date)
    .toUpperCase();

  return (
    <Pressable
      accessibilityLabel={`Open ${event.title}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/event-details", params: { id: event.id } })}
      style={({ pressed }) => [styles.driveCard, pressed && styles.pressed]}
    >
      <View style={styles.dateTile}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
      </View>
      <View style={styles.driveCopy}>
        <Text style={styles.driveEyebrow}>UPCOMING CREW DRIVE</Text>
        <Text numberOfLines={1} style={styles.driveTitle}>
          {event.title.toUpperCase()}
        </Text>
        <Text numberOfLines={1} style={styles.driveMeta}>
          {formatDrive(event.starts_at)} · {event.location_name}
        </Text>
        <View style={styles.driveFooter}>
          <CanonicalAvatarStack total={crew?.memberCount ?? 0} max={3} size={25} />
          <Text style={styles.driveSignal}>
            {crew ? `${crew.name} is going` : "Crew members are going"}
          </Text>
        </View>
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

  const canSubmit = name.trim().length >= 2 && !creating;

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
          <View style={styles.previewCard}>
            <View style={styles.previewLogo}>
              <Text style={styles.previewLogoText}>
                {initials(name || "NOXA")}
              </Text>
            </View>
            <Text style={styles.previewTitle}>
              {(name || "YOUR CREW").toUpperCase()}
            </Text>
            <Text style={styles.previewMeta}>
              {(city || "YOUR CITY").toUpperCase()}
            </Text>
          </View>

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
            disabled={!canSubmit}
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

    const crewsQuery = supabase
      .from("crews")
      .select(
        "id,owner_id,name,description,city,logo_url,cover_image_url,is_public,join_policy,created_at,profiles:owner_id(display_name,username)",
      )
      .order("created_at", { ascending: false });

    const membersQuery = supabase
      .from("crew_members")
      .select("crew_id,user_id,role");

    const requestsQuery = currentUserId
      ? supabase
          .from("crew_join_requests")
          .select("id,crew_id,user_id,status")
          .eq("user_id", currentUserId)
          .eq("status", "pending")
      : Promise.resolve({ data: [], error: null });

    const eventsQuery = supabase
      .from("events")
      .select("id,crew_id,title,location_name,starts_at,cover_image_url")
      .not("crew_id", "is", null)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(8);

    const profilesQuery = supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .limit(8);

    const [crewsResult, membersResult, requestsResult, eventsResult, profilesResult] =
      await Promise.all([
        crewsQuery,
        membersQuery,
        requestsQuery,
        eventsQuery,
        profilesQuery,
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
      if (member.user_id === currentUserId) roleByCrew.set(member.crew_id, member.role);
    }
    const requestByCrew = new Map(
      requestRows.map((request) => [request.crew_id, request.id]),
    );

    setCrews(
      rows.map((row) => {
        const role = roleByCrew.get(row.id) ?? null;
        return {
          ...row,
          ownerName: ownerName(row),
          memberCount: memberCount.get(row.id) ?? 0,
          currentUserRole: role,
          isCurrentUserMember: role !== null,
          pendingJoinRequestId: requestByCrew.get(row.id) ?? null,
        };
      }),
    );
    setEvents((eventsResult.data ?? []) as CrewEvent[]);
    setProfiles((profilesResult.data ?? []) as CanonicalProfile[]);
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
  const hero = myCrews[0] ?? discovery[0] ?? null;
  const activeNear = (hero ? crews.filter((crew) => crew.id !== hero.id) : crews).slice(0, 4);
  const nextEvent = events[0] ?? null;
  const nextEventCrew = nextEvent
    ? crews.find((crew) => crew.id === nextEvent.crew_id)
    : undefined;

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
          <Text style={styles.stateTitle}>Build the first crew</Text>
          <Text style={styles.stateText}>
            Create a place for drivers, cars and upcoming drives.
          </Text>
          <CanonicalPrimaryButton
            label="CREATE CREW"
            onPress={() => setCreateVisible(true)}
          />
        </View>
      );
    }

    return (
      <>
        <HeroCrew
          busy={busyCrewId === hero.id}
          crew={hero}
          event={events.find((event) => event.crew_id === hero.id) ?? null}
          onAction={handleAction}
        />

        {activeNear.length ? (
          <>
            <CanonicalSectionHeader title="ACTIVE NEAR YOU" action="SEE ALL" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {activeNear.map((crew) => (
                <CompactCrewCard key={crew.id} crew={crew} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {nextEvent ? (
          <UpcomingDrive event={nextEvent} crew={nextEventCrew} />
        ) : null}

        <View style={styles.activityStrip}>
          <View>
            <Text style={styles.activityEyebrow}>PEOPLE & ACTIVITY</Text>
            <Text style={styles.activityText}>
              {myCrews.length
                ? `${myCrews.length} crew${myCrews.length === 1 ? "" : "s"} in your garage`
                : "Discover drivers who share your road"}
            </Text>
          </View>
          <CanonicalAvatarStack profiles={profiles} total={profiles.length} max={4} size={30} />
        </View>

        {discovery.length > activeNear.length ? (
          <>
            <CanonicalSectionHeader title="DISCOVERY" />
            <View style={styles.discoveryList}>
              {discovery.slice(4, 7).map((crew) => (
                <Pressable
                  key={crew.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: "/crew/[id]", params: { id: crew.id } })
                  }
                  style={({ pressed }) => [
                    styles.discoveryRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <CrewLogo crew={crew} size={42} />
                  <View style={styles.discoveryCopy}>
                    <Text numberOfLines={1} style={styles.discoveryTitle}>
                      {crew.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.discoveryMeta}>
                      {crew.city || "NOXA"} · {crew.memberCount} members
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textSubtle}
                  />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </>
    );
  }, [
    activeNear,
    busyCrewId,
    discovery,
    events,
    handleAction,
    hero,
    loading,
    myCrews.length,
    nextEvent,
    nextEventCrew,
    profiles,
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

        {error ? (
          <Pressable onPress={() => setError(null)} style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primaryHover} />
            <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
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
    minHeight: 286,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  heroArtworkImage: { borderRadius: radius.hero - 1 },
  heroShadeTop: {
    ...StyleSheet.absoluteFillObject,
    bottom: "44%",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  heroShadeBottom: {
    ...StyleSheet.absoluteFillObject,
    top: "38%",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  heroCopy: {
    gap: spacing.sm,
  },
  heroIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroNameBlock: { flex: 1 },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 28,
    lineHeight: 32,
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
  heroSocialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroSignal: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  logoFallbackText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
  },
  horizontalList: {
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  compactCard: {
    width: 176,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  compactArtwork: {
    height: 96,
  },
  compactArtworkImage: {
    borderTopLeftRadius: radius.lg - 1,
    borderTopRightRadius: radius.lg - 1,
  },
  compactShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  compactAccent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 7,
    backgroundColor: colors.primary,
    opacity: 0.68,
  },
  compactBody: {
    gap: spacing.xxs,
    padding: spacing.sm,
  },
  compactTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  compactTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "900",
  },
  compactMeta: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  compactSignal: {
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 14,
  },
  driveCard: {
    minHeight: 142,
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
    width: 58,
    height: 74,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  dateDay: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 27,
    lineHeight: 30,
    fontWeight: "900",
  },
  dateMonth: {
    color: colors.primaryHover,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  driveCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
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
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "900",
  },
  driveMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  driveFooter: {
    marginTop: spacing.xxs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  driveSignal: {
    flex: 1,
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 14,
  },
  activityStrip: {
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
  activityEyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  activityText: {
    marginTop: spacing.xxs,
    maxWidth: 220,
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  discoveryList: {
    gap: spacing.xs,
  },
  discoveryRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  discoveryCopy: { flex: 1 },
  discoveryTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  discoveryMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  modalContent: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  previewCard: {
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    overflow: "hidden",
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  previewLogo: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  previewLogoText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  previewTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 23,
    lineHeight: 27,
    fontWeight: "900",
  },
  previewMeta: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  field: {
    gap: spacing.xs,
  },
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
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
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
  optionTextActive: {
    color: colors.text,
  },
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
