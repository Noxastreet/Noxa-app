import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CrewModuleHeader,
  CrewModuleIconButton,
  CrewModuleState,
} from "@/src/components/crew/CrewModuleChrome";
import { NoxaButton, NoxaScreen } from "@/src/components/ui";
import { uuidPattern } from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type CrewRole = "owner" | "admin" | "member";
type CrewRow = { id: string; name: string };
type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};
type PollRow = {
  id: string;
  crew_id: string;
  created_by: string;
  question: string;
  status: "open" | "closed";
  closes_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};
type OptionRow = {
  id: string;
  poll_id: string;
  label: string;
  position: number;
};
type ResultRow = {
  poll_id: string;
  option_id: string;
  vote_count: number | string;
  is_selected: boolean;
};
type PollOption = OptionRow & { voteCount: number; selected: boolean };
type CrewPoll = PollRow & { creator?: ProfileRow; options: PollOption[] };
type PollFilter = "all" | "open" | "closed";

const durationOptions: { label: string; hours: number | null }[] = [
  { label: "NO DEADLINE", hours: null },
  { label: "24 HOURS", hours: 24 },
  { label: "3 DAYS", hours: 72 },
  { label: "7 DAYS", hours: 168 },
];

function profileName(profile?: ProfileRow) {
  return profile?.display_name || profile?.username || "NOXA manager";
}

function isPollClosed(poll: PollRow) {
  return poll.status === "closed" || Boolean(
    poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now(),
  );
}

function deadlineLabel(poll: PollRow) {
  if (!poll.closes_at) return isPollClosed(poll) ? "Closed" : "No deadline";
  const date = new Date(poll.closes_at);
  const formatted = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return isPollClosed(poll) ? `Ended ${formatted}` : `Closes ${formatted}`;
}

function PollOptionRow({
  closed,
  disabled,
  onVote,
  option,
  totalVotes,
}: {
  closed: boolean;
  disabled: boolean;
  onVote: () => void;
  option: PollOption;
  totalVotes: number;
}) {
  const percentage = totalVotes
    ? Math.round((option.voteCount / totalVotes) * 100)
    : 0;
  return (
    <Pressable
      accessibilityLabel={`${option.label}, ${percentage} percent, ${option.voteCount} votes`}
      accessibilityRole="button"
      disabled={closed || disabled}
      onPress={onVote}
      style={({ pressed }) => [
        styles.option,
        option.selected && styles.optionSelected,
        (closed || disabled) && styles.optionDisabled,
        pressed && !closed && !disabled && styles.pressed,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.optionFill,
          option.selected && styles.optionFillSelected,
          { width: `${percentage}%` },
        ]}
      />
      <View style={[styles.radio, option.selected && styles.radioSelected]}>
        {option.selected ? <View style={styles.radioDot} /> : null}
      </View>
      <Text numberOfLines={2} style={[styles.optionLabel, option.selected && styles.optionLabelSelected]}>
        {option.label}
      </Text>
      <View style={styles.optionResult}>
        <Text style={[styles.optionPercent, option.selected && styles.optionPercentSelected]}>
          {percentage}%
        </Text>
        <Text style={styles.optionVotes}>{option.voteCount}</Text>
      </View>
    </Pressable>
  );
}

