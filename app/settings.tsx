import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  NoxaAvatar,
  NoxaButton,
  NoxaIconButton,
  NoxaListRow as SettingsRow,
  NoxaLoadingState,
  NoxaScreen,
  NoxaTopBar,
} from '@/src/components/ui';
import { SUPPORT_EMAIL } from '@/src/legal/legalDocuments';
import { stopLiveDriveSession } from '@/src/lib/liveDrive';
import { supabase } from '@/src/lib/supabase';
import { resetToSignedOutHome } from '@/src/navigation/authNavigation';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

type SettingsProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
};

function getInitials(value: string) {
  return (
    value
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NX'
  );
}

function formatHandle(username: string | null) {
  if (!username) return 'Complete your profile';
  return username.startsWith('@') ? username : `@${username}`;
}

function SettingsGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setErrorMessage('Account settings could not be loaded.');
      setIsLoading(false);
      return;
    }

    const user = authData.user;
    if (!user) {
      setProfile(null);
      setFollowersCount(0);
      setFollowingCount(0);
      setVehiclesCount(0);
      setIsLoading(false);
      return;
    }

    const [profileResult, followersResult, followingResult, vehiclesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url,city')
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
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id),
    ]);

    if (profileResult.error || followersResult.error || followingResult.error || vehiclesResult.error) {
      setErrorMessage('Account settings could not be loaded.');
      setIsLoading(false);
      return;
    }

    setProfile(profileResult.data as SettingsProfile);
    setFollowersCount(followersResult.count ?? 0);
    setFollowingCount(followingResult.count ?? 0);
    setVehiclesCount(vehiclesResult.count ?? 0);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings]),
  );

  const signOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    await stopLiveDriveSession(true).catch(() => undefined);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    setIsSigningOut(false);

    if (error) {
      Alert.alert('Sign out failed', 'Please try again.');
      return;
    }

    resetToSignedOutHome();
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out of NOXA?', 'You will need to sign in again on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const contactSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('NOXA Support')}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Email unavailable', `Contact us at ${SUPPORT_EMAIL}.`);
    }
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const displayName = profile?.display_name ?? 'NOXA Guest';

  return (
    <NoxaScreen padded={false}>
      <View style={styles.shell}>
        <NoxaTopBar
          left={
            <NoxaIconButton
              accessibilityLabel="Go back"
              icon="chevron-back"
              onPress={() => router.back()}
              variant="ghost"
            />
          }
          title="SETTINGS"
          subtitle="Your account and NOXA shortcuts"
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole={profile ? 'button' : undefined}
            disabled={!profile}
            onPress={() => router.push('/edit-profile')}
            style={({ pressed }) => [styles.profileCard, pressed && profile && styles.pressed]}>
            <View style={styles.avatarRing}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <NoxaAvatar initials={getInitials(displayName)} size={56} />
              )}
            </View>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={styles.profileName}>
                {displayName}
              </Text>
              <Text numberOfLines={1} style={styles.profileMeta}>
                {isLoading
                  ? 'Loading account…'
                  : profile
                    ? `${formatHandle(profile.username)}${profile.city ? ` · ${profile.city}` : ''}`
                    : 'Sign in to manage your account'}
              </Text>
            </View>
            {profile ? <Ionicons name="create-outline" size={19} color={colors.textMuted} /> : null}
          </Pressable>

          {errorMessage ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadSettings()}
              style={({ pressed }) => [styles.errorCard, pressed && styles.pressed]}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.primaryHover} />
              <Text style={styles.errorText}>{errorMessage} Tap to retry.</Text>
            </Pressable>
          ) : null}

          {isLoading ? (
            <NoxaLoadingState label="Loading account…" />
          ) : (
            <>
              <SettingsGroup label="ACCOUNT">
                <SettingsRow
                  caption="Name, bio, avatar, and city"
                  icon="person-outline"
                  label="Edit Profile"
                  onPress={profile ? () => router.push('/edit-profile') : undefined}
                />
                <SettingsRow
                  caption="Your saved builds"
                  icon="car-sport-outline"
                  label="Connected Vehicles"
                  onPress={() => router.push('/(tabs)/garage')}
                  value={String(vehiclesCount)}
                />
                <SettingsRow
                  caption={`${followersCount} followers · ${followingCount} following`}
                  icon="people-outline"
                  isLast
                  label="Social Connections"
                  onPress={
                    profile
                      ? () =>
                          router.push({
                            pathname: '/social-list',
                            params: { userId: profile.id, mode: 'followers' },
                          })
                      : undefined
                  }
                />
              </SettingsGroup>

              <SettingsGroup label="YOUR NOXA">
                <SettingsRow
                  caption="Followers, invitations, and upcoming events"
                  icon="notifications-outline"
                  label="Activity"
                  onPress={() => router.push('/notifications')}
                />
                <SettingsRow
                  caption="Meets you host or attend"
                  icon="calendar-outline"
                  label="Events"
                  onPress={() => router.push('/(tabs)/events')}
                />
                <SettingsRow
                  caption="Your automotive communities"
                  icon="people-circle-outline"
                  isLast
                  label="Crews"
                  onPress={() => router.push('/(tabs)/crews')}
                />
              </SettingsGroup>

              <SettingsGroup label="APP">
                <SettingsRow
                  caption="Live map and nearby drivers"
                  icon="map-outline"
                  label="Open Map"
                  onPress={() => router.push('/(tabs)')}
                />
                <SettingsRow
                  caption="Review the NOXA introduction"
                  icon="play-circle-outline"
                  label="Replay onboarding"
                  onPress={() => router.push('/onboarding?replay=1' as Href)}
                />
                <SettingsRow
                  caption={SUPPORT_EMAIL}
                  icon="mail-outline"
                  label="Contact NOXA"
                  onPress={() => void contactSupport()}
                />
                <SettingsRow
                  icon="information-circle-outline"
                  isLast
                  label="App Version"
                  value={appVersion}
                />
              </SettingsGroup>

              <SettingsGroup label="PRIVACY & SAFETY">
                <SettingsRow
                  caption="Review people hidden from your account"
                  icon="ban-outline"
                  label="Blocked Users"
                  onPress={profile ? () => router.push('/blocked-users') : undefined}
                />
                <SettingsRow
                  caption="How NOXA handles your data"
                  icon="shield-checkmark-outline"
                  label="Privacy Policy"
                  onPress={() => router.push('/privacy-policy')}
                />
                <SettingsRow
                  caption="The rules for using NOXA"
                  icon="document-text-outline"
                  label="Terms of Service"
                  onPress={() => router.push('/terms-of-service')}
                />
                <SettingsRow
                  caption="Permanently remove your account and data"
                  destructive
                  icon="trash-outline"
                  isLast
                  label="Delete Account"
                  onPress={profile ? () => router.push('/delete-account') : undefined}
                />
              </SettingsGroup>

              {profile ? (
                <SettingsGroup label="SESSION">
                  <SettingsRow
                    destructive
                    disabled={isSigningOut}
                    icon="log-out-outline"
                    isLast
                    label={isSigningOut ? 'Signing Out…' : 'Sign Out'}
                    onPress={confirmSignOut}
                  />
                </SettingsGroup>
              ) : (
                <NoxaButton
                  fullWidth
                  onPress={() => router.push('/sign-in')}
                  title="SIGN IN TO NOXA"
                />
              )}

              <View accessible accessibilityLabel="NOXA, crafted by KARAKETIDIS" style={styles.signature}>
                <Text style={styles.signatureBrand}>NOXA</Text>
                <Text style={styles.signatureCredit}>CRAFTED BY KARAKETIDIS</Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.background,
  },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl },
  profileCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  avatarRing: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderAccent,
    backgroundColor: colors.background,
  },
  avatarImage: { width: 56, height: 56, borderRadius: radius.pill },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: typography.lineHeight.title,
    textTransform: 'uppercase',
  },
  profileMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  errorCard: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  group: { gap: spacing.sm },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: typography.letterSpacing.label,
  },
  groupCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  signature: { alignItems: 'center', gap: 3, paddingTop: spacing.xs },
  signatureBrand: {
    color: colors.textSubtle,
    fontFamily: typography.fontFamily.display,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  signatureCredit: {
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
    opacity: 0.66,
  },
});
