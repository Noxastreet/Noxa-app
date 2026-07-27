import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  NoxaButton,
  NoxaInput,
  NoxaScreen,
} from "@/src/components/ui";
import { MapboxEventLocationPickerCompat } from "@/src/features/mapbox/MapboxEventLocationPickerCompat";
import { NOXA_FALLBACK_COORDINATE } from "@/src/features/mapbox/config";
import type { LatLng } from "@/src/features/mapbox/types";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type EventForm = {
  title: string;
  description: string;
  category: EventCategory;
  capacity: string;
  locationName: string;
  startAt: Date;
  endAt: Date | null;
  isPublic: boolean;
  crewId: string | null;
  latitude: number | null;
  longitude: number | null;
};
type EventCategory = "meet" | "drive" | "track" | "social";
type EventRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  capacity: number | null;
  location_name: string;
  starts_at: string;
  ends_at: string | null;
  is_public: boolean;
  crew_id: string | null;
  latitude: number | null;
  longitude: number | null;
};
type PickerTarget = "startDate" | "startTime" | "endDate" | "endTime";
type ManagedCrew = { id: string; name: string; logo_url: string | null };

const eventCategories: { value: EventCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "meet", label: "MEET", icon: "people-outline" },
  { value: "drive", label: "DRIVE", icon: "navigate-outline" },
  { value: "track", label: "TRACK", icon: "speedometer-outline" },
  { value: "social", label: "SOCIAL", icon: "cafe-outline" },
];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function futureStart() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return date;
}

const initialForm: EventForm = {
  title: "",
  description: "",
  category: "meet",
  capacity: "",
  locationName: "",
  startAt: futureStart(),
  endAt: null,
  isPublic: true,
  crewId: null,
  latitude: null,
  longitude: null,
};
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function isValidDate(value: Date | null) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
function mergeDatePart(base: Date | null, picked: Date) {
  const current = base ?? futureStart();
  return new Date(
    picked.getFullYear(),
    picked.getMonth(),
    picked.getDate(),
    current.getHours(),
    current.getMinutes(),
    0,
    0,
  );
}
function mergeTimePart(base: Date | null, picked: Date) {
  const current = base ?? futureStart();
  return new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    picked.getHours(),
    picked.getMinutes(),
    0,
    0,
  );
}
function formatCoords(latitude: number, longitude: number) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
function buildAddress(
  addresses: Location.LocationGeocodedAddress[],
  latitude: number,
  longitude: number,
) {
  const address = addresses[0];
  if (!address) return formatCoords(latitude, longitude);
  const street = [address.name, address.street]
    .filter(Boolean)
    .join(" ")
    .trim();
  const parts = [street, address.city, address.region].filter(Boolean);
  return parts.length
    ? Array.from(new Set(parts)).join(", ")
    : formatCoords(latitude, longitude);
}
function prefillFromEvent(event: EventRow): EventForm {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  return {
    title: event.title,
    description: event.description ?? "",
    category: event.category ?? "meet",
    capacity: event.capacity?.toString() ?? "",
    locationName: event.location_name,
    startAt: isValidDate(start) ? start : futureStart(),
    endAt: isValidDate(end) ? end : null,
    isPublic: event.is_public,
    crewId: event.crew_id,
    latitude: event.latitude,
    longitude: event.longitude,
  };
}

