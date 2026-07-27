import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NoxaButton, NoxaScreen } from "@/src/components/ui";
import { initials, uuidPattern } from "@/src/lib/eventExperience";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

const eventGalleryBucket = "event-gallery";
const maxImageBytes = 10 * 1024 * 1024;
const supportedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

type EventRow = { id: string; title: string; creator_id: string };
type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};
type GalleryItemRow = {
  id: string;
  event_id: string;
  uploader_id: string;
  object_path: string;
  caption: string | null;
  created_at: string;
};
type GalleryItem = GalleryItemRow & {
  signedUrl: string;
  uploader: ProfileRow | undefined;
};

function profileName(profile?: ProfileRow) {
  return profile?.display_name || profile?.username || "NOXA driver";
}

function normalizeMimeType(mimeType?: string | null) {
  return mimeType?.toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : mimeType?.toLowerCase();
}

function safeExtension(asset: ImagePicker.ImagePickerAsset, contentType: string) {
  const fileExtension = asset.fileName?.split(".").pop()?.toLowerCase();
  const uriExtension = asset.uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  const candidate = fileExtension || uriExtension;
  if (candidate && ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(candidate)) {
    return candidate === "jpg" ? "jpeg" : candidate;
  }
  return contentType.split("/")[1] ?? "jpeg";
}

