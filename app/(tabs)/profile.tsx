import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
} from 'react-native';

import { NoxaAvatar, NoxaScreen } from '@/src/components/ui';
import { clearGroupDriveLocationBeforeSignOut } from '@/src/features/group-drive/runtime/nativeLocation';
import { VehicleTypeIcon } from '@/src/features/garage/vehicle-picker/components/VehicleTypeIcon';
import { formatProfileLocation } from '@/src/features/profile/formatProfileLocation';
import { stopLiveDriveSession } from '@/src/lib/liveDrive';
import { supabase } from '@/src/lib/supabase';
import { resetToSignedOutHome } from '@/src/navigation/authNavigation';
import { animations, colors, radius, shadows, spacing, typography } from '@/src/theme';

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

function useEntryAnimation(delay = 0, distance: number = animations.entranceDistance) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: animations.entrance, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: animations.entrance, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, translateY]);

  return { opacity, transform: [{ translateY }] };
}

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
      <Text style={styles.pageTitle}>PROFILE</Text>
      <Pressable
        accessibilityLabel="Profile settings"
        accessibilityRole="button"
        onPress={() => router.push('/settings')}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Ionicons name="settings-outline" size={21} color={colors.text} />
      </Pressable>
    </View>
  );
}

function Identity({
  profile,
  isLoading,
  errorMessage,
  onRetry,
}: {
  profile: CurrentUserProfile | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  const displayName = profile?.display_name ?? 'NOXA Driver';
  const username = formatUsername(profile?.username ?? null);
  const bio = profile?.bio?.trim() || 'Tell the community about yourself.';
  const location = formatProfileLocation(profile?.country_code, profile?.city);

  return (
    <Animated.View style={[styles.identity, useEntryAnimation(40, 12)]}>
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

      <Text style={styles.bio}>{bio}</Text>

      <Pressable
        accessibilityLabel="Edit Profile"
        accessibilityRole="button"
        onPress={() => router.push('/edit-profile')}
        style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
        <Text style={styles.editButtonText}>EDIT PROFILE</Text>
      </Pressable>

      {errorMessage ? (
        <View style={styles.inlineErrorRow}>
          <Text style={styles.inlineError}>{errorMessage}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

function GarageFeature({ vehicle, vehiclesCount }: { vehicle: ProfileVehicle | null; vehiclesCount: number }) {
  const animatedStyle = useEntryAnimation(90, 16);

  if (!vehicle) {
    return (
      <Animated.View style={[styles.section, animatedStyle]}>
        <Text style={styles.sectionEyebrow}>YOUR GARAGE</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/vehicle-picker')}
          style={({ pressed }) => [styles.emptyGarage, pressed && styles.pressed]}>
          <View style={styles.emptyGarageIcon}>
            <Ionicons name="add" size={21} color={colors.primaryHover} />
          </View>
          <View style={styles.emptyGarageCopy}>
            <Text style={styles.emptyGarageTitle}>Add your first vehicle</Text>
            <Text style={styles.emptyGarageText}>Make your automotive identity visible in NOXA.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </Pressable>
      </Animated.View>
    );
  }

  const details = [
    vehicle.year ? String(vehicle.year) : null,
    vehicle.horsepower === null ? null : `${vehicle.horsepower} HP`,
    vehicle.color,
  ].filter(Boolean).join(' · ');

  const content = (
    <>
      <View style={styles.vehicleShade} />
      <View style={styles.vehicleTopRow}>
        <View style={styles.vehicleTypeBadge}>
          <VehicleTypeIcon vehicleType={vehicle.vehicle_type} size={14} color={colors.primaryHover} />
          <Text style={styles.vehicleTypeText}>{vehicle.vehicle_type === 'motorcycle' ? 'MOTORCYCLE' : 'CAR'}</Text>
        </View>
        <Text style={styles.vehicleCount}>{vehicle.is_primary ? 'PRIMARY' : vehiclesCount === 1 ? '1 VEHICLE' : `${vehiclesCount} VEHICLES`}</Text>
      </View>
      <View style={styles.vehicleCopy}>
        <Text numberOfLines={1} style={styles.vehicleTitle}>{vehicle.brand}</Text>
        <Text numberOfLines={1} style={styles.vehicleModel}>{vehicle.model || 'Vehicle'}</Text>
        {details ? <Text numberOfLines={1} style={styles.vehicleMeta}>{details}</Text> : null}
      </View>
    </>
  );

  return (
    <Animated.View style={[styles.section, animatedStyle]}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionEyebrow}>YOUR GARAGE</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/garage')}>
          <Text style={styles.sectionLink}>VIEW ALL</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel={`Open ${vehicle.brand} ${vehicle.model || ''}`.trim()}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/vehicle-details', params: { id: vehicle.id } })}
        style={({ pressed }) => [styles.vehicleCard, pressed && styles.pressed]}>
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
            <VehicleTypeIcon vehicleType={vehicle.vehicle_type} size={68} color={colors.primaryMuted} />
            {content}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function NoxaContext({ vehiclesCount }: { vehiclesCount: number }) {
  const rows = [
    {
      key: 'garage',
      label: 'Garage',
      caption: vehiclesCount === 1 ? '1 vehicle' : `${vehiclesCount} vehicles`,
      icon: 'car-sport-outline' as const,
      onPress: () => router.push('/(tabs)/garage'),
    },
    {
      key: 'crews',
      label: 'Crews',
      caption: 'Your automotive community',
      icon: 'people-outline' as const,
      onPress: () => router.push('/(tabs)/crews'),
    },
    {
      key: 'events',
      label: 'Events',
      caption: 'Meets and upcoming activity',
      icon: 'calendar-outline' as const,
      onPress: () => router.push('/(tabs)/events'),
    },
  ];

  return (
    <Animated.View style={[styles.section, useEntryAnimation(130)]}>
      <Text style={styles.sectionEyebrow}>YOUR NOXA</Text>
      <View style={styles.contextList}>
        {rows.map((row, index) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            onPress={row.onPress}
            style={({ pressed }) => [styles.contextRow, index < rows.length - 1 && styles.rowDivider, pressed && styles.pressed]}>
            <View style={styles.contextIcon}><Ionicons name={row.icon} size={20} color={colors.text} /></View>
            <View style={styles.contextCopy}>
              <Text style={styles.contextLabel}>{row.label}</Text>
              <Text style={styles.contextCaption}>{row.caption}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

function SocialContext({
  profileId,
  followersCount,
  followingCount,
}: {
  profileId: string | null;
  followersCount: number;
  followingCount: number;
}) {
  return (
    <Animated.View style={[styles.section, useEntryAnimation(165)]}>
      <Text style={styles.sectionEyebrow}>COMMUNITY</Text>
      <View style={styles.socialRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!profileId}
          onPress={profileId ? () => router.push({ pathname: '/social-list', params: { userId: profileId, mode: 'followers' } }) : undefined}
          style={({ pressed }) => [styles.socialMetric, pressed && styles.pressed]}>
          <Text style={styles.socialValue}>{followersCount}</Text>
          <Text style={styles.socialLabel}>Followers</Text>
        </Pressable>
        <View style={styles.socialDivider} />
        <Pressable
          accessibilityRole="button"
          disabled={!profileId}
          onPress={profileId ? () => router.push({ pathname: '/social-list', params: { userId: profileId, mode: 'following' } }) : undefined}
          style={({ pressed }) => [styles.socialMetric, pressed && styles.pressed]}>
          <Text style={styles.socialValue}>{followingCount}</Text>
          <Text style={styles.socialLabel}>Following</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function ProfilePosts({ posts, isLoading }: { posts: ProfilePost[]; isLoading: boolean }) {
  return (
    <Animated.View style={[styles.section, useEntryAnimation(195)]}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionEyebrow}>MOMENTS</Text>
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
    </Animated.View>
  );
}

function AccountActions({ isSigningOut, onSignOut }: { isSigningOut: boolean; onSignOut: () => void }) {
  return (
    <Animated.View style={[styles.section, useEntryAnimation(225)]}>
      <Text style={styles.sectionEyebrow}>ACCOUNT</Text>
      <View style={styles.contextList}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => [styles.contextRow, styles.rowDivider, pressed && styles.pressed]}>
          <View style={styles.contextIcon}><Ionicons name="settings-outline" size={20} color={colors.text} /></View>
          <Text style={[styles.contextLabel, styles.flexLabel]}>Settings</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
        </Pressable>
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
    </Animated.View>
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

  const loadProfile = useCallback(async () => {
    setIsProfileLoading(true);
    setProfileError(null);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      setProfileData(null);
      setProfileError('Sign in to load profile.');
      setFollowersCount(0);
      setFollowingCount(0);
      setVehiclesCount(0);
      setFeaturedVehicle(null);
      setPosts([]);
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
        <Identity profile={profileData} isLoading={isProfileLoading} errorMessage={profileError} onRetry={loadProfile} />
        <GarageFeature vehicle={featuredVehicle} vehiclesCount={vehiclesCount} />
        <NoxaContext vehiclesCount={vehiclesCount} />
        <SocialContext profileId={profileData?.id ?? null} followersCount={followersCount} followingCount={followingCount} />
        <ProfilePosts posts={posts} isLoading={isProfileLoading} />
        <AccountActions isSigningOut={isSigningOut} onSignOut={confirmSignOut} />
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 144,
    gap: spacing.xl,
  },
  pressed: { opacity: 0.82, transform: [{ translateY: 1 }, { scale: 0.987 }] },
  disabled: { opacity: 0.45 },
  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  identity: { gap: spacing.md },
  identityTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarRing: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  avatarImage: { width: 82, height: 82, borderRadius: radius.pill },
  identityNames: { flex: 1, minWidth: 0 },
  name: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    fontWeight: '900',
    lineHeight: typography.lineHeight.h2,
  },
  username: { marginTop: 2, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  locationRow: { marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  locationFlag: { fontSize: 14, lineHeight: 16 },
  location: { flexShrink: 1, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  bio: { color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 20 },
  editButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  editButtonText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.75 },
  inlineErrorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inlineError: { flex: 1, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  retryButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.button, backgroundColor: colors.primarySubtle },
  retryText: { color: colors.primaryHover, fontSize: 9, fontWeight: '900' },
  section: { gap: spacing.sm },
  sectionEyebrow: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionLink: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  sectionCaption: { marginTop: 2, color: colors.textSubtle, fontSize: 9, fontWeight: '700' },
  vehicleCard: {
    height: 224,
    overflow: 'hidden',
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  vehicleArtwork: { flex: 1, justifyContent: 'flex-end' },
  vehicleArtworkRadius: { borderRadius: radius.hero },
  vehicleFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },
  vehicleShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,10,0.35)' },
  vehicleTopRow: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehicleTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, minHeight: 30, borderRadius: radius.pill, backgroundColor: 'rgba(6,6,10,0.70)' },
  vehicleTypeText: { color: colors.primaryHover, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  vehicleCount: { color: colors.text, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  vehicleCopy: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  vehicleTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 32, fontWeight: '900', textTransform: 'uppercase' },
  vehicleModel: { marginTop: 2, color: colors.text, fontSize: typography.subtitle, fontWeight: '800' },
  vehicleMeta: { marginTop: spacing.xs, color: 'rgba(240,240,244,0.70)', fontSize: typography.caption, fontWeight: '700' },
  emptyGarage: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  emptyGarageIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primarySubtle },
  emptyGarageCopy: { flex: 1 },
  emptyGarageTitle: { color: colors.text, fontSize: typography.body, fontWeight: '900' },
  emptyGarageText: { marginTop: 2, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  contextList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  contextRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  contextIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceSoft },
  contextCopy: { flex: 1, minWidth: 0 },
  contextLabel: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  contextCaption: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  flexLabel: { flex: 1 },
  socialRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  socialMetric: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing.xs },
  socialDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.divider },
  socialValue: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.subtitle, fontWeight: '900' },
  socialLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  postGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  postTile: { width: '31.6%', aspectRatio: 1, overflow: 'hidden', borderRadius: radius.sm, backgroundColor: colors.surfaceSoft },
  postImage: { width: '100%', height: '100%' },
  momentEmpty: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  mutedText: { flex: 1, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  logoutIcon: { backgroundColor: colors.primarySubtle },
  logoutText: { flex: 1, color: colors.primaryHover, fontSize: typography.body, fontWeight: '800' },
});