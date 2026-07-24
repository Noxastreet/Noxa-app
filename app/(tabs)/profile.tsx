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
import { stopLiveDriveSession } from '@/src/lib/liveDrive';
import { supabase } from '@/src/lib/supabase';
import { animations, colors, radius, shadows, spacing, typography } from '@/src/theme';

type CurrentUserProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
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

function ProfileCover({ coverImageUrl, displayName, avatarUrl }: { coverImageUrl: string | null; displayName: string; avatarUrl: string | null }) {
  const coverContent = (
    <>
      <View style={styles.coverShade} />
      {!coverImageUrl ? (
        <>
          <View style={styles.coverGlowLarge} />
          <View style={styles.coverGlowSmall} />
          <Ionicons name="car-sport" size={92} color={colors.primaryMuted} />
        </>
      ) : null}
      <Pressable
        accessibilityLabel="Profile settings"
        accessibilityRole="button"
        onPress={() => router.push('/settings')}
        style={({ pressed }) => [styles.coverAction, pressed && styles.pressed]}>
        <Ionicons name="settings-outline" size={20} color={colors.text} />
      </Pressable>
    </>
  );

  return (
    <View style={styles.cover}>
      {coverImageUrl ? (
        <ImageBackground
          source={{ uri: coverImageUrl }}
          resizeMode="cover"
          style={styles.coverImage}
          imageStyle={styles.coverImageRadius as ImageStyle}>
          {coverContent}
        </ImageBackground>
      ) : (
        <View style={[styles.coverImage, styles.coverPlaceholder]}>{coverContent}</View>
      )}
      <View style={styles.avatarPosition}>
        <View style={styles.avatarRing}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} accessibilityLabel={`${displayName} avatar`} />
          ) : (
            <NoxaAvatar initials={getProfileInitials(displayName)} size={80} />
          )}
        </View>
      </View>
    </View>
  );
}

