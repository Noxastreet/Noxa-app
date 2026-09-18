import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CrewModuleHeader,
  CrewModuleIconButton,
  CrewModuleState,
} from "@/src/components/crew/CrewModuleChrome";
import { NoxaScreen } from "@/src/components/ui";
import { initials, uuidPattern } from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";

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
  vehicle_type: "car" | "motorcycle";
  brand: string;
  model: string | null;
  year: number | null;
  horsepower: number | null;
  color: string;
  transmission: string | null;
  drivetrain: string | null;
  tuning_stage: string | null;
  cover_image_url: string | null;
  created_at: string;
};
type CrewVehicle = VehicleRow & { owner?: ProfileRow };

const vehicleSelect =
  "id,owner_id,vehicle_type,brand,model,year,horsepower,color,transmission,drivetrain,tuning_stage,cover_image_url,created_at";

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

function VehicleFallback({ vehicleType }: { vehicleType: VehicleRow["vehicle_type"] }) {
  if (vehicleType === "motorcycle") {
    return <FontAwesome5 name="motorcycle" size={28} color={colors.textMuted} />;
  }

  return <Ionicons name="car-sport" size={30} color={colors.textMuted} />;
}

function VehicleCard({ vehicle }: { vehicle: CrewVehicle }) {
  const title = vehicleName(vehicle);
  const meta = [
    vehicle.year,
    vehicle.vehicle_type === "motorcycle" ? "Motorcycle" : "Car",
    vehicle.horsepower === null ? null : `${vehicle.horsepower} HP`,
    vehicle.tuning_stage && vehicle.tuning_stage.trim() !== "-1" ? vehicle.tuning_stage : null,
  ].filter(Boolean).join(" · ");

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
        <Image
          resizeMode="cover"
          source={{ uri: vehicle.cover_image_url }}
          style={styles.vehicleThumbnail}
        />
      ) : (
        <View style={[styles.vehicleThumbnail, styles.artworkFallback]}>
          <VehicleFallback vehicleType={vehicle.vehicle_type} />
        </View>
      )}

      <View style={styles.vehicleCopy}>
        <Text numberOfLines={1} style={styles.vehicleTitle}>{title}</Text>
        {meta ? <Text numberOfLines={1} style={styles.vehicleMeta}>{meta}</Text> : null}
        <View style={styles.ownerInline}>
          <OwnerAvatar profile={vehicle.owner} />
          <Text numberOfLines={1} style={styles.ownerName}>{profileName(vehicle.owner)}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadGarage(false);
  }, [loadGarage]);

  return (
    <NoxaScreen padded={false}>
      <CrewModuleHeader
        badge="Members"
        right={
          <CrewModuleIconButton
            disabled={refreshing}
            icon="refresh"
            label="Refresh crew garage"
            onPress={onRefresh}
          />
        }
        subtitle={crew ? `${crew.name} · ${memberCount} members` : "NOXA crew"}
        title="Crew Garage"
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
              onAction={() => query ? setQuery("") : router.push("/vehicle-picker")}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
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
  vehicleList: { gap: 0 },
  vehicleCard: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  vehicleThumbnail: {
    width: 84,
    height: 64,
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
  },
  artworkFallback: { alignItems: "center", justifyContent: "center" },
  vehicleCopy: { flex: 1, minWidth: 0 },
  vehicleTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "600" },
  vehicleMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: "500" },
  ownerInline: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  avatar: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.surfaceSoft },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.text, fontSize: 7, fontWeight: "700" },
  ownerName: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: "500" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.988 }] },
});