import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
} from "react-native";

import { ReportModal } from "@/src/components/moderation/ReportModal";
import { NoxaButton, NoxaScreen } from "@/src/components/ui";
import { EntityActionSheet, type EntityAction } from "@/src/features/crews-events/EntityActionSheet";
import { VehicleTypeIcon } from "@/src/features/garage/vehicle-picker/components/VehicleTypeIcon";
import { formatProfileLocation } from "@/src/features/profile/formatProfileLocation";
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
  country_code: string | null;
};

type PublicVehicle = {
  id: string;
  vehicle_type: "car" | "motorcycle";
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

function HeaderAction({ icon, onPress, label }: { icon: IconName; onPress?: () => void; label: string }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
      <Ionicons name={icon} size={21} color={colors.text} />
    </Pressable>
  );
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

function formatUsername(username: string | null) {
  if (!username) return null;
  return username.startsWith("@") ? username : `@${username}`;
}

function vehicleName(vehicle: PublicVehicle) {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
}

function StateCard({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {onRetry ? <NoxaButton title="Retry" onPress={onRetry} /> : null}
    </View>
  );
}

function IdentityBlock({
  profile,
  displayName,
  username,
  canFollow,
  isFollowing,
  isFollowLoading,
  onFollow,
}: {
  profile: DriverProfile;
  displayName: string;
  username: string | null;
  canFollow: boolean;
  isFollowing: boolean;
  isFollowLoading: boolean;
  onFollow: () => void;
}) {
  const location = formatProfileLocation(profile.country_code, profile.city);

  return (
    <View style={styles.identityBlock}>
      <View style={styles.identityTop}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} accessibilityLabel={`${displayName} avatar`} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
          </View>
        )}
        <View style={styles.identityCopy}>
          <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
          {username ? <Text numberOfLines={1} style={styles.username}>{username}</Text> : null}
          {location ? (
            <View style={styles.locationRow}>
              {location.flag ? (
                <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.locationFlag}>
                  {location.flag}
                </Text>
              ) : (
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              )}
              <Text numberOfLines={1} style={styles.location}>{location.text}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {canFollow ? (
        <Pressable
          accessibilityRole="button"
          disabled={isFollowLoading}
          onPress={onFollow}
          style={({ pressed }) => [
            styles.followButton,
            isFollowing && styles.followingButton,
            pressed && !isFollowLoading && styles.pressed,
            isFollowLoading && styles.disabled,
          ]}>
          {isFollowLoading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? "FOLLOWING" : "FOLLOW"}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function CommunityRow({
  profileId,
  followersCount,
  followingCount,
  vehiclesCount,
}: {
  profileId: string;
  followersCount: number;
  followingCount: number;
  vehiclesCount: number;
}) {
  return (
    <View style={styles.communityRow}>
      <View style={styles.communityMetric}>
        <Text style={styles.communityValue}>{vehiclesCount}</Text>
        <Text style={styles.communityLabel}>Vehicles</Text>
      </View>
      <View style={styles.communityDivider} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: "/social-list", params: { userId: profileId, mode: "followers" } })}
        style={({ pressed }) => [styles.communityMetric, pressed && styles.pressed]}>
        <Text style={styles.communityValue}>{followersCount}</Text>
        <Text style={styles.communityLabel}>Followers</Text>
      </Pressable>
      <View style={styles.communityDivider} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: "/social-list", params: { userId: profileId, mode: "following" } })}
        style={({ pressed }) => [styles.communityMetric, pressed && styles.pressed]}>
        <Text style={styles.communityValue}>{followingCount}</Text>
        <Text style={styles.communityLabel}>Following</Text>
      </Pressable>
    </View>
  );
}

