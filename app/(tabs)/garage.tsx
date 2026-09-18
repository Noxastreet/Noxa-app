import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoxaIconButton, NoxaScreen } from '@/src/components/ui';
import { getCurrentSessionUser, supabase } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

type GarageVehicle = {
  id: string;
  owner_id: string;
  vehicle_type: 'car' | 'motorcycle';
  brand: string;
  model: string | null;
  year: number | null;
  horsepower: number | null;
  color: string;
  transmission: string | null;
  drivetrain: string | null;
  tuning_stage: string | null;
  zero_to_hundred: number | null;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
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
  is_public,
  is_primary,
  created_at,
  updated_at
`;

function vehicleMeta(vehicle: GarageVehicle) {
  const items = [
    vehicle.color?.trim() || null,
    vehicle.horsepower === null ? null : `${vehicle.horsepower} HP`,
    vehicle.tuning_stage?.trim() && vehicle.tuning_stage.trim() !== '-1' ? vehicle.tuning_stage.trim() : null,
    vehicle.zero_to_hundred === null ? null : `${vehicle.zero_to_hundred}s 0–100`,
  ].filter((value): value is string => Boolean(value));

  return items.slice(0, 3);
}

function VehicleFallbackIcon({ vehicleType }: { vehicleType: GarageVehicle['vehicle_type'] }) {
  if (vehicleType === 'motorcycle') {
    return <FontAwesome5 name="motorcycle" size={28} color={colors.textMuted} />;
  }

  return <Ionicons name="car-sport-outline" size={32} color={colors.textMuted} />;
}

function VehicleArtwork({ vehicle }: { vehicle: GarageVehicle }) {
  if (vehicle.cover_image_url) {
    return (
      <ImageBackground
        source={{ uri: vehicle.cover_image_url }}
        resizeMode="cover"
        style={styles.vehicleThumbnail}
        imageStyle={styles.vehicleThumbnailImage}
      />
    );
  }

  return (
    <View style={[styles.vehicleThumbnail, styles.vehiclePlaceholder]}>
      <VehicleFallbackIcon vehicleType={vehicle.vehicle_type} />
    </View>
  );
}

function VehicleCard({
  vehicle,
  busy,
  onMakePrimary,
}: {
  vehicle: GarageVehicle;
  index: number;
  busy: boolean;
  onMakePrimary: (vehicle: GarageVehicle) => void;
}) {
  const meta = vehicleMeta(vehicle);
  const modelName = [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';

  return (
    <View style={styles.vehicleCard}>
      <Pressable
        accessibilityLabel={`Open ${modelName} details`}
        accessibilityRole="button"
        accessibilityHint="Opens vehicle details"
        onPress={() => router.push({ pathname: '/vehicle-details', params: { id: vehicle.id } })}
        style={({ pressed }) => [styles.vehicleMain, pressed && styles.pressed]}
      >
        <VehicleArtwork vehicle={vehicle} />
        <View style={styles.vehicleCopy}>
          <View style={styles.vehicleTitleLine}>
            <Text numberOfLines={1} style={styles.vehicleName}>
              {modelName}
            </Text>
            {vehicle.is_primary ? (
              <Text style={styles.primaryState}>Primary</Text>
            ) : null}
          </View>
          <Text numberOfLines={1} style={styles.vehicleSubline}>
            {[vehicle.year, vehicle.vehicle_type === 'motorcycle' ? 'Motorcycle' : 'Car']
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text numberOfLines={1} style={styles.metaText}>
            {meta.length > 0 ? meta.join(' · ') : vehicle.is_public ? 'Public vehicle' : 'Private vehicle'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Pressable>

      {!vehicle.is_primary ? (
        <Pressable
          accessibilityLabel={`Make ${modelName} primary`}
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onMakePrimary(vehicle)}
          style={({ pressed }) => [
            styles.makePrimaryRow,
            pressed && !busy && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primaryHover} />
          ) : (
            <Ionicons name="star-outline" size={16} color={colors.primaryHover} />
          )}
          <Text style={styles.makePrimaryText}>
            {busy ? 'Setting primary…' : 'Make primary'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function GarageState({ error, isLoading, onRetry }: { error: boolean; isLoading: boolean; onRetry: () => void }) {
  if (isLoading) {
    return (
      <View style={styles.collectionState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.stateText}>Loading your garage…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.collectionState}>
        <View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={28} color={colors.primary} /></View>
        <Text style={styles.stateTitle}>Garage unavailable</Text>
        <Text style={styles.stateText}>Your vehicles could not be loaded.</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.collectionState}>
      <View style={styles.stateIcon}><Ionicons name="car-sport-outline" size={30} color={colors.primary} /></View>
      <Text style={styles.stateTitle}>Your garage is empty</Text>
      <Text style={styles.stateText}>Add a car or motorcycle to your garage.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/vehicle-picker')} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
        <Text style={styles.retryText}>Add vehicle</Text>
      </Pressable>
    </View>
  );
}

export default function GarageScreen() {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [hasVehicleError, setHasVehicleError] = useState(false);
  const [primaryBusyId, setPrimaryBusyId] = useState<string | null>(null);
  const hasLoadedVehiclesRef = useRef(false);

  const loadVehicles = useCallback(async () => {
    setIsLoadingVehicles(!hasLoadedVehiclesRef.current);
    setHasVehicleError(false);

    const user = await getCurrentSessionUser();

    if (!user) {
      setVehicles([]);
      setHasVehicleError(true);
      hasLoadedVehiclesRef.current = true;
      setIsLoadingVehicles(false);
      return;
    }

    const { data, error } = await supabase
      .from('vehicles')
      .select(vehicleSelect)
      .eq('owner_id', user.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setHasVehicleError(true);
    } else {
      setVehicles((data ?? []) as GarageVehicle[]);
    }

    hasLoadedVehiclesRef.current = true;
    setIsLoadingVehicles(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadVehicles();
    }, [loadVehicles]),
  );

  const makePrimary = useCallback(async (vehicle: GarageVehicle) => {
    if (primaryBusyId || vehicle.is_primary) return;
    setPrimaryBusyId(vehicle.id);
    setHasVehicleError(false);

    const { data, error } = await supabase.rpc('noxa_set_primary_vehicle', {
      target_vehicle_id: vehicle.id,
    });

    if (error || data !== true) {
      setHasVehicleError(true);
    } else {
      await loadVehicles();
    }
    setPrimaryBusyId(null);
  }, [loadVehicles, primaryBusyId]);

  return (
    <NoxaScreen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Garage</Text>
          <NoxaIconButton
            accessibilityLabel="Add vehicle"
            accessibilityHint="Opens vehicle picker"
            icon="add"
            variant="ghost"
            onPress={() => router.push('/vehicle-picker')}
          />
        </View>

        {isLoadingVehicles || hasVehicleError || vehicles.length === 0 ? (
          <GarageState error={hasVehicleError} isLoading={isLoadingVehicles} onRetry={loadVehicles} />
        ) : (
          <View style={styles.vehicleList}>
            {vehicles.map((vehicle, index) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                index={index}
                busy={primaryBusyId === vehicle.id}
                onMakePrimary={makePrimary}
              />
            ))}
          </View>
        )}

      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 112,
    gap: spacing.xs,
  },
  topBar: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.3,
    fontWeight: '700',
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.52 },
  vehicleList: { gap: 0 },
  vehicleCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  vehicleMain: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  vehicleThumbnail: {
    width: 72,
    height: 54,
    overflow: 'hidden',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
  },
  vehicleThumbnailImage: { borderRadius: radius.sm },
  vehiclePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  vehicleCopy: { flex: 1, minWidth: 0, gap: 3 },
  vehicleTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vehicleName: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    ...typography.v2.row,
    fontWeight: '700',
  },
  primaryState: {
    color: colors.primaryHover,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  vehicleSubline: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
  },
  metaText: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 16,
  },
  makePrimaryRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: 96,
  },
  makePrimaryText: {
    color: colors.primaryHover,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  collectionState: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  stateIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    maxWidth: 280,
    color: colors.textMuted,
    ...typography.v2.body,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
