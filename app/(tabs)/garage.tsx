import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
} from 'react-native';

import { NoxaBadge, NoxaScreen } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

type GarageVehicle = {
  id: string;
  owner_id: string;
  brand: string;
  model: string | null;
  year: number | null;
  horsepower: number;
  color: string;
  transmission: string | null;
  drivetrain: string | null;
  tuning_stage: string | null;
  zero_to_hundred: number | null;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

const vehicleSelect = `
  id,
  owner_id,
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
  created_at,
  updated_at
`;

function formatAcceleration(value: number | null) {
  return value === null ? '—' : String(value);
}

function formatYear(value: number | null) {
  return value === null ? '—' : String(value);
}

function vehicleTags(vehicle: GarageVehicle) {
  return [vehicle.color, vehicle.tuning_stage, vehicle.transmission, vehicle.drivetrain].filter(
    (value): value is string => Boolean(value?.trim()),
  );
}

function SpecCell({ label, value, unit, bordered = false }: { label: string; value: string; unit?: string; bordered?: boolean }) {
  return (
    <View style={[styles.specCell, bordered && styles.specCellBorder]}>
      <View style={styles.specValueRow}>
        <Text style={styles.specValue}>{value}</Text>
        {unit ? <Text style={styles.specUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.specLabel}>{label}</Text>
    </View>
  );
}

function VehicleArtwork({ vehicle }: { vehicle: GarageVehicle }) {
  const content = (
    <>
      <View style={styles.heroShade} />
      <View style={styles.vehicleBadge}>
        <NoxaBadge label={vehicle.is_public ? 'PUBLIC' : 'PRIVATE'} variant={vehicle.is_public ? 'primary' : 'default'} />
      </View>
      <View style={styles.heroContent}>
        <Text numberOfLines={1} style={styles.brand}>{vehicle.brand}</Text>
        <Text numberOfLines={1} style={styles.model}>
          {[vehicle.year, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}
        </Text>
      </View>
    </>
  );

  if (vehicle.cover_image_url) {
    return (
      <ImageBackground
        source={{ uri: vehicle.cover_image_url }}
        resizeMode="cover"
        style={styles.heroImage}
        imageStyle={styles.heroImageRadius as ImageStyle}>
        {content}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.heroImage, styles.vehiclePlaceholder]}>
      <Ionicons name="car-sport" size={86} color={colors.primaryMuted} />
      {content}
    </View>
  );
}

function VehicleCard({ vehicle, index }: { vehicle: GarageVehicle; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const tags = vehicleTags(vehicle);
  const modelName = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 460, delay: index * 55, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 460, delay: index * 55, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        accessibilityLabel={`Open ${modelName} details`}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/vehicle-details', params: { id: vehicle.id } })}
        style={({ pressed }) => [styles.vehicleCard, pressed && styles.pressed]}>
        <VehicleArtwork vehicle={vehicle} />
        <View style={styles.specStrip}>
          <SpecCell label="POWER" value={String(vehicle.horsepower)} unit="HP" />
          <SpecCell label="0–100" value={formatAcceleration(vehicle.zero_to_hundred)} unit={vehicle.zero_to_hundred === null ? undefined : 'S'} bordered />
          <SpecCell label="YEAR" value={formatYear(vehicle.year)} bordered />
        </View>
        {tags.length > 0 ? (
          <View style={styles.tagList}>
            {tags.map((tag, tagIndex) => (
              <View key={`${tag}-${tagIndex}`} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
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
          <Text style={styles.retryText}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.collectionState}>
      <View style={styles.stateIcon}><Ionicons name="car-sport-outline" size={30} color={colors.primary} /></View>
      <Text style={styles.stateTitle}>Your garage is empty</Text>
      <Text style={styles.stateText}>Add your first car and start building your NOXA identity.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/vehicle-editor')} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
        <Text style={styles.retryText}>ADD FIRST CAR</Text>
      </Pressable>
    </View>
  );
}

export default function GarageScreen() {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [hasVehicleError, setHasVehicleError] = useState(false);
  const hasLoadedVehiclesRef = useRef(false);

  const loadVehicles = useCallback(async () => {
    setIsLoadingVehicles(!hasLoadedVehiclesRef.current);
    setHasVehicleError(false);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;

    if (authError || !user) {
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

  return (
    <NoxaScreen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.headingBlock}>
            <Text style={styles.pageTitle}>GARAGE</Text>
            <Text style={styles.pageSubtitle}>
              {isLoadingVehicles ? 'Loading vehicles…' : `${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}`}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Add Vehicle"
            accessibilityRole="button"
            onPress={() => router.push('/vehicle-editor')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={17} color={colors.text} />
            <Text style={styles.addText}>ADD</Text>
          </Pressable>
        </View>

        {isLoadingVehicles || hasVehicleError || vehicles.length === 0 ? (
          <GarageState error={hasVehicleError} isLoading={isLoadingVehicles} onRetry={loadVehicles} />
        ) : (
          <View style={styles.vehicleList}>
            {vehicles.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} index={index} />)}
          </View>
        )}

        {!isLoadingVehicles && !hasVehicleError && vehicles.length > 0 ? (
          <Pressable
            accessibilityLabel="Add another vehicle"
            accessibilityRole="button"
            onPress={() => router.push('/vehicle-editor')}
            style={({ pressed }) => [styles.addSlot, pressed && styles.pressed]}>
            <View style={styles.addSlotIcon}><Ionicons name="add" size={18} color={colors.textMuted} /></View>
            <Text style={styles.addSlotText}>Add another vehicle</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 144,
    gap: spacing.lg,
  },
  topBar: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingBlock: { flex: 1 },
  pageTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.hero,
    fontWeight: '900',
    letterSpacing: 0.6,
    lineHeight: typography.lineHeight.hero,
  },
  pageSubtitle: {
    marginTop: -spacing.xs,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  addButton: {
    minHeight: 38,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    ...shadows.redGlow,
  },
  addText: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  pressed: { opacity: 0.82, transform: [{ translateY: 1 }, { scale: 0.985 }] },
  vehicleList: { gap: spacing.md },
  vehicleCard: {
    overflow: 'hidden',
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroImage: { height: 210, justifyContent: 'flex-end', backgroundColor: colors.surfaceSoft },
  heroImageRadius: { borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero },
  vehiclePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,10,0.35)' },
  vehicleBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  heroContent: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  brand: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.7,
    lineHeight: 36,
    textTransform: 'uppercase',
  },
  model: {
    marginTop: spacing.xxs,
    color: 'rgba(240,240,244,0.68)',
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  specStrip: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.divider },
  specCell: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  specCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  specValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 3 },
  specValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
  },
  specUnit: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  specLabel: { marginTop: 2, color: colors.textSubtle, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  tag: {
    minHeight: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: { color: colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  collectionState: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  stateIcon: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  stateText: { maxWidth: 260, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700', lineHeight: 18, textAlign: 'center' },
  retryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  addSlot: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  addSlotIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  addSlotText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
});
