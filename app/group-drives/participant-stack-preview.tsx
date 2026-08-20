import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NoxaButton, NoxaScreen, NoxaTopBar } from '@/src/components/ui';
import {
  GroupDriveParticipantStack,
  buildParticipantStackPresentation,
  createGroupDriveSimulation,
  deriveGroupDriveParticipantProgress,
  emptyGroupDriveProgressState,
  emptyParticipantStackOrderState,
  groupDriveLocations,
  prepareDriveRoute,
  reduceParticipantStackOrder,
  type GroupDriveProgressState,
  type ParticipantStackIdentity,
  type ParticipantStackOrderState,
} from '@/src/features/group-drive';
import { colors, spacing, typography } from '@/src/theme';

const DRIVE_ID = 'phase-4b-simulation';
const CURRENT_USER_ID = 'driver-you';
const ROUTE_DISTANCE_METERS = 6_000;
const ROUTE_POINTS = [
  { latitude: 37.9764, longitude: 23.7258 },
  { latitude: 37.9820, longitude: 23.7340 },
  { latitude: 37.9875, longitude: 23.7425 },
  { latitude: 37.9922, longitude: 23.7510 },
  { latitude: 37.9970, longitude: 23.7600 },
] as const;

const identities: readonly ParticipantStackIdentity[] = [
  { userId: 'driver-arrived', displayName: 'Alex Rivera', initials: 'AR' },
  { userId: 'driver-kim', displayName: 'Kim Morgan', initials: 'KM' },
  { userId: 'driver-nick', displayName: 'Nick Stone', initials: 'NS' },
  { userId: 'driver-sam', displayName: 'Sam Lee', initials: 'SL' },
  { userId: 'driver-mia', displayName: 'Mia Chen', initials: 'MC' },
  { userId: CURRENT_USER_ID, displayName: 'You', initials: 'YO' },
  { userId: 'driver-unavailable', displayName: 'Jamie Lane', initials: 'JL' },
];

const preparedRoute = prepareDriveRoute({
  type: 'LineString',
  coordinates: ROUTE_POINTS.map((point) => [point.longitude, point.latitude]),
}, ROUTE_DISTANCE_METERS);

type PreviewHarness = {
  simulation: ReturnType<typeof createGroupDriveSimulation>;
  progress: GroupDriveProgressState;
  order: ParticipantStackOrderState;
  step: number;
};

function createPreviewHarness(): PreviewHarness {
  return {
    simulation: createGroupDriveSimulation(DRIVE_ID, [
      { userId: 'driver-arrived', path: [ROUTE_POINTS[4]] },
      { userId: 'driver-kim', path: [ROUTE_POINTS[3], ROUTE_POINTS[4], ROUTE_POINTS[4]] },
      { userId: 'driver-nick', path: [ROUTE_POINTS[2], ROUTE_POINTS[3], ROUTE_POINTS[4]] },
      { userId: 'driver-sam', path: [ROUTE_POINTS[1], ROUTE_POINTS[2], ROUTE_POINTS[3], ROUTE_POINTS[4]] },
      { userId: 'driver-mia', path: [...ROUTE_POINTS] },
      { userId: CURRENT_USER_ID, path: [ROUTE_POINTS[0], ...ROUTE_POINTS] },
      { userId: 'driver-unavailable', path: [] },
    ]),
    progress: emptyGroupDriveProgressState(DRIVE_ID),
    order: emptyParticipantStackOrderState(),
    step: 0,
  };
}

function nextPresentation(harness: PreviewHarness) {
  const at = new Date(Date.UTC(2026, 7, 21, 10, 0, harness.step * 15));
  const snapshot = harness.simulation.tick(at);
  harness.progress = deriveGroupDriveParticipantProgress(
    DRIVE_ID,
    preparedRoute,
    identities.map(({ userId }) => userId),
    groupDriveLocations(snapshot),
    harness.progress,
    at,
  );
  harness.order = reduceParticipantStackOrder(
    harness.order,
    Object.values(harness.progress.byUserId),
  );
  harness.step += 1;
  return buildParticipantStackPresentation(
    identities,
    harness.progress.byUserId,
    harness.order.order,
    CURRENT_USER_ID,
  );
}

function ParticipantStackPreviewContent() {
  const harnessRef = useRef<PreviewHarness | null>(null);
  if (!harnessRef.current) harnessRef.current = createPreviewHarness();
  const [presentation, setPresentation] = useState(() => nextPresentation(harnessRef.current!));
  const [selectedUserId, setSelectedUserId] = useState<string | null>('driver-kim');
  const [notice, setNotice] = useState('Simulation only — no GPS, Mapbox or Supabase writes.');

  const advance = () => {
    if (!harnessRef.current) return;
    setPresentation(nextPresentation(harnessRef.current));
    setNotice('Applied one simulated 15-second location update.');
  };

  const reset = () => {
    harnessRef.current = createPreviewHarness();
    setPresentation(nextPresentation(harnessRef.current));
    setSelectedUserId('driver-kim');
    setNotice('Simulation reset. No device location was requested.');
  };

  return (
    <NoxaScreen padded={false}>
      <View style={styles.screen}>
        <View pointerEvents="none" style={styles.mapPlaceholder}>
          <View style={[styles.road, styles.roadOne]} />
          <View style={[styles.road, styles.roadTwo]} />
          <View style={styles.routeLine} />
        </View>

        <View style={styles.topBar}>
          <NoxaTopBar title="Active Drive" subtitle="Participant Stack preview" />
        </View>
        <Text style={styles.simulationLabel}>SIMULATION · NO GPS</Text>

        <GroupDriveParticipantStack
          presentation={presentation}
          selectedUserId={selectedUserId}
          style={styles.participantStack}
          onOpenParticipants={() => setNotice(`${presentation.hiddenCount} more participants are hidden.`)}
          onSelectParticipant={(userId) => {
            setSelectedUserId(userId);
            setNotice(`Selected ${identities.find((identity) => identity.userId === userId)?.displayName ?? 'participant'}.`);
          }}
          onUnavailableParticipant={() => setNotice('Participant location is unavailable and cannot be focused.')}
        />

        <View style={styles.controls}>
          <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>
          <View style={styles.actions}>
            <NoxaButton title="Next update" onPress={advance} size="md" style={styles.action} />
            <NoxaButton title="Reset" onPress={reset} size="md" variant="secondary" style={styles.action} />
          </View>
        </View>
      </View>
    </NoxaScreen>
  );
}

export default function ParticipantStackPreviewScreen() {
  if (!__DEV__) return <Redirect href="/group-drives" />;
  return <ParticipantStackPreviewContent />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  road: {
    position: 'absolute',
    height: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceBase,
    transform: [{ rotate: '-24deg' }],
  },
  roadOne: {
    width: '140%',
    top: '38%',
    left: '-20%',
  },
  roadTwo: {
    width: '120%',
    top: '64%',
    left: '-8%',
    transform: [{ rotate: '31deg' }],
  },
  routeLine: {
    position: 'absolute',
    width: '115%',
    height: 3,
    top: '61%',
    left: '-8%',
    borderRadius: 2,
    backgroundColor: colors.primary,
    transform: [{ rotate: '-17deg' }],
  },
  topBar: {
    paddingHorizontal: spacing.md,
  },
  simulationLabel: {
    position: 'absolute',
    top: 76,
    right: spacing.md,
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.label,
  },
  participantStack: {
    position: 'absolute',
    top: 92,
    left: spacing.md,
  },
  controls: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    gap: spacing.sm,
  },
  notice: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeight.caption,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
