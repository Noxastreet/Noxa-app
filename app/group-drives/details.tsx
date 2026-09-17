import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import {
  NoxaAvatar,
  NoxaButton,
  NoxaEmptyState,
  NoxaInput,
  NoxaLoadingState,
} from '@/src/components/ui';
import {
  createDriveSession,
  inviteCrewsToDrive,
  inviteUsersToDrive,
  loadDriveInviteOptions,
  loadGroupDriveDetails,
  saveDriveRoute,
  updateDriveDetails,
  type DriveInviteCrew,
  type DriveInviteFriend,
  type GroupDriveDetails,
} from '@/src/features/group-drive';
import { MapboxEventLocationPickerCompat } from '@/src/features/mapbox/MapboxEventLocationPickerCompat';
import { NOXA_FALLBACK_COORDINATE } from '@/src/features/mapbox/config';
import type { LatLng } from '@/src/features/mapbox/types';
import { colors, radius, spacing, typography } from '@/src/theme';

type RoutePoint = LatLng & { label: string };
type PickerTarget = 'start' | 'end';
type ScheduleMode = 'ready' | 'scheduled';
type DatePickerMode = 'date' | 'time';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('') || 'NX';
}

function nextStart() {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
  return value;
}

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

function toggleSet(setter: Dispatch<SetStateAction<Set<string>>>, id: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function SectionHeader({
  icon,
  title,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderIcon}>
        <Ionicons name={icon} size={18} color={colors.primaryHover} />
      </View>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {value ? <Text style={styles.sectionHeaderValue}>{value}</Text> : null}
    </View>
  );
}

function RouteRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${value}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.routeRow, pressed && styles.pressed]}
    >
      <View style={styles.routePointIcon}>
        <Ionicons name={icon} size={18} color={colors.text} />
      </View>
      <View style={styles.routeRowCopy}>
        <Text style={styles.routeRowLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.routeRowValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

function SelectMark({ selected, disabled }: { selected: boolean; disabled?: boolean }) {
  return (
    <View style={[styles.mark, selected && styles.markSelected, disabled && styles.markDisabled]}>
      <Ionicons
        name={selected || disabled ? 'checkmark' : 'add'}
        size={17}
        color={selected ? colors.text : colors.textMuted}
      />
    </View>
  );
}

export default function GroupDriveComposerScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    crewId?: string;
    inviteUserId?: string;
    mode?: string;
  }>();
  const initialDriveId = typeof params.id === 'string' ? params.id : null;
  const requestedCrewId = typeof params.crewId === 'string' ? params.crewId : null;
  const inviteUserId = typeof params.inviteUserId === 'string' ? params.inviteUserId : null;
  const editMode = params.mode === 'edit' && Boolean(initialDriveId);

  const [draftId, setDraftId] = useState<string | null>(initialDriveId);
  const draftCreationRef = useRef<Promise<string> | null>(null);
  const inviteContextAppliedRef = useRef(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [crewId, setCrewId] = useState<string | null>(requestedCrewId);
  const [showMore, setShowMore] = useState(false);

  const [start, setStart] = useState<RoutePoint | null>(null);
  const [end, setEnd] = useState<RoutePoint | null>(null);
  const [routePickerTarget, setRoutePickerTarget] = useState<PickerTarget | null>(null);
  const [draftCoordinate, setDraftCoordinate] = useState<LatLng>(NOXA_FALLBACK_COORDINATE);
  const [isLocating, setIsLocating] = useState(false);

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('ready');
  const [scheduledAt, setScheduledAt] = useState(nextStart);
  const [datePickerMode, setDatePickerMode] = useState<DatePickerMode | null>(null);
  const [draftDate, setDraftDate] = useState(nextStart);

  const [friends, setFriends] = useState<DriveInviteFriend[]>([]);
  const [crews, setCrews] = useState<DriveInviteCrew[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [selectedCrews, setSelectedCrews] = useState<Set<string>>(new Set());
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [inviteContextMessage, setInviteContextMessage] = useState<string | null>(
    inviteUserId ? 'Driver selected from the map. Confirm people before creating the drive.' : null,
  );
  const [existingPendingInvites, setExistingPendingInvites] = useState(0);

  const [loading, setLoading] = useState(Boolean(initialDriveId));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyLoadedDrive = useCallback((drive: GroupDriveDetails) => {
    if (drive.hostId !== drive.currentUserId || !['draft', 'scheduled'].includes(drive.status)) {
      throw new Error('Only the host can edit a Group Drive before it starts.');
    }

    setTitle(drive.title);
    setDescription(drive.description ?? '');
    setShowMore(Boolean(drive.description));
    setCrewId(drive.crewId);
    setExistingPendingInvites(
      drive.invitations.filter((invitation) => invitation.status === 'invited').length,
    );

    const startStop = drive.stops.find((stop) => stop.kind === 'start');
    const endStop = drive.stops.find((stop) => stop.kind === 'end');
    setStart(
      startStop
        ? {
            latitude: startStop.latitude,
            longitude: startStop.longitude,
            label: startStop.label ?? coordinateLabel(startStop.latitude, startStop.longitude),
          }
        : null,
    );
    setEnd(
      endStop
        ? {
            latitude: endStop.latitude,
            longitude: endStop.longitude,
            label: endStop.label ?? coordinateLabel(endStop.latitude, endStop.longitude),
          }
        : null,
    );

    if (drive.scheduledStartAt) {
      const value = new Date(drive.scheduledStartAt);
      if (!Number.isNaN(value.getTime())) setScheduledAt(value);
      setScheduleMode('scheduled');
    } else {
      setScheduleMode('ready');
    }
  }, []);

  const load = useCallback(async () => {
    if (!initialDriveId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      applyLoadedDrive(await loadGroupDriveDetails(initialDriveId));
    } catch (loadDriveError) {
      setLoadError(
        loadDriveError instanceof Error
          ? loadDriveError.message
          : 'Group Drive could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [applyLoadedDrive, initialDriveId]);

  useEffect(() => {
    void load();
  }, [load]);

  const validateTitle = useCallback(() => {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2 || cleanTitle.length > 100) {
      setError('Use a title between 2 and 100 characters.');
      return null;
    }
    if (description.length > 1000) {
      setError('Keep the description under 1,000 characters.');
      return null;
    }
    return cleanTitle;
  }, [description.length, title]);

  const scheduleValue = useCallback(() => {
    if (scheduleMode === 'ready') return null;
    if (scheduledAt.getTime() <= Date.now() + 60_000) {
      setError('Choose a future start time.');
      return undefined;
    }
    return scheduledAt.toISOString();
  }, [scheduleMode, scheduledAt]);

  const ensureDraft = useCallback(async () => {
    if (draftId) return draftId;
    if (draftCreationRef.current) return draftCreationRef.current;

    const cleanTitle = validateTitle();
    if (!cleanTitle) throw new Error('Fix the drive title first.');
    const scheduledStartAt = scheduleValue();
    if (scheduledStartAt === undefined) throw new Error('Fix the start time first.');

    const creation = (async () => {
      const id = await createDriveSession(cleanTitle, description);
      // Persist the draft id immediately so a later update failure never creates
      // a second server draft when the user retries.
      setDraftId(id);
      await updateDriveDetails(id, cleanTitle, description, scheduledStartAt, crewId);
      return id;
    })();

    draftCreationRef.current = creation;
    try {
      return await creation;
    } finally {
      draftCreationRef.current = null;
    }
  }, [crewId, description, draftId, scheduleValue, validateTitle]);

  const loadPeople = useCallback(
    async (id: string | null, applyMapContext = true) => {
      setPeopleLoading(true);
      setPeopleError(null);
      try {
        const options = await loadDriveInviteOptions(id);
        setFriends(options.friends);
        setCrews(options.crews);

        if (applyMapContext && inviteUserId && !inviteContextAppliedRef.current) {
          inviteContextAppliedRef.current = true;
          const match = options.friends.find(
            (friend) => friend.id === inviteUserId && !friend.unavailable,
          );
          if (match) {
            setSelectedFriends((current) => new Set(current).add(match.id));
            setInviteContextMessage(
              `${match.displayName} is selected. The invitation is sent only when you create the drive.`,
            );
          } else {
            setInviteContextMessage(
              'The selected driver is no longer available for a direct invitation.',
            );
          }
        }
        return options;
      } catch (loadPeopleError) {
        const message =
          loadPeopleError instanceof Error
            ? loadPeopleError.message
            : 'People could not be loaded.';
        setPeopleError(message);
        throw loadPeopleError;
      } finally {
        setPeopleLoading(false);
      }
    },
    [inviteUserId],
  );

  const openPeople = async () => {
    setError(null);
    setPeopleOpen(true);
    try {
      await loadPeople(draftId);
    } catch {
      // The modal owns its retry state. Opening People never creates a server draft.
    }
  };

  const visibleFriends = useMemo(() => {
    const normalized = peopleQuery.trim().toLowerCase();
    if (!normalized) return friends;
    return friends.filter((friend) =>
      [friend.displayName, friend.username]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [friends, peopleQuery]);

  const visibleCrews = useMemo(() => {
    const normalized = peopleQuery.trim().toLowerCase();
    if (!normalized) return crews;
    return crews.filter((crew) => crew.name.toLowerCase().includes(normalized));
  }, [crews, peopleQuery]);

  const selectedRecipientCount = useMemo(() => {
    const recipients = new Set(selectedFriends);
    for (const crew of crews) {
      if (!selectedCrews.has(crew.id)) continue;
      for (const userId of crew.eligibleUserIds) recipients.add(userId);
    }
    if (inviteUserId && !inviteContextAppliedRef.current) recipients.add(inviteUserId);
    return recipients.size;
  }, [crews, inviteUserId, selectedCrews, selectedFriends]);

  const openRoutePicker = (target: PickerTarget) => {
    const point = target === 'start' ? start : end;
    setDraftCoordinate(point ?? start ?? end ?? NOXA_FALLBACK_COORDINATE);
    setRoutePickerTarget(target);
  };

  const confirmPoint = async (coordinate: LatLng) => {
    const target = routePickerTarget;
    if (!target) return;
    const point = {
      ...coordinate,
      label: await resolveLabel(coordinate, target === 'end'),
    };
    if (target === 'start') setStart(point);
    else setEnd(point);
    setRoutePickerTarget(null);
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
          'You can still choose the point manually on the map.',
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
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

  const openDatePicker = (mode: DatePickerMode) => {
    setDraftDate(scheduledAt);
    setDatePickerMode(mode);
  };

  const commitDatePicker = () => {
    setScheduledAt((current) =>
      datePickerMode === 'date'
        ? new Date(
            draftDate.getFullYear(),
            draftDate.getMonth(),
            draftDate.getDate(),
            current.getHours(),
            current.getMinutes(),
          )
        : new Date(
            current.getFullYear(),
            current.getMonth(),
            current.getDate(),
            draftDate.getHours(),
            draftDate.getMinutes(),
          ),
    );
    setDatePickerMode(null);
    setError(null);
  };

  const submit = async () => {
    const cleanTitle = validateTitle();
    if (!cleanTitle) return;
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
    const scheduledStartAt = scheduleValue();
    if (scheduledStartAt === undefined) return;

    setSaving(true);
    setError(null);
    try {
      const id = await ensureDraft();
      await updateDriveDetails(id, cleanTitle, description, scheduledStartAt, crewId);
      await saveDriveRoute(id, start, end);

      const directInvites = new Set(selectedFriends);
      if (inviteUserId && !directInvites.has(inviteUserId)) {
        const options = await loadDriveInviteOptions(id);
        const match = options.friends.find(
          (friend) => friend.id === inviteUserId && !friend.unavailable,
        );
        if (match) {
          directInvites.add(match.id);
        } else if (!inviteContextAppliedRef.current) {
          throw new Error(
            'The driver selected from the map can no longer be invited. Open People and choose again.',
          );
        }
      }

      const sourceCrewByUserId = Object.fromEntries(
        friends
          .filter((friend) => directInvites.has(friend.id))
          .map((friend) => [friend.id, friend.sourceCrewId]),
      );
      if (inviteUserId && directInvites.has(inviteUserId) && !(inviteUserId in sourceCrewByUserId)) {
        const options = await loadDriveInviteOptions(id);
        const match = options.friends.find((friend) => friend.id === inviteUserId);
        if (match) sourceCrewByUserId[inviteUserId] = match.sourceCrewId;
      }

      await inviteUsersToDrive(id, Array.from(directInvites), sourceCrewByUserId);
      await inviteCrewsToDrive(id, Array.from(selectedCrews));

      router.replace({ pathname: '/group-drives/[id]', params: { id } });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Group Drive could not be saved. Retry.',
      );
      if (draftId) {
        try {
          const options = await loadDriveInviteOptions(draftId);
          const unavailable = new Set(
            options.friends.filter((friend) => friend.unavailable).map((friend) => friend.id),
          );
          setSelectedFriends((current) =>
            new Set(Array.from(current).filter((id) => !unavailable.has(id))),
          );
        } catch {
          // Preserve the original actionable error. Availability can refresh on next People open.
        }
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <NoxaLoadingState label="Loading Group Drive…" />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen constrained={false} contentStyle={styles.content}>
        <NoxaEmptyState
          body={loadError}
          icon="navigate-outline"
          title="Drive unavailable"
        />
        <NoxaButton fullWidth onPress={() => void load()} title="Retry" variant="secondary" />
        <NoxaButton fullWidth onPress={() => router.back()} title="Go back" variant="ghost" />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding constrained={false} contentStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={23} color={colors.text} />
        </Pressable>
        <View style={styles.topBarCopy}>
          <Text style={styles.topBarEyebrow}>{editMode ? 'EDIT DRIVE' : 'CREATE DRIVE'}</Text>
          <Text style={styles.topBarTitle}>Drive Together</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>
          {editMode ? 'One drive. One place to edit it.' : 'Set the drive in one pass.'}
        </Text>
        <Text style={styles.body}>
          Route, time and people stay together. Nothing starts location sharing from this screen.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader icon="text-outline" title="DRIVE" />
        <View style={styles.surface}>
          <NoxaInput
            autoCapitalize="sentences"
            editable={!saving}
            label="Name"
            maxLength={100}
            onChangeText={setTitle}
            placeholder="Night coast drive"
            returnKeyType="done"
            value={title}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showMore }}
            onPress={() => setShowMore((current) => !current)}
            style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
          >
            <View style={styles.moreIcon}>
              <Ionicons name="options-outline" size={18} color={colors.textMuted} />
            </View>
            <View style={styles.moreCopy}>
              <Text style={styles.moreTitle}>More options</Text>
              <Text style={styles.moreCaption}>Optional note for invited drivers</Text>
            </View>
            <Ionicons
              name={showMore ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSubtle}
            />
          </Pressable>
          {showMore ? (
            <NoxaInput
              editable={!saving}
              hint={`${description.length}/1000 · optional`}
              label="Description"
              maxLength={1000}
              multiline
              onChangeText={setDescription}
              placeholder="A short note for the group"
              style={styles.descriptionInput}
              textAlignVertical="top"
              value={description}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          icon="map-outline"
          title="ROUTE"
          value={start && end ? 'READY' : 'REQUIRED'}
        />
        <View style={styles.surface}>
          <RouteRow
            icon="radio-button-on"
            label="From"
            onPress={() => openRoutePicker('start')}
            value={start?.label ?? 'Choose start'}
          />
          <View style={styles.routeConnector} />
          <RouteRow
            icon="flag"
            label="Destination"
            onPress={() => openRoutePicker('end')}
            value={end?.label ?? 'Choose destination'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader icon="time-outline" title="WHEN" />
        <View accessibilityRole="radiogroup" style={styles.whenGrid}>
          <Pressable
            accessibilityLabel="Now or when everyone is ready"
            accessibilityRole="radio"
            accessibilityState={{ selected: scheduleMode === 'ready' }}
            onPress={() => {
              setScheduleMode('ready');
              setError(null);
            }}
            style={({ pressed }) => [
              styles.whenChoice,
              scheduleMode === 'ready' && styles.whenChoiceActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="flash-outline"
              size={20}
              color={scheduleMode === 'ready' ? colors.primaryHover : colors.textMuted}
            />
            <Text style={styles.whenTitle}>Now / ready</Text>
            <Text style={styles.whenCaption}>Host starts manually</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Choose date and time"
            accessibilityRole="radio"
            accessibilityState={{ selected: scheduleMode === 'scheduled' }}
            onPress={() => setScheduleMode('scheduled')}
            style={({ pressed }) => [
              styles.whenChoice,
              scheduleMode === 'scheduled' && styles.whenChoiceActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={scheduleMode === 'scheduled' ? colors.primaryHover : colors.textMuted}
            />
            <Text style={styles.whenTitle}>Date & time</Text>
            <Text style={styles.whenCaption}>
              {scheduleMode === 'scheduled'
                ? `${dateFormat.format(scheduledAt)} · ${timeFormat.format(scheduledAt)}`
                : 'Plan for later'}
            </Text>
          </Pressable>
        </View>

        {scheduleMode === 'scheduled' ? (
          <View style={styles.dateActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => openDatePicker('date')}
              style={({ pressed }) => [styles.dateAction, pressed && styles.pressed]}
            >
              <Text style={styles.dateActionLabel}>DATE</Text>
              <Text style={styles.dateActionValue}>{dateFormat.format(scheduledAt)}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => openDatePicker('time')}
              style={({ pressed }) => [styles.dateAction, pressed && styles.pressed]}
            >
              <Text style={styles.dateActionLabel}>TIME</Text>
              <Text style={styles.dateActionValue}>{timeFormat.format(scheduledAt)}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeader
          icon="people-outline"
          title="PEOPLE"
          value={
            selectedRecipientCount || existingPendingInvites
              ? `${selectedRecipientCount + existingPendingInvites} SELECTED`
              : 'OPTIONAL'
          }
        />
        <Pressable
          accessibilityHint="Choose individual friends or Crew members to invite"
          accessibilityRole="button"
          onPress={() => void openPeople()}
          style={({ pressed }) => [styles.peopleRow, pressed && styles.pressed]}
        >
          <View style={styles.peopleIcon}>
            <Ionicons name="person-add-outline" size={21} color={colors.text} />
          </View>
          <View style={styles.peopleCopy}>
            <Text style={styles.peopleTitle}>
              {selectedRecipientCount || existingPendingInvites
                ? 'Review selected people'
                : 'Add people'}
            </Text>
            <Text style={styles.peopleCaption}>
              {inviteContextMessage ??
                (existingPendingInvites
                  ? `${existingPendingInvites} existing invitation${existingPendingInvites === 1 ? '' : 's'}`
                  : 'Friends and your Crews')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </Pressable>
      </View>

      <View style={styles.sharingNote}>
        <View style={styles.sharingIcon}>
          <Ionicons name="location-outline" size={21} color={colors.primaryHover} />
        </View>
        <View style={styles.sharingCopy}>
          <Text style={styles.sharingTitle}>LOCATION SHARING</Text>
          <Text style={styles.sharingBody}>
            Creating or scheduling this drive does not share anyone’s location. Each participant
            chooses separately when Active Drive asks for location consent.
          </Text>
        </View>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <NoxaButton
        fullWidth
        loading={saving}
        onPress={() => void submit()}
        title={editMode ? 'Save Drive' : 'Create Drive'}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => setRoutePickerTarget(null)}
        visible={routePickerTarget !== null}
      >
        <MapboxEventLocationPickerCompat
          confirmLabel={routePickerTarget === 'start' ? 'Confirm Start' : 'Confirm Destination'}
          headerTitle={routePickerTarget === 'start' ? 'Drive start' : 'Drive destination'}
          initialCoordinate={draftCoordinate}
          isLocating={isLocating}
          onCancel={() => setRoutePickerTarget(null)}
          onConfirm={(point) => void confirmPoint(point)}
          onUseCurrentLocation={() => void locateCurrentPoint()}
        />
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setDatePickerMode(null)}
        transparent
        visible={datePickerMode !== null}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dateSheet}>
            <View style={styles.modalHeader}>
              <Pressable
                accessibilityLabel="Cancel date and time selection"
                accessibilityRole="button"
                onPress={() => setDatePickerMode(null)}
                style={({ pressed }) => [styles.modalAction, pressed && styles.pressed]}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Select {datePickerMode}</Text>
              <Pressable
                accessibilityLabel="Confirm date and time selection"
                accessibilityRole="button"
                onPress={commitDatePicker}
                style={({ pressed }) => [styles.modalAction, pressed && styles.pressed]}
              >
                <Text style={styles.modalDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              mode={datePickerMode ?? 'date'}
              onChange={(_, selected) => {
                if (selected) setDraftDate(selected);
              }}
              textColor={colors.text}
              themeVariant="dark"
              value={draftDate}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setPeopleOpen(false)}
        presentationStyle="pageSheet"
        visible={peopleOpen}
      >
        <View style={styles.peopleModal}>
          <View style={styles.peopleModalHeader}>
            <Pressable
              accessibilityLabel="Close people"
              accessibilityRole="button"
              onPress={() => setPeopleOpen(false)}
              style={({ pressed }) => [styles.modalCircleButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={21} color={colors.text} />
            </Pressable>
            <View style={styles.peopleModalHeaderCopy}>
              <Text style={styles.peopleModalEyebrow}>CREATE DRIVE</Text>
              <Text style={styles.peopleModalTitle}>Add people</Text>
            </View>
            <Pressable
              accessibilityLabel="Done selecting people"
              accessibilityRole="button"
              onPress={() => setPeopleOpen(false)}
              style={({ pressed }) => [styles.modalDoneButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalDone}>Done</Text>
            </Pressable>
          </View>

          <Screen scroll keyboardAvoiding constrained={false} contentStyle={styles.peopleModalContent}>
            <Text style={styles.peopleModalBody}>
              Selection stays local to this draft. Invitations are sent only when you create the drive.
            </Text>
            <NoxaInput
              autoCapitalize="none"
              label="Search people"
              onChangeText={setPeopleQuery}
              placeholder="Name, username or Crew"
              value={peopleQuery}
            />

            {peopleLoading ? (
              <View style={styles.peopleLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.peopleLoadingText}>Loading people…</Text>
              </View>
            ) : peopleError ? (
              <View style={styles.peopleErrorBox}>
                <Text accessibilityRole="alert" style={styles.error}>{peopleError}</Text>
                <NoxaButton
                  fullWidth
                  onPress={() => void loadPeople(draftId)}
                  title="Retry"
                  variant="secondary"
                />
              </View>
            ) : (
              <>
                <View style={styles.peopleSection}>
                  <Text style={styles.peopleSectionTitle}>PEOPLE</Text>
                  {visibleFriends.length ? (
                    visibleFriends.map((friend) => {
                      const selected = selectedFriends.has(friend.id);
                      return (
                        <Pressable
                          accessibilityLabel={`${friend.displayName}, ${friend.unavailable ? 'already invited' : selected ? 'selected' : 'not selected'}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked: selected || friend.unavailable,
                            disabled: friend.unavailable,
                          }}
                          disabled={friend.unavailable}
                          key={friend.id}
                          onPress={() => toggleSet(setSelectedFriends, friend.id)}
                          style={({ pressed }) => [
                            styles.personRow,
                            pressed && styles.pressed,
                            friend.unavailable && styles.disabled,
                          ]}
                        >
                          <NoxaAvatar
                            imageUrl={friend.avatarUrl}
                            initials={initials(friend.displayName)}
                            size={44}
                          />
                          <View style={styles.personCopy}>
                            <Text numberOfLines={1} style={styles.personName}>{friend.displayName}</Text>
                            <Text numberOfLines={1} style={styles.personMeta}>
                              {friend.unavailable
                                ? 'Already part of this drive'
                                : friend.username
                                  ? `@${friend.username} · ${friend.relationship === 'crew_member' ? 'Crew' : friend.relationship === 'mutual_friend_and_crew' ? 'Friend + Crew' : 'Friend'}`
                                  : friend.relationship === 'crew_member'
                                    ? 'Shared Crew member'
                                    : friend.relationship === 'mutual_friend_and_crew'
                                      ? 'Mutual friend · shared Crew'
                                      : 'Mutual friend'}
                            </Text>
                          </View>
                          <SelectMark
                            disabled={friend.unavailable}
                            selected={selected || friend.unavailable}
                          />
                        </Pressable>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyCopy}>No matching people.</Text>
                  )}
                </View>

                <View style={styles.peopleSection}>
                  <Text style={styles.peopleSectionTitle}>YOUR CREWS</Text>
                  {visibleCrews.length ? (
                    visibleCrews.map((crew) => {
                      const selected = selectedCrews.has(crew.id);
                      return (
                        <Pressable
                          accessibilityLabel={`${crew.name}, ${crew.memberCount} eligible members, ${selected ? 'selected' : 'not selected'}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          key={crew.id}
                          onPress={() => toggleSet(setSelectedCrews, crew.id)}
                          style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
                        >
                          <View style={styles.crewAvatar}>
                            <Ionicons name="people" size={20} color={colors.text} />
                          </View>
                          <View style={styles.personCopy}>
                            <Text numberOfLines={1} style={styles.personName}>{crew.name}</Text>
                            <Text style={styles.personMeta}>
                              {crew.memberCount} eligible {crew.memberCount === 1 ? 'member' : 'members'}
                            </Text>
                          </View>
                          <SelectMark selected={selected} />
                        </Pressable>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyCopy}>No matching Crews.</Text>
                  )}
                </View>
              </>
            )}
          </Screen>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  topBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  topBarCopy: { flex: 1, alignItems: 'center' },
  topBarEyebrow: {
    color: colors.primaryHover,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  topBarTitle: { marginTop: 2, color: colors.text, fontSize: 16, fontWeight: '800' },
  intro: { gap: spacing.xs },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: '900',
  },
  body: { color: colors.textMuted, ...typography.v2.body },
  section: { gap: spacing.sm },
  sectionHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
  },
  sectionHeaderTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  sectionHeaderValue: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  surface: {
    overflow: 'hidden',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  descriptionInput: { minHeight: 112, paddingTop: spacing.md },
  moreRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  moreIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  moreCopy: { flex: 1 },
  moreTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  moreCaption: { marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  routeRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  routePointIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  routeRowCopy: { flex: 1, minWidth: 0 },
  routeRowLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  routeRowValue: { marginTop: 3, color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  routeConnector: {
    width: 1,
    height: 16,
    marginLeft: 27,
    marginVertical: -8,
    backgroundColor: colors.borderStrong,
  },
  whenGrid: { flexDirection: 'row', gap: spacing.sm },
  whenChoice: {
    flex: 1,
    minHeight: 104,
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  whenChoiceActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  whenTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  whenCaption: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  dateActions: { flexDirection: 'row', gap: spacing.sm },
  dateAction: {
    flex: 1,
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  dateActionLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  dateActionValue: { marginTop: 4, color: colors.text, fontSize: 14, fontWeight: '800' },
  peopleRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  peopleIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  peopleCopy: { flex: 1, minWidth: 0 },
  peopleTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  peopleCaption: { marginTop: 3, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  sharingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  sharingIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  sharingCopy: { flex: 1 },
  sharingTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  sharingBody: { marginTop: 4, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.primaryHover, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  dateSheet: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.surfaceRaised,
  },
  modalHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalAction: { minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  modalCancel: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  modalDone: { color: colors.primaryHover, fontSize: 14, fontWeight: '900' },
  modalTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
  peopleModal: { flex: 1, backgroundColor: colors.background },
  peopleModalHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalCircleButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  peopleModalHeaderCopy: { flex: 1 },
  peopleModalEyebrow: {
    color: colors.primaryHover,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  peopleModalTitle: { marginTop: 2, color: colors.text, fontSize: 18, fontWeight: '900' },
  modalDoneButton: {
    minWidth: 60,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleModalContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  peopleModalBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  peopleLoading: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  peopleLoadingText: { color: colors.textMuted, fontSize: 12 },
  peopleErrorBox: { gap: spacing.md },
  peopleSection: { gap: spacing.xs },
  peopleSectionTitle: {
    marginBottom: spacing.xs,
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  personRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  personMeta: { marginTop: 3, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  crewAvatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  mark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  markSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  markDisabled: { opacity: 0.6 },
  emptyCopy: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingVertical: spacing.sm },
});
