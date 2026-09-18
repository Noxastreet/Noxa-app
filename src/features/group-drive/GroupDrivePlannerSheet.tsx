import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import {
  NoxaAvatar,
  NoxaButton,
  NoxaIconButton,
  NoxaInput,
  NoxaSheet,
} from '@/src/components/ui';
import type { LatLng } from '@/src/features/mapbox/types';
import { colors, radius, spacing, typography } from '@/src/theme';

import {
  calculateDriveRoute,
  createDriveSession,
  inviteCrewsToDrive,
  inviteUsersToDrive,
  loadDriveInviteOptions,
  saveCalculatedDriveRoute,
  updateDriveDetails,
} from './api';
import { formatDriveDistance, formatDriveDuration } from './format';
import {
  resolveDrivePointLabel,
  type DriveRoutePointSelection,
} from './routeLabel';
import type {
  DriveInviteCrew,
  DriveInviteFriend,
  DriveRouteResult,
} from './types';

type PlannerStep = 'where' | 'route' | 'crew' | 'departure' | 'review';
type PickerTarget = 'start' | 'end';
type ScheduleMode = 'ready' | 'scheduled';
type DatePickerMode = 'date' | 'time';

const STEPS: PlannerStep[] = ['where', 'route', 'crew', 'departure', 'review'];
const STEP_LABEL: Record<PlannerStep, string> = {
  where: 'Where',
  route: 'Route',
  crew: 'Crew',
  departure: 'Departure',
  review: 'Review',
};

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function nextStart() {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
  return value;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || 'NX'
  );
}

function buildPrivateDriveTitle(destination: string | null) {
  const label = destination?.trim();
  if (!label || label === 'Destination shared after joining') return 'Group Drive';
  const value = `Drive to ${label}`;
  return value.length <= 100 ? value : `${value.slice(0, 97).trimEnd()}…`;
}

function PointRow({
  active,
  icon,
  label,
  point,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  point: DriveRoutePointSelection | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${point?.label ?? 'not selected'}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pointRow,
        active && styles.pointRowActive,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.pointIcon, active && styles.pointIconActive]}>
        <Ionicons
          name={icon}
          size={18}
          color={active ? colors.text : point ? colors.primaryHover : colors.textMuted}
        />
      </View>
      <View style={styles.pointCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text
          numberOfLines={2}
          style={[styles.rowValue, !point && styles.placeholder]}>
          {point?.label ?? 'Tap this row, then tap the map'}
        </Text>
      </View>
      <Ionicons
        name={active ? 'locate' : 'chevron-forward'}
        size={17}
        color={active ? colors.primaryHover : colors.textSubtle}
      />
    </Pressable>
  );
}

function SelectMark({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.selectMark, selected && styles.selectMarkSelected]}>
      <Ionicons
        name={selected ? 'checkmark' : 'add'}
        size={16}
        color={selected ? colors.text : colors.textMuted}
      />
    </View>
  );
}

function FriendRow({
  friend,
  selected,
  onPress,
}: {
  friend: DriveInviteFriend;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${friend.displayName}, ${selected ? 'selected' : 'not selected'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: friend.unavailable }}
      disabled={friend.unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.peopleRow,
        pressed && styles.pressed,
        friend.unavailable && styles.disabled,
      ]}>
      <NoxaAvatar initials={initials(friend.displayName)} size={40} />
      <View style={styles.peopleCopy}>
        <Text numberOfLines={1} style={styles.peopleTitle}>
          {friend.displayName}
        </Text>
        <Text style={styles.peopleMeta}>
          {friend.unavailable ? 'Already invited' : friend.username ? `@${friend.username}` : 'Mutual friend'}
        </Text>
      </View>
      <SelectMark selected={selected || friend.unavailable} />
    </Pressable>
  );
}