export default function EventEditorScreen() {
  const params = useLocalSearchParams<{ id?: string; crewId?: string }>();
  const eventId = typeof params.id === "string" ? params.id : undefined;
  const requestedCrewId = typeof params.crewId === "string" ? params.crewId : undefined;
  const isEditing = Boolean(eventId);
  const [form, setForm] = useState<EventForm>(initialForm);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [managedCrews, setManagedCrews] = useState<ManagedCrew[]>([]);
  const [crewLoadError, setCrewLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [saving, setSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [draftLocation, setDraftLocation] = useState<LatLng>(
    NOXA_FALLBACK_COORDINATE,
  );
  const [error, setError] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [draftDate, setDraftDate] = useState<Date>(futureStart());

  const title = useMemo(
    () => (isEditing ? "EDIT EVENT" : "CREATE EVENT"),
    [isEditing],
  );
  const coordinatesAttached = form.latitude !== null && form.longitude !== null;
  const updateField = useCallback(
    <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
      setForm((current) => ({ ...current, [key]: value })),
    [],
  );
  const resolveLocationName = useCallback(
    async (latitude: number, longitude: number) => {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      return buildAddress(addresses, latitude, longitude);
    },
    [],
  );

  const loadEvent = useCallback(async () => {
    setError(null);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError("Sign in to manage events.");
      setLoading(false);
      return;
    }
    setCurrentUserId(authData.user.id);
    setCrewLoadError(null);
    const { data: membershipRows, error: membershipsError } = await supabase
      .from("crew_members")
      .select("crew_id,role")
      .eq("user_id", authData.user.id)
      .in("role", ["owner", "admin"]);
    if (membershipsError) {
      setManagedCrews([]);
      setCrewLoadError("Crew hosts could not be loaded.");
    } else {
      const crewIds = Array.from(new Set((membershipRows ?? []).map((row) => row.crew_id)));
      const { data: crewRows, error: crewsError } = crewIds.length
        ? await supabase
            .from("crews")
            .select("id,name,logo_url")
            .in("id", crewIds)
            .order("name", { ascending: true })
        : { data: [], error: null };
      if (crewsError) {
        setManagedCrews([]);
        setCrewLoadError("Crew hosts could not be loaded.");
      } else {
        const nextCrews = (crewRows ?? []) as ManagedCrew[];
        setManagedCrews(nextCrews);
        if (!eventId && requestedCrewId && nextCrews.some((crew) => crew.id === requestedCrewId)) {
          setForm((current) => ({ ...current, crewId: requestedCrewId }));
        }
      }
    }
    if (!eventId) {
      setLoading(false);
      return;
    }
    if (!uuidPattern.test(eventId)) {
      setError("Invalid event id.");
      setLoading(false);
      return;
    }
    const { data, error: eventError } = await supabase
      .from("events")
      .select(
        "id,creator_id,title,description,category,capacity,location_name,starts_at,ends_at,is_public,crew_id,latitude,longitude",
      )
      .eq("id", eventId)
      .maybeSingle();
    if (eventError) setError(eventError.message);
    else if (!data) setError("Event not found.");
    else if ((data as EventRow).creator_id !== authData.user.id)
      setError("Only the event host can edit this event.");
    else setForm(prefillFromEvent(data as EventRow));
    setLoading(false);
  }, [eventId, requestedCrewId]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const openPicker = useCallback(
    (target: PickerTarget) => {
      const value = target.startsWith("end")
        ? (form.endAt ?? form.startAt)
        : form.startAt;
      setDraftDate(value);
      setPickerTarget(target);
    },
    [form.endAt, form.startAt],
  );

  const commitPicker = useCallback(() => {
    if (!pickerTarget) return;
    setForm((current) => {
      if (pickerTarget === "startDate")
        return {
          ...current,
          startAt: mergeDatePart(current.startAt, draftDate),
        };
      if (pickerTarget === "startTime")
        return {
          ...current,
          startAt: mergeTimePart(current.startAt, draftDate),
        };
      if (pickerTarget === "endDate")
        return {
          ...current,
          endAt: mergeDatePart(current.endAt ?? current.startAt, draftDate),
        };
      return {
        ...current,
        endAt: mergeTimePart(current.endAt ?? current.startAt, draftDate),
      };
    });
    setPickerTarget(null);
  }, [draftDate, pickerTarget]);

  const getCurrentPoint = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED)
      throw new Error("permission-denied");
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }, []);

  const useCurrentLocation = useCallback(async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const point = await getCurrentPoint();
      const locationName = await resolveLocationName(
        point.latitude,
        point.longitude,
      );
      setForm((current) => ({
        ...current,
        locationName,
        latitude: point.latitude,
        longitude: point.longitude,
      }));
    } catch {
      Alert.alert(
        "Location unavailable",
        "Allow foreground location access or choose the exact event point on the map.",
      );
    } finally {
      setIsLocating(false);
    }
  }, [getCurrentPoint, isLocating, resolveLocationName]);

  const openMapSelector = useCallback(async () => {
    const existing =
      form.latitude !== null && form.longitude !== null
        ? { latitude: form.latitude, longitude: form.longitude }
        : null;
    if (existing) {
      setDraftLocation(existing);
      setMapModalVisible(true);
      return;
    }
    setDraftLocation(NOXA_FALLBACK_COORDINATE);
    setMapModalVisible(true);
    setIsLocating(true);
    try {
      const point = await getCurrentPoint();
      setDraftLocation(point);
    } catch {
      /* Permission or services unavailable: keep the safe fallback. */
    } finally {
      setIsLocating(false);
    }
  }, [form.latitude, form.longitude, getCurrentPoint]);

  const useCurrentLocationInModal = useCallback(async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const point = await getCurrentPoint();
      setDraftLocation(point);
    } catch {
      Alert.alert(
        "Location unavailable",
        "Foreground location permission is needed to use your current position.",
      );
    } finally {
      setIsLocating(false);
    }
  }, [getCurrentPoint, isLocating]);

  const confirmDraftLocation = useCallback(async (coordinate: LatLng) => {
    setIsLocating(true);
    let locationName: string;
    try {
      locationName = await resolveLocationName(coordinate.latitude, coordinate.longitude);
    } catch {
      locationName = formatCoords(coordinate.latitude, coordinate.longitude);
    }
    setDraftLocation(coordinate);
    setForm((current) => ({
      ...current,
      locationName,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    }));
    setMapModalVisible(false);
    setIsLocating(false);
  }, [resolveLocationName]);

  const validate = useCallback(() => {
    const titleValue = form.title.trim();
    const locationValue = form.locationName.trim();
    if (!titleValue) return "Title is required.";
    if (titleValue.length > 100) return "Title must be 100 characters or less.";
    if (form.description.length > 2000)
      return "Description must be 2000 characters or less.";
    const capacityValue = form.capacity.trim();
    const capacity = capacityValue ? Number(capacityValue) : null;
    if (
      capacityValue
      && (capacity === null || !Number.isInteger(capacity) || capacity < 2 || capacity > 5000)
    )
      return "Capacity must be a whole number between 2 and 5000.";
    if (!coordinatesAttached || !locationValue)
      return "Choose the exact event location on the map.";
    if (locationValue.length > 160)
      return "Location must be 160 characters or less.";
    if (!isValidDate(form.startAt))
      return "Select a valid start date and time.";
    if (!isEditing && form.startAt.getTime() <= Date.now())
      return "Start time must be in the future.";
    if (form.endAt) {
      if (!isValidDate(form.endAt))
        return "Select a valid end date and time, or clear the end value.";
      if (form.endAt.getTime() <= form.startAt.getTime())
        return "End time must be later than start time.";
    }
    return {
      title: titleValue,
      location: locationValue,
      start: form.startAt,
      end: form.endAt,
      capacity,
    };
  }, [coordinatesAttached, form, isEditing]);

  const saveEvent = useCallback(async () => {
    if (saving) return;
    setError(null);
    const valid = validate();
    if (typeof valid === "string") {
      setError(valid);
      return;
    }
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? currentUserId;
    if (!userId) {
      setError("Sign in to save events.");
      setSaving(false);
      return;
    }
    const payload = {
      title: valid.title,
      description: form.description.trim() || null,
      category: form.category,
      capacity: valid.capacity,
      location_name: valid.location,
      starts_at: valid.start.toISOString(),
      ends_at: valid.end?.toISOString() ?? null,
      is_public: form.isPublic,
      crew_id: form.crewId,
      latitude: form.latitude,
      longitude: form.longitude,
    };
    const result =
      isEditing && eventId
        ? await supabase
            .from("events")
            .update(payload)
            .eq("id", eventId)
            .eq("creator_id", userId)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("events")
            .insert({ ...payload, creator_id: userId })
            .select("id")
            .single();
    if (result.error || !result.data) {
      setError(result.error?.message ?? "Event could not be saved.");
      setSaving(false);
      return;
    }
    router.replace({
      pathname: "/event-details",
      params: { id: result.data.id },
    });
    setSaving(false);
  }, [currentUserId, eventId, form, isEditing, saving, validate]);

  return (
    <NoxaScreen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.editorHeader}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.previewCard}>
            <View style={styles.previewGlow} />
            <View style={styles.previewTopline}>
              <View style={styles.previewBadge}>
                <Ionicons name="flag" size={14} color={colors.primaryHover} />
                <Text style={styles.previewBadgeText}>{form.category.toUpperCase()}</Text>
              </View>
              <Text style={styles.previewStatus}>
                {form.isPublic ? "PUBLIC" : "PRIVATE"}
              </Text>
            </View>
            <Text numberOfLines={2} style={styles.previewTitle}>
              {form.title.trim() || "YOUR NEXT NOXA EVENT"}
            </Text>
            <View style={styles.previewMeta}>
              <View style={styles.previewMetaItem}>
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={colors.textMuted}
                />
                <Text style={styles.previewMetaText}>
                  {dateFormatter.format(form.startAt)}
                </Text>
              </View>
              <View style={styles.previewMetaItem}>
                <Ionicons
                  name="time-outline"
                  size={15}
                  color={colors.textMuted}
                />
                <Text style={styles.previewMetaText}>
                  {timeFormatter.format(form.startAt)}
                </Text>
              </View>
            </View>
            <View style={styles.previewLocation}>
              <Ionicons
                name="location-outline"
                size={15}
                color={colors.primaryHover}
              />
              <Text numberOfLines={1} style={styles.previewLocationText}>
                {form.locationName || "Choose an exact location"}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Loading event…</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Text style={styles.eyebrow}>01 / DETAILS</Text>
              <Text style={styles.sectionTitle}>Make it unmistakable</Text>
            </View>
            <NoxaInput
              label="Title"
              value={form.title}
              onChangeText={(value) => updateField("title", value)}
              placeholder="Night Drive Thessaloniki"
              maxLength={100}
            />
            <NoxaInput
              label="About"
              value={form.description}
              onChangeText={(value) => updateField("description", value)}
              placeholder="Route, meeting point and what drivers should know…"
              multiline
              maxLength={2000}
              style={styles.textArea}
            />
            <Text style={styles.characterCount}>
              {form.description.length} / 2000
            </Text>
            <View style={styles.categoryGrid}>
              {eventCategories.map((category) => {
                const active = form.category === category.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    key={category.value}
                    onPress={() => updateField("category", category.value)}
                    style={({ pressed }) => [
                      styles.categoryOption,
                      active && styles.categoryOptionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={category.icon}
                      size={17}
                      color={active ? colors.primaryHover : colors.textMuted}
                    />
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <NoxaInput
              label="Capacity (optional)"
              value={form.capacity}
              onChangeText={(value) => updateField("capacity", value.replace(/[^0-9]/g, ""))}
              placeholder="60"
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Text style={styles.eyebrow}>02 / LOCATION</Text>
              <Text style={styles.sectionTitle}>Pin the meeting point</Text>
            </View>
            <View style={styles.readOnlyLocation}>
              <View style={styles.locationIcon}>
                <Ionicons
                  name="location"
                  size={20}
                  color={colors.primaryHover}
                />
              </View>
              <View style={styles.locationCopy}>
                <Text style={styles.pickerLabel}>LOCATION</Text>
                <Text numberOfLines={2} style={styles.locationValue}>
                  {form.locationName || "No exact location selected"}
                </Text>
              </View>
            </View>
            <View style={styles.locationButtons}>
              <Pressable
                accessibilityRole="button"
                onPress={openMapSelector}
                style={({ pressed }) => [
                  styles.locationAction,
                  styles.locationActionPrimary,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="map-outline" size={17} color={colors.text} />
                <Text style={styles.locationActionText}>CHOOSE ON MAP</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={useCurrentLocation}
                disabled={isLocating}
                style={({ pressed }) => [
                  styles.locationAction,
                  pressed && styles.pressed,
                  isLocating && styles.disabled,
                ]}
              >
                <Ionicons
                  name="navigate-outline"
                  size={17}
                  color={colors.text}
                />
                <Text style={styles.locationActionText}>
                  {isLocating ? "LOCATING…" : "USE CURRENT"}
                </Text>
              </Pressable>
            </View>
            {coordinatesAttached ? (
              <View style={styles.verifiedRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.success}
                />
                <Text style={styles.verified}>Exact coordinates attached</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Text style={styles.eyebrow}>03 / SCHEDULE</Text>
              <Text style={styles.sectionTitle}>Set the timeline</Text>
            </View>
            <Text style={styles.scheduleLabel}>STARTS</Text>
            <View style={styles.row}>
              <PickerRow
                label="Start Date"
                value={dateFormatter.format(form.startAt)}
                onPress={() => openPicker("startDate")}
              />
              <PickerRow
                label="Start Time"
                value={timeFormatter.format(form.startAt)}
                onPress={() => openPicker("startTime")}
              />
            </View>
            <View style={styles.scheduleDivider} />
            <View style={styles.optionalRow}>
              <Text style={styles.scheduleLabel}>ENDS</Text>
              <Text style={styles.optionalText}>OPTIONAL</Text>
            </View>
            <View style={styles.row}>
              <PickerRow
                label="End Date"
                value={
                  form.endAt ? dateFormatter.format(form.endAt) : "Optional"
                }
                onPress={() => openPicker("endDate")}
              />
              <PickerRow
                label="End Time"
                value={
                  form.endAt ? timeFormatter.format(form.endAt) : "Optional"
                }
                onPress={() => openPicker("endTime")}
              />
            </View>
            {form.endAt ? (
              <Pressable
                onPress={() => updateField("endAt", null)}
                style={({ pressed }) => [
                  styles.clearEnd,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={colors.textMuted}
                />
                <Text style={styles.clearEndText}>CLEAR END TIME</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Text style={styles.eyebrow}>04 / HOST</Text>
              <Text style={styles.sectionTitle}>Choose the organizer</Text>
            </View>
            <View style={styles.hostOptions}>
              <HostOption
                active={!form.crewId}
                icon="person-outline"
                label="My profile"
                onPress={() => updateField("crewId", null)}
              />
              {managedCrews.map((crew) => (
                <HostOption
                  active={form.crewId === crew.id}
                  icon="people-outline"
                  key={crew.id}
                  label={crew.name}
                  onPress={() => updateField("crewId", crew.id)}
                />
              ))}
            </View>
            {crewLoadError ? <Text style={styles.hostError}>{crewLoadError}</Text> : null}
            {!crewLoadError && managedCrews.length === 0 ? (
              <Text style={styles.hostHelper}>Create or manage a crew to host events under its name.</Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Text style={styles.eyebrow}>05 / VISIBILITY</Text>
              <Text style={styles.sectionTitle}>Choose the audience</Text>
            </View>
            <View style={styles.visibilityOptions}>
              <VisibilityOption
                active={form.isPublic}
                description="Visible to every NOXA driver"
                icon="earth-outline"
                label="Public"
                onPress={() => updateField("isPublic", true)}
              />
              <VisibilityOption
                active={!form.isPublic}
                description={form.crewId ? "Visible to crew members" : "Visible only to you for now"}
                icon="lock-closed-outline"
                label="Private"
                onPress={() => updateField("isPublic", false)}
              />
            </View>
          </View>
        </ScrollView>
        <View style={styles.fixedFooter}>
          <NoxaButton
            title={isEditing ? "SAVE CHANGES" : "PUBLISH EVENT"}
            fullWidth
            loading={saving}
            disabled={loading || saving || Boolean(isEditing && error)}
            onPress={saveEvent}
          />
        </View>
        <Modal
          animationType="slide"
          visible={mapModalVisible}
          onRequestClose={() => setMapModalVisible(false)}
        >
          <MapboxEventLocationPickerCompat
            initialCoordinate={draftLocation}
            isLocating={isLocating}
            onCancel={() => setMapModalVisible(false)}
            onConfirm={confirmDraftLocation}
            onUseCurrentLocation={useCurrentLocationInModal}
          />
        </Modal>
        <Modal
          animationType="fade"
          transparent
          visible={pickerTarget !== null}
          onRequestClose={() => setPickerTarget(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Pressable onPress={() => setPickerTarget(null)}>
                  <Text style={styles.pickerAction}>Cancel</Text>
                </Pressable>
                <Text style={styles.pickerTitle}>
                  {pickerTarget?.includes("Date")
                    ? "Select date"
                    : "Select time"}
                </Text>
                <Pressable onPress={commitPicker}>
                  <Text style={styles.pickerDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draftDate}
                mode={pickerTarget?.includes("Date") ? "date" : "time"}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_: unknown, selected?: Date) => {
                  if (selected) setDraftDate(selected);
                }}
                themeVariant="dark"
                textColor={colors.text}
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </NoxaScreen>
  );
}

function PickerRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
    >
      <Text style={styles.pickerLabel}>{label}</Text>
      <Text style={styles.pickerValue}>{value}</Text>
    </Pressable>
  );
}

function HostOption({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hostOption,
        active && styles.hostOptionActive,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.hostOptionIcon, active && styles.hostOptionIconActive]}>
        <Ionicons name={icon} size={18} color={active ? colors.primaryHover : colors.textMuted} />
      </View>
      <Text numberOfLines={1} style={[styles.hostOptionText, active && styles.hostOptionTextActive]}>
        {label}
      </Text>
      <Ionicons
        name={active ? "checkmark-circle" : "ellipse-outline"}
        size={18}
        color={active ? colors.primaryHover : colors.textSubtle}
      />
    </Pressable>
  );
}

function VisibilityOption({
  active,
  description,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.visibilityOption,
        active && styles.visibilityOptionActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.visibilityIcon, active && styles.visibilityIconActive]}>
        <Ionicons
          name={icon}
          size={20}
          color={active ? colors.primaryHover : colors.textMuted}
        />
      </View>
      <Text style={styles.visibilityTitle}>{label}</Text>
      <Text style={styles.visibilityText}>{description}</Text>
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  editorHeader: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surfaceBase,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  headerSpacer: { width: 40, height: 40 },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 124,
    gap: spacing.lg,
  },
  previewCard: {
    minHeight: 214,
    justifyContent: "flex-end",
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.lg,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  previewGlow: {
    position: "absolute",
    top: -82,
    right: -54,
    width: 220,
    height: 220,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  previewTopline: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  previewBadgeText: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  previewStatus: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  previewTitle: {
    maxWidth: "88%",
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    lineHeight: typography.lineHeight.h2,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  previewMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  previewMetaText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  previewLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  previewLocationText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  sectionCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  sectionHeading: { gap: spacing.xxs, marginBottom: spacing.xxs },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  textArea: {
    minHeight: 112,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  characterCount: {
    marginTop: -spacing.xs,
    textAlign: "right",
    color: colors.textSubtle,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  categoryOption: {
    minHeight: 42,
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  categoryOptionActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  categoryText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  categoryTextActive: { color: colors.text },
  pickerRow: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  pickerLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pickerValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
  readOnlyLocation: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  locationIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
  },
  locationCopy: { flex: 1, gap: spacing.xxs },
  locationValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
  },
  locationButtons: { flexDirection: "row", gap: spacing.sm },
  locationAction: {
    minHeight: 46,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  locationActionPrimary: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  locationActionText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  verified: {
    color: colors.success,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  disabled: { opacity: 0.55 },
  scheduleLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  scheduleDivider: {
    height: 1,
    marginVertical: spacing.xxs,
    backgroundColor: colors.divider,
  },
  optionalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionalText: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  clearEnd: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  clearEndText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  hostOptions: { gap: spacing.xs },
  hostOption: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  hostOptionActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySubtle },
  hostOptionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  hostOptionIconActive: { backgroundColor: colors.primaryMuted },
  hostOptionText: { flex: 1, color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  hostOptionTextActive: { color: colors.text },
  hostHelper: { color: colors.textMuted, fontSize: 11, fontWeight: "700", lineHeight: 17 },
  hostError: { color: colors.primaryHover, fontSize: 11, fontWeight: "700" },
  visibilityOptions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  visibilityOption: {
    minHeight: 154,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  visibilityOptionActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  visibilityIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  visibilityIconActive: { backgroundColor: colors.primaryMuted },
  visibilityTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
  visibilityText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  fixedFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.glass,
  },
  stateCard: {
    gap: spacing.sm,
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "700",
  },
  errorCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  errorText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  pressed: { opacity: 0.86, transform: [{ translateY: 1 }, { scale: 0.98 }] },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  pickerSheet: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  pickerAction: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "800",
  },
  pickerDone: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: "900",
  },
  pickerTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
  },
});
