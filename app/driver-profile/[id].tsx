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
  View,
} from "react-native";

import { ReportModal } from "@/src/components/moderation/ReportModal";
import { NoxaButton, NoxaScreen } from "@/src/components/ui";
import { blockUser } from "@/src/lib/moderation";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

type DriverProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
};

type PublicVehicle = {
  id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  horsepower: number | null;
  color: string | null;
  cover_image_url: string | null;
  is_public: boolean | null;
};

type PublicPost = {
  id: string;
  image_url: string;
  created_at: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function HeaderAction({
  icon,
  onPress,
  label,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function normalizeRouteId(id: string | string[] | undefined) {
  const routeId = Array.isArray(id) ? id[0] : id;
  return routeId?.trim() ?? "";
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

function vehicleName(vehicle: PublicVehicle) {
  return [vehicle.year, vehicle.brand, vehicle.model].filter(Boolean).join(" ");
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
      {onRetry ? <NoxaButton title="Retry" onPress={onRetry} /> : null}
    </View>
  );
}

export default function PublicDriverProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const driverId = useMemo(() => normalizeRouteId(id), [id]);
  const isValidDriverId = uuidPattern.test(driverId);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const loadDriverProfile = useCallback(async () => {
    if (!isValidDriverId) {
      setProfile(null);
      setVehicles([]);
      setPosts([]);
      setErrorMessage("This driver profile link is invalid.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    setCurrentUserId(userId);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, bio, city")
      .eq("id", driverId)
      .maybeSingle();

    if (profileError) {
      setProfile(null);
      setVehicles([]);
      setPosts([]);
      setErrorMessage("Unable to load this driver profile.");
      setIsLoading(false);
      return;
    }

    if (!profileData) {
      setProfile(null);
      setVehicles([]);
      setPosts([]);
      setIsLoading(false);
      return;
    }

    const [followersResult, followingResult, relationshipResult] =
      await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", driverId),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", driverId),
        userId && userId !== driverId
          ? supabase
              .from("follows")
              .select("follower_id")
              .eq("follower_id", userId)
              .eq("following_id", driverId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    setFollowersCount(followersResult.count ?? 0);
    setFollowingCount(followingResult.count ?? 0);
    setIsFollowing(Boolean(relationshipResult.data));

    if (
      followersResult.error ||
      followingResult.error ||
      relationshipResult.error
    ) {
      setErrorMessage("Driver loaded, but social details could not be loaded.");
    }

    const [vehicleResult, postResult] = await Promise.all([
      supabase
        .from("vehicles")
        .select(
          "id, brand, model, year, horsepower, color, cover_image_url, is_public",
        )
        .eq("owner_id", driverId)
        .eq("is_public", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("posts")
        .select("id,image_url,created_at")
        .eq("author_id", driverId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    if (vehicleResult.error || postResult.error) {
      setProfile(profileData);
      setVehicles([]);
      setPosts([]);
      setErrorMessage(
        "Driver loaded, but public content could not be loaded.",
      );
      setIsLoading(false);
      return;
    }

    setProfile(profileData);
    setVehicles(vehicleResult.data ?? []);
    setPosts((postResult.data ?? []) as PublicPost[]);
    setIsLoading(false);
  }, [driverId, isValidDriverId]);

  useEffect(() => {
    void loadDriverProfile();
  }, [loadDriverProfile]);

  const refreshFollowDetails = useCallback(async () => {
    if (!isValidDriverId || !profile) {
      return;
    }

    const [followersResult, followingResult, relationshipResult] =
      await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", profile.id),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", profile.id),
        currentUserId && currentUserId !== profile.id
          ? supabase
              .from("follows")
              .select("follower_id")
              .eq("follower_id", currentUserId)
              .eq("following_id", profile.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    if (
      followersResult.error ||
      followingResult.error ||
      relationshipResult.error
    ) {
      Alert.alert("Social update failed", "Unable to refresh follow details.");
      return;
    }

    setFollowersCount(followersResult.count ?? 0);
    setFollowingCount(followingResult.count ?? 0);
    setIsFollowing(Boolean(relationshipResult.data));
  }, [currentUserId, isValidDriverId, profile]);

  const toggleFollow = useCallback(async () => {
    if (
      !currentUserId ||
      !profile ||
      currentUserId === profile.id ||
      isFollowLoading
    ) {
      return;
    }

    setIsFollowLoading(true);

    const { error } = isFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", profile.id)
      : await supabase.from("follows").insert({
          follower_id: currentUserId,
          following_id: profile.id,
        });

    if (error) {
      Alert.alert(
        isFollowing ? "Unfollow failed" : "Follow failed",
        "NOXA could not update this follow relationship. Please try again.",
      );
      setIsFollowLoading(false);
      return;
    }

    await refreshFollowDetails();
    setIsFollowLoading(false);
  }, [
    currentUserId,
    isFollowLoading,
    isFollowing,
    profile,
    refreshFollowDetails,
  ]);

  const confirmBlock = useCallback(() => {
    if (!profile || !currentUserId || currentUserId === profile.id || isBlocking) return;
    const name = profile.display_name?.trim() || "this driver";

    Alert.alert(
      `Block ${name}?`,
      "You will no longer see each other's profiles, content, follows, or Live Drive location. Existing follows will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setIsBlocking(true);
            try {
              await blockUser(profile.id);
              Alert.alert("Driver blocked", `${name} is now hidden from your NOXA account.`, [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (blockError) {
              Alert.alert(
                "Block failed",
                blockError instanceof Error ? blockError.message : "Please try again.",
              );
            } finally {
              setIsBlocking(false);
            }
          },
        },
      ],
    );
  }, [currentUserId, isBlocking, profile]);

  const openSafetyActions = useCallback(() => {
    if (!profile || !currentUserId || currentUserId === profile.id) return;
    Alert.alert("Driver actions", "Choose a safety action for this profile.", [
      { text: "Report User", onPress: () => setReportVisible(true) },
      { text: "Block User", style: "destructive", onPress: confirmBlock },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [confirmBlock, currentUserId, profile]);

  const displayName = profile?.display_name?.trim() || "NOXA Driver";
  const username = profile?.username ? `@${profile.username}` : null;
  const canFollow = Boolean(
    currentUserId && profile && currentUserId !== profile.id,
  );
  const stats = [
    { label: "Cars", value: vehicles.length },
    { label: "Followers", value: followersCount, mode: "followers" as const },
    { label: "Following", value: followingCount, mode: "following" as const },
  ];
  const coverVehicle =
    vehicles.find((vehicle) => Boolean(vehicle.cover_image_url)) ??
    vehicles[0] ??
    null;

  return (
    <NoxaScreen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <HeaderAction
            icon="chevron-back"
            label="Go back"
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle}>DRIVER PROFILE</Text>
          {canFollow ? (
            <HeaderAction
              icon={isBlocking ? "hourglass-outline" : "ellipsis-horizontal"}
              label="Driver safety actions"
              onPress={isBlocking ? undefined : openSafetyActions}
            />
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateMessage}>Loading driver profile…</Text>
          </View>
        ) : errorMessage && !profile ? (
          <StateCard
            title="Profile unavailable"
            message={errorMessage}
            onRetry={isValidDriverId ? loadDriverProfile : undefined}
          />
        ) : !profile ? (
          <StateCard
            title="Driver not found"
            message="No public NOXA profile exists for this driver."
            onRetry={loadDriverProfile}
          />
        ) : (
          <>
            <View style={styles.coverHero}>
              {coverVehicle?.cover_image_url ? (
                <Image
                  source={{ uri: coverVehicle.cover_image_url }}
                  style={styles.coverImage}
                />
              ) : (
                <View style={styles.coverFallback}>
                  <View style={styles.coverGlow} />
                  <Ionicons
                    name="car-sport"
                    size={74}
                    color={colors.primaryMuted}
                  />
                </View>
              )}
              <View style={styles.coverShade} />
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>NOXA DRIVER</Text>
              </View>
              {profile.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(displayName)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.identityBlock}>
              <View style={styles.identityRow}>
                <View style={styles.identityCopy}>
                  <Text style={styles.name}>{displayName}</Text>
                  {username ? (
                    <Text style={styles.username}>{username}</Text>
                  ) : null}
                </View>
                {canFollow ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isFollowLoading}
                    onPress={toggleFollow}
                    style={({ pressed }) => [
                      styles.followButton,
                      isFollowing && styles.followingButton,
                      pressed && !isFollowLoading && styles.pressed,
                      isFollowLoading && styles.followButtonDisabled,
                    ]}
                  >
                    {isFollowLoading ? (
                      <ActivityIndicator color={colors.text} size="small" />
                    ) : (
                      <Text
                        style={[
                          styles.followButtonText,
                          isFollowing && styles.followingButtonText,
                        ]}
                      >
                        {isFollowing ? "FOLLOWING" : "FOLLOW"}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
              </View>

              {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
              {profile.city ? (
                <View style={styles.metaRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={colors.primaryHover}
                  />
                  <Text style={styles.metaText}>{profile.city}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.statsCard}>
              {stats.map((stat, index) => {
                const content = (
                  <>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </>
                );

                if (stat.label === "Cars") {
                  return (
                    <View
                      key={stat.label}
                      style={[
                        styles.statItem,
                        index < stats.length - 1 && styles.statDivider,
                      ]}
                    >
                      {content}
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={stat.label}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/social-list",
                        params: { userId: profile.id, mode: stat.mode },
                      })
                    }
                    style={({ pressed }) => [
                      styles.statItem,
                      index < stats.length - 1 && styles.statDivider,
                      pressed && styles.pressed,
                    ]}
                  >
                    {content}
                  </Pressable>
                );
              })}
            </View>

            {errorMessage ? (
              <StateCard
                title="Profile warning"
                message={errorMessage}
                onRetry={loadDriverProfile}
              />
            ) : null}

            {posts.length ? (
              <>
                <SectionTitle title="Posts" />
                <View style={styles.postGrid}>
                  {posts.map((post) => (
                    <Pressable
                      accessibilityLabel="Open post"
                      accessibilityRole="button"
                      key={post.id}
                      onPress={() =>
                        router.push({ pathname: "/post-details", params: { id: post.id } })
                      }
                      style={({ pressed }) => [styles.postTile, pressed && styles.pressed]}>
                      <Image source={{ uri: post.image_url }} style={styles.postImage} />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {coverVehicle ? (
              <>
                <SectionTitle title="Featured build" />
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/vehicle-details",
                      params: { id: coverVehicle.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.featuredVehicle,
                    pressed && styles.pressed,
                  ]}
                >
                  {coverVehicle.cover_image_url ? (
                    <Image
                      source={{ uri: coverVehicle.cover_image_url }}
                      style={styles.featuredVehicleImage}
                    />
                  ) : (
                    <View style={styles.featuredVehicleFallback}>
                      <Ionicons
                        name="car-sport-outline"
                        size={44}
                        color={colors.primaryHover}
                      />
                    </View>
                  )}
                  <View style={styles.featuredVehicleShade} />
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>FEATURED</Text>
                  </View>
                  <View style={styles.featuredVehicleCopy}>
                    <Text style={styles.featuredVehicleName}>
                      {vehicleName(coverVehicle)}
                    </Text>
                    <Text style={styles.featuredVehicleMeta}>
                      {[coverVehicle.horsepower
                        ? `${coverVehicle.horsepower} HP`
                        : null, coverVehicle.color]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={19}
                    color={colors.text}
                    style={styles.featuredChevron}
                  />
                </Pressable>
              </>
            ) : null}

            {vehicles.length > 1 ? (
              <>
                <SectionTitle title="Public garage" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.garageList}
                >
                  {vehicles
                    .filter((vehicle) => vehicle.id !== coverVehicle?.id)
                    .map((vehicle) => (
                      <Pressable
                        key={vehicle.id}
                        accessibilityRole="button"
                        onPress={() =>
                          router.push({
                            pathname: "/vehicle-details",
                            params: { id: vehicle.id },
                          })
                        }
                        style={({ pressed }) => [
                          styles.carCard,
                          pressed && styles.pressed,
                        ]}
                      >
                        {vehicle.cover_image_url ? (
                          <Image
                            source={{ uri: vehicle.cover_image_url }}
                            style={styles.carImage}
                          />
                        ) : (
                          <View style={styles.carImageFallback}>
                            <Ionicons
                              name="car-sport-outline"
                              size={42}
                              color={colors.textMuted}
                            />
                          </View>
                        )}
                        <View style={styles.carShade} />
                        <View style={styles.carCopy}>
                          <Text style={styles.carName}>
                            {vehicleName(vehicle)}
                          </Text>
                          <View style={styles.carMetaRow}>
                            {vehicle.horsepower ? (
                              <Text style={styles.carPill}>
                                {vehicle.horsepower} HP
                              </Text>
                            ) : null}
                            {vehicle.color ? (
                              <Text style={styles.carPill}>
                                {vehicle.color}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    ))}
                </ScrollView>
              </>
            ) : null}

            {vehicles.length === 0 ? (
              <StateCard
                title="No public vehicles"
                message="This driver has not shared any public vehicles yet."
              />
            ) : null}
          </>
        )}
      </ScrollView>
      <ReportModal
        onClose={() => setReportVisible(false)}
        targetId={profile?.id ?? null}
        targetLabel="driver"
        targetType="profile"
        visible={reportVisible}
      />
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 132,
  },
  header: {
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  headerAction: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  headerSpacer: { width: 42, height: 42 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  loadingCard: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateCard: {
    marginTop: spacing.lg,
    gap: spacing.md,
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
  coverHero: {
    width: "100%",
    height: 228,
    overflow: "hidden",
    marginTop: spacing.xs,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  coverImage: { width: "100%", height: "100%" },
  coverFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceBase,
  },
  coverGlow: {
    position: "absolute",
    top: -80,
    right: -30,
    width: 250,
    height: 250,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  coverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  coverBadge: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(6,6,10,0.76)",
  },
  coverBadgeText: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  avatar: {
    position: "absolute",
    left: spacing.lg,
    bottom: spacing.md,
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: colors.text,
  },
  avatarFallback: {
    position: "absolute",
    left: spacing.lg,
    bottom: spacing.md,
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 42,
    borderWidth: 3,
    borderColor: colors.text,
    backgroundColor: colors.surfaceSoft,
  },
  avatarInitials: {
    color: colors.text,
    fontSize: typography.h2,
    fontWeight: "900",
  },
  identityBlock: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  identityCopy: { flex: 1, minWidth: 0 },
  name: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  username: {
    marginTop: spacing.xxs,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  bio: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
  },
  followButton: {
    minWidth: 112,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  followingButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
    shadowOpacity: 0,
  },
  followButtonDisabled: { opacity: 0.7 },
  followButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  followingButtonText: { color: colors.textMuted },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  statsCard: {
    marginTop: spacing.lg,
    flexDirection: "row",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: spacing.md,
  },
  statDivider: { borderRightWidth: 1, borderRightColor: colors.divider },
  statValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  postGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  postTile: {
    width: "31.6%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  postImage: { width: "100%", height: "100%" },
  featuredVehicle: {
    height: 172,
    overflow: "hidden",
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  featuredVehicleImage: { width: "100%", height: "100%" },
  featuredVehicleFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
  featuredVehicleShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  featuredBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(6,6,10,0.78)",
  },
  featuredBadgeText: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  featuredVehicleCopy: {
    position: "absolute",
    left: spacing.md,
    right: 44,
    bottom: spacing.md,
  },
  featuredVehicleName: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
  },
  featuredVehicleMeta: {
    marginTop: spacing.xxs,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  featuredChevron: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
  },
  garageList: { gap: spacing.sm, paddingRight: spacing.lg },
  carCard: {
    width: 224,
    height: 164,
    overflow: "hidden",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: colors.surface,
  },
  carImage: { width: "100%", height: "100%" },
  carImageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
  carShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  carCopy: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  carName: { color: colors.text, fontSize: 17, fontWeight: "900" },
  carMetaRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  carPill: {
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    color: colors.text,
    backgroundColor: "rgba(255,255,255,0.14)",
    fontSize: 11,
    fontWeight: "900",
  },
});
