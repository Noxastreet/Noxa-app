import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NoxaButton, NoxaScreen } from "@/src/components/ui";
import {
  eventLifecycle,
  formatMessageTime,
  initials,
  lifecycleLabel,
  uuidPattern,
  type EventExperienceRow,
} from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type EventChatRow = Pick<
  EventExperienceRow,
  "id" | "title" | "description" | "starts_at" | "ends_at" | "status"
>;
type MessageRow = {
  id: string;
  event_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function profileName(profile?: ProfileRow) {
  return profile?.display_name || profile?.username || "NOXA driver";
}

export default function EventChatScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === "string" ? params.id : "";
  const scrollRef = useRef<ScrollView>(null);
  const [event, setEvent] = useState<EventChatRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [canChat, setCanChat] = useState(false);
  const [draft, setDraft] = useState("");
  const [pinnedVisible, setPinnedVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lifecycle = useMemo(
    () => (event ? eventLifecycle(event) : "upcoming"),
    [event],
  );

  const loadMessages = useCallback(async () => {
    if (!uuidPattern.test(eventId)) return;
    const { data, error: messagesError } = await supabase
      .from("event_messages")
      .select("id,event_id,sender_id,body,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .limit(250);
    if (messagesError) {
      setError(messagesError.message);
      return;
    }

    const nextMessages = (data ?? []) as MessageRow[];
    setMessages(nextMessages);
    const senderIds = Array.from(new Set(nextMessages.map((message) => message.sender_id)));
    if (!senderIds.length) {
      setProfiles({});
      return;
    }
    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", senderIds);
    if (profilesError) {
      setError(profilesError.message);
      return;
    }
    setProfiles(
      Object.fromEntries(
        ((profileRows ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
      ),
    );
  }, [eventId]);

  const loadChat = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!uuidPattern.test(eventId)) {
      setError("Invalid event link.");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (authError || !userId) {
      setError("Sign in to open event chat.");
      setLoading(false);
      return;
    }
    setCurrentUserId(userId);

    const [eventResult, memberResult, countResult] = await Promise.all([
      supabase
        .from("events")
        .select("id,title,description,starts_at,ends_at,status")
        .eq("id", eventId)
        .maybeSingle(),
      supabase
        .from("event_attendees")
        .select("event_id")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("event_attendees")
        .select("event_id", { count: "exact", head: true })
        .eq("event_id", eventId),
    ]);

    if (eventResult.error || !eventResult.data) {
      setError(eventResult.error?.message ?? "Event not found.");
      setLoading(false);
      return;
    }

    setEvent(eventResult.data as EventChatRow);
    setParticipantCount(countResult.error ? 0 : (countResult.count ?? 0));
    const allowed = !memberResult.error && Boolean(memberResult.data);
    setCanChat(allowed);
    if (allowed) await loadMessages();
    setLoading(false);
  }, [eventId, loadMessages]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  useEffect(() => {
    if (!canChat || !uuidPattern.test(eventId)) return;
    const channel = supabase
      .channel(`noxa-event-chat-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_messages",
          filter: `event_id=eq.${eventId}`,
        },
        () => void loadMessages(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canChat, eventId, loadMessages]);

  const sendMessage = useCallback(async () => {
    const body = draft.trim();
    if (!body || !currentUserId || !canChat || sending) return;
    setSending(true);
    setError(null);
    const { error: sendError } = await supabase.from("event_messages").insert({
      event_id: eventId,
      sender_id: currentUserId,
      body,
    });
    if (sendError) setError(sendError.message);
    else {
      setDraft("");
      await loadMessages();
    }
    setSending(false);
  }, [canChat, currentUserId, draft, eventId, loadMessages, sending]);

  return (
    <NoxaScreen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
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
            <View style={styles.titleRow}>
              <Text numberOfLines={1} style={styles.headerTitle}>EVENT CHAT</Text>
              {event ? (
                <View
                  style={[
                    styles.lifecycleBadge,
                    lifecycle === "live" && styles.lifecycleLive,
                    lifecycle === "completed" && styles.lifecycleComplete,
                  ]}
                >
                  <View
                    style={[
                      styles.lifecycleDot,
                      lifecycle === "completed" && styles.lifecycleDotComplete,
                    ]}
                  />
                  <Text
                    style={[
                      styles.lifecycleText,
                      lifecycle === "completed" && styles.lifecycleTextComplete,
                    ]}
                  >
                    {lifecycleLabel(lifecycle)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.headerSubtitle}>
              {event?.title ?? "NOXA event"} · {participantCount} participants
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Refresh chat"
            accessibilityRole="button"
            onPress={() => void loadMessages()}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="refresh" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading event chat…</Text>
          </View>
        ) : !canChat ? (
          <View style={styles.state}>
            <View style={styles.stateIcon}>
              <Ionicons name="chatbubbles-outline" size={30} color={colors.primaryHover} />
            </View>
            <Text style={styles.stateTitle}>CHAT IS FOR PARTICIPANTS</Text>
            <Text style={styles.stateText}>
              RSVP to this event before joining the attendee conversation.
            </Text>
            <NoxaButton
              title="BACK TO EVENT"
              onPress={() => router.replace({ pathname: "/event-details", params: { id: eventId } })}
            />
          </View>
        ) : (
          <>
            {pinnedVisible && event?.description ? (
              <View style={styles.pinnedCard}>
                <View style={styles.pinnedRail} />
                <View style={styles.pinnedCopy}>
                  <Text style={styles.pinnedLabel}>PINNED · EVENT ORGANIZER</Text>
                  <Text numberOfLines={3} style={styles.pinnedText}>{event.description}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Hide pinned note"
                  onPress={() => setPinnedVisible(false)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={17} color={colors.textSubtle} />
                </Pressable>
              </View>
            ) : null}

            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.systemMessage}>
                <Text style={styles.systemText}>{lifecycleLabel(lifecycle)}</Text>
              </View>
              {messages.length === 0 ? (
                <View style={styles.emptyChat}>
                  <Ionicons name="chatbubble-ellipses-outline" size={27} color={colors.textSubtle} />
                  <Text style={styles.emptyTitle}>START THE CONVERSATION</Text>
                  <Text style={styles.emptyText}>Share arrival updates and event details here.</Text>
                </View>
              ) : (
                messages.map((message) => {
                  const mine = message.sender_id === currentUserId;
                  const profile = profiles[message.sender_id];
                  const name = profileName(profile);
                  return (
                    <View
                      key={message.id}
                      style={[styles.messageRow, mine && styles.messageRowMine]}
                    >
                      {!mine ? (
                        profile?.avatar_url ? (
                          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatar, styles.avatarFallback]}>
                            <Text style={styles.avatarText}>{initials(name)}</Text>
                          </View>
                        )
                      ) : null}
                      <View style={[styles.messageStack, mine && styles.messageStackMine]}>
                        {!mine ? <Text style={styles.senderName}>{name}</Text> : null}
                        <View style={[styles.bubble, mine && styles.bubbleMine]}>
                          <Text style={styles.messageText}>{message.body}</Text>
                        </View>
                        <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>
                          {formatMessageTime(message.created_at)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                editable={!sending}
                maxLength={2000}
                multiline
                placeholder="Message attendees…"
                placeholderTextColor={colors.textSubtle}
                selectionColor={colors.primary}
                style={styles.input}
              />
              <Pressable
                accessibilityLabel="Send message"
                accessibilityRole="button"
                disabled={!draft.trim() || sending}
                onPress={() => void sendMessage()}
                style={({ pressed }) => [
                  styles.sendButton,
                  Boolean(draft.trim()) && styles.sendButtonActive,
                  pressed && styles.pressed,
                  sending && styles.disabled,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Ionicons
                    name="send"
                    size={17}
                    color={draft.trim() ? colors.text : colors.textSubtle}
                  />
                )}
              </Pressable>
            </View>
          </>
        )}
        {!canChat && error ? <Text style={styles.stateError}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  headerCopy: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  headerTitle: {
    maxWidth: "56%",
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  headerSubtitle: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  lifecycleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingVertical: 3,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  lifecycleLive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  lifecycleComplete: {
    borderColor: "rgba(48,209,88,0.25)",
    backgroundColor: colors.successMuted,
  },
  lifecycleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  lifecycleDotComplete: { backgroundColor: colors.success },
  lifecycleText: { color: colors.primaryHover, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  lifecycleTextComplete: { color: colors.success },
  pinnedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  pinnedRail: { width: 5, alignSelf: "stretch", borderRadius: 3, backgroundColor: colors.primary },
  pinnedCopy: { flex: 1, gap: spacing.xxs },
  pinnedLabel: { color: colors.primaryHover, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  pinnedText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  messages: { flexGrow: 1, padding: spacing.sm, paddingBottom: spacing.lg },
  systemMessage: { alignItems: "center", paddingVertical: spacing.sm },
  systemText: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    overflow: "hidden",
    borderRadius: radius.pill,
    color: colors.primaryHover,
    backgroundColor: colors.primarySubtle,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  messageRowMine: { justifyContent: "flex-end" },
  avatar: { width: 30, height: 30, borderRadius: radius.pill },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  avatarText: { color: colors.text, fontSize: 9, fontWeight: "900" },
  messageStack: { maxWidth: "78%", alignItems: "flex-start" },
  messageStackMine: { alignItems: "flex-end" },
  senderName: { marginBottom: 3, color: colors.textSubtle, fontSize: 10, fontWeight: "700" },
  bubble: {
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  bubbleMine: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  messageText: { color: colors.text, fontSize: 14, fontWeight: "500", lineHeight: 20 },
  messageTime: { marginTop: 3, color: colors.textSubtle, fontSize: 9, fontWeight: "600" },
  messageTimeMine: { textAlign: "right" },
  emptyChat: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  emptyTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 18, fontWeight: "900" },
  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surfaceBase,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 112,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  sendButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  inlineError: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.primaryHover,
    backgroundColor: colors.primarySubtle,
    fontSize: 11,
    fontWeight: "700",
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateIcon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
    textAlign: "center",
  },
  stateText: { color: colors.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 20, textAlign: "center" },
  stateError: { padding: spacing.md, color: colors.primaryHover, textAlign: "center" },
  pressed: { opacity: 0.86, transform: [{ translateY: 1 }, { scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