function ProfileIdentity({
  profileData,
  isLoading,
  errorMessage,
  onRetry,
}: {
  profileData: CurrentUserProfile | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  const displayName = profileData?.display_name ?? 'NOXA Driver';
  const username = formatUsername(profileData?.username ?? null);
  const bio = profileData?.bio ?? 'Tell the community about yourself.';
  const city = profileData?.city ?? 'Add city';

  return (
    <Animated.View style={[styles.identitySection, useEntryAnimation(50, 14)]}>
      <View style={styles.identityTopRow}>
        <View style={styles.identityNames}>
          <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
          <Text style={styles.username}>{isLoading ? 'Loading profile…' : username}</Text>
        </View>
        <Pressable
          accessibilityLabel="Edit Profile"
          accessibilityRole="button"
          onPress={() => router.push('/edit-profile')}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <Text style={styles.editButtonText}>EDIT PROFILE</Text>
        </Pressable>
      </View>
      <Text style={styles.bio}>{bio}</Text>
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={14} color={colors.textMuted} />
        <Text style={styles.location}>{city}</Text>
      </View>
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

function ProfileStats({
  profileId,
  followersCount,
  followingCount,
  vehiclesCount,
}: {
  profileId: string | null;
  followersCount: number;
  followingCount: number;
  vehiclesCount: number;
}) {
  const stats = [
    {
      label: 'FOLLOWERS',
      value: followersCount,
      onPress: profileId
        ? () => router.push({ pathname: '/social-list', params: { userId: profileId, mode: 'followers' } })
        : undefined,
    },
    {
      label: 'FOLLOWING',
      value: followingCount,
      onPress: profileId
        ? () => router.push({ pathname: '/social-list', params: { userId: profileId, mode: 'following' } })
        : undefined,
    },
    { label: 'VEHICLES', value: vehiclesCount, onPress: () => router.push('/(tabs)/garage') },
  ];

  return (
    <Animated.View style={[styles.statsStrip, useEntryAnimation(100)]}>
      {stats.map((stat, index) => (
        <Pressable
          key={stat.label}
          accessibilityLabel={`${stat.value} ${stat.label.toLowerCase()}`}
          accessibilityRole="button"
          disabled={!stat.onPress}
          onPress={stat.onPress}
          style={({ pressed }) => [styles.statCell, index > 0 && styles.statCellBorder, pressed && styles.pressed]}>
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

function ProfilePosts({ posts, isLoading }: { posts: ProfilePost[]; isLoading: boolean }) {
  return (
    <Animated.View style={[styles.postsSection, useEntryAnimation(140)]}>
      <View style={styles.postsHeader}>
        <View>
          <Text style={styles.sectionTitle}>POSTS</Text>
          <Text style={styles.postsCaption}>
            {posts.length === 1 ? '1 shared moment' : `${posts.length} shared moments`}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Create post"
          accessibilityRole="button"
          onPress={() => router.push('/post-editor')}
          style={({ pressed }) => [styles.newPostButton, pressed && styles.pressed]}>
          <Ionicons name="add" size={16} color={colors.text} />
          <Text style={styles.newPostText}>NEW POST</Text>
        </Pressable>
      </View>
      {isLoading ? (
        <View style={styles.postsEmpty}>
          <Text style={styles.postsEmptyText}>Loading posts…</Text>
        </View>
      ) : posts.length ? (
        <View style={styles.postGrid}>
          {posts.map((post) => (
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
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/post-editor')}
          style={({ pressed }) => [styles.postsEmpty, pressed && styles.pressed]}>
          <View style={styles.postsEmptyIcon}>
            <Ionicons name="camera-outline" size={23} color={colors.primaryHover} />
          </View>
          <View style={styles.postsEmptyCopy}>
            <Text style={styles.postsEmptyTitle}>Share your first moment</Text>
            <Text style={styles.postsEmptyText}>Add a photo to your NOXA profile.</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
        </Pressable>
      )}
    </Animated.View>
  );
}

function ExploreCard({ vehiclesCount }: { vehiclesCount: number }) {
  const links = [
    {
      label: 'Garage',
      caption: vehiclesCount === 1 ? '1 vehicle' : `${vehiclesCount} vehicles`,
      icon: 'car-sport-outline' as const,
      onPress: () => router.push('/(tabs)/garage'),
    },
    {
      label: 'Events',
      caption: 'Upcoming meets',
      icon: 'calendar-outline' as const,
      onPress: () => router.push('/(tabs)/events'),
    },
    {
      label: 'Crews',
      caption: 'Your community',
      icon: 'people-outline' as const,
      onPress: () => router.push('/(tabs)/crews'),
    },
  ];

  return (
    <Animated.View style={[styles.sectionBlock, useEntryAnimation(170)]}>
      <Text style={styles.sectionTitle}>YOUR NOXA</Text>
      <View style={styles.linksCard}>
        {links.map((link, index) => (
          <Pressable
            key={link.label}
            accessibilityRole="button"
            onPress={link.onPress}
            style={({ pressed }) => [styles.linkRow, index < links.length - 1 && styles.linkRowBorder, pressed && styles.pressed]}>
            <View style={styles.linkIcon}><Ionicons name={link.icon} size={21} color={colors.text} /></View>
            <View style={styles.linkCopy}>
              <Text style={styles.linkLabel}>{link.label}</Text>
              <Text style={styles.linkCaption}>{link.caption}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

function AccountCard({ isSigningOut, onSignOut }: { isSigningOut: boolean; onSignOut: () => void }) {
  return (
    <Animated.View style={[styles.sectionBlock, useEntryAnimation(230)]}>
      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <View style={styles.linksCard}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/notifications')}
          style={({ pressed }) => [styles.linkRow, styles.linkRowBorder, pressed && styles.pressed]}>
          <View style={styles.linkIcon}><Ionicons name="notifications-outline" size={21} color={colors.text} /></View>
          <Text style={[styles.linkLabel, styles.accountLinkLabel]}>Notifications</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={onSignOut}
          style={({ pressed }) => [styles.linkRow, pressed && !isSigningOut && styles.pressed, isSigningOut && styles.disabled]}>
          <View style={[styles.linkIcon, styles.logoutIcon]}><Ionicons name="log-out-outline" size={21} color={colors.primaryHover} /></View>
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
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
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
      setCoverImageUrl(null);
      setPosts([]);
      setIsProfileLoading(false);
      return;
    }

    const [profileResult, followersResult, followingResult, vehiclesResult, postsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, bio, city')
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
        .select('cover_image_url', { count: 'exact' })
        .eq('owner_id', user.id)
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
    setCoverImageUrl(vehiclesResult.data?.cover_image_url ?? null);
    setPosts(postsResult.error ? [] : (postsResult.data ?? []) as ProfilePost[]);
    if (postsResult.error) setProfileError('Profile loaded, but posts are unavailable.');
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
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    setIsSigningOut(false);

    if (error) {
      Alert.alert('Logout failed', "We couldn't log you out. Please try again.");
      return;
    }

    router.replace('/welcome');
  };

  const confirmSignOut = () => {
    if (isSigningOut) return;

    Alert.alert('Log out of NOXA?', 'You will need to sign in again on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const displayName = profileData?.display_name ?? 'NOXA Driver';

  return (
    <NoxaScreen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ProfileCover coverImageUrl={coverImageUrl} displayName={displayName} avatarUrl={profileData?.avatar_url ?? null} />
        <ProfileIdentity profileData={profileData} isLoading={isProfileLoading} errorMessage={profileError} onRetry={loadProfile} />
        <View style={styles.paddedContent}>
          <ProfileStats
            profileId={profileData?.id ?? null}
            followersCount={followersCount}
            followingCount={followingCount}
            vehiclesCount={vehiclesCount}
          />
          <ProfilePosts posts={posts} isLoading={isProfileLoading} />
          <ExploreCard vehiclesCount={vehiclesCount} />
          <AccountCard isSigningOut={isSigningOut} onSignOut={confirmSignOut} />
        </View>
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 144 },
  pressed: { opacity: 0.8, transform: [{ translateY: 1 }, { scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  cover: { height: 218, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.hero, ...shadows.card },
  coverImage: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.hero, overflow: 'hidden' },
  coverImageRadius: { borderRadius: radius.hero },
  coverPlaceholder: { backgroundColor: colors.surfaceSoft },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,10,0.38)' },
  coverGlowLarge: {
    position: 'absolute',
    right: -36,
    top: -62,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.primaryMuted,
  },
  coverGlowSmall: {
    position: 'absolute',
    left: 28,
    bottom: -52,
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 24,
    borderColor: colors.primarySubtle,
  },
  coverAction: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,6,10,0.76)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  avatarPosition: { position: 'absolute', left: spacing.md, bottom: -42 },
  avatarRing: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 44,
    backgroundColor: colors.background,
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  identitySection: { marginTop: 52, paddingHorizontal: spacing.lg },
  identityTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  identityNames: { flex: 1 },
  name: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: typography.lineHeight.h2,
    textTransform: 'uppercase',
  },
  username: { marginTop: spacing.xxs, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  editButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  editButtonText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  bio: { marginTop: spacing.md, color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.sm },
  location: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  inlineErrorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  inlineError: { flex: 1, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  retryButton: {
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  retryText: { color: colors.primaryHover, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  paddedContent: { paddingHorizontal: spacing.lg, gap: spacing.xl, marginTop: spacing.lg },
  statsStrip: {
    minHeight: 78,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  statValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 25,
  },
  statLabel: { marginTop: spacing.xxs, color: colors.textSubtle, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  postsSection: { gap: spacing.sm },
  postsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  postsCaption: { marginTop: 2, color: colors.textSubtle, fontSize: 9, fontWeight: '800' },
  newPostButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  newPostText: { color: colors.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  postGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  postTile: {
    width: '31.6%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  postImage: { width: '100%', height: '100%' },
  postsEmpty: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  postsEmptyIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  postsEmptyCopy: { flex: 1 },
  postsEmptyTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  postsEmptyText: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  sectionBlock: { gap: spacing.sm },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: typography.letterSpacing.label,
  },
  linksCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  linkRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  linkIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  linkCopy: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: spacing.xs,
  },
  linkLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: typography.lineHeight.body,
  },
  accountLinkLabel: { flex: 1 },
  linkCaption: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: typography.lineHeight.caption,
  },
  logoutIcon: { backgroundColor: colors.primarySubtle },
  logoutText: { flex: 1, color: colors.primaryHover, fontSize: typography.body, fontWeight: '800' },
});
