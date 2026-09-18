import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NoxaIconButton, NoxaScreen } from "@/src/components/ui";
import {
  CanonicalArtwork,
  CanonicalPrimaryButton,
  initials,
} from "@/src/features/crews-events/CanonicalPrimitives";
import { getCurrentSessionUser, supabase } from "@/src/lib/supabase";
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
        { value: "mine" as const, label: "Your crews", count: myCount },
        { value: "discover" as const, label: "Discover", count: discoverCount },
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

function CrewListRow({
  crew,
  event,
}: {
  crew: Crew;
  event?: CrewEvent;
}) {
  const membership =
    crew.currentUserRole === "owner"
      ? "Owner"
      : crew.isCurrentUserMember
        ? "Joined"
        : crew.pendingJoinRequestId
          ? "Requested"
          : null;

  return (
    <Pressable
      accessibilityLabel={`Open ${crew.name}`}
      accessibilityRole="button"
      accessibilityHint="Opens crew details"
      onPress={() =>
        router.push({ pathname: "/crew/[id]", params: { id: crew.id } })
      }
      style={({ pressed }) => [styles.crewRow, pressed && styles.pressed]}
    >
      <CrewLogo crew={crew} size={48} />
      <View style={styles.crewRowCopy}>
        <View style={styles.crewTitleLine}>
          <Text numberOfLines={1} style={styles.crewRowTitle}>
            {crew.name}
          </Text>
          {membership ? (
            <Text style={styles.membershipText}>{membership}</Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.crewRowMeta}>
          {crew.city || "Location not set"} · {crew.memberCount} {crew.memberCount === 1 ? "member" : "members"}
        </Text>
        {event ? (
          <Text numberOfLines={1} style={styles.crewNextDrive}>
            Next: {event.title} · {formatDrive(event.starts_at)}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

function UpcomingDrive({ event, crew }: { event: CrewEvent; crew?: Crew }) {
  const date = new Date(event.starts_at);
  const day = new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" })
    .format(date)
    .replace(".", "")
    .replace(".", "");

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
        <Text style={styles.driveEyebrow}>Upcoming</Text>
        <Text numberOfLines={1} style={styles.driveTitle}>
          {event.title}
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
  const insets = useSafeAreaInsets();
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
      <View style={styles.modalScreen}>
        <View
          style={[
            styles.modalHeader,
            { height: 58 + insets.top, paddingTop: insets.top },
          ]}
        >
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={close}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.modalTitle}>Create Crew</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.modalContent}
        >
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Crew name</Text>
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
            <Text style={styles.fieldLabel}>City</Text>
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
            <Text style={styles.fieldLabel}>Description</Text>
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
            <Text style={styles.fieldLabel}>Access</Text>
            <View style={styles.optionRow}>
              {[
                { label: "Public", value: true },
                { label: "Private", value: false },
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
              <Text style={styles.fieldLabel}>Join policy</Text>
              <View style={styles.optionRow}>
                {[
                  { label: "Open", value: "open" as JoinPolicy },
                  { label: "Approval", value: "approval" as JoinPolicy },
                  { label: "Invite", value: "invite_only" as JoinPolicy },
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

        <View
          style={[
            styles.modalFooter,
            { paddingBottom: Math.max(spacing.xl, insets.bottom) },
          ]}
        >
          <CanonicalPrimaryButton
            disabled={name.trim().length < 2 || creating}
            loading={creating}
            label="Create crew"
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
      </View>
    </Modal>
  );
}

export default function CanonicalCrewsScreen() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [events, setEvents] = useState<CrewEvent[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CrewFilter>("mine");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);

    const currentUserId = (await getCurrentSessionUser())?.id ?? null;
    setUserId(currentUserId);

    const crewsResult = await supabase
      .from("crews")
      .select(
        "id,owner_id,name,description,city,logo_url,cover_image_url,is_public,join_policy,created_at,profiles:owner_id(display_name,username)",
      )
      .order("created_at", { ascending: false });

    if (crewsResult.error) {
      setError(crewsResult.error.message);
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
      return;
    }

    const rows = (crewsResult.data ?? []) as CrewRow[];
    const baseModels = rows.map((row) => ({
      ...row,
      ownerName: getOwnerName(row),
      memberCount: 0,
      currentUserRole: null,
      isCurrentUserMember: false,
      pendingJoinRequestId: null,
    } satisfies Crew));

    setCrews(baseModels);
    setEvents([]);
    setFilter("discover");
    setLoading(false);
    setRefreshing(false);
    hasLoadedRef.current = true;

    if (rows.length === 0) return;

    const requestsQuery = currentUserId
      ? supabase
          .from("crew_join_requests")
          .select("id,crew_id,user_id,status")
          .eq("user_id", currentUserId)
          .eq("status", "pending")
      : Promise.resolve({ data: [], error: null });

    void Promise.all([
      supabase.from("crew_members").select("crew_id,user_id,role"),
      requestsQuery,
      supabase
        .from("events")
        .select("id,crew_id,title,location_name,starts_at,cover_image_url")
        .not("crew_id", "is", null)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(12),
    ]).then(([membersResult, requestsResult, eventsResult]) => {
      const memberRows = membersResult.error
        ? []
        : ((membersResult.data ?? []) as CrewMemberRow[]);
      const requestRows = requestsResult.error
        ? []
        : ((requestsResult.data ?? []) as JoinRequestRow[]);
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
      if (!eventsResult.error) setEvents((eventsResult.data ?? []) as CrewEvent[]);
      setFilter(models.some((crew) => crew.isCurrentUserMember) ? "mine" : "discover");
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(!hasLoadedRef.current);
    }, [load]),
  );

  const myCrews = crews.filter((crew) => crew.isCurrentUserMember);
  const discovery = crews.filter((crew) => !crew.isCurrentUserMember);
  const visibleCrews = filter === "mine" ? myCrews : discovery;
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

      setCreateVisible(false);
      setFilter("mine");
      await load(false);
      router.push({ pathname: "/crew/[id]", params: { id: data.id } });
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

    if (!visibleCrews.length) {
      return (
        <View style={styles.stateCard}>
          <Ionicons name="people-outline" size={30} color={colors.textMuted} />
          <Text style={styles.stateTitle}>
            {filter === "mine" ? "No crews yet" : "No crews to discover"}
          </Text>
          <Text style={styles.stateText}>
            {filter === "mine"
              ? "Create a crew or discover one that fits your community."
              : "Public crews will appear here when they are available."}
          </Text>
          <CanonicalPrimaryButton
            label={filter === "mine" ? "Create crew" : "Refresh"}
            variant={filter === "mine" ? "accent" : "surface"}
            onPress={() =>
              filter === "mine" ? setCreateVisible(true) : void load(false)
            }
          />
        </View>
      );
    }

    return (
      <View>
        <View style={styles.crewList}>
          {visibleCrews.map((crew, index) => (
            <View key={crew.id}>
              <CrewListRow crew={crew} event={eventForCrew(crew.id)} />
              {index < visibleCrews.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>

        {nextEvent ? (
          <View style={styles.nextDriveSection}>
            <Text style={styles.sectionTitle}>Next from your crews</Text>
            <UpcomingDrive event={nextEvent} crew={nextEventCrew} />
          </View>
        ) : null}
      </View>
    );
  }, [
    eventForCrew,
    filter,
    load,
    loading,
    nextEvent,
    nextEventCrew,
    visibleCrews,
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
          <Text style={styles.pageTitle}>Crews</Text>
          <NoxaIconButton
            accessibilityLabel="Create crew"
            accessibilityHint="Opens crew creation"
            icon="add"
            variant="ghost"
            onPress={() => setCreateVisible(true)}
          />
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
              Could not refresh crews. Tap to dismiss.
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
    paddingTop: spacing.sm,
    paddingBottom: 136,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.72 },
  topBar: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  pageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: "900",
  },
  filterControl: {
    flexDirection: "row",
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  filterButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  filterButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  filterTextActive: { color: colors.text, fontWeight: "700" },
  filterCount: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxs,
    borderRadius: 11,
  },
  filterCountActive: { backgroundColor: colors.primaryMuted },
  filterCountText: { color: colors.textSubtle, fontSize: 11, fontWeight: "700" },
  filterCountTextActive: { color: colors.primaryHover },
  errorBanner: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  errorText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  stateCard: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: "900",
    textAlign: "center",
  },
  stateText: {
    maxWidth: 290,
    color: colors.textMuted,
    ...typography.v2.body,
    textAlign: "center",
  },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  logoFallbackText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  crewList: { marginTop: spacing.xs },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
    backgroundColor: colors.divider,
  },
  crewRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  crewRowCopy: { flex: 1, minWidth: 0, gap: 3 },
  crewTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  crewRowTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    ...typography.v2.row,
    fontWeight: "700",
  },
  membershipText: {
    color: colors.primaryHover,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  crewRowMeta: { color: colors.textMuted, fontSize: 13, lineHeight: 17 },
  crewNextDrive: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 16,
  },
  nextDriveSection: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: "700",
  },
  driveCard: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateTile: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDay: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "900",
  },
  dateMonth: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  driveCopy: { flex: 1, gap: 2 },
  driveEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  driveTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: "700",
  },
  driveMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  driveSignal: { color: colors.textSubtle, fontSize: 11, lineHeight: 15 },
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
    ...typography.v2.row,
    fontWeight: "700",
  },
  modalContent: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
  field: { gap: spacing.xs },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
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
