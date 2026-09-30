import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  ReduceMotion,
} from 'react-native-reanimated';

import {
  NoxaAvatar,
  NoxaButton,
  NoxaIconButton,
  NoxaPressableSurface,
  NoxaSurface,
} from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { animations, colors, radius, spacing, typography } from '@/src/theme';

const DRIVER_CARD_ENTER = FadeInDown
  .duration(animations.step)
  .reduceMotion(ReduceMotion.System);
const DRIVER_CARD_EXIT = FadeOutDown
  .duration(animations.fast)
  .reduceMotion(ReduceMotion.System);

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
  isRelevant: boolean;
  onRelationshipChange: () => void;
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
  isRelevant,
  onClose,
  onRelationshipChange,
  onInviteToDrive,
}: Props) {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [vehicle, setVehicle] = useState<VehiclePreview | null>(null);
  const [relationship, setRelationship] = useState<Relationship>('none');
  const [loading, setLoading] = useState(true);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unavailable, setUnavailable] = useState(false);
  const [sharedCrew, setSharedCrew] = useState(false);
  const requestVersion = useRef(0);
  const actionPending = useRef(false);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    const isCurrent = () => requestVersion.current === version;
    setLoading(true);
    setError(null);
    setProfile(null);
    setVehicle(null);
    setRelationship('none');
    setUnavailable(false);
    setSharedCrew(false);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!isCurrent()) return;
      const currentUserId = authData.user?.id ?? null;
      if (authError || !currentUserId) {
        throw new Error('Sign in again to interact with this driver.');
      }
      const canRevealMapIdentity = isRelevant || currentUserId === driverId;
      const [profileResult, vehicleResult, outgoingResult, incomingResult, ownCrews, driverCrews] = await Promise.all([
        supabase.from('profiles')
          .select(canRevealMapIdentity ? 'id,display_name,username,avatar_url' : 'id')
          .eq('id', driverId).maybeSingle(),
        canRevealMapIdentity
          ? supabase.from('vehicles')
            .select('id,brand,model,year,cover_image_url')
            .eq('owner_id', driverId)
            .eq('is_public', true)
            .eq('is_primary', true)
            .limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('follows').select('following_id')
          .eq('follower_id', currentUserId).eq('following_id', driverId).maybeSingle(),
        supabase.from('follows').select('follower_id')
          .eq('follower_id', driverId).eq('following_id', currentUserId).maybeSingle(),
        supabase.from('crew_members').select('crew_id').eq('user_id', currentUserId),
        supabase.from('crew_members').select('crew_id').eq('user_id', driverId),
      ]);
      if (!isCurrent()) return;
      if (profileResult.error) throw new Error('This driver could not be loaded.');
      if (!profileResult.data) {
        setUnavailable(true);
        return;
      }

      if (canRevealMapIdentity) {
        const row = profileResult.data as {
          id: string; display_name?: string | null; username?: string | null; avatar_url?: string | null;
        };
        setProfile({
          id: row.id,
          displayName: row.display_name?.trim() || row.username?.trim() || 'NOXA driver',
          username: row.username ?? null,
          avatarUrl: row.avatar_url ?? null,
        });
        if (!vehicleResult.error && vehicleResult.data) {
          const row = vehicleResult.data;
          setVehicle({
            id: String(row.id),
            brand: row.brand ?? null,
            model: row.model ?? null,
            year: typeof row.year === 'number' ? row.year : null,
            coverImageUrl: row.cover_image_url ?? null,
          });
        }
      } else {
        setProfile(null);
        setVehicle(null);
      }

      if (outgoingResult.error || incomingResult.error) {
        throw new Error('Connection status is unavailable. Try again.');
      }
      setRelationship(
        currentUserId === driverId ? 'self'
          : outgoingResult.data && incomingResult.data ? 'mutual'
            : outgoingResult.data ? 'outgoing'
              : incomingResult.data ? 'incoming' : 'none',
      );
      if (!ownCrews.error && !driverCrews.error) {
        const ownIds = new Set((ownCrews.data ?? []).map((row) => row.crew_id));
        setSharedCrew((driverCrews.data ?? []).some((row) => ownIds.has(row.crew_id)));
      }
      if (vehicleResult.error) setError('Public vehicle could not be loaded. Try again.');
    } catch (loadError) {
      if (isCurrent()) {
        setError(loadError instanceof Error ? loadError.message : 'This driver could not be loaded. Try again.');
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [driverId, isRelevant]);

  useEffect(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  const connect = useCallback(async () => {
    if (actionPending.current || loading || error || unavailable
      || relationship === 'self' || relationship === 'mutual' || relationship === 'outgoing') return;
    actionPending.current = true;
    const version = requestVersion.current;
    setRelationshipLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (version !== requestVersion.current) return;
      const currentUserId = authData.user?.id ?? null;
      if (authError || !currentUserId || currentUserId === driverId) {
        throw new Error('Sign in again to interact with this driver.');
      }
      const { error: followError } = await supabase.from('follows')
        .insert({ follower_id: currentUserId, following_id: driverId });
      if (version !== requestVersion.current) return;
      if (followError && followError.code !== '23505') {
        throw new Error('Connection could not be updated. Try again.');
      }
      setRelationship((current) => current === 'incoming' ? 'mutual' : 'outgoing');
      onRelationshipChange();
    } catch (connectError) {
      if (version === requestVersion.current) {
        setError(connectError instanceof Error ? connectError.message : 'Connection could not be updated. Try again.');
      }
    } finally {
      actionPending.current = false;
      if (version === requestVersion.current) setRelationshipLoading(false);
    }
  }, [driverId, error, loading, onRelationshipChange, relationship, unavailable]);

  const name = isRelevant ? displayName(profile, unavailable || error ? null : fallbackProfile) : 'NOXA driver';
  const username = isRelevant && !unavailable && !error
    ? usernameLabel(profile?.username ?? fallbackProfile?.username)
    : null;
  const avatarUrl = isRelevant && !unavailable && !error
    ? (profile?.avatarUrl ?? fallbackProfile?.avatarUrl ?? null)
    : null;
  const car = isRelevant ? vehicleLabel(vehicle) : null;

  const primaryAction = useMemo<{
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    disabled: boolean;
    onPress: () => void;
  }>(() => {
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
    <Animated.View
      entering={DRIVER_CARD_ENTER}
      exiting={DRIVER_CARD_EXIT}
      style={[styles.cardPosition, { bottom: bottomOffset }]}>
      <NoxaSurface level="overlay" style={styles.card}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.avatarWrap}>
            <NoxaAvatar imageUrl={avatarUrl} initials={isRelevant ? initials(name) : 'NX'} size={48} />

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
              {sharedCrew ? <Text style={styles.username}>Shared Crew</Text> : null}
            </View>
          </View>
        </View>

        <NoxaIconButton
          accessibilityLabel="Close driver card"
          icon="close"
          iconSize={18}
          onPress={onClose}
          size={44}
          variant="ghost"
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Loading driver…</Text>
        </View>
      ) : (
        <>
          {!unavailable && vehicle ? (
            <NoxaPressableSurface
              accessibilityLabel={car ? `Open ${car}` : 'Open vehicle'}
              accessibilityRole="button"
              contentStyle={styles.vehicle}
              onPress={() =>
                router.push({ pathname: '/vehicle-details', params: { id: vehicle.id } })
              }>
              {vehicle.coverImageUrl ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  recyclingKey={vehicle.id}
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
            </NoxaPressableSurface>
          ) : !error ? (
            <Text style={styles.loadingText}>
              {unavailable ? 'This driver is private or no longer available.'
                : !isRelevant ? 'Identity is private on the map.'
                  : 'No public primary vehicle.'}
            </Text>
          ) : null}

          {error ? (
            <View style={styles.loading}>
              <Text accessibilityRole="alert" style={[styles.error, { flex: 1 }]}>{error}</Text>
              <NoxaButton title="Retry" variant="secondary" size="sm" onPress={() => void load()} />
            </View>
          ) : null}

          <View style={styles.actions}>
            <NoxaButton
              disabled={primaryAction.disabled || Boolean(error) || unavailable}
              leadingIcon={<Ionicons name={primaryAction.icon} size={16} color={colors.text} />}
              loading={relationshipLoading}
              onPress={primaryAction.onPress}
              size="md"
              style={styles.primaryAction}
              title={primaryAction.title}
            />

            {relationship !== 'self' && !unavailable ? (
              <NoxaButton
                disabled={Boolean(error)}
                leadingIcon={<Ionicons name="person-outline" size={16} color={colors.text} />}
                onPress={() =>
                  router.push({
                    pathname: '/driver-profile/[id]',
                    params: { id: driverId },
                  })
                }
                size="md"
                style={styles.secondaryAction}
                title="Profile"
                variant="secondary"
              />
            ) : null}
          </View>
        </>
      )}
      </NoxaSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardPosition: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    zIndex: 52,
  },
  card: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: spacing.md,
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
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
