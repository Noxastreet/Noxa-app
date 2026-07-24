import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NoxaEmptyState, NoxaScreen } from "@/src/components/ui";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type SearchFilter = "all" | "drivers" | "vehicles" | "crews" | "events";

type DriverResult = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
};

type VehicleResult = {
  id: string;
  brand: string;
  model: string | null;
  year: number | null;
  horsepower: number;
  color: string;
  cover_image_url: string | null;
};

type CrewResult = {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  logo_url: string | null;
  is_public: boolean;
};

type EventResult = {
  id: string;
  title: string;
  location_name: string;
  starts_at: string;
  cover_image_url: string | null;
  is_public: boolean;
};

type SearchResults = {
  drivers: DriverResult[];
  vehicles: VehicleResult[];
  crews: CrewResult[];
  events: EventResult[];
};

const emptyResults: SearchResults = {
  drivers: [],
  vehicles: [],
  crews: [],
  events: [],
};

const filters: { label: string; value: SearchFilter }[] = [
  { label: "All", value: "all" },
  { label: "Drivers", value: "drivers" },
  { label: "Vehicles", value: "vehicles" },
  { label: "Events", value: "events" },
  { label: "Crews", value: "crews" },
];

const eventDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function cleanSearchTerm(value: string) {
  return value
    .trim()
    .replace(/[,%.()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

function getInitials(value: string) {
  return (
    value
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NX"
  );
}

function driverName(driver: DriverResult) {
  return driver.display_name?.trim() || "NOXA Driver";
}

function vehicleName(vehicle: VehicleResult) {
  return [vehicle.year, vehicle.brand, vehicle.model].filter(Boolean).join(" ");
}

function SearchHeader({ loading }: { loading: boolean }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>EXPLORE</Text>
      <View style={styles.headerStatus}>
        {loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      </View>
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionHeading({ count, title }: { count: number; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

function DriverAvatar({ driver, size = 52 }: { driver: DriverResult; size?: number }) {
  const name = driverName(driver);

  if (driver.avatar_url) {
    return (
      <Image
        accessibilityLabel={`${name} avatar`}
        source={{ uri: driver.avatar_url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

function DriverCard({ driver }: { driver: DriverResult }) {
  const name = driverName(driver);

  return (
    <Pressable
      accessibilityLabel={`Open ${name}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/driver-profile/[id]",
          params: { id: driver.id },
        })
      }
      style={({ pressed }) => [styles.driverCard, pressed && styles.pressed]}
    >
      <DriverAvatar driver={driver} size={56} />
      <Text numberOfLines={1} style={styles.driverCardName}>
        {name}
      </Text>
      <Text numberOfLines={1} style={styles.driverCardMeta}>
        {driver.username ? `@${driver.username}` : driver.city || "NOXA driver"}
      </Text>
    </Pressable>
  );
}

function DriverRow({ driver }: { driver: DriverResult }) {
  const name = driverName(driver);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/driver-profile/[id]",
          params: { id: driver.id },
        })
      }
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
    >
      <DriverAvatar driver={driver} />
      <View style={styles.resultCopy}>
        <Text numberOfLines={1} style={styles.resultTitle}>
          {name}
        </Text>
        <Text numberOfLines={1} style={styles.resultSubtitle}>
          {[driver.username ? `@${driver.username}` : null, driver.city]
            .filter(Boolean)
            .join(" · ") || "NOXA community"}
        </Text>
      </View>
      <Text style={styles.resultType}>DRIVER</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

function ResultArtwork({
  icon,
  imageUrl,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  imageUrl: string | null;
}) {
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={styles.resultImage} />;
  }

  return (
    <View style={styles.resultImageFallback}>
      <Ionicons name={icon} size={23} color={colors.primaryHover} />
    </View>
  );
}

function VehicleRow({ vehicle }: { vehicle: VehicleResult }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/vehicle-details", params: { id: vehicle.id } })
      }
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
    >
      <ResultArtwork icon="car-sport-outline" imageUrl={vehicle.cover_image_url} />
      <View style={styles.resultCopy}>
        <Text numberOfLines={1} style={styles.resultTitle}>
          {vehicleName(vehicle)}
        </Text>
        <Text numberOfLines={1} style={styles.resultSubtitle}>
          {vehicle.horsepower} HP · {vehicle.color}
        </Text>
      </View>
      <Text style={styles.resultType}>VEHICLE</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

function CrewRow({ crew }: { crew: CrewResult }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/crew/[id]", params: { id: crew.id } })
      }
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
    >
      <ResultArtwork icon="people-outline" imageUrl={crew.logo_url} />
      <View style={styles.resultCopy}>
        <Text numberOfLines={1} style={styles.resultTitle}>
          {crew.name}
        </Text>
        <Text numberOfLines={1} style={styles.resultSubtitle}>
          {crew.city || crew.description || "NOXA crew"}
        </Text>
      </View>
      <Text style={styles.resultType}>{crew.is_public ? "PUBLIC" : "PRIVATE"}</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

function EventRow({ event }: { event: EventResult }) {
  const parsedDate = new Date(event.starts_at);
  const dateText = Number.isNaN(parsedDate.getTime())
    ? "Date unavailable"
    : eventDateFormatter.format(parsedDate);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/event-details", params: { id: event.id } })
      }
      style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}
    >
      <ResultArtwork icon="flag-outline" imageUrl={event.cover_image_url} />
      <View style={styles.resultCopy}>
        <Text numberOfLines={1} style={styles.resultTitle}>
          {event.title}
        </Text>
        <Text numberOfLines={1} style={styles.resultSubtitle}>
          {dateText} · {event.location_name}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle-outline" size={19} color={colors.primaryHover} />
      <Text style={styles.errorText}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry}>
        <Text style={styles.retryText}>RETRY</Text>
      </Pressable>
    </View>
  );
}

export default function SearchScreen() {
  const [activeFilter, setActiveFilter] = useState<SearchFilter>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);

  const loadResults = useCallback(async (rawQuery: string) => {
    const currentRequestId = ++requestId.current;
    const term = cleanSearchTerm(rawQuery);
    const pattern = `%${term}%`;

    setIsLoading(true);
    setErrorMessage(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      if (currentRequestId === requestId.current) {
        setResults(emptyResults);
        setErrorMessage("Sign in to explore the NOXA community.");
        setIsLoading(false);
      }
      return;
    }

    let driversQuery = supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url,city")
      .neq("id", authData.user.id)
      .order("display_name", { ascending: true })
      .limit(10);
    let vehiclesQuery = supabase
      .from("vehicles")
      .select("id,brand,model,year,horsepower,color,cover_image_url")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(10);
    let crewsQuery = supabase
      .from("crews")
      .select("id,name,city,description,logo_url,is_public")
      .order("created_at", { ascending: false })
      .limit(10);
    let eventsQuery = supabase
      .from("events")
      .select("id,title,location_name,starts_at,cover_image_url,is_public")
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(10);

    if (term) {
      driversQuery = driversQuery.or(
        `display_name.ilike.${pattern},username.ilike.${pattern},city.ilike.${pattern}`,
      );
      vehiclesQuery = vehiclesQuery.or(
        `brand.ilike.${pattern},model.ilike.${pattern},color.ilike.${pattern}`,
      );
      crewsQuery = crewsQuery.or(
        `name.ilike.${pattern},city.ilike.${pattern},description.ilike.${pattern}`,
      );
      eventsQuery = eventsQuery.or(
        `title.ilike.${pattern},location_name.ilike.${pattern}`,
      );
    }

    const [driversResult, vehiclesResult, crewsResult, eventsResult] =
      await Promise.all([
        driversQuery,
        vehiclesQuery,
        crewsQuery,
        eventsQuery,
      ]);

    if (currentRequestId !== requestId.current) return;

    const firstError = [
      driversResult.error,
      vehiclesResult.error,
      crewsResult.error,
      eventsResult.error,
    ].find(Boolean);

    setResults({
      drivers: (driversResult.data ?? []) as DriverResult[],
      vehicles: (vehiclesResult.data ?? []) as VehicleResult[],
      crews: (crewsResult.data ?? []) as CrewResult[],
      events: (eventsResult.data ?? []) as EventResult[],
    });
    setErrorMessage(
      firstError ? "Some live search results could not be loaded." : null,
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => void loadResults(query),
      query.trim() ? 280 : 0,
    );

    return () => clearTimeout(timer);
  }, [loadResults, query, reloadKey]);

  const hasQuery = query.trim().length > 0;
  const hasAnyResults = useMemo(
    () => Object.values(results).some((items) => items.length > 0),
    [results],
  );
  const showDrivers = activeFilter === "all" || activeFilter === "drivers";
  const showVehicles = activeFilter === "all" || activeFilter === "vehicles";
  const showCrews = activeFilter === "all" || activeFilter === "crews";
  const showEvents = activeFilter === "all" || activeFilter === "events";
  const visibleResultCount =
    (showDrivers ? results.drivers.length : 0) +
    (showVehicles ? results.vehicles.length : 0) +
    (showCrews ? results.crews.length : 0) +
    (showEvents ? results.events.length : 0);

  return (
    <NoxaScreen padded={false}>
      <View style={styles.screen}>
        <SearchHeader loading={isLoading && hasAnyResults} />

        <View style={styles.searchArea}>
          <View style={styles.searchShell}>
            <Ionicons name="search" size={19} color={colors.textMuted} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={80}
              onChangeText={setQuery}
              placeholder="Drivers, vehicles, events, crews…"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setQuery("")}
                style={styles.clearButton}
              >
                <Ionicons name="close" size={15} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.filters}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {filters.map((filter) => (
              <FilterChip
                key={filter.value}
                active={activeFilter === filter.value}
                label={filter.label}
                onPress={() => setActiveFilter(filter.value)}
              />
            ))}
          </ScrollView>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? (
            <ErrorBanner
              message={errorMessage}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          ) : null}

          {isLoading && !hasAnyResults ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading live NOXA results…</Text>
            </View>
          ) : visibleResultCount === 0 ? (
            <NoxaEmptyState
              icon="search-outline"
              title={hasQuery ? "No live matches" : "Nothing to explore yet"}
              body={
                hasQuery
                  ? `No drivers, vehicles, events, or crews match “${query.trim()}”.`
                  : "New public NOXA activity will appear here."
              }
            />
          ) : (
            <>
              {showDrivers && results.drivers.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeading count={results.drivers.length} title="Drivers" />
                  {hasQuery ? (
                    <View style={styles.resultStack}>
                      {results.drivers.map((driver) => (
                        <DriverRow driver={driver} key={driver.id} />
                      ))}
                    </View>
                  ) : (
                    <ScrollView
                      contentContainerStyle={styles.driverStrip}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {results.drivers.map((driver) => (
                        <DriverCard driver={driver} key={driver.id} />
                      ))}
                    </ScrollView>
                  )}
                </View>
              ) : null}

              {showEvents && results.events.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeading count={results.events.length} title="Upcoming events" />
                  <View style={styles.resultStack}>
                    {results.events.map((event) => (
                      <EventRow event={event} key={event.id} />
                    ))}
                  </View>
                </View>
              ) : null}

              {showCrews && results.crews.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeading count={results.crews.length} title="Crews" />
                  <View style={styles.resultStack}>
                    {results.crews.map((crew) => (
                      <CrewRow crew={crew} key={crew.id} />
                    ))}
                  </View>
                </View>
              ) : null}

              {showVehicles && results.vehicles.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeading count={results.vehicles.length} title="Vehicles" />
                  <View style={styles.resultStack}>
                    {results.vehicles.map((vehicle) => (
                      <VehicleRow key={vehicle.id} vehicle={vehicle} />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
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
    letterSpacing: 1.4,
  },
  headerStatus: { width: 40, alignItems: "center" },
  searchArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  searchShell: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  clearButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePressed,
  },
  filters: { gap: spacing.xs, paddingVertical: spacing.sm },
  filterChip: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  filterTextActive: { color: colors.text },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  section: { gap: spacing.sm },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
  },
  sectionCount: {
    color: colors.textSubtle,
    fontSize: typography.caption,
    fontWeight: "800",
  },
  driverStrip: { gap: spacing.sm, paddingRight: spacing.lg },
  driverCard: {
    width: 126,
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.primaryMuted,
  },
  avatarInitials: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  driverCardName: {
    width: "100%",
    color: colors.text,
    textAlign: "center",
    fontSize: typography.caption,
    fontWeight: "900",
  },
  driverCardMeta: {
    width: "100%",
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
  },
  resultStack: {
    overflow: "hidden",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  resultRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  eventCard: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  resultImage: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  resultImageFallback: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
  },
  resultCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  resultSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
  },
  resultType: {
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  retryText: {
    color: colors.primaryHover,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  loadingState: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.huge,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "700",
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
