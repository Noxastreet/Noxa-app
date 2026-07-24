import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

import { NoxaScreen } from "@/src/components/ui";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

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
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>SOCIAL</Text>
        <Text style={styles.headerSubtitle}>Followers &amp; Following</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
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
    <View style={styles.tabsCard}>
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
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.city}>{profile.city || "NOXA community"}</Text>
      </View>
      <View style={styles.viewPill}>
        <Text style={styles.viewPillText}>VIEW</Text>
      </View>
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
        targetId = data.user?.id ?? "";
      }

      if (!uuidPattern.test(targetId)) {
        setTargetUserId(targetId);
        setProfiles([]);
        setErrorMessage("This social list link is invalid.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

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
          activeTab === "followers"
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
          return activeTab === "followers"
            ? followRow.follower_id
            : followRow.following_id;
        })
        .filter((id): id is string => Boolean(id));

      if (profileIds.length === 0) {
        setProfiles([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, city")
        .in("id", profileIds);

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
                Loading real social graph…
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 132,
    gap: 0,
  },
  listHeader: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  headerCopy: { alignItems: "center", gap: spacing.xxs },
  headerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  headerSpacer: { width: 44 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  tabsCard: {
    flexDirection: "row",
    borderBottomWidth: 1,
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
    fontSize: typography.caption,
    fontWeight: "900",
  },
  activeTabText: { color: colors.text },
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
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateCard: {
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateTitle: {
    color: colors.text,
    fontSize: typography.h2,
    fontWeight: "900",
  },
  stateMessage: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 22,
  },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadows.redGlow,
  },
  retryText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  userRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatar: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: colors.primaryMuted,
  },
  avatarImage: { width: 50, height: 50, borderRadius: 25 },
  avatarText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
  userCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  userName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
  },
  username: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  city: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "700",
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
