import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, type ImageStyle } from 'react-native';

import { NoxaAvatar, NoxaBadge, NoxaScreen } from '@/src/components/ui';
import { EntityActionSheet, type EntityAction } from '@/src/features/crews-events/EntityActionSheet';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

type VehicleInfoRow = {
  label: string;
  value?: string | number | null;
};

type VehicleDetails = {
  id: string;
  owner_id: string;
  vehicle_type: 'car' | 'motorcycle';
  brand: string | null;
  model: string | null;
  year: number | null;
  horsepower: number | null;
  color: string | null;
  transmission: string | null;
  drivetrain: string | null;
  tuning_stage: string | null;
  zero_to_hundred: number | null;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean | null;
};

type VehicleOwner = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
};

const vehicleSelect = `
  id,
  owner_id,
  vehicle_type,
  brand,
  model,
  year,
  horsepower,
  color,
  transmission,
  drivetrain,
  tuning_stage,
  zero_to_hundred,
  description,
  cover_image_url,
  is_public
`;

const ownerSelect = `
  id,
  display_name,
  username,
  avatar_url,
  city
`;

function isPresent(value?: string | number | null) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getParamId(id: string | string[] | undefined) {
  return Array.isArray(id) ? id[0] : id;
}

function formatOwnerInitials(owner: VehicleOwner) {
  const displayName = owner.display_name || owner.username || 'NX';
  return displayName.slice(0, 2);
}

function HeaderAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

function Header({ onMenu, showMenu }: { onMenu: () => void; showMenu: boolean }) {
  return (
    <View style={styles.header}>
      <HeaderAction icon="chevron-back" label="Go back" onPress={() => router.back()} />
      {showMenu ? <HeaderAction icon="ellipsis-horizontal" label="Vehicle actions" onPress={onMenu} /> : <View style={styles.headerSpacer} />}
    </View>
  );
}

function VehicleFallback({ vehicleType }: { vehicleType: VehicleDetails['vehicle_type'] }) {
  if (vehicleType === 'motorcycle') {
    return <FontAwesome5 name="motorcycle" size={78} color={colors.primaryMuted} />;
  }

  return <Ionicons name="car-sport" size={96} color={colors.primaryMuted} />;
}

function VehicleHero({ vehicle }: { vehicle: VehicleDetails }) {
  const content = (
    <>
      <View style={styles.heroTopFade} />
      <View style={styles.heroBottomFade} />
      <View style={styles.heroContent}>
        {typeof vehicle.is_public === 'boolean' ? <NoxaBadge label={vehicle.is_public ? 'PUBLIC' : 'PRIVATE'} variant="primary" /> : <View />}
        <View>
          <Text numberOfLines={1} style={styles.heroTitle}>{vehicle.brand || 'VEHICLE'}</Text>
          <Text numberOfLines={1} style={styles.heroSubtitle}>
            {[vehicle.model, vehicle.year].filter(isPresent).join(' · ') || 'NOXA garage'}
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.heroCard}>
      {vehicle.cover_image_url ? (
        <ImageBackground source={{ uri: vehicle.cover_image_url }} resizeMode="cover" style={styles.heroImage} imageStyle={styles.heroImageRadius as ImageStyle}>
          {content}
        </ImageBackground>
      ) : (
        <View style={[styles.heroImage, styles.vehiclePlaceholder]}>
          <VehicleFallback vehicleType={vehicle.vehicle_type} />
          {content}
        </View>
      )}
    </View>
  );
}

