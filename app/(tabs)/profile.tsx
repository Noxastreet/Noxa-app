import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoxaAvatar, NoxaIconButton, NoxaScreen } from '@/src/components/ui';
import { clearGroupDriveLocationBeforeSignOut } from '@/src/features/group-drive/runtime/nativeLocation';
import { VehicleTypeIcon } from '@/src/features/garage/vehicle-picker/components/VehicleTypeIcon';
import { formatProfileLocation } from '@/src/features/profile/formatProfileLocation';
import { stopLiveDriveSession } from '@/src/lib/liveDrive';
import { getCurrentSessionUser, supabase } from '@/src/lib/supabase';
import { resetToSignedOutHome } from '@/src/navigation/authNavigation';
import { colors, radius, spacing, typography } from '@/src/theme';

type CurrentUserProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  country_code: string | null;
};

type ProfileVehicle = {
  id: string;
  vehicle_type: 'car' | 'motorcycle';
  brand: string;
  model: string | null;
  year: number | null;
  horsepower: number | null;
  color: string | null;
  cover_image_url: string | null;
  is_primary: boolean;
};

type ProfilePost = {
  id: string;
  image_url: string;
  created_at: string;
};

function getProfileInitials(displayName: string) {
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  return initials || 'NX';
}

function formatUsername(username: string | null) {
  if (!username) return 'Add username';
  return username.startsWith('@') ? username : `@${username}`;
}

function TopBar() {
  return (
    <View style={styles.topBar}>
      <Text style={styles.pageTitle}>Profile</Text>
      <NoxaIconButton
        accessibilityLabel="Profile settings"
        accessibilityHint="Opens settings"
        icon="settings-outline"
        variant="ghost"
        onPress={() => router.push('/settings')}
      />
    </View>
  );
}

function Identity({
  profile,
  isLoading,
  errorMessage,
  onRetry,
  profileId,
  followersCount,
  followingCount,
}: {
  profile: CurrentUserProfile | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  profileId: string | null;
  followersCount: number;
  followingCount: number;
}) {
  const displayName = profile?.display_name ?? 'NOXA driver';
  const username = formatUsername(profile?.username ?? null);
  const bio = profile?.bio?.trim() || 'Tell the community about yourself.';
  const location = formatProfileLocation(profile?.country_code, profile?.city);

  return (
    <View style={styles.identity}>
      <View style={styles.identityTop}>
        <View style={styles.avatarRing}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} accessibilityLabel={`${displayName} avatar`} />
          ) : (
            <NoxaAvatar initials={getProfileInitials(displayName)} size={82} />
          )}
        </View>
        <View style={styles.identityNames}>
          <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
          <Text numberOfLines={1} style={styles.username}>{isLoading ? 'Loading profile…' : username}</Text>
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

      <View style={styles.identitySocialRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!profileId}
          onPress={profileId ? () => router.push({ pathname: '/social-list', params: { userId: profileId, mode: 'followers' } }) : undefined}
          style={({ pressed }) => [styles.identitySocialMetric, pressed && styles.pressed]}>
          <Text style={styles.identitySocialValue}>{followersCount}</Text>
          <Text style={styles.identitySocialLabel}>followers</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!profileId}
          onPress={profileId ? () => router.push({ pathname: '/social-list', params: { userId: profileId, mode: 'following' } }) : undefined}
          style={({ pressed }) => [styles.identitySocialMetric, pressed && styles.pressed]}>
          <Text style={styles.identitySocialValue}>{followingCount}</Text>
          <Text style={styles.identitySocialLabel}>following</Text>
        </Pressable>
      </View>

      <Text style={styles.bio}>{bio}</Text>

      <Pressable
        accessibilityLabel="Edit Profile"
        accessibilityRole="button"
        onPress={() => router.push('/edit-profile')}
        style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
        <Text style={styles.editButtonText}>Edit profile</Text>
      </Pressable>

      {errorMessage ? (
        <View style={styles.inlineErrorRow}>
          <Text style={styles.inlineError}>{errorMessage}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function GarageFeature({
  vehicle,
  vehiclesCount,
}: {
  vehicle: ProfileVehicle | null;
  vehiclesCount: number;
}) {
  if (!vehicle) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Garage</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add your first vehicle"
          onPress={() => router.push('/vehicle-picker')}
          style={({ pressed }) => [styles.emptyGarage, pressed && styles.pressed]}
        >
          <View style={styles.vehicleThumbFallback}>
            <Ionicons name="add" size={22} color={colors.textMuted} />
          </View>
          <View style={styles.emptyGarageCopy}>
            <Text style={styles.emptyGarageTitle}>Add your first vehicle</Text>
            <Text style={styles.emptyGarageText}>Add a vehicle to show it here.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </Pressable>
      </View>
    );
  }

  const title = [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
  const details = [
    vehicle.year ? String(vehicle.year) : null,
    vehicle.horsepower === null ? null : `${vehicle.horsepower} HP`,
    vehicle.color,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Garage</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all vehicles"
          onPress={() => router.push('/(tabs)/garage')}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.sectionLink}>
            {vehiclesCount === 1 ? '1 vehicle' : `${vehiclesCount} vehicles`}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel={`Open ${title}`}
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: '/vehicle-details', params: { id: vehicle.id } })
        }
        style={({ pressed }) => [styles.vehicleRow, pressed && styles.pressed]}
      >
        {vehicle.cover_image_url ? (
          <Image
            source={{ uri: vehicle.cover_image_url }}
            style={styles.vehicleThumb}
          />
        ) : (
          <View style={[styles.vehicleThumb, styles.vehicleThumbFallback]}>
            <VehicleTypeIcon
              vehicleType={vehicle.vehicle_type}
              size={28}
              color={colors.textMuted}
            />
          </View>
        )}
        <View style={styles.vehicleRowCopy}>
          <View style={styles.vehicleTitleLine}>
            <Text numberOfLines={1} style={styles.vehicleTitle}>{title}</Text>
            {vehicle.is_primary ? (
              <Text style={styles.primaryVehicleState}>Primary</Text>
            ) : null}
          </View>
          {details ? <Text numberOfLines={1} style={styles.vehicleMeta}>{details}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Pressable>
    </View>
  );
}

