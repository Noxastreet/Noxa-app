import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { NoxaButton } from '@/src/components/ui';
import {
  GroupDriveHeader,
  GroupDriveStep,
  loadGroupDriveDetails,
  saveDriveRoute,
} from '@/src/features/group-drive';
import { MapboxEventLocationPickerCompat } from '@/src/features/mapbox/MapboxEventLocationPickerCompat';
import { NOXA_FALLBACK_COORDINATE } from '@/src/features/mapbox/config';
import type { LatLng } from '@/src/features/mapbox/types';
import { colors, radius, spacing, typography } from '@/src/theme';

type RoutePoint = LatLng & { label: string };
type PickerTarget = 'start' | 'end';

function coordinateLabel(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function resolveLabel(point: LatLng, approximate: boolean) {
  try {
    const address = (await Location.reverseGeocodeAsync(point))[0];
    if (!address) {
      return approximate
        ? 'Destination shared after joining'
        : coordinateLabel(point.latitude, point.longitude);
    }
    if (approximate) {
      const area = Array.from(
        new Set([address.city, address.district, address.subregion, address.region].filter(Boolean)),
      );
      return area.length ? area.join(', ') : 'Destination shared after joining';
    }
    const street = [address.name, address.street].filter(Boolean).join(' ').trim();
    const parts = Array.from(new Set([street, address.city, address.region].filter(Boolean)));
    return parts.length ? parts.join(', ') : coordinateLabel(point.latitude, point.longitude);
  } catch {
    return approximate
      ? 'Destination shared after joining'
      : coordinateLabel(point.latitude, point.longitude);
  }
}

function PointRow({
  icon,
  label,
  point,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  point: RoutePoint | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${point?.label ?? 'not selected'}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pointRow, pressed && styles.pressed]}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={20} color={point ? colors.primaryHover : colors.textMuted} />
      </View>
      <View style={styles.pointCopy}>
        <Text style={styles.pointLabel}>{label}</Text>
        <Text numberOfLines={2} style={[styles.pointValue, !point && styles.pointPlaceholder]}>
          {point?.label ?? 'Choose an exact point'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function GroupDriveRouteScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const driveSessionId = typeof params.id === 'string' ? params.id : '';
  const [start, setStart] = useState<RoutePoint | null>(null);
  const [end, setEnd] = useState<RoutePoint | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [draftCoordinate, setDraftCoordinate] = useState<LatLng>(NOXA_FALLBACK_COORDINATE);
  const [isLocating, setIsLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driveSessionId) {
      setError('This Group Drive link is invalid.');
      return;
    }
    try {
      const drive = await loadGroupDriveDetails(driveSessionId);
      const startStop = drive.stops.find((stop) => stop.kind === 'start');
      const endStop = drive.stops.find((stop) => stop.kind === 'end');
      if (startStop) {
        setStart({
          latitude: startStop.latitude,
          longitude: startStop.longitude,
          label: startStop.label ?? coordinateLabel(startStop.latitude, startStop.longitude),
        });
      }
      if (endStop) {
        setEnd({
          latitude: endStop.latitude,
          longitude: endStop.longitude,
          label: endStop.label ?? coordinateLabel(endStop.latitude, endStop.longitude),
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Route could not be loaded.');
    }
  }, [driveSessionId]);

  useEffect(() => { void load(); }, [load]);

  const openPicker = (target: PickerTarget) => {
    const point = target === 'start' ? start : end;
    setDraftCoordinate(point ?? start ?? end ?? NOXA_FALLBACK_COORDINATE);
    setPickerTarget(target);
  };

  const confirmPoint = async (coordinate: LatLng) => {
    const target = pickerTarget;
    if (!target) return;
    const point = { ...coordinate, label: await resolveLabel(coordinate, target === 'end') };
    if (target === 'start') setStart(point);
    else setEnd(point);
    setPickerTarget(null);
    setError(null);
  };

  const locateCurrentPoint = async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          'Location permission is off',
          'You can still choose the start or destination manually on the map.',
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDraftCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      Alert.alert('Location unavailable', 'Check GPS or choose a point manually on the map.');
    } finally {
      setIsLocating(false);
    }
  };

  const continueFlow = async () => {
    if (!start || !end) {
      setError('Choose both a start and a destination.');
      return;
    }
    if (
      Math.abs(start.latitude - end.latitude) < 0.00001 &&
      Math.abs(start.longitude - end.longitude) < 0.00001
    ) {
      setError('Start and destination must be different points.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDriveRoute(driveSessionId, start, end);
      router.replace({ pathname: '/group-drives/participants', params: { id: driveSessionId } });
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : 'Route could not be calculated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll constrained={false} contentStyle={styles.content}>
      <GroupDriveHeader title="BUILD ROUTE" subtitle="Start and destination only" />
      <GroupDriveStep current={2} label="Route" />
      <View style={styles.intro}>
        <Text style={styles.title}>Choose two real points.</Text>
        <Text style={styles.body}>
          The route stays private. Invited drivers receive only an approximate destination before joining.
        </Text>
      </View>
      <View style={styles.routeSurface}>
        <PointRow icon="radio-button-on" label="Start" point={start} onPress={() => openPicker('start')} />
        <View style={styles.connector} />
        <PointRow icon="flag" label="Destination" point={end} onPress={() => openPicker('end')} />
      </View>
      <View style={styles.note}>
        <Ionicons name="map-outline" size={19} color={colors.textMuted} />
        <Text style={styles.noteText}>The calculated line, distance and duration appear on the next review steps.</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <NoxaButton
        disabled={!start || !end}
        fullWidth
        loading={saving}
        onPress={() => void continueFlow()}
        title="Calculate route"
        trailingIcon={<Ionicons name="arrow-forward" size={18} color={colors.text} />}
      />
      <Modal animationType="slide" visible={pickerTarget !== null} onRequestClose={() => setPickerTarget(null)}>
        <MapboxEventLocationPickerCompat
          confirmLabel={pickerTarget === 'start' ? 'Confirm Start' : 'Confirm Destination'}
          headerTitle={pickerTarget === 'start' ? 'Group Drive start' : 'Group Drive destination'}
          initialCoordinate={draftCoordinate}
          isLocating={isLocating}
          onCancel={() => setPickerTarget(null)}
          onConfirm={(point) => void confirmPoint(point)}
          onUseCurrentLocation={() => void locateCurrentPoint()}
        />
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  intro: { gap: spacing.sm, paddingTop: spacing.sm },
  title: { color: colors.text, fontFamily: typography.fontFamily.display, ...typography.v2.section, fontWeight: '900' },
  body: { color: colors.textMuted, ...typography.v2.body },
  routeSurface: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pointRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  pointIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceSoft },
  pointCopy: { flex: 1, minWidth: 0 },
  pointLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase' },
  pointValue: { marginTop: spacing.xxs, color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  pointPlaceholder: { color: colors.textMuted, fontWeight: '600' },
  connector: { height: 18, width: 1, marginLeft: spacing.md + 20, backgroundColor: colors.borderStrong },
  pressed: { backgroundColor: colors.surfacePressed },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  noteText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.primaryHover, fontSize: 13, fontWeight: '700' },
});
