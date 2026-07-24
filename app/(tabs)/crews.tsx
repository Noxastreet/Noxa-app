import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NoxaBadge, NoxaScreen } from "@/src/components/ui";
import { supabase } from "@/src/lib/supabase";
import {
  animations,
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/theme";

type CrewRole = "owner" | "admin" | "member";
type JoinPolicy = "open" | "approval" | "invite_only";
type CrewTab = "discover" | "mine";

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

type Invitation = {
  id: string;
  crew_id: string;
  invited_user_id: string;
  invited_by: string;
  status: string;
  created_at: string;
  crewName: string;
  crewCity: string | null;
  inviterName: string;
};

type JoinRequest = {
  id: string;
  crew_id: string;
  user_id: string;
  status: string;
  created_at: string;
};

type ProfileLite = {
  id: string;
  display_name: string | null;
  username: string | null;
};

type Crew = CrewRow & {
  ownerName: string;
  memberCount: number;
  currentUserRole: CrewRole | null;
  isCurrentUserMember: boolean;
  pendingJoinRequestId: string | null;
};

function useSlideUp(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(
    new Animated.Value(animations.entranceDistance),
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: animations.entrance,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: animations.entrance,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return { opacity, transform: [{ translateY }] };
}

function CreateCrewButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Create crew"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerCreateButton, pressed && styles.pressed]}>
      <Ionicons name="add" size={17} color={colors.text} />
      <Text style={styles.headerCreateText}>CREATE</Text>
    </Pressable>
  );
}

function crewInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function CrewLogo({ crew }: { crew: Crew }) {
  if (crew.logo_url) {
    return <Image source={{ uri: crew.logo_url }} style={styles.crewLogoImage} accessibilityLabel={`${crew.name} logo`} />;
  }

  return (
    <View style={styles.crewLogoFallback}>
      <Text style={styles.crewLogoText}>{crewInitials(crew.name)}</Text>
    </View>
  );
}

function CrewArtwork({ crew, onPress }: { crew: Crew; onPress: () => void }) {
  const content = (
    <>
      <View style={styles.crewCoverShade} />
      <View style={styles.crewVisibilityBadge}>
        <NoxaBadge label={crew.is_public ? "PUBLIC" : "PRIVATE"} variant={crew.is_public ? "primary" : "default"} />
      </View>
    </>
  );

  return (
    <Pressable accessibilityLabel={`Open ${crew.name} crew details`} accessibilityRole="button" onPress={onPress}>
      {crew.cover_image_url ? (
        <ImageBackground
          source={{ uri: crew.cover_image_url }}
          resizeMode="cover"
          style={styles.crewCover}
          imageStyle={styles.crewCoverImage as ImageStyle}>
          {content}
        </ImageBackground>
      ) : (
        <View style={[styles.crewCover, styles.crewCoverPlaceholder]}>
          <Ionicons name="people" size={58} color={colors.primaryMuted} />
          {content}
        </View>
      )}
    </Pressable>
  );
}

