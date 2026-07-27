import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from "react-native";

import {
  CrewModuleHeader,
  CrewModuleIconButton,
  CrewModuleState,
} from "@/src/components/crew/CrewModuleChrome";
import { NoxaBadge, NoxaScreen } from "@/src/components/ui";
import { initials, uuidPattern } from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type CrewRow = { id: string; name: string };
type MemberRow = { user_id: string };
type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};
type VehicleRow = {
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
  cover_image_url: string | null;
  created_at: string;
};
type CrewVehicle = VehicleRow & { owner?: ProfileRow };

const vehicleSelect =
  "id,owner_id,brand,model,year,horsepower,color,transmission,drivetrain,tuning_stage,cover_image_url,created_at";

function profileName(profile?: ProfileRow) {
  return profile?.display_name || profile?.username || "NOXA driver";
}

function vehicleName(vehicle: VehicleRow) {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
}

function OwnerAvatar({ profile }: { profile?: ProfileRow }) {
  const name = profileName(profile);
  if (profile?.avatar_url) {
    return <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarText}>{initials(name)}</Text>
    </View>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <Text numberOfLines={1} style={styles.specValue}>{value}</Text>
      <Text style={styles.specLabel}>{label}</Text>
    </View>
  );
}

function VehicleCard({ vehicle }: { vehicle: CrewVehicle }) {
  const title = vehicleName(vehicle);
  const artwork = (
    <>
      <View style={styles.artworkShade} />
      <View style={styles.artworkTopRow}>
        <NoxaBadge label="CREW BUILD" variant="primary" />
        {vehicle.tuning_stage ? (
          <View style={styles.stageBadge}>
            <Text style={styles.stageText}>{vehicle.tuning_stage.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.artworkCopy}>
        <Text numberOfLines={1} style={styles.vehicleBrand}>{vehicle.brand}</Text>
        <Text numberOfLines={1} style={styles.vehicleModel}>
          {[vehicle.year, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
        </Text>
      </View>
    </>
  );

  return (
    <Pressable
      accessibilityLabel={`Open ${title}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/vehicle-details", params: { id: vehicle.id } })
      }
      style={({ pressed }) => [styles.vehicleCard, pressed && styles.pressed]}
    >
      {vehicle.cover_image_url ? (
        <ImageBackground
          imageStyle={styles.artworkRadius as ImageStyle}
          resizeMode="cover"
          source={{ uri: vehicle.cover_image_url }}
          style={styles.artwork}
        >
          {artwork}
        </ImageBackground>
      ) : (
        <View style={[styles.artwork, styles.artworkFallback]}>
          <Ionicons name="car-sport" size={84} color={colors.primaryMuted} />
          {artwork}
        </View>
      )}

      <View style={styles.ownerRow}>
        <OwnerAvatar profile={vehicle.owner} />
        <View style={styles.ownerCopy}>
          <Text style={styles.ownerEyebrow}>CREW DRIVER</Text>
          <Text numberOfLines={1} style={styles.ownerName}>{profileName(vehicle.owner)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
      </View>

      <View style={styles.specRow}>
        <Spec label="POWER" value={`${vehicle.horsepower} HP`} />
        <Spec label="DRIVETRAIN" value={vehicle.drivetrain || "—"} />
        <Spec label="COLOR" value={vehicle.color} />
      </View>
    </Pressable>
  );
}

export default function CrewGarageScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const crewId = typeof params.id === "string" ? params.id : "";
  const loadedRef = useRef(false);
  const [crew, setCrew] = useState<CrewRow | null>(null);
  const [vehicles, setVehicles] = useState<CrewVehicle[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [canView, setCanView] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGarage = useCallback(async (showSpinner = true) => {
    if (showSpinner && !loadedRef.current) setLoading(true);
    setError(null);
    if (!uuidPattern.test(crewId)) {
      setError("Invalid crew link.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (authError || !userId) {
      setError("Sign in to open the crew garage.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [crewResult, membershipResult] = await Promise.all([
      supabase.from("crews").select("id,name").eq("id", crewId).maybeSingle(),
      supabase
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crewId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (crewResult.error || !crewResult.data) {
      setError(crewResult.error?.message ?? "Crew not found.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setCrew(crewResult.data as CrewRow);
    const allowed = !membershipResult.error && Boolean(membershipResult.data);
    setCanView(allowed);
    if (!allowed) {
      setVehicles([]);
      setLoading(false);
      setRefreshing(false);
      loadedRef.current = true;
      return;
    }

    const { data: memberRows, error: membersError } = await supabase
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crewId);
    if (membersError) {
      setError(membersError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const memberIds = ((memberRows ?? []) as MemberRow[]).map((row) => row.user_id);
    setMemberCount(memberIds.length);
    if (!memberIds.length) {
      setVehicles([]);
      setLoading(false);
      setRefreshing(false);
      loadedRef.current = true;
      return;
    }

    const [profilesResult, vehiclesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .in("id", memberIds),
      supabase
        .from("vehicles")
        .select(vehicleSelect)
        .in("owner_id", memberIds)
        .eq("is_public", true)
        .order("created_at", { ascending: false }),
    ]);

    if (profilesResult.error || vehiclesResult.error) {
      setError(profilesResult.error?.message ?? vehiclesResult.error?.message ?? "Garage unavailable.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const profiles = new Map(
      ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
    );
    setVehicles(
      ((vehiclesResult.data ?? []) as VehicleRow[]).map((vehicle) => ({
        ...vehicle,
        owner: profiles.get(vehicle.owner_id),
      })),
    );
    loadedRef.current = true;
    setLoading(false);
    setRefreshing(false);
  }, [crewId]);

  useFocusEffect(
    useCallback(() => {
      void loadGarage();
    }, [loadGarage]),
  );

  const visibleVehicles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return vehicles;
    return vehicles.filter((vehicle) =>
      [
        vehicle.brand,
        vehicle.model,
        vehicle.year,
        vehicle.color,
        vehicle.tuning_stage,
        profileName(vehicle.owner),
        vehicle.owner?.username,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, vehicles]);

  const driversWithCars = useMemo(
    () => new Set(vehicles.map((vehicle) => vehicle.owner_id)).size,
    [vehicles],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadGarage(false);
  }, [loadGarage]);

  return (
    <NoxaScreen padded={false}>
      <CrewModuleHeader
        badge="MEMBERS"
        right={
          <CrewModuleIconButton
            disabled={refreshing}
            icon="refresh"
            label="Refresh crew garage"
            onPress={onRefresh}
          />
        }
        subtitle={crew?.name ?? "NOXA crew"}
        title="CREW GARAGE"
      />

      {loading ? (
        <CrewModuleState
          icon="car-sport-outline"
          loading
          message="Collecting the crew's public builds."
          title="Loading garage"
        />
      ) : error ? (
        <CrewModuleState
          actionLabel="Retry"
          icon="cloud-offline-outline"
          message={error}
          onAction={() => void loadGarage()}
          title="Garage unavailable"
        />
      ) : !canView ? (
        <CrewModuleState
          icon="lock-closed-outline"
          message="Join this crew to view member builds and driver details."
          title="Members only"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              onRefresh={onRefresh}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>SHARED COLLECTION</Text>
            <Text style={styles.introTitle}>BUILT BY THE CREW</Text>
            <Text style={styles.introText}>
              Public vehicles from current members, kept together in one private crew view.
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryValue}>{vehicles.length}</Text>
                <Text style={styles.summaryLabel}>BUILDS</Text>
              </View>
              <View style={[styles.summaryCell, styles.summaryBorder]}>
                <Text style={styles.summaryValue}>{driversWithCars}</Text>
                <Text style={styles.summaryLabel}>DRIVERS</Text>
              </View>
              <View style={[styles.summaryCell, styles.summaryBorder]}>
                <Text style={styles.summaryValue}>{memberCount}</Text>
                <Text style={styles.summaryLabel}>MEMBERS</Text>
              </View>
            </View>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              autoCapitalize="none"
              onChangeText={setQuery}
              placeholder="Search build or driver"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable
                accessibilityLabel="Clear garage search"
                accessibilityRole="button"
                onPress={() => setQuery("")}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {visibleVehicles.length ? (
            <View style={styles.vehicleList}>
              <View style={styles.listHeading}>
                <Text style={styles.listTitle}>PUBLIC BUILDS</Text>
                <Text style={styles.listCount}>{visibleVehicles.length} CARS</Text>
              </View>
              {visibleVehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </View>
          ) : (
            <CrewModuleState
              actionLabel={query ? "Clear search" : "Add public vehicle"}
              icon="car-sport-outline"
              message={
                query
                  ? "No crew build matches this search."
                  : "No member has shared a public vehicle yet."
              }
              onAction={() => query ? setQuery("") : router.push("/vehicle-editor")}
              title={query ? "No matches" : "Garage is empty"}
            />
          )}
        </ScrollView>
      )}
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  intro: {
    overflow: "hidden",
    padding: spacing.lg,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  introTitle: {
    marginTop: spacing.xxs,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  introText: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700",
    lineHeight: 19,
  },
  summaryRow: {
    minHeight: 66,
    flexDirection: "row",
    marginTop: spacing.lg,
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  summaryCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryBorder: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  summaryValue: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
  },
  summaryLabel: { color: colors.textSubtle, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  searchBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  vehicleList: { gap: spacing.md },
  listHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listTitle: { color: colors.text, fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  listCount: { color: colors.textSubtle, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  vehicleCard: {
    overflow: "hidden",
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  artwork: { height: 190, justifyContent: "flex-end", backgroundColor: colors.surfaceSoft },
  artworkRadius: { borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero },
  artworkFallback: { alignItems: "center", justifyContent: "center" },
  artworkShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,6,10,0.42)" },
  artworkTopRow: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stageBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(6,6,10,0.72)",
  },
  stageText: { color: colors.text, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  artworkCopy: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md },
  vehicleBrand: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  vehicleModel: { marginTop: 2, color: "rgba(240,240,244,0.72)", fontSize: 13, fontWeight: "800" },
  ownerRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatar: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.surfaceSoft },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  ownerCopy: { flex: 1, minWidth: 0 },
  ownerEyebrow: { color: colors.primaryHover, fontSize: 7, fontWeight: "900", letterSpacing: 0.75 },
  ownerName: { marginTop: 2, color: colors.text, fontSize: 13, fontWeight: "800" },
  specRow: { minHeight: 70, flexDirection: "row" },
  spec: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xs },
  specValue: { color: colors.text, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  specLabel: { marginTop: 3, color: colors.textSubtle, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.988 }] },
});