function PollCard({
  canManage,
  onClose,
  onVote,
  poll,
  working,
}: {
  canManage: boolean;
  onClose: () => void;
  onVote: (optionId: string) => void;
  poll: CrewPoll;
  working: boolean;
}) {
  const closed = isPollClosed(poll);
  const totalVotes = poll.options.reduce((sum, option) => sum + option.voteCount, 0);
  const hasVoted = poll.options.some((option) => option.selected);
  return (
    <View style={styles.pollCard}>
      <View style={styles.pollTopRow}>
        <View style={[styles.statusBadge, closed && styles.statusBadgeClosed]}>
          <View style={[styles.statusDot, closed && styles.statusDotClosed]} />
          <Text style={[styles.statusText, closed && styles.statusTextClosed]}>
            {closed ? "CLOSED" : "OPEN"}
          </Text>
        </View>
        {canManage && !closed ? (
          <Pressable
            accessibilityLabel="Close poll"
            accessibilityRole="button"
            disabled={working}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
            <Text style={styles.closeText}>CLOSE</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.question}>{poll.question}</Text>
      <View style={styles.authorRow}>
        <Ionicons name="shield-checkmark-outline" size={13} color={colors.primaryHover} />
        <Text numberOfLines={1} style={styles.authorText}>
          {profileName(poll.creator)} · {deadlineLabel(poll)}
        </Text>
      </View>

      <View style={styles.options}>
        {poll.options.map((option) => (
          <PollOptionRow
            closed={closed}
            disabled={working}
            key={option.id}
            onVote={() => onVote(option.id)}
            option={option}
            totalVotes={totalVotes}
          />
        ))}
      </View>

      <View style={styles.pollFooter}>
        <View style={styles.voteCountRow}>
          <Ionicons name="people-outline" size={14} color={colors.textMuted} />
          <Text style={styles.voteCount}>{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</Text>
        </View>
        <Text style={styles.voteHint}>
          {closed
            ? "FINAL RESULT"
            : hasVoted
              ? "TAP TO CHANGE"
              : "TAP TO VOTE"}
        </Text>
      </View>
    </View>
  );
}

function PollComposer({
  creating,
  onCancel,
  onCreate,
}: {
  creating: boolean;
  onCancel: () => void;
  onCreate: (question: string, options: string[], hours: number | null) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState<number | null>(72);
  const validOptions = options.map((option) => option.trim()).filter(Boolean);
  const uniqueOptions = new Set(validOptions.map((option) => option.toLowerCase()));
  const canSubmit =
    question.trim().length >= 5 &&
    validOptions.length === options.length &&
    uniqueOptions.size === validOptions.length;

  return (
    <View style={styles.composer}>
      <View style={styles.composerHeading}>
        <View>
          <Text style={styles.composerEyebrow}>MANAGER TOOL</Text>
          <Text style={styles.composerTitle}>NEW CREW POLL</Text>
        </View>
        <Pressable
          accessibilityLabel="Close poll composer"
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>QUESTION</Text>
      <TextInput
        maxLength={180}
        multiline
        onChangeText={setQuestion}
        placeholder="What should the crew decide?"
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        style={[styles.field, styles.questionField]}
        value={question}
      />
      <Text style={styles.counter}>{question.trim().length} / 180</Text>

      <Text style={styles.fieldLabel}>OPTIONS</Text>
      <View style={styles.optionFields}>
        {options.map((option, index) => (
          <View key={index} style={styles.optionFieldRow}>
            <View style={styles.optionNumber}>
              <Text style={styles.optionNumberText}>{index + 1}</Text>
            </View>
            <TextInput
              maxLength={100}
              onChangeText={(value) =>
                setOptions((current) =>
                  current.map((item, itemIndex) => itemIndex === index ? value : item),
                )
              }
              placeholder={`Option ${index + 1}`}
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              style={[styles.field, styles.optionField]}
              value={option}
            />
            {options.length > 2 ? (
              <Pressable
                accessibilityLabel={`Remove option ${index + 1}`}
                accessibilityRole="button"
                onPress={() =>
                  setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
                style={({ pressed }) => [styles.removeOption, pressed && styles.pressed]}
              >
                <Ionicons name="remove" size={17} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      {options.length < 6 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOptions((current) => [...current, ""])}
          style={({ pressed }) => [styles.addOption, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={16} color={colors.primaryHover} />
          <Text style={styles.addOptionText}>ADD OPTION</Text>
        </Pressable>
      ) : null}

      <Text style={styles.fieldLabel}>VOTING WINDOW</Text>
      <View style={styles.durationRow}>
        {durationOptions.map((item) => {
          const active = duration === item.hours;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.label}
              onPress={() => setDuration(item.hours)}
              style={({ pressed }) => [
                styles.durationButton,
                active && styles.durationButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.durationText, active && styles.durationTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.composerActions}>
        <NoxaButton
          disabled={creating}
          onPress={onCancel}
          size="md"
          title="Cancel"
          variant="secondary"
        />
        <View style={styles.createPollButton}>
          <NoxaButton
            disabled={!canSubmit || creating}
            fullWidth
            onPress={() => onCreate(question.trim(), validOptions, duration)}
            size="md"
            title={creating ? "Creating…" : "Create Poll"}
          />
        </View>
      </View>
    </View>
  );
}

export default function CrewPollsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const crewId = typeof params.id === "string" ? params.id : "";
  const [crew, setCrew] = useState<CrewRow | null>(null);
  const [polls, setPolls] = useState<CrewPoll[]>([]);
  const [role, setRole] = useState<CrewRole | null>(null);
  const [filter, setFilter] = useState<PollFilter>("all");
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [workingPollId, setWorkingPollId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canView = role !== null;
  const canManage = role === "owner" || role === "admin";

  const loadPolls = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    if (!uuidPattern.test(crewId)) {
      setError("Invalid crew link.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (authError || !userId) {
      setError("Sign in to open crew polls.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [crewResult, membershipResult] = await Promise.all([
      supabase.from("crews").select("id,name").eq("id", crewId).maybeSingle(),
      supabase
        .from("crew_members")
        .select("role")
        .eq("crew_id", crewId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (crewResult.error || !crewResult.data) {
      setError(crewResult.error?.message ?? "Crew not found.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setCrew(crewResult.data as CrewRow);
    const membershipRole = membershipResult.error
      ? null
      : ((membershipResult.data?.role as CrewRole | undefined) ?? null);
    setRole(membershipRole);
    if (!membershipRole) {
      setPolls([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: pollRows, error: pollsError } = await supabase
      .from("crew_polls")
      .select(
        "id,crew_id,created_by,question,status,closes_at,closed_at,created_at,updated_at",
      )
      .eq("crew_id", crewId)
      .order("created_at", { ascending: false });
    if (pollsError) {
      setError(pollsError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = (pollRows ?? []) as PollRow[];
    if (!rows.length) {
      setPolls([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const pollIds = rows.map((poll) => poll.id);
    const creatorIds = Array.from(new Set(rows.map((poll) => poll.created_by)));
    const [optionsResult, profilesResult, resultsResult] = await Promise.all([
      supabase
        .from("crew_poll_options")
        .select("id,poll_id,label,position")
        .in("poll_id", pollIds)
        .order("position", { ascending: true }),
      supabase
        .from("profiles")
        .select("id,display_name,username")
        .in("id", creatorIds),
      supabase.rpc("noxa_get_crew_poll_results", { target_crew_id: crewId }),
    ]);
    const loadError = optionsResult.error || profilesResult.error || resultsResult.error;
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const profiles = new Map(
      ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
    );
    const results = new Map(
      ((resultsResult.data ?? []) as ResultRow[]).map((result) => [
        result.option_id,
        { voteCount: Number(result.vote_count), selected: result.is_selected },
      ]),
    );
    const optionsByPoll = new Map<string, PollOption[]>();
    for (const option of (optionsResult.data ?? []) as OptionRow[]) {
      const result = results.get(option.id) ?? { voteCount: 0, selected: false };
      optionsByPoll.set(option.poll_id, [
        ...(optionsByPoll.get(option.poll_id) ?? []),
        { ...option, ...result },
      ]);
    }
    setPolls(
      rows.map((poll) => ({
        ...poll,
        creator: profiles.get(poll.created_by),
        options: optionsByPoll.get(poll.id) ?? [],
      })),
    );
    setLoading(false);
    setRefreshing(false);
  }, [crewId]);

  useEffect(() => {
    void loadPolls();
  }, [loadPolls]);

  useEffect(() => {
    if (!canView || !uuidPattern.test(crewId)) return;
    const channel = supabase
      .channel(`noxa-crew-polls-${crewId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crew_polls",
          filter: `crew_id=eq.${crewId}`,
        },
        () => void loadPolls(false),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canView, crewId, loadPolls]);

  const visiblePolls = useMemo(() => polls.filter((poll) => {
    if (filter === "all") return true;
    return filter === "closed" ? isPollClosed(poll) : !isPollClosed(poll);
  }), [filter, polls]);

  const createPoll = useCallback(async (
    question: string,
    options: string[],
    hours: number | null,
  ) => {
    if (!canManage || creating) return;
    setCreating(true);
    setActionError(null);
    const { error: createError } = await supabase.rpc("noxa_create_crew_poll", {
      target_crew_id: crewId,
      poll_question: question,
      option_labels: options,
      closes_in_hours: hours,
    });
    if (createError) setActionError(createError.message);
    else {
      setShowComposer(false);
      setFilter("all");
      await loadPolls(false);
    }
    setCreating(false);
  }, [canManage, creating, crewId, loadPolls]);

  const vote = useCallback(async (poll: CrewPoll, optionId: string) => {
    if (workingPollId || isPollClosed(poll)) return;
    const selected = poll.options.find((option) => option.id === optionId)?.selected;
    if (selected) return;
    setWorkingPollId(poll.id);
    setActionError(null);
    const { error: voteError } = await supabase.rpc("noxa_vote_crew_poll", {
      target_poll_id: poll.id,
      target_option_id: optionId,
    });
    if (voteError) setActionError(voteError.message);
    await loadPolls(false);
    setWorkingPollId(null);
  }, [loadPolls, workingPollId]);

  const closePoll = useCallback((poll: CrewPoll) => {
    if (!canManage || workingPollId) return;
    Alert.alert(
      "Close this poll?",
      "Voting will stop and the current totals will become final.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Poll",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setWorkingPollId(poll.id);
              setActionError(null);
              const { error: closeError } = await supabase.rpc("noxa_close_crew_poll", {
                target_poll_id: poll.id,
              });
              if (closeError) setActionError(closeError.message);
              await loadPolls(false);
              setWorkingPollId(null);
            })();
          },
        },
      ],
    );
  }, [canManage, loadPolls, workingPollId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadPolls(false);
  }, [loadPolls]);

  return (
    <NoxaScreen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <CrewModuleHeader
          badge="MEMBERS"
          right={
            <View style={styles.headerActions}>
              <CrewModuleIconButton
                disabled={refreshing}
                icon="refresh"
                label="Refresh crew polls"
                onPress={onRefresh}
              />
              {canManage ? (
                <CrewModuleIconButton
                  icon={showComposer ? "close" : "add"}
                  label={showComposer ? "Close poll composer" : "Create crew poll"}
                  onPress={() => setShowComposer((current) => !current)}
                />
              ) : null}
            </View>
          }
          subtitle={crew?.name ?? "NOXA crew"}
          title="CREW POLLS"
        />

        {loading ? (
          <CrewModuleState
            icon="stats-chart-outline"
            loading
            message="Loading private crew decisions."
            title="Loading polls"
          />
        ) : error ? (
          <CrewModuleState
            actionLabel="Retry"
            icon="cloud-offline-outline"
            message={error}
            onAction={() => void loadPolls()}
            title="Polls unavailable"
          />
        ) : !canView ? (
          <CrewModuleState
            icon="lock-closed-outline"
            message="Join this crew to view and vote in its polls."
            title="Members only"
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                onRefresh={onRefresh}
                refreshing={refreshing}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {showComposer && canManage ? (
              <PollComposer
                creating={creating}
                onCancel={() => setShowComposer(false)}
                onCreate={(question, options, hours) =>
                  void createPoll(question, options, hours)
                }
              />
            ) : null}

            {actionError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={17} color={colors.warning} />
                <Text style={styles.errorText}>{actionError}</Text>
                <Pressable
                  accessibilityLabel="Dismiss error"
                  accessibilityRole="button"
                  onPress={() => setActionError(null)}
                >
                  <Ionicons name="close" size={17} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.introRow}>
              <View style={styles.introCopy}>
                <Text style={styles.introEyebrow}>CREW DECISIONS</Text>
                <Text style={styles.introTitle}>VOTE TOGETHER</Text>
                <Text style={styles.introText}>
                  Results show totals only. Individual voter identities stay private.
                </Text>
              </View>
              <View style={styles.totalBadge}>
                <Text style={styles.totalValue}>{polls.length}</Text>
                <Text style={styles.totalLabel}>POLLS</Text>
              </View>
            </View>

            <View style={styles.filters}>
              {(["all", "open", "closed"] as PollFilter[]).map((item) => {
                const active = filter === item;
                const count = polls.filter((poll) =>
                  item === "all" ? true : item === "closed" ? isPollClosed(poll) : !isPollClosed(poll),
                ).length;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item}
                    onPress={() => setFilter(item)}
                    style={({ pressed }) => [
                      styles.filterButton,
                      active && styles.filterButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {item.toUpperCase()}
                    </Text>
                    <Text style={[styles.filterCount, active && styles.filterCountActive]}>{count}</Text>
                  </Pressable>
                );
              })}
            </View>

            {visiblePolls.length ? (
              <View style={styles.pollList}>
                {visiblePolls.map((poll) => (
                  <PollCard
                    canManage={canManage}
                    key={poll.id}
                    onClose={() => closePoll(poll)}
                    onVote={(optionId) => void vote(poll, optionId)}
                    poll={poll}
                    working={workingPollId === poll.id}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="stats-chart-outline" size={28} color={colors.primaryHover} />
                </View>
                <Text style={styles.emptyTitle}>NO {filter === "all" ? "" : `${filter.toUpperCase()} `}POLLS</Text>
                <Text style={styles.emptyText}>
                  {canManage && filter === "all"
                    ? "Start a private poll when the crew needs to make a decision."
                    : "There is nothing in this view yet."}
                </Text>
                {canManage && filter === "all" ? (
                  <NoxaButton onPress={() => setShowComposer(true)} size="md" title="Create Poll" />
                ) : filter !== "all" ? (
                  <NoxaButton onPress={() => setFilter("all")} size="md" title="Show All" variant="secondary" />
                ) : null}
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: "row", gap: spacing.xs },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  introRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  introCopy: { flex: 1 },
  introEyebrow: { color: colors.primaryHover, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  introTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    fontWeight: "900",
  },
  introText: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 11, fontWeight: "700", lineHeight: 17 },
  totalBadge: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  totalValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
  },
  totalLabel: { color: colors.primaryHover, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  filters: {
    minHeight: 44,
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.sm,
  },
  filterButtonActive: { backgroundColor: colors.surfaceRaised },
  filterText: { color: colors.textSubtle, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  filterTextActive: { color: colors.text },
  filterCount: { color: colors.textSubtle, fontSize: 9, fontWeight: "900" },
  filterCountActive: { color: colors.primaryHover },
  pollList: { gap: spacing.md },
  pollCard: {
    padding: spacing.lg,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pollTopRow: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(48,209,88,0.28)",
    backgroundColor: colors.successMuted,
  },
  statusBadgeClosed: { borderColor: colors.border, backgroundColor: colors.surfaceSoft },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.success },
  statusDotClosed: { backgroundColor: colors.textSubtle },
  statusText: { color: colors.success, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  statusTextClosed: { color: colors.textMuted },
  closeButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingLeft: spacing.sm },
  closeText: { color: colors.textMuted, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  question: {
    marginTop: spacing.md,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 28,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.xs },
  authorText: { flex: 1, color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  options: { gap: spacing.xs, marginTop: spacing.lg },
  option: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  optionSelected: { borderColor: colors.borderAccent },
  optionDisabled: { opacity: 0.84 },
  optionFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  optionFillSelected: { backgroundColor: colors.primarySubtle },
  radio: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.textSubtle,
  },
  radioSelected: { borderColor: colors.primaryHover },
  radioDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.primaryHover },
  optionLabel: { flex: 1, color: colors.textMuted, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  optionLabelSelected: { color: colors.text },
  optionResult: { alignItems: "flex-end" },
  optionPercent: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  optionPercentSelected: { color: colors.primaryHover },
  optionVotes: { marginTop: 1, color: colors.textSubtle, fontSize: 8, fontWeight: "900" },
  pollFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  voteCountRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  voteCount: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  voteHint: { color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  composer: {
    padding: spacing.lg,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
    ...shadows.redGlow,
  },
  composerHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  composerEyebrow: { color: colors.primaryHover, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  composerTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
  },
  dismissButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  fieldLabel: { marginTop: spacing.md, marginBottom: spacing.xs, color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  field: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  questionField: { minHeight: 92, paddingTop: spacing.md, textAlignVertical: "top" },
  counter: { marginTop: 4, color: colors.textSubtle, fontSize: 8, fontWeight: "700", textAlign: "right" },
  optionFields: { gap: spacing.xs },
  optionFieldRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  optionNumber: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primarySubtle },
  optionNumberText: { color: colors.primaryHover, fontSize: 9, fontWeight: "900" },
  optionField: { flex: 1 },
  removeOption: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSoft },
  addOption: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: spacing.sm, paddingVertical: spacing.xs },
  addOptionText: { color: colors.primaryHover, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  durationButton: { minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft },
  durationButtonActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySubtle },
  durationText: { color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  durationTextActive: { color: colors.primaryHover },
  composerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  createPollButton: { flex: 1 },
  errorBanner: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,159,10,0.28)",
    backgroundColor: colors.warningMuted,
  },
  errorText: { flex: 1, color: colors.warning, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  emptyCard: {
    minHeight: 250,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primarySubtle },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: "900", letterSpacing: 0.8 },
  emptyText: { maxWidth: 270, color: colors.textMuted, fontSize: 12, fontWeight: "700", lineHeight: 18, textAlign: "center" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
