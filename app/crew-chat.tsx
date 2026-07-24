import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  formatMessageTime,
  initials,
  uuidPattern,
} from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type CrewRow = {
  id: string;
  name: string;
  description: string | null;
};
type MessageRow = {
  id: string;
  crew_id: string;
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

export default function CrewChatScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const crewId = typeof params.id === "string" ? params.id : "";
  const scrollRef = useRef<ScrollView>(null);
  const [crew, setCrew] = useState<CrewRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [canChat, setCanChat] = useState(false);
  const [draft, setDraft] = useState("");
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!uuidPattern.test(crewId)) return;
    const { data, error: messagesError } = await supabase
      .from("crew_messages")
      .select("id,crew_id,sender_id,body,created_at")
      .eq("crew_id", crewId)
      .order("created_at", { ascending: true })
      .limit(250);
    if (messagesError) {
      setError(messagesError.message);
      return;
    }

    const nextMessages = (data ?? []) as MessageRow[];
    setMessages(nextMessages);
    const senderIds = Array.from(
      new Set(nextMessages.map((message) => message.sender_id)),
    );
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
        ((profileRows ?? []) as ProfileRow[]).map((profile) => [
          profile.id,
          profile,
        ]),
      ),
    );
  }, [crewId]);

  const loadChat = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!uuidPattern.test(crewId)) {
      setError("Invalid crew link.");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (authError || !userId) {
      setError("Sign in to open crew chat.");
      setLoading(false);
      return;
    }
    setCurrentUserId(userId);

    const [crewResult, membershipResult, countResult] = await Promise.all([
      supabase
        .from("crews")
        .select("id,name,description")
        .eq("id", crewId)
        .maybeSingle(),
      supabase
        .from("crew_members")
        .select("crew_id")
        .eq("crew_id", crewId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("crew_members")
        .select("crew_id", { count: "exact", head: true })
        .eq("crew_id", crewId),
    ]);

    if (crewResult.error || !crewResult.data) {
      setError(crewResult.error?.message ?? "Crew not found.");
      setLoading(false);
      return;
    }

    setCrew(crewResult.data as CrewRow);
    setMemberCount(countResult.error ? 0 : (countResult.count ?? 0));
    const allowed = !membershipResult.error && Boolean(membershipResult.data);
    setCanChat(allowed);
    if (allowed) await loadMessages();
    setLoading(false);
  }, [crewId, loadMessages]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  useEffect(() => {
    if (!canChat || !uuidPattern.test(crewId)) return;
    const channel = supabase
      .channel(`noxa-crew-chat-${crewId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "crew_messages",
          filter: `crew_id=eq.${crewId}`,
        },
        () => void loadMessages(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canChat, crewId, loadMessages]);

  const sendMessage = useCallback(async () => {
    const body = draft.trim();
    if (!body || !currentUserId || !canChat || sending) return;
    setSending(true);
    setError(null);
    const { error: sendError } = await supabase.from("crew_messages").insert({
      crew_id: crewId,
      sender_id: currentUserId,
      body,
    });
    if (sendError) setError(sendError.message);
    else {
      setDraft("");
      await loadMessages();
    }
    setSending(false);
  }, [canChat, crewId, currentUserId, draft, loadMessages, sending]);

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
              <Text numberOfLines={1} style={styles.headerTitle}>CREW CHAT</Text>
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={9} color={colors.primaryHover} />
                <Text style={styles.privateText}>MEMBERS</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {crew?.name ?? "NOXA crew"} · {memberCount} members
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Refresh crew chat"
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
            <Text style={styles.stateText}>Loading crew chat…</Text>
          </View>
        ) : !canChat ? (
          <View style={styles.state}>
            <View style={styles.lockIcon}>
              <Ionicons name="lock-closed" size={28} color={colors.primaryHover} />
            </View>
            <Text style={styles.stateTitle}>MEMBERS-ONLY CHAT</Text>
            <Text style={styles.stateText}>
              Join this crew to read and send messages.
            </Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <NoxaButton title="BACK TO CREW" onPress={() => router.back()} />
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
              showsVerticalScrollIndicator={false}
            >
              {crew?.description && noticeVisible ? (
                <View style={styles.notice}>
                  <View style={styles.noticeIcon}>
                    <Ionicons name="megaphone" size={15} color={colors.primaryHover} />
                  </View>
                  <View style={styles.noticeCopy}>
                    <Text style={styles.noticeLabel}>CREW NOTICE</Text>
                    <Text style={styles.noticeText}>{crew.description}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Hide crew notice"
                    onPress={() => setNoticeVisible(false)}
                    style={styles.noticeClose}
                  >
                    <Ionicons name="close" size={15} color={colors.textSubtle} />
                  </Pressable>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {messages.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={30} color={colors.textSubtle} />
                  <Text style={styles.emptyTitle}>START THE CREW CHAT</Text>
                  <Text style={styles.emptyText}>
                    Messages are visible only to current crew members.
                  </Text>
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
                      <View style={[styles.messageBlock, mine && styles.messageBlockMine]}>
                        {!mine ? <Text style={styles.sender}>{name}</Text> : null}
                        <View style={[styles.bubble, mine && styles.bubbleMine]}>
                          <Text style={styles.messageBody}>{message.body}</Text>
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

            <View style={styles.composer}>
              <TextInput
                accessibilityLabel="Crew message"
                editable={!sending}
                maxLength={2000}
                multiline
                onChangeText={setDraft}
                onSubmitEditing={() => void sendMessage()}
                placeholder="Message the crew…"
                placeholderTextColor={colors.textSubtle}
                selectionColor={colors.primary}
                style={styles.input}
                value={draft}
              />
              <Pressable
                accessibilityLabel="Send message"
                accessibilityRole="button"
                disabled={!draft.trim() || sending}
                onPress={() => void sendMessage()}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!draft.trim() || sending) && styles.sendDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {sending ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color={colors.text} />
                )}
              </Pressable>
            </View>
          </>
        )}
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
  headerCopy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  headerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  privateText: {
    color: colors.primaryHover,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  messages: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  noticeIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  noticeCopy: { flex: 1, gap: spacing.xxs },
  noticeLabel: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  noticeText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  noticeClose: { padding: spacing.xxs },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  messageRowMine: { justifyContent: "flex-end" },
  messageBlock: { maxWidth: "78%", alignItems: "flex-start" },
  messageBlockMine: { alignItems: "flex-end" },
  sender: {
    marginBottom: 4,
    marginLeft: spacing.xs,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  avatar: { width: 30, height: 30, borderRadius: radius.pill },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  avatarText: { color: colors.text, fontSize: 8, fontWeight: "900" },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  bubbleMine: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 5,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  messageBody: { color: colors.text, fontSize: 14, lineHeight: 20 },
  messageTime: {
    marginTop: 4,
    marginLeft: spacing.xs,
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: "700",
  },
  messageTimeMine: { marginLeft: 0, marginRight: spacing.xs },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? spacing.lg : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surfaceBase,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  sendDisabled: { opacity: 0.35 },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  lockIcon: {
    width: 64,
    height: 64,
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
  },
  stateText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  empty: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 16,
    fontWeight: "900",
  },
  emptyText: { maxWidth: 270, color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  errorCard: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: { color: colors.primaryHover, fontSize: 11, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.86, transform: [{ translateY: 1 }, { scale: 0.985 }] },
});