function OwnerCard({ owner }: { owner: VehicleOwner }) {
  const ownerName = owner.display_name || owner.username;
  const ownerHandle = owner.username ? (owner.username.startsWith('@') ? owner.username : `@${owner.username}`) : null;
  const ownerMeta = [ownerHandle, owner.city].filter(isPresent).join(' • ');

  if (!ownerName && !ownerMeta) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View owner profile"
      onPress={() => router.push({ pathname: '/driver-profile/[id]', params: { id: owner.id } })}
      style={({ pressed }) => [styles.ownerCard, pressed && styles.pressed]}>
      {owner.avatar_url ? (
        <Image source={{ uri: owner.avatar_url }} style={styles.ownerAvatar} accessibilityLabel={`${ownerName || 'Owner'} avatar`} />
      ) : (
        <NoxaAvatar initials={formatOwnerInitials(owner)} size={48} />
      )}
      <View style={styles.ownerCopy}>
        <Text style={styles.eyebrow}>OWNER</Text>
        {ownerName ? <Text style={styles.ownerName}>{ownerName}</Text> : null}
        {ownerMeta ? <Text style={styles.ownerMeta}>{ownerMeta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

function Information({ rows }: { rows: VehicleInfoRow[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionEyebrow}>DETAILS</Text>
      <View style={styles.infoList}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.infoRow, index < rows.length - 1 && styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>{row.label}</Text>
            <Text style={styles.infoValue}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function About({ description }: { description: string | null }) {
  if (!isPresent(description)) {
    return null;
  }

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionEyebrow}>ABOUT THIS BUILD</Text>
      <Text style={styles.bodyText}>{description}</Text>
    </View>
  );
}

function StateCard({ title, message, onRetry, loading }: { title: string; message?: string; onRetry?: () => void; loading?: boolean }) {
  return (
    <View style={styles.stateCard}>
      {loading ? <ActivityIndicator color={colors.primary} /> : <View style={styles.stateIcon}><Ionicons name="car-sport-outline" size={28} color={colors.primary} /></View>}
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateText}>{message}</Text> : null}
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function VehicleDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const vehicleId = getParamId(id);
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [owner, setOwner] = useState<VehicleOwner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);

  const informationRows = useMemo<VehicleInfoRow[]>(() => {
    if (!vehicle) {
      return [];
    }

    return [
      { label: 'Type', value: vehicle.vehicle_type === 'motorcycle' ? 'Motorcycle' : 'Car' },
      { label: 'Year', value: vehicle.year },
      { label: 'Power', value: vehicle.horsepower === null ? null : `${vehicle.horsepower} HP` },
      { label: '0–100 km/h', value: vehicle.zero_to_hundred === null ? null : `${vehicle.zero_to_hundred} s` },
      { label: 'Color', value: vehicle.color },
      { label: 'Transmission', value: vehicle.transmission },
      { label: 'Drivetrain', value: vehicle.drivetrain },
      { label: 'Tuning', value: vehicle.tuning_stage },
      { label: 'Visibility', value: typeof vehicle.is_public === 'boolean' ? (vehicle.is_public ? 'Public' : 'Private') : null },
    ].filter((row) => isPresent(row.value));
  }, [vehicle]);

  const loadVehicle = useCallback(async () => {
    if (!vehicleId || !isUuid(vehicleId)) {
      setVehicle(null);
      setOwner(null);
      setError('Invalid vehicle id.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    setCurrentUserId(userData.user?.id ?? null);

    const { data: vehicleData, error: vehicleError } = await supabase.from('vehicles').select(vehicleSelect).eq('id', vehicleId).maybeSingle();

    if (vehicleError || !vehicleData) {
      setVehicle(null);
      setOwner(null);
      setError('Unable to load vehicle.');
      setIsLoading(false);
      return;
    }

    const loadedVehicle = vehicleData as VehicleDetails;
    setVehicle(loadedVehicle);

    const { data: ownerData, error: ownerError } = await supabase.from('profiles').select(ownerSelect).eq('id', loadedVehicle.owner_id).maybeSingle();

    if (ownerError) {
      setOwner(null);
      setError('Vehicle loaded, but owner details are unavailable.');
    } else {
      setOwner((ownerData as VehicleOwner | null) ?? null);
    }

    setIsLoading(false);
  }, [vehicleId]);

  useEffect(() => {
    void loadVehicle();
  }, [loadVehicle]);

  const deleteVehicle = useCallback(async () => {
    if (isDeleting || !vehicle) {
      return;
    }

    setIsDeleting(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const currentUser = authData.user;

    if (authError || !currentUser) {
      setIsDeleting(false);
      Alert.alert('Unable to delete vehicle', 'You must be signed in to delete this vehicle.');
      return;
    }

    if (currentUser.id !== vehicle.owner_id) {
      setIsDeleting(false);
      Alert.alert('Unable to delete vehicle', 'You can only delete vehicles you own.');
      return;
    }

    const { data, error: deleteError } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicle.id)
      .eq('owner_id', currentUser.id)
      .select('id');

    if (deleteError) {
      setIsDeleting(false);
      Alert.alert('Unable to delete vehicle', deleteError.message);
      return;
    }

    if (!data || data.length === 0) {
      setIsDeleting(false);
      Alert.alert('Unable to delete vehicle', 'No vehicle was deleted. Please try again.');
      return;
    }

    setIsDeleting(false);
    router.replace('/(tabs)/garage');
  }, [isDeleting, vehicle]);

  const confirmDeleteVehicle = useCallback(() => {
    if (isDeleting) {
      return;
    }

    Alert.alert('Delete vehicle?', 'This vehicle will be permanently removed from your garage.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteVehicle() },
    ]);
  }, [deleteVehicle, isDeleting]);

  const ownsVehicle = Boolean(vehicle && currentUserId && currentUserId === vehicle.owner_id);
  const vehicleTitle = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ') || 'Vehicle';
  const ownerActions = useMemo<EntityAction[]>(() => {
    if (!vehicle || !ownsVehicle) {
      return [];
    }

    return [
      {
        key: 'edit',
        label: 'Edit vehicle',
        icon: 'create-outline',
        onPress: () => router.push({ pathname: '/vehicle-editor', params: { id: vehicle.id } }),
      },
      {
        key: 'delete',
        label: isDeleting ? 'Deleting…' : 'Delete vehicle',
        icon: 'trash-outline',
        destructive: true,
        disabled: isDeleting,
        onPress: confirmDeleteVehicle,
      },
    ];
  }, [confirmDeleteVehicle, isDeleting, ownsVehicle, vehicle]);

  return (
    <NoxaScreen padded={false}>
      <Header onMenu={() => setActionsVisible(true)} showMenu={ownsVehicle} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? <StateCard loading title="Loading vehicle..." /> : null}
        {!isLoading && error ? <StateCard title={error} onRetry={loadVehicle} /> : null}
        {!isLoading && !error && vehicle ? (
          <>
            <VehicleHero vehicle={vehicle} />
            {owner ? <OwnerCard owner={owner} /> : null}
            <Information rows={informationRows} />
            <About description={vehicle.description} />
          </>
        ) : null}
      </ScrollView>
      <EntityActionSheet
        actions={ownerActions}
        onClose={() => setActionsVisible(false)}
        title={vehicleTitle}
        visible={actionsVisible && ownsVehicle}
      />
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 72, gap: spacing.lg },
  header: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,6,10,0.72)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  headerSpacer: { width: 40, height: 40 },
  pressed: { opacity: 0.82, transform: [{ translateY: 1 }, { scale: 0.98 }] },
  heroCard: { height: 330, overflow: 'hidden', backgroundColor: colors.surface },
  heroImage: { flex: 1 },
  heroImageRadius: { borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero },
  vehiclePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },
  heroTopFade: { ...StyleSheet.absoluteFillObject, bottom: undefined, height: 130, backgroundColor: 'rgba(6,6,10,0.22)' },
  heroBottomFade: { ...StyleSheet.absoluteFillObject, top: undefined, height: 190, backgroundColor: 'rgba(6,6,10,0.68)' },
  heroContent: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 68, paddingBottom: spacing.lg },
  heroTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 0.4,
    lineHeight: 48,
    textTransform: 'uppercase',
  },
  heroSubtitle: {
    marginTop: spacing.xxs,
    color: 'rgba(240,240,244,0.72)',
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '700',
  },
  ownerCard: {
    marginHorizontal: spacing.lg,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  ownerAvatar: { width: 48, height: 48, borderRadius: radius.pill },
  ownerCopy: { flex: 1 },
  eyebrow: { color: colors.textSubtle, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  ownerName: { marginTop: spacing.xxs, color: colors.text, fontSize: typography.body, fontWeight: '900' },
  ownerMeta: { marginTop: spacing.xxs, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  sectionBlock: { marginHorizontal: spacing.lg, gap: spacing.sm },
  sectionEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: typography.letterSpacing.label },
  infoList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  infoRow: { minHeight: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  infoLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  infoValue: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  bodyText: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 23 },
  stateCard: {
    minHeight: 320,
    marginHorizontal: spacing.lg,
    marginTop: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primarySubtle },
  stateTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: typography.title, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  stateText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
  retryButton: { marginTop: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.button, backgroundColor: colors.primary },
  retryText: { color: colors.text, fontSize: typography.caption, fontWeight: '900' },
});