import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NoxaIconButton, NoxaScreen, NoxaTopBar } from "@/src/components/ui";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

type SocialTab = "followers" | "following";

type SocialProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeParam(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function normalizeMode(value?: string | string[]): SocialTab | null {
  const mode = normalizeParam(value);
  return mode === "followers" || mode === "following" ? mode : null;
}

function getInitials(displayName: string) {
  return (
    displayName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2) || "NX"
  );
}

function Header() {
  return (
    <NoxaTopBar
      left={
        <NoxaIconButton
          accessibilityLabel="Go back"
          icon="chevron-back"
          onPress={() => router.back()}
          variant="ghost"
        />
      }
      title="Social"
    />
  );
}

function SocialTabs({
  activeTab,
  followersCount,
  followingCount,
  onChange,
}: {
  activeTab: SocialTab;
  followersCount: number;
  followingCount: number;
  onChange: (tab: SocialTab) => void;
}) {
  return (
    <View style={styles.tabs}>
      {(["followers", "following"] as const).map((tab) => {
        const isActive = activeTab === tab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(tab)}
            style={({ pressed }) => [
              styles.tabButton,
              isActive && styles.activeTabButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {tab === "followers"
                ? `Followers · ${followersCount}`
                : `Following · ${followingCount}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StateCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SocialRow({ profile }: { profile: SocialProfile }) {
  const displayName = profile.display_name?.trim() || "NOXA Driver";
  const username = profile.username ? `@${profile.username}` : "@noxa.driver";
  const meta = profile.city ? `${username} · ${profile.city}` : username;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${displayName} public driver profile`}
      onPress={() =>
        router.push({
          pathname: "/driver-profile/[id]",
          params: { id: profile.id },
        })
      }
      style={({ pressed }) => [styles.userRow, pressed && styles.pressed]}
    >
      {profile.avatar_url ? (
        <Image
          source={{ uri: profile.avatar_url }}
          style={styles.avatarImage}
        />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
        </View>
      )}
      <View style={styles.userCopy}>
        <Text style={styles.userName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text numberOfLines={1} style={styles.username}>{meta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function SocialListScreen() {
  const { userId, mode, tab } = useLocalSearchParams<{
    userId?: string | string[];
    mode?: string | string[];
    tab?: string | string[];
  }>();
  const initialMode = useMemo(
    () => normalizeMode(mode) ?? normalizeMode(tab),
    [mode, tab],
  );
  const loadRequestIdRef = useRef(0);
  const [activeTab, setActiveTab] = useState<SocialTab>(
    initialMode ?? "followers",
  );
  const [targetUserId, setTargetUserId] = useState("");
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const routeUserId = useMemo(() => normalizeParam(userId), [userId]);
  const hasInvalidMode =
    !initialMode && Boolean(normalizeParam(mode) || normalizeParam(tab));

  useEffect(() => {
    if (initialMode) {
      setActiveTab(initialMode);
    }
  }, [initialMode]);

  const loadSocialList = useCallback(
    async ({ refreshing = false } = {}) => {
      const requestId = ++loadRequestIdRef.current;
      const requestedTab = activeTab;
      const isCurrentRequest = () => requestId === loadRequestIdRef.current;

      if (hasInvalidMode) {
        setErrorMessage("This social list mode is invalid.");
        setProfiles([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      let targetId = routeUserId;
      if (!targetId) {
        const { data } = await supabase.auth.getUser();
        if (!isCurrentRequest()) return;
        targetId = data.user?.id ?? "";
      }

      if (!uuidPattern.test(targetId)) {
        if (!isCurrentRequest()) return;
        setTargetUserId(targetId);
        setProfiles([]);
        setErrorMessage("This social list link is invalid.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (!isCurrentRequest()) return;
      setTargetUserId(targetId);

      const [followersResult, followingResult, followResult] =
        await Promise.all([
          supabase
            .from("follows")
            .select("follower_id", { count: "exact", head: true })
            .eq("following_id", targetId),
          supabase
            .from("follows")
            .select("following_id", { count: "exact", head: true })
            .eq("follower_id", targetId),
          requestedTab === "followers"
            ? supabase
                .from("follows")
                .select("follower_id, created_at")
                .eq("following_id", targetId)
                .order("created_at", { ascending: false })
            : supabase
                .from("follows")
                .select("following_id, created_at")
                .eq("follower_id", targetId)
                .order("created_at", { ascending: false }),
        ]);

      if (!isCurrentRequest()) return;
      setFollowersCount(followersResult.count ?? 0);
      setFollowingCount(followingResult.count ?? 0);

      const followRows = followResult.data;
      const followError =
        followersResult.error ?? followingResult.error ?? followResult.error;

      if (followError) {
        setProfiles([]);
        setErrorMessage("Unable to load this social list.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const profileIds = (followRows ?? [])
        .map((row) => {
          const followRow = row as {
            follower_id?: string | null;
            following_id?: string | null;
          };
          return requestedTab === "followers"
            ? followRow.follower_id
            : followRow.following_id;
        })
        .filter((id): id is string => Boolean(id));

      if (profileIds.length === 0) {
        if (!isCurrentRequest()) return;
        setProfiles([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, city")
        .in("id", profileIds);

      if (!isCurrentRequest()) return;
      if (profileError) {
        setProfiles([]);
        setErrorMessage("Unable to load driver profiles.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const profileById = new Map(
        (profileRows ?? []).map((profile) => [profile.id, profile]),
      );
      setProfiles(
        profileIds
          .map((id) => profileById.get(id))
          .filter(Boolean) as SocialProfile[],
      );
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [activeTab, hasInvalidMode, routeUserId],
  );

  useEffect(() => {
    void loadSocialList();
  }, [loadSocialList]);

  const visibleProfiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return profiles;

    return profiles.filter((profile) =>
      [profile.display_name, profile.username, profile.city]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery)),
    );
  }, [profiles, searchQuery]);

  const emptyTitle =
    searchQuery.trim().length > 0
      ? "No matching drivers"
      : activeTab === "followers"
        ? "No followers yet"
        : "Not following anyone yet";
  const emptyMessage =
    searchQuery.trim().length > 0
      ? `No one in this list matches “${searchQuery.trim()}”.`
      : activeTab === "followers"
        ? "Real followers will appear here when drivers follow this profile."
        : "Real following relationships will appear here when this driver follows others.";

  return (
    <NoxaScreen padded={false}>
      <FlatList
        data={visibleProfiles}
        keyExtractor={(item) => `${activeTab}-${targetUserId}-${item.id}`}
        renderItem={({ item }) => <SocialRow profile={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={isRefreshing}
            onRefresh={() => void loadSocialList({ refreshing: true })}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Header />
            <SocialTabs
              activeTab={activeTab}
              followersCount={followersCount}
              followingCount={followingCount}
              onChange={setActiveTab}
            />
            <View style={styles.searchShell}>
              <Ionicons name="search" size={17} color={colors.textMuted} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={60}
                onChangeText={setSearchQuery}
                placeholder="Search this list…"
                placeholderTextColor={colors.textSubtle}
                selectionColor={colors.primary}
                style={styles.searchInput}
                value={searchQuery}
              />
              {searchQuery ? (
                <Pressable
                  accessibilityLabel="Clear social search"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setSearchQuery("")}
                >
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateMessage}>
                Loading…
              </Text>
            </View>
          ) : errorMessage ? (
            <StateCard
              title="Social list unavailable"
              message={errorMessage}
              onRetry={loadSocialList}
            />
          ) : (
            <StateCard title={emptyTitle} message={emptyMessage} />
          )
        }
      />
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    gap: 0,
  },
  listHeader: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTabButton: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  activeTabText: { color: colors.text, fontWeight: "700" },
  searchShell: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  loadingCard: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingVertical: spacing.xxl,
  },
  stateCard: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  stateTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: "700",
  },
  stateMessage: {
    color: colors.textMuted,
    ...typography.v2.body,
  },
  retryButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  retryText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  userRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: colors.primaryMuted,
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  avatarText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
  userCopy: { flex: 1, minWidth: 0 },
  userName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
  username: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  viewPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  viewPillText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
});
