import { FontAwesome5, Ionicons } from '@expo/vector-icons';
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
import { requireClientEnv } from '@/src/config/env';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

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

const { supabaseUrl, supabasePublishableKey } = requireClientEnv();

type RestProbeResult = {
  status: number;
  headersMs: number;
  bodyMs: number;
  bytes: number;
};

function diagnosticError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

async function probeVehiclesRest(
  userId: string,
  accessToken: string,
): Promise<RestProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const startedAt = Date.now();

  try {
    const query = new URLSearchParams({
      select: 'id',
      owner_id: `eq.${userId}`,
      limit: '1',
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/vehicles?${query.toString()}`, {
      headers: {
        Accept: 'application/json',
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
    const headersMs = Date.now() - startedAt;
    const bodyStartedAt = Date.now();
    const body = await response.text();

    return {
      status: response.status,
      headersMs,
      bodyMs: Date.now() - bodyStartedAt,
      bytes: body.length,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function vehicleMeta(vehicle: GarageVehicle) {
  const items = [
    vehicle.color?.trim() || null,
    vehicle.horsepower === null ? null : `${vehicle.horsepower} HP`,
    vehicle.tuning_stage?.trim() || null,
    vehicle.zero_to_hundred === null ? null : `${vehicle.zero_to_hundred}s 0–100`,
  ].filter((value): value is string => Boolean(value));

  return items.slice(0, 3);
}

function VehicleFallbackIcon({ vehicleType }: { vehicleType: GarageVehicle['vehicle_type'] }) {
  if (vehicleType === 'motorcycle') {
    return <FontAwesome5 name="motorcycle" size={72} color={colors.primaryMuted} />;
  }

  return <Ionicons name="car-sport" size={86} color={colors.primaryMuted} />;
}

function VehicleArtwork({ vehicle }: { vehicle: GarageVehicle }) {
  const content = (
    <>
      <View style={styles.heroShade} />
      <View style={styles.vehicleBadges}>
        {vehicle.is_primary ? <NoxaBadge label="PRIMARY" variant="primary" /> : null}
        <NoxaBadge label={vehicle.is_public ? 'PUBLIC' : 'PRIVATE'} variant={vehicle.is_public ? 'primary' : 'default'} />
      </View>
      <View style={styles.heroContent}>
        <Text numberOfLines={1} style={styles.brand}>{vehicle.brand}</Text>
        <Text numberOfLines={1} style={styles.model}>
          {[vehicle.model, vehicle.year].filter(Boolean).join(' · ') || 'Vehicle'}
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
      <VehicleFallbackIcon vehicleType={vehicle.vehicle_type} />
      {content}
    </View>
  );
}

function VehicleCard({
  vehicle,
  index,
  busy,
  onMakePrimary,
}: {
  vehicle: GarageVehicle;
  index: number;
  busy: boolean;
  onMakePrimary: (vehicle: GarageVehicle) => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const meta = vehicleMeta(vehicle);
  const modelName = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 420, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={styles.vehicleCard}>
        <Pressable
          accessibilityLabel={`Open ${modelName} details`}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/vehicle-details', params: { id: vehicle.id } })}
          style={({ pressed }) => pressed && styles.pressed}>
          <VehicleArtwork vehicle={vehicle} />
          <View style={styles.identityFooter}>
            <View style={styles.identityCopy}>
              <Text style={styles.vehicleType}>{vehicle.vehicle_type === 'motorcycle' ? 'MOTORCYCLE' : 'CAR'}</Text>
              <Text numberOfLines={1} style={styles.metaText}>
                {meta.length > 0 ? meta.join('  ·  ') : 'Add build details anytime'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </View>
        </Pressable>
        {!vehicle.is_primary ? (
          <Pressable
            accessibilityLabel={`Make ${modelName || 'vehicle'} primary`}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onMakePrimary(vehicle)}
            style={({ pressed }) => [styles.primaryAction, pressed && !busy && styles.pressed, busy && styles.disabled]}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.primaryHover} />
            ) : (
              <Ionicons name="star-outline" size={16} color={colors.primaryHover} />
            )}
            <Text style={styles.primaryActionText}>{busy ? 'SETTING PRIMARY…' : 'MAKE PRIMARY'}</Text>
          </Pressable>
        ) : (
          <View style={styles.primaryLockedRow}>
            <Ionicons name="star" size={15} color={colors.primaryHover} />
            <Text style={styles.primaryLockedText}>PRIMARY VEHICLE</Text>
          </View>
        )}
      </View>
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
      <Text style={styles.stateText}>Add a car or motorcycle and start building your NOXA identity.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/vehicle-picker')} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
        <Text style={styles.retryText}>ADD FIRST VEHICLE</Text>
      </Pressable>
    </View>
  );
}

export default function GarageScreen() {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [hasVehicleError, setHasVehicleError] = useState(false);
  const [primaryBusyId, setPrimaryBusyId] = useState<string | null>(null);
  const [diagnosticLines, setDiagnosticLines] = useState<string[]>([
    'BUILD 7 DATA DIAGNOSTICS',
    'Waiting for Garage request…',
  ]);
  const hasLoadedVehiclesRef = useRef(false);
  const diagnosticRunRef = useRef(0);

  const loadVehicles = useCallback(async () => {
    const runId = ++diagnosticRunRef.current;
    const appendDiagnostic = (message: string) => {
      if (runId !== diagnosticRunRef.current) return;
      setDiagnosticLines((current) => [
        current[0] ?? 'BUILD 7 DATA DIAGNOSTICS',
        ...current.slice(-5),
        message,
      ]);
    };

    setDiagnosticLines([
      'BUILD 7 DATA DIAGNOSTICS',
      'SESSION: checking local session…',
    ]);
    setIsLoadingVehicles(!hasLoadedVehiclesRef.current);
    setHasVehicleError(false);

    const sessionStartedAt = Date.now();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (sessionError || !session) {
      appendDiagnostic(
        `SESSION: FAIL after ${Date.now() - sessionStartedAt}ms — ${
          sessionError?.message ?? 'no session'
        }`,
      );
      setVehicles([]);
      setHasVehicleError(true);
      hasLoadedVehiclesRef.current = true;
      setIsLoadingVehicles(false);
      return;
    }

    appendDiagnostic(
      `SESSION: OK in ${Date.now() - sessionStartedAt}ms`,
    );

    appendDiagnostic('RAW REST: request sent…');
    void probeVehiclesRest(session.user.id, session.access_token)
      .then((probe) => {
        appendDiagnostic(
          `RAW REST: HTTP ${probe.status}, headers ${probe.headersMs}ms, body ${probe.bodyMs}ms, ${probe.bytes}B`,
        );
      })
      .catch((error) => {
        appendDiagnostic(`RAW REST: FAIL — ${diagnosticError(error)}`);
      });

    appendDiagnostic('SUPABASE CLIENT: request sent…');
    const clientStartedAt = Date.now();

    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select(vehicleSelect)
        .eq('owner_id', session.user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      const clientMs = Date.now() - clientStartedAt;
      appendDiagnostic(
        error
          ? `SUPABASE CLIENT: ERROR in ${clientMs}ms — ${error.code ?? 'unknown'} ${error.message}`
          : `SUPABASE CLIENT: OK in ${clientMs}ms — ${data?.length ?? 0} rows`,
      );

      if (error) {
        setHasVehicleError(true);
      } else {
        setVehicles((data ?? []) as GarageVehicle[]);
      }

      appendDiagnostic('UI: state committed');
    } catch (error) {
      appendDiagnostic(`SUPABASE CLIENT: THROW — ${diagnosticError(error)}`);
      setHasVehicleError(true);
    } finally {
      hasLoadedVehiclesRef.current = true;
      setIsLoadingVehicles(false);
    }
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
          <View style={styles.headingBlock}>
            <Text style={styles.pageTitle}>GARAGE</Text>
            <Text style={styles.pageSubtitle}>
              {isLoadingVehicles ? 'Loading vehicles…' : `${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}`}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Add Vehicle"
            accessibilityRole="button"
            onPress={() => router.push('/vehicle-picker')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={17} color={colors.text} />
            <Text style={styles.addText}>ADD</Text>
          </Pressable>
        </View>

        <View style={styles.diagnosticPanel}>
          {diagnosticLines.map((line, index) => (
            <Text key={`${index}-${line}`} selectable style={styles.diagnosticText}>
              {line}
            </Text>
          ))}
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

        {!isLoadingVehicles && !hasVehicleError && vehicles.length > 0 ? (
          <Pressable
            accessibilityLabel="Add another vehicle"
            accessibilityRole="button"
            onPress={() => router.push('/vehicle-picker')}
            style={({ pressed }) => [styles.addSlot, pressed && styles.pressed]}>
            <Ionicons name="add" size={17} color={colors.textMuted} />
            <Text style={styles.addSlotText}>Add another vehicle</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  diagnosticPanel: {
    gap: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(225,29,46,0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(225,29,46,0.08)',
  },
  diagnosticText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.fontFamily.body,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 144,
    gap: spacing.lg,
  },
  topBar: {
    minHeight: 72,
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
  },
  addText: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  pressed: { opacity: 0.82, transform: [{ translateY: 1 }, { scale: 0.988 }] },
  disabled: { opacity: 0.52 },
  vehicleList: { gap: spacing.md },
  vehicleCard: {
    overflow: 'hidden',
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroImage: { height: 228, justifyContent: 'flex-end', backgroundColor: colors.surfaceSoft },
  heroImageRadius: { borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero },
  vehiclePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,10,0.30)' },
  vehicleBadges: { position: 'absolute', top: spacing.sm, left: spacing.sm, flexDirection: 'row', gap: spacing.xs },
  heroContent: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  brand: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.5,
    lineHeight: 38,
    textTransform: 'uppercase',
  },
  model: {
    marginTop: spacing.xxs,
    color: 'rgba(240,240,244,0.72)',
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  identityFooter: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  identityCopy: { flex: 1, minWidth: 0 },
  vehicleType: {
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  metaText: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  primaryAction: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surfaceSoft,
  },
  primaryActionText: { color: colors.primaryHover, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  primaryLockedRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  primaryLockedText: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
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
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  addSlotText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
});