function CrewCard({
  crew,
  index,
  busy,
  onJoin,
  onRequestJoin,
  onCancelRequest,
  onLeave,
}: {
  crew: Crew;
  index: number;
  busy: boolean;
  onJoin: (crew: Crew) => void;
  onRequestJoin: (crew: Crew) => void;
  onCancelRequest: (crew: Crew) => void;
  onLeave: (crew: Crew) => void;
}) {
  const canNavigate =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      crew.id,
    );
  const effectiveJoinPolicy = crew.is_public ? crew.join_policy : "invite_only";
  const actionLabel =
    crew.currentUserRole === "owner"
      ? "Owner"
      : crew.isCurrentUserMember
        ? "Leave Crew"
        : crew.pendingJoinRequestId
          ? "Cancel Request"
          : effectiveJoinPolicy === "open"
            ? "Join Crew"
            : effectiveJoinPolicy === "approval"
              ? "Request to Join"
              : "Invite Only";
  const canPress =
    !busy &&
    ["Join Crew", "Request to Join", "Cancel Request", "Leave Crew"].includes(
      actionLabel,
    );
  const openCrew = () => {
    if (canNavigate) router.push({ pathname: "/crew/[id]", params: { id: crew.id } });
  };

  return (
    <Animated.View style={[styles.crewCard, useSlideUp(210 + index * 70)]}>
      <CrewArtwork crew={crew} onPress={openCrew} />
      <View style={styles.crewBody}>
        <View style={styles.crewIdentityRow}>
          <View style={styles.crewLogoShell}><CrewLogo crew={crew} /></View>
          <Pressable
            accessibilityRole="button"
            disabled={!canPress}
            onPress={() => {
              if (actionLabel === "Join Crew") onJoin(crew);
              else if (actionLabel === "Request to Join") onRequestJoin(crew);
              else if (actionLabel === "Cancel Request") onCancelRequest(crew);
              else if (actionLabel === "Leave Crew") onLeave(crew);
            }}
            style={({ pressed }) => [
              styles.memberAction,
              !canPress && styles.memberActionDisabled,
              pressed && styles.pressed,
            ]}>
            {busy ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.memberActionText}>{actionLabel}</Text>}
          </Pressable>
        </View>
        <Pressable
          accessibilityLabel={`Open ${crew.name} crew details`}
          accessibilityRole="button"
          disabled={!canNavigate}
          onPress={openCrew}
          style={({ pressed }) => [styles.crewCopyPress, pressed && styles.pressed]}>
          <Text style={styles.crewName}>{crew.name}</Text>
          <View style={styles.crewMetaLine}>
            <View style={styles.memberCountRow}>
              <Ionicons name="people-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>{crew.memberCount} members</Text>
            </View>
            <View style={styles.memberCountRow}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>{crew.city ?? "No city set"}</Text>
            </View>
          </View>
          <Text numberOfLines={3} style={styles.descriptionText}>{crew.description ?? `Owned by ${crew.ownerName}`}</Text>
        </Pressable>
      </View>
    </Animated.View>
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
  onSubmit: (values: {
    name: string;
    description: string;
    city: string;
    isPublic: boolean;
    joinPolicy: JoinPolicy;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>("approval");

  useEffect(() => {
    if (!visible) {
      setName("");
      setDescription("");
      setCity("");
      setIsPublic(true);
      setJoinPolicy("approval");
    }
  }, [visible]);

  const canSubmit = name.trim().length >= 2 && !creating;

  return (
    <Modal
      animationType="slide"
      presentationStyle="fullScreen"
      visible={visible}
      onRequestClose={creating ? undefined : onClose}
    >
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Pressable
            accessibilityLabel="Close create crew"
            accessibilityRole="button"
            disabled={creating}
            onPress={onClose}
            style={({ pressed }) => [styles.modalBackButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.modalHeaderTitle}>CREATE CREW</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalContent}>
          <View style={styles.crewPreview}>
            <View style={styles.previewGlowLarge} />
            <View style={styles.previewGlowSmall} />
            <Ionicons name="people" size={58} color={colors.primaryMuted} />
            <View style={styles.logoPreview}>
              <Text style={styles.logoPreviewText}>{name.trim() ? crewInitials(name) : "NX"}</Text>
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>CREW NAME</Text>
            <TextInput
              placeholder="e.g. Apex Collective"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              value={name}
              onChangeText={setName}
              maxLength={60}
              style={styles.input}
            />
            <Text style={styles.fieldHint}>2–60 characters</Text>
          </View>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>PRIVACY</Text>
            <View style={styles.privacyOptions}>
              {[
                { label: "Public", value: true },
                { label: "Private", value: false },
              ].map((option) => {
                const selected = isPublic === option.value;
                return (
                  <Pressable
                    key={option.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setIsPublic(option.value)}
                    style={({ pressed }) => [styles.privacyOption, selected && styles.privacyOptionActive, pressed && styles.pressed]}>
                    <Ionicons name={option.value ? "earth-outline" : "lock-closed-outline"} size={15} color={selected ? colors.text : colors.textMuted} />
                    <Text style={[styles.privacyOptionText, selected && styles.privacyOptionTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isPublic ? (
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>JOIN POLICY</Text>
              <View style={styles.policyOptions}>
                {(["open", "approval", "invite_only"] as JoinPolicy[]).map((policy) => (
                  <Pressable
                    key={policy}
                    accessibilityRole="button"
                    accessibilityState={{ selected: joinPolicy === policy }}
                    onPress={() => setJoinPolicy(policy)}
                    style={({ pressed }) => [styles.policyOption, joinPolicy === policy && styles.policyOptionActive, pressed && styles.pressed]}>
                    <Text style={styles.policyOptionText}>
                      {policy === "open" ? "Open" : policy === "approval" ? "Approval" : "Invite Only"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>LOCATION</Text>
            <TextInput
              placeholder="City or region"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              value={city}
              onChangeText={setCity}
              maxLength={80}
              style={styles.input}
            />
          </View>

          <View style={styles.formField}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <Text style={styles.fieldCount}>{description.length}/500</Text>
            </View>
            <TextInput
              placeholder="What is your crew about?"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              style={[styles.input, styles.textArea]}
            />
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => onSubmit({ name, description, city, isPublic, joinPolicy: isPublic ? joinPolicy : "invite_only" })}
            style={({ pressed }) => [styles.createCrewSubmit, !canSubmit && styles.createCrewSubmitDisabled, pressed && canSubmit && styles.pressed]}>
            {creating ? <ActivityIndicator color={colors.text} /> : <Text style={styles.createCrewSubmitText}>CREATE CREW</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function CrewsScreen() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [activeTab, setActiveTab] = useState<CrewTab>("discover");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyCrewId, setBusyCrewId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const loadCrews = useCallback(async (showSpinner = true) => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    if (showSpinner) setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData.user?.id ?? null;

    if (!currentUserId) {
      if (mounted.current && requestId.current === currentRequest) {
        setUserId(null);
        setCrews([]);
        setInvitations([]);
        setError("Sign in to view and manage crews.");
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    const { data: inviteRows, error: invitationsError } = await supabase
      .from("crew_invitations")
      .select("id,crew_id,invited_user_id,invited_by,status,created_at")
      .eq("invited_user_id", currentUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (invitationsError) {
      if (mounted.current && requestId.current === currentRequest) {
        setUserId(currentUserId);
        setInvitations([]);
        setCrews([]);
        setError("Crew invitations are unavailable right now.");
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    const pendingInviteRows = (inviteRows ?? []) as Omit<
      Invitation,
      "crewName" | "crewCity" | "inviterName"
    >[];
    let nextInvitations: Invitation[] = [];
    if (pendingInviteRows.length > 0) {
      const invitedCrewIds = Array.from(
        new Set(pendingInviteRows.map((invite) => invite.crew_id)),
      );
      const inviterIds = Array.from(
        new Set(pendingInviteRows.map((invite) => invite.invited_by)),
      );
      const [inviteCrewsResult, invitersResult] = await Promise.all([
        supabase.from("crews").select("id,name,city").in("id", invitedCrewIds),
        supabase
          .from("profiles")
          .select("id,display_name,username")
          .in("id", inviterIds),
      ]);
      if (inviteCrewsResult.error || invitersResult.error) {
        if (mounted.current && requestId.current === currentRequest) {
          setUserId(currentUserId);
          setInvitations([]);
          setCrews([]);
          setError("Crew invitations are unavailable right now.");
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }
      const inviteCrewMap = new Map(
        (
          (inviteCrewsResult.data ?? []) as {
            id: string;
            name: string;
            city: string | null;
          }[]
        ).map((crew) => [crew.id, crew]),
      );
      const inviterMap = new Map(
        ((invitersResult.data ?? []) as ProfileLite[]).map((profile) => [
          profile.id,
          profile,
        ]),
      );
      nextInvitations = pendingInviteRows.map((invite) => {
        const invitedCrew = inviteCrewMap.get(invite.crew_id);
        const inviter = inviterMap.get(invite.invited_by);
        return {
          ...invite,
          crewName: invitedCrew?.name ?? "Crew",
          crewCity: invitedCrew?.city ?? null,
          inviterName: inviter?.display_name ?? inviter?.username ?? "Driver",
        };
      });
    }

    const { data, error: crewsError } = await supabase
      .from("crews")
      .select(
        "id,owner_id,name,description,city,logo_url,cover_image_url,is_public,join_policy,created_at,profiles:owner_id(display_name,username)",
      )
      .order("created_at", { ascending: false });

    if (crewsError) {
      if (mounted.current && requestId.current === currentRequest) {
        setUserId(currentUserId);
        setCrews([]);
        setError("Crews are unavailable right now.");
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    const rows = (data ?? []) as CrewRow[];
    const ids = rows.map((crew) => crew.id);
    const members = new Map<string, CrewMemberRow[]>();
    const pendingRequests = new Map<string, string>();

    if (ids.length > 0) {
      const { data: memberRows, error: membersError } = await supabase
        .from("crew_members")
        .select("crew_id,user_id,role")
        .in("crew_id", ids);

      if (membersError) {
        if (mounted.current && requestId.current === currentRequest) {
          setUserId(currentUserId);
          setCrews([]);
          setError("Crew memberships are unavailable right now.");
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      for (const member of (memberRows ?? []) as CrewMemberRow[]) {
        members.set(member.crew_id, [
          ...(members.get(member.crew_id) ?? []),
          member,
        ]);
      }
      const { data: requestRows, error: requestsError } = await supabase
        .from("crew_join_requests")
        .select("id,crew_id,user_id,status,created_at")
        .eq("user_id", currentUserId)
        .eq("status", "pending")
        .in("crew_id", ids);
      if (requestsError) {
        if (mounted.current && requestId.current === currentRequest) {
          setUserId(currentUserId);
          setCrews([]);
          setError("Crew join requests are unavailable right now.");
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }
      for (const request of (requestRows ?? []) as JoinRequest[])
        pendingRequests.set(request.crew_id, request.id);
    }

    const nextCrews = rows.map((crew) => {
      const crewMembers = members.get(crew.id) ?? [];
      const currentMembership = crewMembers.find(
        (member) => member.user_id === currentUserId,
      );
      return {
        ...crew,
        ownerName:
          (Array.isArray(crew.profiles)
            ? (crew.profiles[0]?.display_name ?? crew.profiles[0]?.username)
            : (crew.profiles?.display_name ?? crew.profiles?.username)) ??
          "Driver",
        memberCount: crewMembers.length,
        currentUserRole:
          currentMembership?.role ??
          (crew.owner_id === currentUserId ? "owner" : null),
        isCurrentUserMember:
          Boolean(currentMembership) || crew.owner_id === currentUserId,
        pendingJoinRequestId: pendingRequests.get(crew.id) ?? null,
      };
    });

    if (mounted.current && requestId.current === currentRequest) {
      setUserId(currentUserId);
      setInvitations(nextInvitations);
      setCrews(nextCrews);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCrews();
    }, [loadCrews]),
  );

  const openCreate = useCallback(() => setModalVisible(true), []);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadCrews(false);
  }, [loadCrews]);

  const createCrew = useCallback(
    async ({
      name,
      description,
      city,
      isPublic,
      joinPolicy,
    }: {
      name: string;
      description: string;
      city: string;
      isPublic: boolean;
      joinPolicy: JoinPolicy;
    }) => {
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();
      const trimmedCity = city.trim();

      if (trimmedName.length < 2 || trimmedName.length > 60) {
        Alert.alert("Check crew name", "Crew names must be 2–60 characters.");
        return;
      }
      if (
        trimmedDescription.length > 500 ||
        trimmedCity.length > 80 ||
        creating
      )
        return;

      const ownerId = userId ?? (await supabase.auth.getUser()).data.user?.id;
      if (!ownerId) {
        Alert.alert("Sign in required", "Sign in to create a crew.");
        return;
      }

      setCreating(true);
      const { error: createError } = await supabase
        .from("crews")
        .insert({
          owner_id: ownerId,
          name: trimmedName,
          description: trimmedDescription || null,
          city: trimmedCity || null,
          is_public: isPublic,
          join_policy: isPublic ? joinPolicy : "invite_only",
        });
      setCreating(false);

      if (createError) {
        Alert.alert(
          "Crew not created",
          "Please check the details and try again.",
        );
        return;
      }

      setModalVisible(false);
      Alert.alert("Crew created", "Your crew is ready.");
      void loadCrews(false);
    },
    [creating, loadCrews, userId],
  );

  const joinCrew = useCallback(
    async (crew: Crew) => {
      if (!userId || busyCrewId) return;
      setBusyCrewId(crew.id);
      const { error: joinError } = await supabase
        .from("crew_members")
        .insert({ crew_id: crew.id, user_id: userId, role: "member" });
      setBusyCrewId(null);
      if (joinError && joinError.code !== "23505") {
        Alert.alert("Could not join", "This crew cannot be joined right now.");
        return;
      }
      void loadCrews(false);
    },
    [busyCrewId, loadCrews, userId],
  );

  const requestJoinCrew = useCallback(
    async (crew: Crew) => {
      if (!userId || busyCrewId) return;
      setBusyCrewId(crew.id);
      const { error: requestError } = await supabase.rpc(
        "noxa_request_crew_join",
        { target_crew_id: crew.id },
      );
      setBusyCrewId(null);
      if (requestError) {
        Alert.alert("Request not sent", "Please try again.");
        return;
      }
      void loadCrews(false);
    },
    [busyCrewId, loadCrews, userId],
  );

  const cancelJoinRequest = useCallback(
    async (crew: Crew) => {
      if (!crew.pendingJoinRequestId || busyCrewId) return;
      setBusyCrewId(crew.id);
      const { data: ok, error: cancelError } = await supabase.rpc(
        "noxa_cancel_crew_join_request",
        { target_request_id: crew.pendingJoinRequestId },
      );
      setBusyCrewId(null);
      if (cancelError || ok !== true) {
        Alert.alert("Request not cancelled", "Please try again.");
        return;
      }
      void loadCrews(false);
    },
    [busyCrewId, loadCrews],
  );

  const leaveCrew = useCallback(
    (crew: Crew) => {
      if (!userId || busyCrewId) return;
      Alert.alert("Leave crew?", `Leave ${crew.name}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyCrewId(crew.id);
              const { error: leaveError } = await supabase
                .from("crew_members")
                .delete()
                .eq("crew_id", crew.id)
                .eq("user_id", userId)
                .eq("role", "member");
              setBusyCrewId(null);
              if (leaveError) {
                Alert.alert("Could not leave", "Please try again.");
                return;
              }
              void loadCrews(false);
            })();
          },
        },
      ]);
    },
    [busyCrewId, loadCrews, userId],
  );

  const respondToInvitation = useCallback(
    async (invitationId: string, accept: boolean) => {
      if (busyInvitationId) return;
      setBusyInvitationId(invitationId);
      const { data: ok, error: responseError } = await supabase.rpc(
        "noxa_respond_to_crew_invitation",
        { target_invitation_id: invitationId, accept },
      );
      setBusyInvitationId(null);
      if (responseError || ok !== true) {
        Alert.alert("Invitation not updated", "Please try again.");
        return;
      }
      setInvitations((current) =>
        current.filter((invite) => invite.id !== invitationId),
      );
      if (accept) void loadCrews(false);
    },
    [busyInvitationId, loadCrews],
  );

  const myCrews = crews.filter((crew) => crew.isCurrentUserMember);
  const discoverCrews = crews.filter((crew) => !crew.isCurrentUserMember);
  const visibleCrews = activeTab === "mine" ? myCrews : discoverCrews;

  return (
    <NoxaScreen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <View style={styles.topBar}>
          <View style={styles.headingBlock}>
            <Text style={styles.pageTitle}>CREWS</Text>
            <Text style={styles.pageSubtitle}>Find your people</Text>
          </View>
          <CreateCrewButton onPress={openCreate} />
        </View>

        <View style={styles.tabBar}>
          {(["discover", "mine"] as CrewTab[]).map((tab) => {
            const selected = activeTab === tab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab)}
                style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                  {tab === "discover" ? "Discover" : `My Crews · ${myCrews.length}`}
                </Text>
                {selected ? <View style={styles.tabIndicator} /> : null}
              </Pressable>
            );
          })}
        </View>

        {activeTab === "discover" && invitations.length > 0 ? (
          <View style={styles.invitationCard}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>INVITATIONS</Text>
              <Text style={styles.sectionMeta}>{invitations.length} PENDING</Text>
            </View>
            {invitations.map((invite) => (
              <View key={invite.id} style={styles.invitationRow}>
                <View style={styles.invitationCopy}>
                  <Text style={styles.crewName}>{invite.crewName}</Text>
                  <Text style={styles.metaText}>
                    {[invite.crewCity, `Invited by ${invite.inviterName}`]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                </View>
                <View style={styles.invitationActions}>
                  <Pressable
                    disabled={busyInvitationId === invite.id}
                    onPress={() => void respondToInvitation(invite.id, true)}
                    style={({ pressed }) => [
                      styles.smallPrimaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {busyInvitationId === invite.id ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Text style={styles.smallButtonText}>Accept</Text>
                    )}
                  </Pressable>
                  <Pressable
                    disabled={busyInvitationId === invite.id}
                    onPress={() => void respondToInvitation(invite.id, false)}
                    style={({ pressed }) => [
                      styles.smallSecondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.smallButtonText}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>{activeTab === "mine" ? "YOUR CREWS" : "DISCOVER"}</Text>
          <Text style={styles.sectionMeta}>{visibleCrews.length} CREWS</Text>
        </View>
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading crews…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Crews unavailable</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              onPress={() => void loadCrews()}
              style={styles.statePrimaryButton}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : visibleCrews.length === 0 ? (
          <View style={styles.stateCard}>
            <View style={styles.stateIcon}>
              <Ionicons name={activeTab === "mine" ? "car-sport-outline" : "people-outline"} size={30} color={colors.primary} />
            </View>
            <Text style={styles.stateTitle}>{activeTab === "mine" ? "No crews yet" : "Nothing new to discover"}</Text>
            <Text style={styles.stateText}>
              {activeTab === "mine"
                ? "Join or create your first NOXA crew."
                : "You already belong to every available crew."}
            </Text>
            {activeTab === "mine" ? (
              <Pressable accessibilityRole="button" onPress={openCreate} style={({ pressed }) => [styles.statePrimaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Create Crew</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          visibleCrews.map((crew, index) => (
            <CrewCard
              key={crew.id}
              crew={crew}
              index={index}
              busy={busyCrewId === crew.id}
              onJoin={joinCrew}
              onRequestJoin={requestJoinCrew}
              onCancelRequest={cancelJoinRequest}
              onLeave={leaveCrew}
            />
          ))
        )}
      </ScrollView>
      <CreateCrewModal
        visible={modalVisible}
        creating={creating}
        onClose={() => setModalVisible(false)}
        onSubmit={createCrew}
      />
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 144,
    gap: spacing.lg,
  },
  topBar: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headingBlock: { flex: 1 },
  pageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.hero,
    fontWeight: "900",
    letterSpacing: 0.6,
    lineHeight: typography.lineHeight.hero,
  },
  pageSubtitle: {
    marginTop: -spacing.xs,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  headerCreateButton: {
    minHeight: 38,
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    ...shadows.redGlow,
  },
  headerCreateText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: "600" },
  tabTextActive: { color: colors.text, fontWeight: "800" },
  tabIndicator: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: -1,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }, { scale: 0.98 }] },
  featuredCard: {
    minHeight: 300,
    overflow: "hidden",
    justifyContent: "space-between",
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  featuredGlow: {
    position: "absolute",
    right: -72,
    top: -64,
    width: 196,
    height: 196,
    borderRadius: 98,
    backgroundColor: colors.primaryMuted,
  },
  featuredTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  memberPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberPillText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  featuredCopy: { gap: spacing.sm },
  featuredTitle: {
    color: colors.text,
    fontSize: typography.h1,
    fontWeight: "900",
    letterSpacing: -0.9,
  },
  featuredSubtitle: {
    color: colors.textMuted,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  featuredStats: { marginTop: spacing.xs, gap: spacing.xs },
  featuredCta: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    ...shadows.redGlow,
  },
  featuredCtaText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: typography.letterSpacing.caption,
    lineHeight: typography.lineHeight.body,
    textAlign: "center",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
    lineHeight: 19,
  },
  descriptionText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
    lineHeight: 19,
  },
  categoryRow: { flexDirection: "row", gap: spacing.sm },
  categoryTab: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryTabActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.borderAccent,
  },
  categoryText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  categoryTextActive: { color: colors.text },
  listHeader: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  invitationCard: {
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadows.card,
  },
  invitationRow: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  invitationCopy: { gap: spacing.xxs },
  invitationActions: { flexDirection: "row", gap: spacing.sm },
  smallPrimaryButton: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  smallSecondaryButton: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  policyOptions: { flexDirection: "row", gap: spacing.sm },
  policyOption: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  policyOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  policyOptionText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  smallButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  crewCard: {
    overflow: "hidden",
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  crewCover: {
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
  crewCoverImage: {
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
  },
  crewCoverPlaceholder: { backgroundColor: colors.surfaceSoft },
  crewCoverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,6,10,0.34)",
  },
  crewVisibilityBadge: { position: "absolute", top: spacing.sm, right: spacing.sm },
  crewBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  crewIdentityRow: {
    minHeight: 52,
    marginTop: -28,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  crewLogoShell: {
    width: 56,
    height: 56,
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceRaised,
  },
  crewLogoImage: { width: "100%", height: "100%" },
  crewLogoFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  crewLogoText: {
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
  },
  crewCopyPress: { gap: spacing.xs },
  crewMetaLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
  redAccent: {
    position: "absolute",
    left: 0,
    top: spacing.lg,
    bottom: spacing.lg,
    width: 3,
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  crewMainPress: { borderRadius: radius.button },
  crewFooterPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  crewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  crewTitleBlock: { flex: 1, gap: spacing.xs },
  crewName: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  crewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dotRow: { flexDirection: "row", alignItems: "center", paddingLeft: 2 },
  memberDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  stackedDot: { marginLeft: -7 },
  moreDot: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.surface,
  },
  moreDotText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 14,
  },
  memberCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  memberAction: {
    minWidth: 88,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  memberActionDisabled: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberActionText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  stateCard: {
    minHeight: 244,
    gap: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  stateIcon: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  stateTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "900",
  },
  stateText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
  },
  statePrimaryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  modalScreen: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalBackButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  modalHeaderTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  modalHeaderSpacer: { width: 40, height: 40 },
  modalContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 128, gap: spacing.lg },
  crewPreview: {
    height: 146,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  previewGlowLarge: {
    position: "absolute",
    right: -30,
    top: -46,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.primaryMuted,
  },
  previewGlowSmall: {
    position: "absolute",
    left: 30,
    bottom: -36,
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 18,
    borderColor: colors.primarySubtle,
  },
  logoPreview: {
    position: "absolute",
    left: spacing.md,
    bottom: -26,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: colors.background,
    backgroundColor: colors.surfaceRaised,
  },
  logoPreviewText: {
    color: colors.primaryHover,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
  },
  formField: { gap: spacing.xs },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: typography.letterSpacing.label },
  fieldCount: { color: colors.textSubtle, fontSize: 10, fontWeight: "700" },
  fieldHint: { color: colors.textSubtle, fontSize: 10, fontWeight: "600" },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  textArea: { minHeight: 112, textAlignVertical: "top" },
  privacyOptions: { flexDirection: "row", gap: spacing.sm },
  privacyOption: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  privacyOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  privacyOptionText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: "800" },
  privacyOptionTextActive: { color: colors.text },
  modalFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.glass,
  },
  createCrewSubmit: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    ...shadows.redGlow,
  },
  createCrewSubmitDisabled: { opacity: 0.42 },
  createCrewSubmitText: { color: colors.text, fontSize: 14, fontWeight: "900", letterSpacing: 0.8 },
  primaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
});
