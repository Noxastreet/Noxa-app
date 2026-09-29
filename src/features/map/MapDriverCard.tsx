import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/src/lib/supabase';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

type Relationship = 'self' | 'none' | 'outgoing' | 'incoming' | 'mutual';

type DriverProfile = {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

type VehiclePreview = {
  id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  coverImageUrl: string | null;
};

type Props = {
  driverId: string;
  fallbackProfile?: {
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
  bottomOffset: number;
  isInDrive: boolean;
  onClose: () => void;
  onInviteToDrive: (driverId: string) => void;
};

function displayName(profile: DriverProfile | null, fallback: Props['fallbackProfile']) {
  return (
    profile?.displayName?.trim()
    || fallback?.displayName?.trim()
    || fallback?.username?.trim()
    || 'NOXA driver'
  );
}

function usernameLabel(value: string | null | undefined) {
  const username = value?.trim();
  if (!username) return null;
  return username.startsWith('@') ? username : `@${username}`;
}

function vehicleLabel(vehicle: VehiclePreview | null) {
  if (!vehicle) return null;
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(' ').trim();
  if (!name && !vehicle.year) return null;
  return [name || 'Vehicle', vehicle.year ? String(vehicle.year) : null]
    .filter(Boolean)
    .join(' · ');
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
    || 'NX'
  );
}

export function MapDriverCard({
  driverId,
  fallbackProfile,
  bottomOffset,
  isInDrive,
  onClose,
  onInviteToDrive,
}: Props) {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [vehicle, setVehicle] = useState<VehiclePreview | null>(null);
  const [relationship, setRelationship] = useState<Relationship>('none');
  const [loading, setLoading] = useState(true);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id ?? null;
    if (!currentUserId) {
      setError('Sign in again to interact with this driver.');
      setLoading(false);
      return;
    }

    const [profileResult, vehicleResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url')
        .eq('id', driverId)
        .maybeSingle(),
      supabase
        .from('vehicles')
        .select('id,brand,model,year,cover_image_url')
        .eq('owner_id', driverId)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      setError('This driver could not be loaded.');
      setLoading(false);
      return;
    }

    const row = profileResult.data;
    setProfile(
      row
        ? {
            id: String(row.id),
            displayName:
              String(row.display_name ?? '').trim()
              || String(row.username ?? '').trim()
              || 'NOXA driver',
            username: row.username ? String(row.username) : null,
            avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
          }
        : null,
    );

    if (!vehicleResult.error && vehicleResult.data) {
      setVehicle({
        id: String(vehicleResult.data.id),
        brand: vehicleResult.data.brand ? String(vehicleResult.data.brand) : null,
        model: vehicleResult.data.model ? String(vehicleResult.data.model) : null,
        year:
          typeof vehicleResult.data.year === 'number'
            ? vehicleResult.data.year
            : null,
        coverImageUrl: vehicleResult.data.cover_image_url
          ? String(vehicleResult.data.cover_image_url)
          : null,
      });
    } else {
      setVehicle(null);
    }

    if (currentUserId === driverId) {
      setRelationship('self');
      setLoading(false);
      return;
    }

    const [outgoingResult, incomingResult] = await Promise.all([
      supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', driverId)
        .maybeSingle(),
      supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', driverId)
        .eq('following_id', currentUserId)
        .maybeSingle(),
    ]);

    if (outgoingResult.error || incomingResult.error) {
      setError('Driver loaded, but connection status is unavailable.');
      setRelationship('none');
    } else if (outgoingResult.data && incomingResult.data) {
      setRelationship('mutual');
    } else if (outgoingResult.data) {
      setRelationship('outgoing');
    } else if (incomingResult.data) {
      setRelationship('incoming');
    } else {
      setRelationship('none');
    }

    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = useCallback(async () => {
    if (relationshipLoading || relationship === 'self' || relationship === 'mutual') return;

    setRelationshipLoading(true);
    setError(null);
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id ?? null;
    if (!currentUserId || currentUserId === driverId) {
      setRelationshipLoading(false);
      return;
    }

    const { error: followError } = await supabase
      .from('follows')
      .insert({ follower_id: currentUserId, following_id: driverId });

    if (followError && followError.code !== '23505') {
      setError('Connection could not be updated.');
      setRelationshipLoading(false);
      return;
    }

    setRelationship((current) => (current === 'incoming' ? 'mutual' : 'outgoing'));
    setRelationshipLoading(false);
  }, [driverId, relationship, relationshipLoading]);

  const name = displayName(profile, fallbackProfile);
  const username = usernameLabel(profile?.username ?? fallbackProfile?.username);
  const avatarUrl = profile?.avatarUrl ?? fallbackProfile?.avatarUrl ?? null;
  const car = vehicleLabel(vehicle);

  const primaryAction = useMemo(() => {
    if (relationship === 'self') {
      return {
        title: 'Your profile',
        icon: 'person-outline' as const,
        disabled: false,
        onPress: () => router.push('/(tabs)/profile'),
      };
    }
    if (isInDrive) {
      return {
        title: 'In Drive Together',
        icon: 'navigate' as const,
        disabled: true,
        onPress: () => undefined,
      };
    }
    if (relationship === 'mutual') {
      return {
        title: 'Invite to Drive',
        icon: 'navigate-outline' as const,
        disabled: false,
        onPress: () => onInviteToDrive(driverId),
      };
    }
    if (relationship === 'outgoing') {
      return {
        title: 'Connection sent',
        icon: 'time-outline' as const,
        disabled: true,
        onPress: () => undefined,
      };
    }
    if (relationship === 'incoming') {
      return {
        title: 'Accept',
        icon: 'person-add-outline' as const,
        disabled: false,
        onPress: () => void connect(),
      };
    }
    return {
      title: 'Connect',
      icon: 'person-add-outline' as const,
      disabled: false,
      onPress: () => void connect(),
    };
  }, [connect, driverId, isInDrive, onInviteToDrive, relationship]);

  return (
    <View style={[styles.card, { bottom: bottomOffset }]}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <Text style={styles.initials}>{initials(name)}</Text>
            )}
            <View style={styles.liveDot} />
          </View>

          <View style={styles.identityCopy}>
            <Text numberOfLines={1} style={styles.name}>{name}</Text>
            <View style={styles.metaRow}>
              {username ? <Text numberOfLines={1} style={styles.username}>{username}</Text> : null}
              {relationship === 'mutual' ? (
                <View style={styles.friendBadge}>
                  <Ionicons name="checkmark" size={10} color={colors.text} />
                  <Text style={styles.friendBadgeText}>FRIEND</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <Pressable
          accessibilityLabel="Close driver card"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Loading driver…</Text>
        </View>
      ) : (
        <>
          {vehicle ? (
            <Pressable
              accessibilityLabel={car ? `Open ${car}` : 'Open vehicle'}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/vehicle-details', params: { id: vehicle.id } })
              }
              style={({ pressed }) => [styles.vehicle, pressed && styles.pressed]}>
              {vehicle.coverImageUrl ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: vehicle.coverImageUrl }}
                  style={styles.vehicleImage}
                />
              ) : (
                <View style={styles.vehicleIcon}>
                  <Ionicons name="car-sport-outline" size={20} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.vehicleCopy}>
                <Text style={styles.vehicleEyebrow}>VEHICLE</Text>
                <Text numberOfLines={1} style={styles.vehicleName}>
                  {car ?? 'Public vehicle'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
            </Pressable>
          ) : null}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={primaryAction.disabled || relationshipLoading}
              onPress={primaryAction.onPress}
              style={({ pressed }) => [
                styles.primaryAction,
                (primaryAction.disabled || relationshipLoading) && styles.disabled,
                pressed && !primaryAction.disabled && styles.pressed,
              ]}>
              {relationshipLoading ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <>
                  <Ionicons name={primaryAction.icon} size={16} color={colors.text} />
                  <Text style={styles.primaryActionText}>{primaryAction.title}</Text>
                </>
              )}
            </Pressable>

            {relationship !== 'self' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/driver-profile/[id]',
                    params: { id: driverId },
                  })
                }
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
                <Ionicons name="person-outline" size={16} color={colors.text} />
                <Text style={styles.secondaryActionText}>Profile</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    zIndex: 52,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: spacing.md,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(9,9,13,0.985)',
    ...shadows.card,
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
  },
  initials: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 15,
    fontWeight: '900',
  },
  liveDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: '#0A0A0E',
    backgroundColor: colors.success,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
  },
  metaRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  username: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  friendBadge: {
    minHeight: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  friendBadgeText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  loading: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  vehicle: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 6,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  vehicleImage: {
    width: 58,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  vehicleIcon: {
    width: 58,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  vehicleCopy: {
    flex: 1,
    minWidth: 0,
  },
  vehicleEyebrow: {
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  vehicleName: {
    marginTop: 2,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  error: {
    color: colors.primaryHover,
    fontSize: 10.5,
    lineHeight: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  primaryActionText: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  secondaryAction: {
    minWidth: 104,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
});
