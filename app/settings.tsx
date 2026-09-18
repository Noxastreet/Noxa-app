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
import { clearGroupDriveLocationBeforeSignOut } from '@/src/features/group-drive/runtime/nativeLocation';
import { SUPPORT_EMAIL } from '@/src/legal/legalDocuments';
import { stopLiveDriveSession } from '@/src/lib/liveDrive';
import { supabase } from '@/src/lib/supabase';
import { resetToSignedOutHome } from '@/src/navigation/authNavigation';
import { colors, radius, spacing, typography } from '@/src/theme';

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
      <View style={styles.groupList}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
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
      setVehiclesCount(0);
      setIsLoading(false);
      return;
    }

    const [profileResult, vehiclesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url,city')
        .eq('id', user.id)
        .single(),
      supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id),
    ]);

    if (profileResult.error || vehiclesResult.error) {
      setErrorMessage('Account settings could not be loaded.');
      setIsLoading(false);
      return;
    }

    setProfile(profileResult.data as SettingsProfile);
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
    try {
      await clearGroupDriveLocationBeforeSignOut();
    } catch {
      setIsSigningOut(false);
      Alert.alert(
        'Sign out paused',
        'NOXA could not clear your current Group Drive location. Check your connection and try again.',
      );
      return;
    }

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    setIsSigningOut(false);

    if (error) {
      Alert.alert('Sign out failed', 'Please try again.');
      return;
    }

    resetToSignedOutHome();
  };

  const confirmSignOut = () => {
    if (isSigningOut) return;

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
          title="Settings"
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole={profile ? 'button' : undefined}
            disabled={!profile}
            onPress={() => router.push('/edit-profile')}
            style={({ pressed }) => [styles.profileRow, pressed && profile && styles.pressed]}>
            <View style={styles.avatarRing}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <NoxaAvatar initials={getInitials(displayName)} size={48} />
              )}
            </View>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={styles.profileName}>{displayName}</Text>
              <Text numberOfLines={1} style={styles.profileMeta}>
                {isLoading
                  ? 'Loading account…'
                  : profile
                    ? `${formatHandle(profile.username)}${profile.city ? ` · ${profile.city}` : ''}`
                    : 'Sign in to manage your account'}
              </Text>
            </View>
            {profile ? <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} /> : null}
          </Pressable>

          {errorMessage ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadSettings()}
              style={({ pressed }) => [styles.errorRow, pressed && styles.pressed]}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.primaryHover} />
              <Text style={styles.errorText}>{errorMessage} Tap to retry.</Text>
            </Pressable>
          ) : null}

          {isLoading ? (
            <NoxaLoadingState label="Loading account…" />
          ) : (
            <>
              <SettingsGroup label="Account">
                <SettingsRow
                  caption="Name, username, bio, city and photo"
                  icon="person-outline"
                  label="Edit Profile"
                  onPress={profile ? () => router.push('/edit-profile') : undefined}
                />
                <SettingsRow
                  caption="Cars and motorcycles connected to your identity"
                  icon="car-sport-outline"
                  isLast
                  label="Garage"
                  onPress={() => router.push('/(tabs)/garage')}
                  value={String(vehiclesCount)}
                />
              </SettingsGroup>

              <SettingsGroup label="Privacy & Safety">
                <SettingsRow
                  caption="Real Crew, Event and community activity"
                  icon="notifications-outline"
                  label="Notifications"
                  onPress={() => router.push('/notifications')}
                />
                <SettingsRow
                  caption="People hidden from your NOXA experience"
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
                  caption="Rules for using NOXA"
                  icon="document-text-outline"
                  isLast
                  label="Terms of Service"
                  onPress={() => router.push('/terms-of-service')}
                />
              </SettingsGroup>

              <SettingsGroup label="App & Support">
                <SettingsRow
                  caption="Review the NOXA introduction"
                  icon="play-circle-outline"
                  label="Replay Onboarding"
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

              {profile ? (
                <SettingsGroup label="Session">
                  <SettingsRow
                    disabled={isSigningOut}
                    icon="log-out-outline"
                    isLast
                    label={isSigningOut ? 'Signing Out…' : 'Sign Out'}
                    onPress={confirmSignOut}
                  />
                </SettingsGroup>
              ) : (
                <NoxaButton fullWidth onPress={() => router.push('/sign-in')} title="Sign in" />
              )}

              {profile ? (
                <View style={styles.dangerZone}>
                  <Text style={styles.dangerLabel}>Account deletion</Text>
                  <Text style={styles.dangerDescription}>
                    Permanently remove your NOXA account and associated data. Identity verification is required before deletion.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/delete-account')}
                    style={({ pressed }) => [styles.deleteAccountButton, pressed && styles.pressed]}>
                    <Ionicons name="trash-outline" size={17} color={colors.primaryHover} />
                    <Text style={styles.deleteAccountText}>Delete account</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.primaryHover} />
                  </Pressable>
                </View>
              ) : null}

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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.lg },
  profileRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  avatarRing: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  avatarImage: { width: 48, height: 48, borderRadius: radius.pill },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: {
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    ...typography.v2.row,
    fontWeight: '600',
  },
  profileMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  errorRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  errorText: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  group: { gap: spacing.xs },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  groupList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  dangerZone: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderAccent,
  },
  dangerLabel: {
    color: colors.primaryHover,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  dangerDescription: { color: colors.textMuted, fontSize: 12, fontWeight: '500', lineHeight: 18 },
  deleteAccountButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderAccent,
  },
  deleteAccountText: { flex: 1, color: colors.primaryHover, fontSize: 13, lineHeight: 18, fontWeight: '600' },
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