function ProfilePosts({ posts, isLoading }: { posts: ProfilePost[]; isLoading: boolean }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Moments</Text>
          <Text style={styles.sectionCaption}>{posts.length === 1 ? '1 shared moment' : `${posts.length} shared moments`}</Text>
        </View>
        <Pressable accessibilityLabel="Create post" accessibilityRole="button" onPress={() => router.push('/post-editor')}>
          <Ionicons name="add" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {isLoading ? (
        <Text style={styles.mutedText}>Loading moments…</Text>
      ) : posts.length ? (
        <View style={styles.postGrid}>
          {posts.slice(0, 6).map((post) => (
            <Pressable
              key={post.id}
              accessibilityLabel="Open post"
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/post-details', params: { id: post.id } })}
              style={({ pressed }) => [styles.postTile, pressed && styles.pressed]}>
              <Image source={{ uri: post.image_url }} style={styles.postImage} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => router.push('/post-editor')} style={({ pressed }) => [styles.momentEmpty, pressed && styles.pressed]}>
          <Ionicons name="camera-outline" size={20} color={colors.textMuted} />
          <Text style={styles.mutedText}>Share a photo when you want to.</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
        </Pressable>
      )}
    </View>
  );
}

function AccountActions({ isSigningOut, onSignOut }: { isSigningOut: boolean; onSignOut: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.contextList}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/notifications')} style={({ pressed }) => [styles.contextRow, styles.rowDivider, pressed && styles.pressed]}>
          <View style={styles.contextIcon}><Ionicons name="notifications-outline" size={20} color={colors.text} /></View>
          <Text style={[styles.contextLabel, styles.flexLabel]}>Notifications</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={onSignOut}
          style={({ pressed }) => [styles.contextRow, pressed && !isSigningOut && styles.pressed, isSigningOut && styles.disabled]}>
          <View style={[styles.contextIcon, styles.logoutIcon]}><Ionicons name="log-out-outline" size={20} color={colors.primaryHover} /></View>
          <Text style={styles.logoutText}>{isSigningOut ? 'Logging out…' : 'Log Out'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [profileData, setProfileData] = useState<CurrentUserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [featuredVehicle, setFeaturedVehicle] = useState<ProfileVehicle | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const hasLoadedProfileRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (!hasLoadedProfileRef.current) setIsProfileLoading(true);
    setProfileError(null);

    const user = await getCurrentSessionUser();

    if (!user) {
      setProfileData(null);
      setProfileError('Sign in to load profile.');
      setFollowersCount(0);
      setFollowingCount(0);
      setVehiclesCount(0);
      setFeaturedVehicle(null);
      setPosts([]);
      hasLoadedProfileRef.current = true;
      setIsProfileLoading(false);
      return;
    }

    const [profileResult, followersResult, followingResult, vehiclesResult, postsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, bio, city, country_code')
        .eq('id', user.id)
        .single(),
      supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', user.id),
      supabase
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', user.id),
      supabase
        .from('vehicles')
        .select('id, vehicle_type, brand, model, year, horsepower, color, cover_image_url, is_primary', { count: 'exact' })
        .eq('owner_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('posts')
        .select('id,image_url,created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

    if (profileResult.error || followersResult.error || followingResult.error || vehiclesResult.error) {
      setProfileError('Unable to load profile.');
      hasLoadedProfileRef.current = true;
      setIsProfileLoading(false);
      return;
    }

    setProfileData(profileResult.data as CurrentUserProfile);
    setFollowersCount(followersResult.count ?? 0);
    setFollowingCount(followingResult.count ?? 0);
    setVehiclesCount(vehiclesResult.count ?? 0);
    setFeaturedVehicle((vehiclesResult.data as ProfileVehicle | null) ?? null);
    setPosts(postsResult.error ? [] : (postsResult.data ?? []) as ProfilePost[]);
    if (postsResult.error) setProfileError('Profile loaded, but moments are unavailable.');
    hasLoadedProfileRef.current = true;
    setIsProfileLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const signOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    await stopLiveDriveSession(true).catch(() => undefined);
    try {
      await clearGroupDriveLocationBeforeSignOut();
    } catch {
      setIsSigningOut(false);
      Alert.alert(
        'Logout paused',
        'NOXA could not clear your current Group Drive location. Check your connection and try again.',
      );
      return;
    }

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    setIsSigningOut(false);

    if (error) {
      Alert.alert('Logout failed', "We couldn't log you out. Please try again.");
      return;
    }

    resetToSignedOutHome();
  };

  const confirmSignOut = () => {
    if (isSigningOut) return;

    Alert.alert('Log out of NOXA?', 'You will need to sign in again on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <NoxaScreen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <TopBar />
        <Identity
          profile={profileData}
          isLoading={isProfileLoading}
          errorMessage={profileError}
          onRetry={loadProfile}
          profileId={profileData?.id ?? null}
          followersCount={followersCount}
          followingCount={followingCount}
        />
        <GarageFeature vehicle={featuredVehicle} vehiclesCount={vehiclesCount} />
        <ProfilePosts posts={posts} isLoading={isProfileLoading} />
        <AccountActions isSigningOut={isSigningOut} onSignOut={confirmSignOut} />
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 144,
    gap: spacing.lg,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  topBar: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: '700',
  },
  identity: { gap: spacing.md },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarRing: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  avatarImage: { width: 72, height: 72, borderRadius: radius.pill },
  identityNames: { flex: 1, minWidth: 0 },
  name: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: '700',
  },
  username: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  locationRow: {
    marginTop: spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  locationFlag: { fontSize: 14, lineHeight: 16 },
  location: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  identitySocialRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identitySocialMetric: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  identitySocialValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  identitySocialLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  bio: { color: colors.text, ...typography.v2.body },
  editButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  editButtonText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  inlineErrorRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  inlineError: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  retryButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  retryText: {
    color: colors.primaryHover,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  section: { gap: spacing.sm },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
  },
  sectionLink: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  sectionCaption: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  vehicleRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  vehicleThumb: {
    width: 82,
    height: 62,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
  },
  vehicleThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleRowCopy: { flex: 1, minWidth: 0, gap: 3 },
  vehicleTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vehicleTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
  },
  primaryVehicleState: {
    color: colors.primaryHover,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  vehicleMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  emptyGarage: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  emptyGarageCopy: { flex: 1 },
  emptyGarageTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  emptyGarageText: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  contextList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  contextRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  contextIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextCopy: { flex: 1, minWidth: 0 },
  contextLabel: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  contextCaption: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  flexLabel: { flex: 1 },
  socialRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  socialMetric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  socialDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.divider,
  },
  socialValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  socialLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  postGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  postTile: {
    width: '31.6%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
  },
  postImage: { width: '100%', height: '100%' },
  momentEmpty: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  mutedText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  logoutIcon: { backgroundColor: 'transparent' },
  logoutText: {
    flex: 1,
    color: colors.primaryHover,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