function FeaturedVehicle({ vehicle }: { vehicle: PublicVehicle }) {
  const meta = [
    vehicle.year ? String(vehicle.year) : null,
    vehicle.horsepower === null ? null : `${vehicle.horsepower} HP`,
    vehicle.color,
  ].filter(Boolean).join(" · ");

  const content = (
    <>
      <View style={styles.vehicleShade} />
      <View style={styles.vehicleBadge}>
        <VehicleTypeIcon vehicleType={vehicle.vehicle_type} size={14} color={colors.primaryHover} />
        <Text style={styles.vehicleBadgeText}>{vehicle.vehicle_type === "motorcycle" ? "MOTORCYCLE" : "CAR"}</Text>
      </View>
      <View style={styles.vehicleCopy}>
        <Text numberOfLines={1} style={styles.vehicleTitle}>{vehicleName(vehicle)}</Text>
        {meta ? <Text numberOfLines={1} style={styles.vehicleMeta}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={19} color={colors.text} style={styles.vehicleChevron} />
    </>
  );

  return (
    <Pressable
      accessibilityLabel={`Open ${vehicleName(vehicle)}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/vehicle-details", params: { id: vehicle.id } })}
      style={({ pressed }) => [styles.featuredVehicle, pressed && styles.pressed]}>
      {vehicle.cover_image_url ? (
        <ImageBackground
          source={{ uri: vehicle.cover_image_url }}
          resizeMode="cover"
          style={styles.vehicleArtwork}
          imageStyle={styles.vehicleArtworkRadius as ImageStyle}>
          {content}
        </ImageBackground>
      ) : (
        <View style={[styles.vehicleArtwork, styles.vehicleFallback]}>
          <VehicleTypeIcon vehicleType={vehicle.vehicle_type} size={64} color={colors.primaryMuted} />
          {content}
        </View>
      )}
    </Pressable>
  );
}

function VehicleCollection({ vehicles, featuredId }: { vehicles: PublicVehicle[]; featuredId: string | null }) {
  const rest = vehicles.filter((vehicle) => vehicle.id !== featuredId);
  if (!rest.length) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>PUBLIC GARAGE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleList}>
        {rest.map((vehicle) => (
          <Pressable
            key={vehicle.id}
            accessibilityLabel={`Open ${vehicleName(vehicle)}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/vehicle-details", params: { id: vehicle.id } })}
            style={({ pressed }) => [styles.smallVehicle, pressed && styles.pressed]}>
            {vehicle.cover_image_url ? (
              <Image source={{ uri: vehicle.cover_image_url }} style={styles.smallVehicleImage} />
            ) : (
              <View style={styles.smallVehicleFallback}>
                <VehicleTypeIcon vehicleType={vehicle.vehicle_type} size={42} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.smallVehicleShade} />
            <View style={styles.smallVehicleCopy}>
              <Text numberOfLines={1} style={styles.smallVehicleName}>{vehicleName(vehicle)}</Text>
              <Text style={styles.smallVehicleMeta}>{vehicle.year || (vehicle.vehicle_type === "motorcycle" ? "Motorcycle" : "Car")}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Moments({ posts }: { posts: PublicPost[] }) {
  if (!posts.length) return null;

  return (
    <View style={styles.section}>
      <View>
        <Text style={styles.sectionEyebrow}>MOMENTS</Text>
        <Text style={styles.sectionCaption}>{posts.length === 1 ? "1 shared moment" : `${posts.length} shared moments`}</Text>
      </View>
      <View style={styles.postGrid}>
        {posts.slice(0, 6).map((post) => (
          <Pressable
            accessibilityLabel="Open post"
            accessibilityRole="button"
            key={post.id}
            onPress={() => router.push({ pathname: "/post-details", params: { id: post.id } })}
            style={({ pressed }) => [styles.postTile, pressed && styles.pressed]}>
            <Image source={{ uri: post.image_url }} style={styles.postImage} />
          </Pressable>
        ))}
      </View>
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
  const [actionsVisible, setActionsVisible] = useState(false);
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
      .select("id, display_name, username, avatar_url, bio, city, country_code")
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

    const [followersResult, followingResult, relationshipResult] = await Promise.all([
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", driverId),
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", driverId),
      userId && userId !== driverId
        ? supabase.from("follows").select("follower_id").eq("follower_id", userId).eq("following_id", driverId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    setFollowersCount(followersResult.count ?? 0);
    setFollowingCount(followingResult.count ?? 0);
    setIsFollowing(Boolean(relationshipResult.data));

    if (followersResult.error || followingResult.error || relationshipResult.error) {
      setErrorMessage("Driver loaded, but social details could not be loaded.");
    }

    const [vehicleResult, postResult] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, vehicle_type, brand, model, year, horsepower, color, cover_image_url, is_public")
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
      setErrorMessage("Driver loaded, but public content could not be loaded.");
      setIsLoading(false);
      return;
    }

    setProfile(profileData);
    setVehicles((vehicleResult.data ?? []) as PublicVehicle[]);
    setPosts((postResult.data ?? []) as PublicPost[]);
    setIsLoading(false);
  }, [driverId, isValidDriverId]);

  useEffect(() => {
    void loadDriverProfile();
  }, [loadDriverProfile]);

  const refreshFollowDetails = useCallback(async () => {
    if (!isValidDriverId || !profile) return;

    const [followersResult, followingResult, relationshipResult] = await Promise.all([
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profile.id),
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profile.id),
      currentUserId && currentUserId !== profile.id
        ? supabase.from("follows").select("follower_id").eq("follower_id", currentUserId).eq("following_id", profile.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (followersResult.error || followingResult.error || relationshipResult.error) {
      Alert.alert("Social update failed", "Unable to refresh follow details.");
      return;
    }

    setFollowersCount(followersResult.count ?? 0);
    setFollowingCount(followingResult.count ?? 0);
    setIsFollowing(Boolean(relationshipResult.data));
  }, [currentUserId, isValidDriverId, profile]);

  const toggleFollow = useCallback(async () => {
    if (!currentUserId || !profile || currentUserId === profile.id || isFollowLoading) return;

    setIsFollowLoading(true);
    const { error } = isFollowing
      ? await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", profile.id)
      : await supabase.from("follows").insert({ follower_id: currentUserId, following_id: profile.id });

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
  }, [currentUserId, isFollowLoading, isFollowing, profile, refreshFollowDetails]);

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
              Alert.alert("Block failed", blockError instanceof Error ? blockError.message : "Please try again.");
            } finally {
              setIsBlocking(false);
            }
          },
        },
      ],
    );
  }, [currentUserId, isBlocking, profile]);

  const displayName = profile?.display_name?.trim() || "NOXA Driver";
  const username = formatUsername(profile?.username ?? null);
  const canFollow = Boolean(currentUserId && profile && currentUserId !== profile.id);
  const featuredVehicle = vehicles.find((vehicle) => Boolean(vehicle.cover_image_url)) ?? vehicles[0] ?? null;
  const safetyActions = useMemo<EntityAction[]>(() => {
    if (!canFollow || !profile) return [];
    return [
      {
        key: "report",
        label: "Report driver",
        icon: "flag-outline",
        onPress: () => setReportVisible(true),
      },
      {
        key: "block",
        label: isBlocking ? "Blocking…" : "Block driver",
        icon: "ban-outline",
        destructive: true,
        disabled: isBlocking,
        onPress: confirmBlock,
      },
    ];
  }, [canFollow, confirmBlock, isBlocking, profile]);

  return (
    <NoxaScreen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <HeaderAction icon="chevron-back" label="Go back" onPress={() => router.back()} />
          <Text style={styles.headerTitle}>DRIVER</Text>
          {canFollow ? (
            <HeaderAction
              icon={isBlocking ? "hourglass-outline" : "ellipsis-horizontal"}
              label="Driver safety actions"
              onPress={isBlocking ? undefined : () => setActionsVisible(true)}
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
          <StateCard title="Profile unavailable" message={errorMessage} onRetry={isValidDriverId ? loadDriverProfile : undefined} />
        ) : !profile ? (
          <StateCard title="Driver not found" message="No public NOXA profile exists for this driver." onRetry={loadDriverProfile} />
        ) : (
          <>
            <IdentityBlock
              profile={profile}
              displayName={displayName}
              username={username}
              canFollow={canFollow}
              isFollowing={isFollowing}
              isFollowLoading={isFollowLoading}
              onFollow={toggleFollow}
            />

            <CommunityRow
              profileId={profile.id}
              followersCount={followersCount}
              followingCount={followingCount}
              vehiclesCount={vehicles.length}
            />

            {errorMessage ? (
              <View style={styles.warningRow}>
                <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
                <Text style={styles.warningText}>{errorMessage}</Text>
                <Pressable accessibilityRole="button" onPress={loadDriverProfile}>
                  <Text style={styles.warningAction}>RETRY</Text>
                </Pressable>
              </View>
            ) : null}

            {featuredVehicle ? (
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>VEHICLE</Text>
                <FeaturedVehicle vehicle={featuredVehicle} />
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>VEHICLE</Text>
                <View style={styles.emptyVehicle}>
                  <VehicleTypeIcon vehicleType="car" size={28} color={colors.textMuted} />
                  <Text style={styles.emptyVehicleText}>No public vehicle shared yet.</Text>
                </View>
              </View>
            )}

            <VehicleCollection vehicles={vehicles} featuredId={featuredVehicle?.id ?? null} />
            <Moments posts={posts} />
          </>
        )}
      </ScrollView>

      <EntityActionSheet
        actions={safetyActions}
        onClose={() => setActionsVisible(false)}
        title={displayName}
        visible={actionsVisible && canFollow}
      />
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
    gap: spacing.xl,
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.display,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  headerSpacer: { width: 40, height: 40 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  loadingCard: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md },
  stateCard: { gap: spacing.md, paddingVertical: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  stateTitle: { color: colors.text, fontSize: typography.h2, fontWeight: "900" },
  stateMessage: { color: colors.textMuted, fontSize: typography.body, fontWeight: "700", lineHeight: 22 },
  identityBlock: { gap: spacing.md },
  identityTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 86, height: 86, borderRadius: radius.pill },
  avatarFallback: { width: 86, height: 86, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.borderStrong },
  avatarInitials: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.h2, fontWeight: "900" },
  identityCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.h2, fontWeight: "900", lineHeight: typography.lineHeight.h2 },
  username: { marginTop: 2, color: colors.textMuted, fontSize: typography.caption, fontWeight: "700" },
  locationRow: { marginTop: spacing.xs, flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  locationFlag: { fontSize: 14, lineHeight: 16 },
  location: { flexShrink: 1, color: colors.textMuted, fontSize: typography.caption, fontWeight: "700" },
  bio: { color: colors.text, fontSize: 13, fontWeight: "600", lineHeight: 20 },
  followButton: { minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.button, backgroundColor: colors.primary },
  followingButton: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.borderStrong },
  followButtonText: { color: colors.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  followingButtonText: { color: colors.textMuted },
  communityRow: { minHeight: 64, flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  communityMetric: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  communityDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.divider },
  communityValue: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.subtitle, fontWeight: "900" },
  communityLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "700" },
  warningRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  warningText: { flex: 1, color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  warningAction: { color: colors.text, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  section: { gap: spacing.sm },
  sectionEyebrow: { color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  sectionCaption: { marginTop: 2, color: colors.textSubtle, fontSize: 9, fontWeight: "700" },
  featuredVehicle: { height: 210, overflow: "hidden", borderRadius: radius.hero, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, ...shadows.card },
  vehicleArtwork: { flex: 1, justifyContent: "flex-end" },
  vehicleArtworkRadius: { borderRadius: radius.hero },
  vehicleFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSoft },
  vehicleShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,6,10,0.34)" },
  vehicleBadge: { position: "absolute", top: spacing.md, left: spacing.md, minHeight: 30, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: "rgba(6,6,10,0.72)" },
  vehicleBadgeText: { color: colors.primaryHover, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  vehicleCopy: { position: "absolute", left: spacing.md, right: 48, bottom: spacing.md },
  vehicleTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.title, fontWeight: "900" },
  vehicleMeta: { marginTop: spacing.xs, color: "rgba(240,240,244,0.72)", fontSize: typography.caption, fontWeight: "700" },
  vehicleChevron: { position: "absolute", right: spacing.md, bottom: spacing.md },
  emptyVehicle: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  emptyVehicleText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: "700" },
  vehicleList: { gap: spacing.sm, paddingRight: spacing.lg },
  smallVehicle: { width: 210, height: 142, overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.surface },
  smallVehicleImage: { width: "100%", height: "100%" },
  smallVehicleFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSoft },
  smallVehicleShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,6,10,0.30)" },
  smallVehicleCopy: { position: "absolute", left: spacing.sm, right: spacing.sm, bottom: spacing.sm },
  smallVehicleName: { color: colors.text, fontSize: 14, fontWeight: "900" },
  smallVehicleMeta: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  postGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  postTile: { width: "31.6%", aspectRatio: 1, overflow: "hidden", borderRadius: radius.sm, backgroundColor: colors.surfaceSoft },
  postImage: { width: "100%", height: "100%" },
});