export default function EventGalleryScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === "string" ? params.id : "";
  const [event, setEvent] = useState<EventRow | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canUpload, setCanUpload] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = useMemo(
    () => Boolean(event && currentUserId === event.creator_id),
    [currentUserId, event],
  );

  const loadItems = useCallback(async () => {
    if (!uuidPattern.test(eventId)) return;
    const { data, error: itemsError } = await supabase
      .from("event_gallery_items")
      .select("id,event_id,uploader_id,object_path,caption,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(120);
    if (itemsError) {
      setError(itemsError.message);
      return;
    }
    const rows = (data ?? []) as GalleryItemRow[];
    const uploaderIds = Array.from(new Set(rows.map((item) => item.uploader_id)));
    const profileResult = uploaderIds.length
      ? await supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .in("id", uploaderIds)
      : { data: [], error: null };
    if (profileResult.error) {
      setError(profileResult.error.message);
      return;
    }
    const profiles = new Map(
      ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
    );
    const signed = await Promise.all(
      rows.map(async (item) => {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(eventGalleryBucket)
          .createSignedUrl(item.object_path, 60 * 60);
        if (signedError || !signedData?.signedUrl) return null;
        return {
          ...item,
          signedUrl: signedData.signedUrl,
          uploader: profiles.get(item.uploader_id),
        } satisfies GalleryItem;
      }),
    );
    setItems(signed.filter((item): item is GalleryItem => Boolean(item)));
  }, [eventId]);

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!uuidPattern.test(eventId)) {
      setError("Invalid event link.");
      setLoading(false);
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (authError || !userId) {
      setError("Sign in to open the event gallery.");
      setLoading(false);
      return;
    }
    setCurrentUserId(userId);
    const [eventResult, attendanceResult] = await Promise.all([
      supabase
        .from("events")
        .select("id,title,creator_id")
        .eq("id", eventId)
        .maybeSingle(),
      supabase
        .from("event_attendees")
        .select("event_id")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (eventResult.error || !eventResult.data) {
      setError(eventResult.error?.message ?? "Event not found.");
      setLoading(false);
      return;
    }
    setEvent(eventResult.data as EventRow);
    setCanUpload(!attendanceResult.error && Boolean(attendanceResult.data));
    await loadItems();
    setLoading(false);
  }, [eventId, loadItems]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const chooseImage = useCallback(async () => {
    if (!canUpload || uploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access to add an event photo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      allowsEditing: false,
      quality: 0.88,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingAsset(result.assets[0]);
      setCaption("");
      setError(null);
    }
  }, [canUpload, uploading]);

  const uploadImage = useCallback(async () => {
    if (!pendingAsset || !currentUserId || uploading) return;
    const cleanCaption = caption.trim();
    if (cleanCaption.length > 500) {
      setError("Caption must be 500 characters or less.");
      return;
    }
    setUploading(true);
    setError(null);
    let uploadedPath: string | null = null;
    try {
      const contentType = normalizeMimeType(pendingAsset.mimeType);
      if (
        !contentType
        || !supportedMimeTypes.includes(contentType as (typeof supportedMimeTypes)[number])
      ) {
        throw new Error("Choose a JPEG, PNG, WEBP, HEIC, or HEIF image.");
      }
      const arrayBuffer = await fetch(pendingAsset.uri).then((response) => response.arrayBuffer());
      if (arrayBuffer.byteLength > maxImageBytes) {
        throw new Error("Choose an image smaller than 10 MB.");
      }
      const extension = safeExtension(pendingAsset, contentType);
      const suffix = Math.random().toString(36).slice(2, 10);
      uploadedPath = `${currentUserId}/${eventId}/${Date.now()}-${suffix}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(eventGalleryBucket)
        .upload(uploadedPath, arrayBuffer, {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { error: rowError } = await supabase.from("event_gallery_items").insert({
        event_id: eventId,
        uploader_id: currentUserId,
        object_path: uploadedPath,
        caption: cleanCaption || null,
      });
      if (rowError) throw rowError;
      uploadedPath = null;
      setPendingAsset(null);
      setCaption("");
      await loadItems();
    } catch (uploadError) {
      if (uploadedPath) {
        await supabase.storage.from(eventGalleryBucket).remove([uploadedPath]);
      }
      setError(
        uploadError instanceof Error ? uploadError.message : "Photo could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }, [caption, currentUserId, eventId, loadItems, pendingAsset, uploading]);

  const confirmDelete = useCallback(() => {
    if (!selectedItem || deleting) return;
    Alert.alert("Remove photo?", "This removes the photo from the event gallery.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          setError(null);
          const { error: storageError } = await supabase.storage
            .from(eventGalleryBucket)
            .remove([selectedItem.object_path]);
          if (storageError) {
            setError(storageError.message);
            setDeleting(false);
            return;
          }
          const { error: rowError } = await supabase
            .from("event_gallery_items")
            .delete()
            .eq("id", selectedItem.id);
          if (rowError) setError(rowError.message);
          else {
            setSelectedItem(null);
            await loadItems();
          }
          setDeleting(false);
        },
      },
    ]);
  }, [deleting, loadItems, selectedItem]);

  return (
    <NoxaScreen padded={false}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={21} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>EVENT GALLERY</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>{event?.title ?? "NOXA event"}</Text>
        </View>
        <Text style={styles.photoCount}>{items.length} PHOTOS</Text>
        {canUpload ? (
          <Pressable
            accessibilityLabel="Add event photo"
            accessibilityRole="button"
            onPress={() => void chooseImage()}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading event photos…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.latestBar}>
            <Text style={styles.latestActive}>LATEST</Text>
            <Text style={styles.latestHint}>
              {canUpload ? "Participant uploads" : "RSVP to add photos"}
            </Text>
          </View>

          {pendingAsset ? (
            <View style={styles.uploadCard}>
              <Image source={{ uri: pendingAsset.uri }} style={styles.uploadPreview} />
              <View style={styles.uploadFields}>
                <Text style={styles.uploadTitle}>NEW EVENT PHOTO</Text>
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  editable={!uploading}
                  maxLength={500}
                  placeholder="Add a caption…"
                  placeholderTextColor={colors.textSubtle}
                  selectionColor={colors.primary}
                  style={styles.captionInput}
                />
                <View style={styles.uploadActions}>
                  <NoxaButton
                    title="CANCEL"
                    size="sm"
                    variant="secondary"
                    disabled={uploading}
                    onPress={() => {
                      setPendingAsset(null);
                      setCaption("");
                    }}
                  />
                  <NoxaButton
                    title="UPLOAD"
                    size="sm"
                    loading={uploading}
                    onPress={() => void uploadImage()}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="images-outline" size={32} color={colors.primaryHover} />
              </View>
              <Text style={styles.emptyTitle}>NO EVENT PHOTOS YET</Text>
              <Text style={styles.emptyText}>
                {canUpload
                  ? "Add the first real moment from this event."
                  : "Participant photos will appear here."}
              </Text>
              {canUpload ? (
                <NoxaButton title="ADD A PHOTO" onPress={() => void chooseImage()} />
              ) : null}
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map((item, index) => {
                const wide = index % 5 === 0;
                return (
                  <Pressable
                    accessibilityLabel={item.caption || "Open event photo"}
                    accessibilityRole="imagebutton"
                    key={item.id}
                    onPress={() => setSelectedItem(item)}
                    style={({ pressed }) => [
                      styles.tile,
                      wide && styles.tileWide,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Image source={{ uri: item.signedUrl }} style={styles.tileImage} />
                    <View style={styles.tileShade} />
                    <View style={styles.tileMeta}>
                      <View style={styles.ownerRow}>
                        {item.uploader?.avatar_url ? (
                          <Image source={{ uri: item.uploader.avatar_url }} style={styles.miniAvatar} />
                        ) : (
                          <View style={[styles.miniAvatar, styles.avatarFallback]}>
                            <Text style={styles.miniInitials}>
                              {initials(profileName(item.uploader))}
                            </Text>
                          </View>
                        )}
                        <Text numberOfLines={1} style={styles.ownerName}>
                          {profileName(item.uploader).split(" ")[0]}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        animationType="fade"
        visible={selectedItem !== null}
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.lightbox}>
          <View style={styles.lightboxHeader}>
            <Pressable
              accessibilityLabel="Close photo"
              onPress={() => setSelectedItem(null)}
              style={styles.lightboxButton}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.lightboxTitle}>EVENT PHOTO</Text>
            {selectedItem
            && (selectedItem.uploader_id === currentUserId || isHost) ? (
              <Pressable
                accessibilityLabel="Remove photo"
                disabled={deleting}
                onPress={confirmDelete}
                style={styles.lightboxButton}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.primaryHover} />
                ) : (
                  <Ionicons name="trash-outline" size={20} color={colors.primaryHover} />
                )}
              </Pressable>
            ) : <View style={styles.lightboxButton} />}
          </View>
          {selectedItem ? (
            <>
              <View style={styles.lightboxImageWrap}>
                <Image
                  resizeMode="contain"
                  source={{ uri: selectedItem.signedUrl }}
                  style={styles.lightboxImage}
                />
              </View>
              <View style={styles.lightboxDetails}>
                {selectedItem.uploader?.avatar_url ? (
                  <Image source={{ uri: selectedItem.uploader.avatar_url }} style={styles.detailAvatar} />
                ) : (
                  <View style={[styles.detailAvatar, styles.avatarFallback]}>
                    <Text style={styles.detailInitials}>
                      {initials(profileName(selectedItem.uploader))}
                    </Text>
                  </View>
                )}
                <View style={styles.lightboxCopy}>
                  <Text style={styles.detailName}>{profileName(selectedItem.uploader)}</Text>
                  {selectedItem.caption ? (
                    <Text style={styles.detailCaption}>{selectedItem.caption}</Text>
                  ) : (
                    <Text style={styles.detailCaptionMuted}>No caption</Text>
                  )}
                </View>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surfaceBase,
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  headerCopy: { flex: 1 },
  headerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  headerSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  photoCount: { color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  addButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  content: { padding: spacing.sm, paddingBottom: spacing.xxl },
  latestBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xxs,
  },
  latestActive: { color: colors.text, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  latestHint: { color: colors.textSubtle, fontSize: 10, fontWeight: "700" },
  uploadCard: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
  },
  uploadPreview: { width: 96, height: 112, borderRadius: radius.md, backgroundColor: colors.surfaceSoft },
  uploadFields: { flex: 1, gap: spacing.xs },
  uploadTitle: { color: colors.primaryHover, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  captionInput: {
    minHeight: 52,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontSize: 12,
  },
  uploadActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 },
  tile: {
    width: "49%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
  },
  tileWide: { width: "100%", aspectRatio: 16 / 7 },
  tileImage: { width: "100%", height: "100%" },
  tileShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 62,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  tileMeta: { position: "absolute", left: spacing.xs, right: spacing.xs, bottom: spacing.xs },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  miniAvatar: { width: 19, height: 19, borderRadius: radius.pill },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
  },
  miniInitials: { color: colors.text, fontSize: 6, fontWeight: "900" },
  ownerName: { maxWidth: "70%", color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "700" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  stateText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  empty: { minHeight: 430, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyIcon: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  errorCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: { color: colors.primaryHover, fontSize: 11, fontWeight: "700" },
  lightbox: { flex: 1, backgroundColor: "#000" },
  lightboxHeader: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    backgroundColor: "#000",
  },
  lightboxButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  lightboxTitle: { color: colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  lightboxImageWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.sm },
  lightboxImage: { width: "100%", height: "100%" },
  lightboxDetails: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  detailAvatar: { width: 38, height: 38, borderRadius: radius.pill },
  detailInitials: { color: colors.text, fontSize: 11, fontWeight: "900" },
  lightboxCopy: { flex: 1, gap: spacing.xxs },
  detailName: { color: colors.text, fontSize: 13, fontWeight: "900" },
  detailCaption: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  detailCaptionMuted: { color: colors.textSubtle, fontSize: 13 },
  pressed: { opacity: 0.86, transform: [{ translateY: 1 }, { scale: 0.985 }] },
});
