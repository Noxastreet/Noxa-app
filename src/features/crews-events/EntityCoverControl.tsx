import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import {
  chooseCoverAsset,
  removeEntityCoverObject,
  removeUploadedEntityCover,
  setEntityCover,
  uploadEntityCover,
  type CoverEntityKind,
} from "@/src/lib/entityCover";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows } from "@/src/theme";

type Props = {
  kind: CoverEntityKind;
  entityId: string;
  onChanged: () => void;
};

type EntityPermission = {
  canManage: boolean;
  currentCoverUrl: string | null;
  isCreator: boolean;
};

const emptyPermission: EntityPermission = {
  canManage: false,
  currentCoverUrl: null,
  isCreator: false,
};

export function EntityCoverControl({ kind, entityId, onChanged }: Props) {
  const [permission, setPermission] = useState<EntityPermission>(emptyPermission);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadPermission = useCallback(async () => {
    setLoading(true);
    setPermission(emptyPermission);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId || !entityId) {
      setLoading(false);
      return;
    }

    if (kind === "crew") {
      const [crewResult, membershipResult] = await Promise.all([
        supabase
          .from("crews")
          .select("owner_id,cover_image_url")
          .eq("id", entityId)
          .maybeSingle(),
        supabase
          .from("crew_members")
          .select("role")
          .eq("crew_id", entityId)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const role = membershipResult.data?.role;
      const isOwner = crewResult.data?.owner_id === userId || role === "owner";
      setPermission({
        canManage: isOwner || role === "admin",
        currentCoverUrl: crewResult.data?.cover_image_url ?? null,
        isCreator: isOwner,
      });
      setLoading(false);
      return;
    }

    const { data: eventData } = await supabase
      .from("events")
      .select("creator_id,crew_id,cover_image_url")
      .eq("id", entityId)
      .maybeSingle();

    if (!eventData) {
      setLoading(false);
      return;
    }

    const isCreator = eventData.creator_id === userId;
    let isCrewManager = false;
    if (!isCreator && eventData.crew_id) {
      const { data: membership } = await supabase
        .from("crew_members")
        .select("role")
        .eq("crew_id", eventData.crew_id)
        .eq("user_id", userId)
        .maybeSingle();
      isCrewManager = membership?.role === "owner" || membership?.role === "admin";
    }

    setPermission({
      canManage: isCreator || isCrewManager,
      currentCoverUrl: eventData.cover_image_url ?? null,
      isCreator,
    });
    setLoading(false);
  }, [entityId, kind]);

  useEffect(() => {
    void loadPermission();
  }, [loadPermission]);

  const replaceCover = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const asset = await chooseCoverAsset();
      if (!asset) return;

      const uploaded = await uploadEntityCover(asset, kind, entityId);
      try {
        await setEntityCover(kind, entityId, uploaded.publicUrl);
      } catch (error) {
        await removeUploadedEntityCover(uploaded.path);
        throw error;
      }

      await removeEntityCoverObject(
        permission.currentCoverUrl,
        kind,
        entityId,
      );
      setPermission((current) => ({
        ...current,
        currentCoverUrl: uploaded.publicUrl,
      }));
      onChanged();
    } catch (error) {
      Alert.alert(
        "Cover not changed",
        error instanceof Error ? error.message : "Unable to change this cover.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, entityId, kind, onChanged, permission.currentCoverUrl]);

  const removeCover = useCallback(async () => {
    if (busy || !permission.currentCoverUrl) return;
    setBusy(true);
    try {
      const previous = permission.currentCoverUrl;
      await setEntityCover(kind, entityId, null);
      await removeEntityCoverObject(previous, kind, entityId);
      setPermission((current) => ({ ...current, currentCoverUrl: null }));
      onChanged();
    } catch (error) {
      Alert.alert(
        "Cover not removed",
        error instanceof Error ? error.message : "Unable to remove this cover.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, entityId, kind, onChanged, permission.currentCoverUrl]);

  const openMenu = useCallback(() => {
    if (!permission.canManage || busy) return;
    const actions: Parameters<typeof Alert.alert>[2] = [
      {
        text: permission.currentCoverUrl ? "Change cover" : "Choose cover",
        onPress: () => void replaceCover(),
      },
    ];
    if (permission.currentCoverUrl) {
      actions.push({
        text: "Remove cover",
        style: "destructive",
        onPress: () => void removeCover(),
      });
    }
    actions.push({ text: "Cancel", style: "cancel" });
    Alert.alert(
      kind === "crew" ? "Crew cover" : "Event cover",
      "Only authorized organizers can change this image.",
      actions,
    );
  }, [
    busy,
    kind,
    permission.canManage,
    permission.currentCoverUrl,
    removeCover,
    replaceCover,
  ]);

  if (loading || !permission.canManage) return null;

  const eventRight = permission.isCreator ? 164 : 116;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        { right: kind === "crew" ? 68 : eventRight },
      ]}
    >
      <Pressable
        accessibilityLabel={
          kind === "crew" ? "Change crew cover" : "Change event cover"
        }
        accessibilityRole="button"
        disabled={busy}
        onPress={openMenu}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          busy && styles.disabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <Ionicons name="camera-outline" size={18} color={colors.text} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 9,
    zIndex: 30,
  },
  button: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