function CrewRow({
  crew,
  selected,
  onPress,
}: {
  crew: DriveInviteCrew;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${crew.name}, ${crew.memberCount} inviteable people, ${selected ? 'selected' : 'not selected'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.peopleRow, pressed && styles.pressed]}>
      <View style={styles.crewIcon}>
        <Ionicons name="people" size={18} color={colors.text} />
      </View>
      <View style={styles.peopleCopy}>
        <Text numberOfLines={1} style={styles.peopleTitle}>
          {crew.name}
        </Text>
        <Text style={styles.peopleMeta}>
          {crew.memberCount} {crew.memberCount === 1 ? 'person' : 'people'} can receive an invite
        </Text>
      </View>
      <SelectMark selected={selected} />
    </Pressable>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={17} color={colors.textMuted} />
      <View style={styles.summaryCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.summaryValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function GroupDrivePlannerSheet({
  bottomOffset,
  currentLocation,
  mapPoint,
  crewContextId = null,
  onClose,
  onCreated,
  onHeightChange,
  onMapSelectionChange,
  onOpenList,
  onRoutePreview,
  onSelectionPointChange,
}: {
  bottomOffset: number;
  currentLocation: LatLng | null;
  mapPoint: LatLng | null;
  crewContextId?: string | null;
  onClose: () => void;
  onCreated: (driveSessionId: string) => void;
  onHeightChange: (height: number) => void;
  onMapSelectionChange: (active: boolean) => void;
  onOpenList: () => void;
  onRoutePreview: (route: DriveRouteResult | null) => void;
  onSelectionPointChange: (point: LatLng | null) => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<PlannerStep>('where');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>('end');
  const [start, setStart] = useState<DriveRoutePointSelection | null>(null);
  const [end, setEnd] = useState<DriveRoutePointSelection | null>(null);
  const [route, setRoute] = useState<DriveRouteResult | null>(null);
  const [friends, setFriends] = useState<DriveInviteFriend[]>([]);
  const [crews, setCrews] = useState<DriveInviteCrew[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedCrews, setSelectedCrews] = useState<Set<string>>(
    () => new Set(),
  );
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('ready');
  const [scheduledAt, setScheduledAt] = useState(nextStart);
  const [datePickerMode, setDatePickerMode] = useState<DatePickerMode | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [createdDriveId, setCreatedDriveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startResolvedRef = useRef(false);

  const stepIndex = STEPS.indexOf(step);
  const bodyMaxHeight = Math.max(160, Math.min(300, windowHeight * 0.36));

  useEffect(() => {
    if (!currentLocation || startResolvedRef.current || start) return;
    startResolvedRef.current = true;
    let active = true;
    void resolveDrivePointLabel(currentLocation, false).then((label) => {
      if (!active) return;
      setStart({ ...currentLocation, label: label || 'Current location' });
    });
    return () => {
      active = false;
    };
  }, [currentLocation, start]);

  useEffect(() => {
    if (step !== 'where' || !pickerTarget || !mapPoint) return;
    let active = true;
    const approximate = pickerTarget === 'end';
    void resolveDrivePointLabel(mapPoint, approximate).then((label) => {
      if (!active) return;
      const point = { ...mapPoint, label };
      if (pickerTarget === 'start') setStart(point);
      else setEnd(point);
      setError(null);
    });
    return () => {
      active = false;
    };
  }, [mapPoint, pickerTarget, step]);

  useEffect(() => {
    const selecting = step === 'where' && Boolean(pickerTarget);
    onMapSelectionChange(selecting);
    const point =
      selecting && pickerTarget === 'start'
        ? start
        : selecting && pickerTarget === 'end'
          ? end
          : null;
    onSelectionPointChange(point);
    return () => {
      onMapSelectionChange(false);
    };
  }, [
    end,
    onMapSelectionChange,
    onSelectionPointChange,
    pickerTarget,
    start,
    step,
  ]);

  const loadPeople = useCallback(async () => {
    if (peopleLoaded || peopleLoading) return;
    setPeopleLoading(true);
    setError(null);
    try {
      const options = await loadDriveInviteOptions(null);
      setFriends(options.friends);
      setCrews(options.crews);
      setPeopleLoaded(true);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'People could not be loaded.',
      );
    } finally {
      setPeopleLoading(false);
    }
  }, [peopleLoaded, peopleLoading]);

  useEffect(() => {
    if (step === 'crew') void loadPeople();
  }, [loadPeople, step]);

  const filteredFriends = useMemo(() => {
    const query = peopleQuery.trim().toLowerCase();
    const rows = query
      ? friends.filter((friend) =>
          [friend.displayName, friend.username]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(query)),
        )
      : friends;
    return rows.slice(0, 8);
  }, [friends, peopleQuery]);

  const filteredCrews = useMemo(() => {
    const query = peopleQuery.trim().toLowerCase();
    const rows = query
      ? crews.filter((crew) => crew.name.toLowerCase().includes(query))
      : crews;
    return rows.slice(0, 5);
  }, [crews, peopleQuery]);

  const recipientCount = useMemo(() => {
    const recipients = new Set(selectedFriends);
    for (const crew of crews) {
      if (!selectedCrews.has(crew.id)) continue;
      for (const userId of crew.eligibleUserIds) recipients.add(userId);
    }
    return recipients.size;
  }, [crews, selectedCrews, selectedFriends]);

  const toggleSelection = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
      setter((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  const calculateRoute = useCallback(async () => {
    if (!start || !end || busy) return;
    if (
      Math.abs(start.latitude - end.latitude) < 0.00001 &&
      Math.abs(start.longitude - end.longitude) < 0.00001
    ) {
      setError('Start and destination must be different points.');
      return;
    }
    setStep('route');
    setPickerTarget('end');
    setBusy(true);
    setError(null);
    try {
      const nextRoute = await calculateDriveRoute([start, end]);
      setRoute(nextRoute);
      onRoutePreview(nextRoute);
    } catch (routeError) {
      setRoute(null);
      onRoutePreview(null);
      setError(
        routeError instanceof Error
          ? routeError.message
          : 'Route could not be calculated.',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, end, onRoutePreview, start]);

  const goBack = useCallback(() => {
    if (busy) return;
    setError(null);
    if (step === 'where') {
      onRoutePreview(null);
      onSelectionPointChange(null);
      onClose();
      return;
    }
    const previous = STEPS[Math.max(0, stepIndex - 1)];
    if (step === 'route') {
      setRoute(null);
      onRoutePreview(null);
      setPickerTarget('end');
    }
    if (previous === 'where') setPickerTarget('end');
    setStep(previous);
  }, [
    busy,
    onClose,
    onRoutePreview,
    onSelectionPointChange,
    step,
    stepIndex,
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        goBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [goBack]);

  const continueFlow = useCallback(async () => {
    if (busy) return;
    setError(null);

    if (step === 'where') {
      if (!start || !end) {
        setError('Choose a start and destination on the map.');
        return;
      }
      await calculateRoute();
      return;
    }

    if (step === 'route') {
      if (!route) {
        await calculateRoute();
        return;
      }
      setStep('crew');
      return;
    }

    if (step === 'crew') {
      setStep('departure');
      return;
    }

    if (step === 'departure') {
      if (
        scheduleMode === 'scheduled' &&
        scheduledAt.getTime() <= Date.now() + 60_000
      ) {
        setError('Choose a future start time.');
        return;
      }
      setStep('review');
      return;
    }

    if (!start || !end || !route) {
      setError('Route information is incomplete. Go back and review the route.');
      return;
    }

    setBusy(true);
    const scheduledStartAt =
      scheduleMode === 'scheduled' ? scheduledAt.toISOString() : null;
    const title = buildPrivateDriveTitle(end.label);
    let driveId = createdDriveId;

    try {
      if (!driveId) {
        driveId = await createDriveSession(title, '', crewContextId, null);
        setCreatedDriveId(driveId);
      }

      await saveCalculatedDriveRoute(driveId, start, end, route);
      await inviteUsersToDrive(driveId, Array.from(selectedFriends));
      await inviteCrewsToDrive(driveId, Array.from(selectedCrews));
      await updateDriveDetails(
        driveId,
        title,
        '',
        scheduledStartAt,
        crewContextId,
      );
      onCreated(driveId);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Group Drive could not be created.',
      );
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    calculateRoute,
    createdDriveId,
    crewContextId,
    end,
    onCreated,
    route,
    scheduleMode,
    scheduledAt,
    selectedCrews,
    selectedFriends,
    start,
    step,
  ]);

  const onDateTimeChange = useCallback(
    (
      event: { type?: string },
      selected: Date | undefined,
    ) => {
      if (selected && datePickerMode) {
        setScheduledAt((current) =>
          datePickerMode === 'date'
            ? new Date(
                selected.getFullYear(),
                selected.getMonth(),
                selected.getDate(),
                current.getHours(),
                current.getMinutes(),
              )
            : new Date(
                current.getFullYear(),
                current.getMonth(),
                current.getDate(),
                selected.getHours(),
                selected.getMinutes(),
              ),
        );
      }
      if (Platform.OS === 'android' || event.type === 'dismissed') {
        setDatePickerMode(null);
      }
    },
    [datePickerMode],
  );

  const primaryTitle =
    step === 'where'
      ? 'Continue'
      : step === 'route'
        ? route
          ? 'Continue'
          : 'Retry route'
        : step === 'crew'
          ? recipientCount
            ? `Continue with ${recipientCount}`
            : 'Continue solo'
          : step === 'departure'
            ? 'Review'
            : 'Create Group Drive';

  const selectedRouteLabel =
    route?.provider === 'mapbox-driving-traffic'
      ? 'Traffic-aware fastest'
      : 'Fastest available';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'position' : undefined}
      keyboardVerticalOffset={bottomOffset}
      pointerEvents="box-none"
      style={[styles.anchor, { bottom: bottomOffset }]}>
      <NoxaSheet
        onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
        style={styles.sheet}>
        <View style={styles.progress} accessibilityLabel={`Step ${stepIndex + 1} of 5, ${STEP_LABEL[step]}`}>
          {STEPS.map((item, index) => (
            <View
              key={item}
              style={[
                styles.progressSegment,
                index <= stepIndex && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>GROUP DRIVE · {STEP_LABEL[step].toUpperCase()}</Text>
            <Text style={styles.title}>
              {step === 'where'
                ? 'Choose the drive.'
                : step === 'route'
                  ? 'Fastest route.'
                  : step === 'crew'
                    ? 'Who is coming?'
                    : step === 'departure'
                      ? 'When?'
                      : 'Ready to create.'}
            </Text>
          </View>
          <NoxaIconButton
            accessibilityLabel="Close Group Drive planning"
            disabled={busy}
            icon="close"
            onPress={goBack}
            size={40}
            variant="ghost"
          />
        </View>

        <Animated.View
          key={step}
          entering={reduceMotion ? undefined : FadeIn.duration(150)}
          exiting={reduceMotion ? undefined : FadeOut.duration(90)}
          style={styles.body}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: bodyMaxHeight }}>
            {step === 'where' ? (
              <>
                <Text style={styles.helper}>
                  Tap a row, then tap the map. Start defaults to your current location when available.
                </Text>
                <View style={styles.pointList}>
                  <PointRow
                    active={pickerTarget === 'end'}
                    icon="flag"
                    label="Destination"
                    point={end}
                    onPress={() => setPickerTarget('end')}
                  />
                  <PointRow
                    active={pickerTarget === 'start'}
                    icon="radio-button-on"
                    label="Start"
                    point={start}
                    onPress={() => setPickerTarget('start')}
                  />
                </View>
                <NoxaButton
                  onPress={onOpenList}
                  size="sm"
                  title="My Group Drives"
                  variant="ghost"
                />
              </>
            ) : null}

            {step === 'route' ? (
              <>
                {busy ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.helper}>Calculating the fastest drivable route…</Text>
                  </View>
                ) : route ? (
                  <View style={styles.routeOption}>
                    <View style={styles.routeCheck}>
                      <Ionicons name="checkmark" size={16} color={colors.text} />
                    </View>
                    <View style={styles.routeCopy}>
                      <Text style={styles.routeTitle}>Fastest</Text>
                      <Text style={styles.routeMeta}>{selectedRouteLabel}</Text>
                    </View>
                    <View style={styles.routeNumbers}>
                      <Text style={styles.routeDuration}>
                        {formatDriveDuration(route.durationSeconds)}
                      </Text>
                      <Text style={styles.routeDistance}>
                        {formatDriveDistance(route.distanceMeters)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.helper}>
                    The route is not available yet. Retry without leaving the map.
                  </Text>
                )}
              </>
            ) : null}

            {step === 'crew' ? (
              <>
                <View style={styles.crewSummary}>
                  <Ionicons
                    name={recipientCount ? 'people' : 'person-outline'}
                    size={18}
                    color={recipientCount ? colors.primaryHover : colors.textMuted}
                  />
                  <Text style={styles.crewSummaryText}>
                    {recipientCount
                      ? `${recipientCount} ${recipientCount === 1 ? 'person' : 'people'} selected`
                      : 'No invitations selected. Continue solo or add people.'}
                  </Text>
                </View>
                <NoxaInput
                  autoCapitalize="none"
                  label="Find people or Crew"
                  onChangeText={setPeopleQuery}
                  placeholder="Name or username"
                  value={peopleQuery}
                />
                {peopleLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.helper}>Loading invite options…</Text>
                  </View>
                ) : (
                  <>
                    {filteredFriends.map((friend) => (
                      <FriendRow
                        friend={friend}
                        key={friend.id}
                        onPress={() =>
                          toggleSelection(setSelectedFriends, friend.id)
                        }
                        selected={selectedFriends.has(friend.id)}
                      />
                    ))}
                    {filteredCrews.map((crew) => (
                      <CrewRow
                        crew={crew}
                        key={crew.id}
                        onPress={() =>
                          toggleSelection(setSelectedCrews, crew.id)
                        }
                        selected={selectedCrews.has(crew.id)}
                      />
                    ))}
                    {!filteredFriends.length && !filteredCrews.length ? (
                      <Text style={styles.helper}>
                        No matching invite options. You can continue solo.
                      </Text>
                    ) : null}
                  </>
                )}
              </>
            ) : null}

            {step === 'departure' ? (
              <>
                <View accessibilityRole="radiogroup" style={styles.departureChoices}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: scheduleMode === 'ready' }}
                    onPress={() => setScheduleMode('ready')}
                    style={({ pressed }) => [
                      styles.departureChoice,
                      scheduleMode === 'ready' && styles.departureChoiceActive,
                      pressed && styles.pressed,
                    ]}>
                    <Ionicons
                      name="flash-outline"
                      size={19}
                      color={scheduleMode === 'ready' ? colors.primaryHover : colors.textMuted}
                    />
                    <View style={styles.departureCopy}>
                      <Text style={styles.departureTitle}>Ready now</Text>
                      <Text style={styles.departureMeta}>No scheduled start time</Text>
                    </View>
                    <Ionicons
                      name={scheduleMode === 'ready' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={scheduleMode === 'ready' ? colors.primaryHover : colors.textSubtle}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: scheduleMode === 'scheduled' }}
                    onPress={() => setScheduleMode('scheduled')}
                    style={({ pressed }) => [
                      styles.departureChoice,
                      scheduleMode === 'scheduled' && styles.departureChoiceActive,
                      pressed && styles.pressed,
                    ]}>
                    <Ionicons
                      name="calendar-outline"
                      size={19}
                      color={scheduleMode === 'scheduled' ? colors.primaryHover : colors.textMuted}
                    />
                    <View style={styles.departureCopy}>
                      <Text style={styles.departureTitle}>Schedule</Text>
                      <Text style={styles.departureMeta}>Show invited drivers a planned time</Text>
                    </View>
                    <Ionicons
                      name={scheduleMode === 'scheduled' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={scheduleMode === 'scheduled' ? colors.primaryHover : colors.textSubtle}
                    />
                  </Pressable>
                </View>
                {scheduleMode === 'scheduled' ? (
                  <View style={styles.scheduleControls}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setDatePickerMode('date')}
                      style={({ pressed }) => [styles.scheduleControl, pressed && styles.pressed]}>
                      <Text style={styles.rowLabel}>DATE</Text>
                      <Text style={styles.scheduleValue}>{dateFormat.format(scheduledAt)}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setDatePickerMode('time')}
                      style={({ pressed }) => [styles.scheduleControl, pressed && styles.pressed]}>
                      <Text style={styles.rowLabel}>TIME</Text>
                      <Text style={styles.scheduleValue}>{timeFormat.format(scheduledAt)}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {datePickerMode ? (
                  <DateTimePicker
                    display={Platform.OS === 'ios' ? 'compact' : 'default'}
                    minimumDate={new Date()}
                    mode={datePickerMode}
                    onChange={onDateTimeChange}
                    themeVariant="dark"
                    value={scheduledAt}
                  />
                ) : null}
                <Text style={styles.helper}>
                  Creating the plan never starts location sharing. The host still starts Active Drive explicitly from the Lobby.
                </Text>
              </>
            ) : null}

            {step === 'review' && start && end && route ? (
              <View style={styles.review}>
                <SummaryRow icon="flag" label="Destination" value={end.label} />
                <SummaryRow
                  icon="people-outline"
                  label="Crew"
                  value={
                    recipientCount
                      ? `${recipientCount} invited ${recipientCount === 1 ? 'person' : 'people'}`
                      : 'Solo'
                  }
                />
                <SummaryRow
                  icon="time-outline"
                  label="Departure"
                  value={
                    scheduleMode === 'scheduled'
                      ? `${dateFormat.format(scheduledAt)} · ${timeFormat.format(scheduledAt)}`
                      : 'Ready now'
                  }
                />
                <SummaryRow
                  icon="navigate-outline"
                  label="Route"
                  value={`${formatDriveDistance(route.distanceMeters)} · ${formatDriveDuration(route.durationSeconds)}`}
                />
                <View style={styles.privacyNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={colors.primaryHover}
                  />
                  <Text style={styles.privacyText}>
                    Create saves the private plan and opens the Lobby. It does not start GPS sharing or Active Drive.
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {stepIndex > 0 ? (
            <NoxaButton
              disabled={busy}
              onPress={goBack}
              size="md"
              style={styles.backButton}
              title="Back"
              variant="ghost"
            />
          ) : null}
          <NoxaButton
            disabled={
              busy ||
              (step === 'where' && (!start || !end)) ||
              (step === 'crew' && peopleLoading)
            }
            loading={busy}
            onPress={() => void continueFlow()}
            size="md"
            style={styles.primaryButton}
            title={primaryTitle}
          />
        </View>
      </NoxaSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceBase,
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSoft,
  },
  progressSegmentActive: { backgroundColor: colors.primary },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  body: { minHeight: 0 },
  scrollContent: { gap: spacing.sm, paddingBottom: spacing.xs },
  helper: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  pointList: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pointRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pointRowActive: { backgroundColor: colors.primarySubtle },
  pointIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  pointIconActive: { backgroundColor: colors.primary },
  pointCopy: { flex: 1, minWidth: 0 },
  rowLabel: {
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  rowValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  placeholder: { color: colors.textMuted, fontWeight: '600' },
  loadingRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeOption: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
  },
  routeCheck: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  routeCopy: { flex: 1, minWidth: 0 },
  routeTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  routeMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  routeNumbers: { alignItems: 'flex-end' },
  routeDuration: { color: colors.text, fontSize: 14, fontWeight: '800' },
  routeDistance: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  crewSummary: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  crewSummaryText: { flex: 1, color: colors.textMuted, fontSize: 12 },
  peopleRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  peopleCopy: { flex: 1, minWidth: 0 },
  peopleTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  peopleMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  crewIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  selectMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  selectMarkSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  departureChoices: { gap: spacing.xs },
  departureChoice: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  departureChoiceActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  departureCopy: { flex: 1, minWidth: 0 },
  departureTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  departureMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  scheduleControls: { flexDirection: 'row', gap: spacing.sm },
  scheduleControl: {
    flex: 1,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  scheduleValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  review: { gap: 0 },
  summaryRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryValue: {
    marginTop: 2,
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
  },
  privacyText: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  error: { color: colors.primaryHover, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  backButton: { minWidth: 88 },
  primaryButton: { flex: 1 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.42 },
});
