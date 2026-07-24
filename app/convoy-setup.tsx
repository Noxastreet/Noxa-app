import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NoxaButton, NoxaScreen } from "@/src/components/ui";
import { initials, uuidPattern } from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type CrewRole = "owner" | "admin" | "member";
type ConvoyStatus = "lobby" | "live" | "completed" | "cancelled";
type CrewRow = { id: string; name: string };
type ConvoyRow = {
  id: string;
  crew_id: string;
  created_by: string;
  name: string;
  meeting_point: string;
  destination: string;
  starts_at: string;
  max_slots: number;
  safety_note: string | null;
  status: ConvoyStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};
type ParticipantRow = {
  convoy_id: string;
  user_id: string;
  ready: boolean;
  joined_at: string;
};
type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};
type Participant = ParticipantRow & { profile?: ProfileRow };

const defaultSafetyNote =
  "Follow traffic laws, keep a safe distance, and stop only in legal locations.";

function profileName(profile?: ProfileRow) {
  return profile?.display_name || profile?.username || "NOXA driver";
}

function formatStart(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) return "—";
  const minutes = Math.max(
    1,
    Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function Header({ status }: { status: "setup" | ConvoyStatus }) {
  const labels = {
    setup: "SETUP",
    lobby: "LOBBY",
    live: "LIVE",
    completed: "FINISHED",
    cancelled: "CANCELLED",
  } as const;
  const steps = ["setup", "lobby", "live", "completed"] as const;
  const activeIndex = Math.max(0, steps.indexOf(status === "cancelled" ? "setup" : status));
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={21} color={colors.text} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>CREW CONVOY</Text>
        <Text style={styles.headerSubtitle}>{labels[status]}</Text>
      </View>
      <View style={styles.progress}>
        {steps.map((step, index) => (
          <View
            key={step}
            style={[
              styles.progressSegment,
              index <= activeIndex && styles.progressSegmentActive,
              index === activeIndex && styles.progressSegmentCurrent,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function Field({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        maxLength={160}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        style={styles.field}
        value={value}
      />
    </View>
  );
}

function ParticipantAvatar({ profile }: { profile?: ProfileRow }) {
  const name = profileName(profile);
  return profile?.avatar_url ? (
    <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarText}>{initials(name)}</Text>
    </View>
  );
}

export default function ConvoySetupScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const crewId = typeof params.id === "string" ? params.id : "";
  const [crew, setCrew] = useState<CrewRow | null>(null);
  const [convoy, setConvoy] = useState<ConvoyRow | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [role, setRole] = useState<CrewRole | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [name, setName] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [destination, setDestination] = useState("");
  const [safetyNote, setSafetyNote] = useState(defaultSafetyNote);
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [maxSlots, setMaxSlots] = useState(10);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = role === "owner" || role === "admin";
  const currentParticipant = useMemo(
    () => participants.find((participant) => participant.user_id === currentUserId),
    [currentUserId, participants],
  );
  const readyCount = useMemo(
    () => participants.filter((participant) => participant.ready).length,
    [participants],
  );
  const headerStatus = showSetup || !convoy || convoy.status === "cancelled"
    ? "setup"
    : convoy.status;

  const loadParticipants = useCallback(async (targetConvoyId: string) => {
    const { data, error: participantsError } = await supabase
      .from("crew_convoy_participants")
      .select("convoy_id,user_id,ready,joined_at")
      .eq("convoy_id", targetConvoyId)
      .order("joined_at", { ascending: true });
    if (participantsError) {
      setError(participantsError.message);
      return;
    }
    const rows = (data ?? []) as ParticipantRow[];
    const userIds = rows.map((row) => row.user_id);
    const profileResult = userIds.length
      ? await supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .in("id", userIds)
      : { data: [], error: null };
    if (profileResult.error) {
      setError(profileResult.error.message);
      return;
    }
    const profileMap = new Map(
      ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
    );
    setParticipants(rows.map((row) => ({ ...row, profile: profileMap.get(row.user_id) })));
  }, []);

  const loadConvoy = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    if (!uuidPattern.test(crewId)) {
      setError("Invalid crew link.");
      setLoading(false);
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (authError || !userId) {
      setError("Sign in to open crew convoy.");
      setLoading(false);
      return;
    }
    setCurrentUserId(userId);
    const [crewResult, membershipResult, convoyResult] = await Promise.all([
      supabase.from("crews").select("id,name").eq("id", crewId).maybeSingle(),
      supabase
        .from("crew_members")
        .select("role")
        .eq("crew_id", crewId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("crew_convoys")
        .select(
          "id,crew_id,created_by,name,meeting_point,destination,starts_at,max_slots,safety_note,status,started_at,completed_at,created_at",
        )
        .eq("crew_id", crewId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (crewResult.error || !crewResult.data) {
      setError(crewResult.error?.message ?? "Crew not found.");
      setLoading(false);
      return;
    }
    setCrew(crewResult.data as CrewRow);
    const membershipRole = membershipResult.error
      ? null
      : ((membershipResult.data?.role as CrewRole | undefined) ?? null);
    setRole(membershipRole);
    if (!membershipRole) {
      setConvoy(null);
      setParticipants([]);
      setLoading(false);
      return;
    }
    const nextConvoy = convoyResult.error
      ? null
      : ((convoyResult.data as ConvoyRow | null) ?? null);
    setConvoy(nextConvoy);
    if (nextConvoy) await loadParticipants(nextConvoy.id);
    else setParticipants([]);
    setLoading(false);
  }, [crewId, loadParticipants]);

  useEffect(() => {
    void loadConvoy();
  }, [loadConvoy]);

  useEffect(() => {
    if (!role || !uuidPattern.test(crewId)) return;
    const convoyChannel = supabase
      .channel(`noxa-crew-convoy-${crewId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crew_convoys",
          filter: `crew_id=eq.${crewId}`,
        },
        () => void loadConvoy(false),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(convoyChannel);
    };
  }, [crewId, loadConvoy, role]);

  useEffect(() => {
    if (!convoy?.id || !role) return;
    const participantChannel = supabase
      .channel(`noxa-convoy-participants-${convoy.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crew_convoy_participants",
          filter: `convoy_id=eq.${convoy.id}`,
        },
        () => void loadParticipants(convoy.id),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(participantChannel);
    };
  }, [convoy?.id, loadParticipants, role]);

  const createConvoy = useCallback(async () => {
    const cleanName = name.trim();
    const cleanMeetingPoint = meetingPoint.trim();
    const cleanDestination = destination.trim();
    if (!canManage || working) return;
    if (cleanName.length < 2 || cleanMeetingPoint.length < 2 || cleanDestination.length < 2) {
      setError("Add a convoy name, meeting point, and destination.");
      return;
    }
    setWorking(true);
    setError(null);
    const { data, error: createError } = await supabase.rpc("noxa_create_crew_convoy", {
      target_crew_id: crewId,
      convoy_name: cleanName,
      convoy_meeting_point: cleanMeetingPoint,
      convoy_destination: cleanDestination,
      convoy_starts_at: new Date(Date.now() + delayMinutes * 60000).toISOString(),
      convoy_max_slots: maxSlots,
      convoy_safety_note: safetyNote.trim(),
    });
    if (createError || typeof data !== "string") {
      setError(createError?.message ?? "Convoy could not be created.");
    } else {
      setShowSetup(false);
      setName("");
      setMeetingPoint("");
      setDestination("");
      await loadConvoy(false);
    }
    setWorking(false);
  }, [
    canManage,
    crewId,
    delayMinutes,
    destination,
    loadConvoy,
    maxSlots,
    meetingPoint,
    name,
    safetyNote,
    working,
  ]);

  const joinConvoy = useCallback(async () => {
    if (!convoy || !currentUserId || currentParticipant || working) return;
    setWorking(true);
    setError(null);
    const { error: joinError } = await supabase
      .from("crew_convoy_participants")
      .insert({ convoy_id: convoy.id, user_id: currentUserId, ready: false });
    if (joinError) setError(joinError.message);
    else await loadParticipants(convoy.id);
    setWorking(false);
  }, [convoy, currentParticipant, currentUserId, loadParticipants, working]);

  const leaveConvoy = useCallback(async () => {
    if (!convoy || !currentUserId || !currentParticipant || working) return;
    if (convoy.created_by === currentUserId) {
      Alert.alert("Convoy host", "The host stays in the lobby. Cancel the convoy instead.");
      return;
    }
    setWorking(true);
    const { error: leaveError } = await supabase
      .from("crew_convoy_participants")
      .delete()
      .eq("convoy_id", convoy.id)
      .eq("user_id", currentUserId);
    if (leaveError) setError(leaveError.message);
    else await loadParticipants(convoy.id);
    setWorking(false);
  }, [convoy, currentParticipant, currentUserId, loadParticipants, working]);

  const toggleReady = useCallback(async () => {
    if (!convoy || !currentParticipant || working) return;
    setWorking(true);
    const { error: readyError } = await supabase
      .from("crew_convoy_participants")
      .update({ ready: !currentParticipant.ready })
      .eq("convoy_id", convoy.id)
      .eq("user_id", currentParticipant.user_id);
    if (readyError) setError(readyError.message);
    else await loadParticipants(convoy.id);
    setWorking(false);
  }, [convoy, currentParticipant, loadParticipants, working]);

  const updateStatus = useCallback(async (status: "live" | "completed" | "cancelled") => {
    if (!convoy || !canManage || working) return;
    setWorking(true);
    setError(null);
    const { data, error: statusError } = await supabase
      .from("crew_convoys")
      .update({ status })
      .eq("id", convoy.id)
      .select(
        "id,crew_id,created_by,name,meeting_point,destination,starts_at,max_slots,safety_note,status,started_at,completed_at,created_at",
      )
      .single();
    if (statusError) setError(statusError.message);
    else setConvoy(data as ConvoyRow);
    setWorking(false);
  }, [canManage, convoy, working]);

  const confirmCancel = useCallback(() => {
    if (!convoy || !canManage || working) return;
    Alert.alert("Cancel convoy?", "The private lobby will close for all participants.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Convoy",
        style: "destructive",
        onPress: () => void updateStatus("cancelled"),
      },
    ]);
  }, [canManage, convoy, updateStatus, working]);

  const setupVisible = showSetup || !convoy || convoy.status === "cancelled";

  return (
    <NoxaScreen padded={false}>
      <Header status={headerStatus} />
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading crew convoy…</Text>
        </View>
      ) : !role ? (
        <View style={styles.state}>
          <View style={styles.stateIcon}>
            <Ionicons name="lock-closed" size={28} color={colors.primaryHover} />
          </View>
          <Text style={styles.stateTitle}>CREW MEMBERS ONLY</Text>
          <Text style={styles.stateText}>Join {crew?.name ?? "this crew"} to open its private convoy lobby.</Text>
          <NoxaButton title="BACK TO CREW" onPress={() => router.back()} />
        </View>
      ) : setupVisible ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <Ionicons name="people" size={20} color={colors.primaryHover} />
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>PRIVATE CREW PLAN</Text>
              <Text style={styles.introText}>
                Meeting details stay inside {crew?.name ?? "the crew"}. NOXA does not publish routes, speeds, or rankings.
              </Text>
            </View>
          </View>

          {canManage ? (
            <>
              <Field label="CONVOY NAME" value={name} onChangeText={setName} placeholder="Sunday morning convoy" />
              <Field label="MEETING POINT" value={meetingPoint} onChangeText={setMeetingPoint} placeholder="Legal public meeting location" />
              <Field label="DESTINATION" value={destination} onChangeText={setDestination} placeholder="Final destination" />

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>START</Text>
                <View style={styles.chips}>
                  {[0, 30, 60].map((minutes) => (
                    <Pressable
                      key={minutes}
                      onPress={() => setDelayMinutes(minutes)}
                      style={({ pressed }) => [
                        styles.chip,
                        delayMinutes === minutes && styles.chipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.chipText, delayMinutes === minutes && styles.chipTextActive]}>
                        {minutes === 0 ? "NOW" : `IN ${minutes} MIN`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.counterHeader}>
                  <Text style={styles.fieldLabel}>MAX SLOTS</Text>
                  <Text style={styles.counterValue}>{maxSlots}</Text>
                </View>
                <View style={styles.counterTrack}>
                  <Pressable
                    accessibilityLabel="Reduce convoy slots"
                    onPress={() => setMaxSlots((value) => Math.max(2, value - 1))}
                    style={styles.counterButton}
                  >
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </Pressable>
                  <View style={styles.counterLine}>
                    <View style={[styles.counterFill, { width: `${((maxSlots - 2) / 18) * 100}%` }]} />
                  </View>
                  <Pressable
                    accessibilityLabel="Increase convoy slots"
                    onPress={() => setMaxSlots((value) => Math.min(20, value + 1))}
                    style={styles.counterButton}
                  >
                    <Ionicons name="add" size={18} color={colors.text} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>SAFETY NOTE</Text>
                <TextInput
                  maxLength={500}
                  multiline
                  onChangeText={setSafetyNote}
                  placeholder="Shared safety reminder"
                  placeholderTextColor={colors.textSubtle}
                  selectionColor={colors.primary}
                  style={[styles.field, styles.noteField]}
                  value={safetyNote}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <NoxaButton
                fullWidth
                loading={working}
                onPress={() => void createConvoy()}
                title="CREATE CONVOY · OPEN LOBBY"
              />
            </>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="hourglass-outline" size={28} color={colors.textSubtle} />
              <Text style={styles.emptyTitle}>NO ACTIVE CONVOY</Text>
              <Text style={styles.emptyText}>A crew owner or admin can open the next private lobby.</Text>
            </View>
          )}
        </ScrollView>
      ) : convoy.status === "lobby" ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statusCard}>
            <View style={styles.waitingDot} />
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>LOBBY OPEN</Text>
              <Text style={styles.statusText}>{formatStart(convoy.starts_at)} · waiting for the crew</Text>
            </View>
          </View>
          <View style={styles.routeCard}>
            <View style={styles.routePoint}>
              <View style={styles.routeDot} />
              <View style={styles.routeCopy}>
                <Text style={styles.routeLabel}>MEETING POINT</Text>
                <Text style={styles.routeValue}>{convoy.meeting_point}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <Ionicons name="flag" size={16} color={colors.primaryHover} />
              <View style={styles.routeCopy}>
                <Text style={styles.routeLabel}>DESTINATION</Text>
                <Text style={styles.routeValue}>{convoy.destination}</Text>
              </View>
            </View>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>LOBBY · {participants.length}/{convoy.max_slots}</Text>
            <Text style={styles.readySummary}>{readyCount} READY</Text>
          </View>
          <View style={styles.participantList}>
            {participants.map((participant) => (
              <View key={participant.user_id} style={styles.participantRow}>
                <ParticipantAvatar profile={participant.profile} />
                <View style={styles.participantCopy}>
                  <Text style={styles.participantName}>{profileName(participant.profile)}</Text>
                  <Text style={styles.participantMeta}>
                    {participant.user_id === convoy.created_by ? "HOST" : "CREW MEMBER"}
                  </Text>
                </View>
                <View style={styles.readyStatus}>
                  <View style={[styles.readyDot, participant.ready && styles.readyDotActive]} />
                  <Text style={[styles.readyText, participant.ready && styles.readyTextActive]}>
                    {participant.ready ? "READY" : "WAITING"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!currentParticipant ? (
            <NoxaButton fullWidth loading={working} onPress={() => void joinConvoy()} title="JOIN LOBBY" />
          ) : (
            <View style={styles.actionRow}>
              <NoxaButton
                fullWidth
                loading={working}
                onPress={() => void toggleReady()}
                title={currentParticipant.ready ? "MARK NOT READY" : "I’M READY"}
                variant={currentParticipant.ready ? "secondary" : "primary"}
              />
              {convoy.created_by !== currentUserId ? (
                <NoxaButton onPress={() => void leaveConvoy()} title="LEAVE" variant="danger" />
              ) : null}
            </View>
          )}
          {canManage ? (
            <View style={styles.managerActions}>
              <NoxaButton
                disabled={participants.length < 2 || readyCount < participants.length}
                fullWidth
                loading={working}
                onPress={() => void updateStatus("live")}
                title="START CONVOY"
              />
              <NoxaButton onPress={confirmCancel} title="CANCEL" variant="danger" />
              {participants.length < 2 || readyCount < participants.length ? (
                <Text style={styles.helperText}>At least two drivers must join and everyone must be ready.</Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      ) : convoy.status === "live" ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.liveHero}>
            <View style={styles.livePulse} />
            <Text style={styles.liveEyebrow}>PRIVATE CONVOY IS LIVE</Text>
            <Text style={styles.liveTitle}>{convoy.name}</Text>
            <Text style={styles.liveMeta}>{participants.length} vehicles · no public route sharing</Text>
          </View>
          <View style={styles.routeCard}>
            <View style={styles.routePoint}>
              <Ionicons name="location" size={16} color={colors.primaryHover} />
              <View style={styles.routeCopy}>
                <Text style={styles.routeLabel}>STARTED FROM</Text>
                <Text style={styles.routeValue}>{convoy.meeting_point}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <Ionicons name="flag" size={16} color={colors.primaryHover} />
              <View style={styles.routeCopy}>
                <Text style={styles.routeLabel}>DESTINATION</Text>
                <Text style={styles.routeValue}>{convoy.destination}</Text>
              </View>
            </View>
          </View>
          <View style={styles.safetyCard}>
            <Ionicons name="shield-checkmark" size={21} color={colors.success} />
            <View style={styles.safetyCopy}>
              <Text style={styles.safetyTitle}>SAFETY FIRST</Text>
              <Text style={styles.safetyText}>{convoy.safety_note || defaultSafetyNote}</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>PARTICIPANTS</Text>
          <View style={styles.participantList}>
            {participants.map((participant) => (
              <View key={participant.user_id} style={styles.participantRow}>
                <ParticipantAvatar profile={participant.profile} />
                <View style={styles.participantCopy}>
                  <Text style={styles.participantName}>{profileName(participant.profile)}</Text>
                  <Text style={styles.participantMeta}>
                    {participant.user_id === convoy.created_by ? "CONVOY HOST" : "IN CONVOY"}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
            ))}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {canManage ? (
            <View style={styles.managerActions}>
              <NoxaButton
                fullWidth
                loading={working}
                onPress={() => void updateStatus("completed")}
                title="COMPLETE CONVOY"
              />
              <NoxaButton onPress={confirmCancel} title="CANCEL" variant="danger" />
            </View>
          ) : (
            <Text style={styles.helperText}>The crew host will close the convoy after arrival.</Text>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.completeHero}>
            <View style={styles.completeIcon}>
              <Ionicons name="checkmark" size={34} color={colors.text} />
            </View>
            <Text style={styles.completeTitle}>CONVOY COMPLETE</Text>
            <Text style={styles.completeText}>{convoy.destination} reached</Text>
          </View>
          <View style={styles.statsGrid}>
            {[
              { label: "VEHICLES", value: String(participants.length) },
              { label: "DURATION", value: formatDuration(convoy.started_at, convoy.completed_at) },
              { label: "MEETING", value: formatStart(convoy.starts_at) },
              { label: "VISIBILITY", value: "PRIVATE" },
            ].map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text numberOfLines={1} style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.routeCard}>
            <View style={styles.routePoint}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.routeValue}>{convoy.meeting_point}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <Ionicons name="flag" size={16} color={colors.primaryHover} />
              <Text style={styles.routeValue}>{convoy.destination}</Text>
            </View>
          </View>
          {canManage ? (
            <NoxaButton
              fullWidth
              onPress={() => setShowSetup(true)}
              title="PLAN ANOTHER CONVOY"
            />
          ) : (
            <NoxaButton fullWidth onPress={() => router.back()} title="BACK TO CREW" />
          )}
        </ScrollView>
      )}
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surfaceBase,
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  headerCopy: { flex: 1 },
  headerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  headerSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  progress: { flexDirection: "row", gap: 4 },
  progressSegment: { width: 20, height: 3, borderRadius: 2, backgroundColor: colors.surfacePressed },
  progressSegmentActive: { backgroundColor: colors.primaryMuted },
  progressSegmentCurrent: { backgroundColor: colors.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  introCard: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  introIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primaryMuted },
  introCopy: { flex: 1, gap: spacing.xxs },
  introTitle: { color: colors.primaryHover, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  introText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  field: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontSize: 14,
  },
  noteField: { minHeight: 90, paddingTop: spacing.md, textAlignVertical: "top" },
  chips: { flexDirection: "row", gap: spacing.xs },
  chip: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  chipText: { color: colors.textMuted, fontSize: 9, fontWeight: "900" },
  chipTextActive: { color: colors.primaryHover },
  counterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  counterValue: { color: colors.text, fontFamily: typography.fontFamily.body, fontSize: 17, fontWeight: "900" },
  counterTrack: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  counterButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft },
  counterLine: { flex: 1, height: 4, overflow: "hidden", borderRadius: 2, backgroundColor: colors.surfacePressed },
  counterFill: { height: "100%", backgroundColor: colors.primary },
  statusCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningMuted },
  waitingDot: { width: 9, height: 9, borderRadius: radius.pill, backgroundColor: colors.warning },
  statusCopy: { flex: 1 },
  statusTitle: { color: colors.warning, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  statusText: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  routeCard: { padding: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  routePoint: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  routeDot: { width: 9, height: 9, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.primary },
  routeCopy: { flex: 1 },
  routeLabel: { color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  routeValue: { marginTop: 2, color: colors.text, fontSize: 13, fontWeight: "800" },
  routeLine: { width: 1, height: 18, marginLeft: 8, backgroundColor: colors.borderStrong },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  readySummary: { color: colors.success, fontSize: 9, fontWeight: "900" },
  participantList: { gap: spacing.xs },
  participantRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  avatar: { width: 40, height: 40, borderRadius: radius.pill },
  avatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSoft },
  avatarText: { color: colors.text, fontSize: 10, fontWeight: "900" },
  participantCopy: { flex: 1 },
  participantName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  participantMeta: { marginTop: 2, color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  readyStatus: { flexDirection: "row", alignItems: "center", gap: 5 },
  readyDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.textSubtle },
  readyDotActive: { backgroundColor: colors.success },
  readyText: { color: colors.textSubtle, fontSize: 8, fontWeight: "900" },
  readyTextActive: { color: colors.success },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  managerActions: { gap: spacing.sm },
  helperText: { color: colors.textSubtle, fontSize: 10, lineHeight: 15, textAlign: "center" },
  liveHero: { alignItems: "center", padding: spacing.xl, borderRadius: radius.card, borderWidth: 1, borderColor: colors.borderAccent, backgroundColor: colors.primarySubtle },
  livePulse: { width: 12, height: 12, marginBottom: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primary },
  liveEyebrow: { color: colors.primaryHover, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  liveTitle: { marginTop: spacing.xs, color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 22, fontWeight: "900", textAlign: "center" },
  liveMeta: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 11 },
  safetyCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.success, backgroundColor: colors.successMuted },
  safetyCopy: { flex: 1 },
  safetyTitle: { color: colors.success, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  safetyText: { marginTop: 3, color: colors.text, fontSize: 12, lineHeight: 18 },
  completeHero: { alignItems: "center", paddingVertical: spacing.xl },
  completeIcon: { width: 68, height: 68, alignItems: "center", justifyContent: "center", marginBottom: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primary },
  completeTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 22, fontWeight: "900" },
  completeText: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 13, textAlign: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { width: "48.5%", minHeight: 82, justifyContent: "center", padding: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statValue: { color: colors.text, fontFamily: typography.fontFamily.body, fontSize: 17, fontWeight: "900" },
  statLabel: { marginTop: spacing.xs, color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  stateIcon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primaryMuted },
  stateTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.title, fontWeight: "900", textAlign: "center" },
  stateText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  emptyCard: { minHeight: 300, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 16, fontWeight: "900" },
  emptyText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  errorText: { color: colors.primaryHover, fontSize: 11, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.86, transform: [{ translateY: 1 }, { scale: 0.985 }] },
});
