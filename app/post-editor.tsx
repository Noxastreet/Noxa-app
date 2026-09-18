import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NoxaButton, NoxaIconButton, NoxaInput, NoxaScreen, NoxaTopBar } from "@/src/components/ui";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing, typography } from "@/src/theme";

const postImagesBucket = "post-images";
const maxPostImageBytes = 10 * 1024 * 1024;
const supportedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

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

export default function PostEditorScreen() {
  const navigation = useNavigation();
  const publishingRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPublish = useMemo(
    () => Boolean(imageAsset && !publishing),
    [imageAsset, publishing],
  );

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (!publishingRef.current || allowNavigationRef.current) return;
        event.preventDefault();
      }),
    [navigation],
  );

  const chooseImage = useCallback(async () => {
    if (publishing) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access to choose an image for this post.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.84,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImageAsset(result.assets[0]);
      setError(null);
    }
  }, [publishing]);

  const publishPost = useCallback(async () => {
    if (!imageAsset || publishing) return;

    const cleanCaption = caption.trim();
    const cleanLocation = locationName.trim();
    if (cleanCaption.length > 2200) {
      setError("Caption must be 2,200 characters or less.");
      return;
    }
    if (cleanLocation.length > 160) {
      setError("Location must be 160 characters or less.");
      return;
    }

    publishingRef.current = true;
    allowNavigationRef.current = false;
    setPublishing(true);
    setError(null);
    let uploadedPath: string | null = null;

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (authError || !userId) throw new Error("Sign in to publish a post.");

      const contentType = normalizeMimeType(imageAsset.mimeType);
      if (
        !contentType ||
        !supportedMimeTypes.includes(contentType as (typeof supportedMimeTypes)[number])
      ) {
        throw new Error("Choose a JPEG, PNG, WEBP, HEIC, or HEIF image.");
      }

      const arrayBuffer = await fetch(imageAsset.uri).then((response) => response.arrayBuffer());
      if (arrayBuffer.byteLength > maxPostImageBytes) {
        throw new Error("Choose an image smaller than 10 MB.");
      }

      const extension = safeExtension(imageAsset, contentType);
      const suffix = Math.random().toString(36).slice(2, 10);
      uploadedPath = `${userId}/${Date.now()}-${suffix}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(postImagesBucket)
        .upload(uploadedPath, arrayBuffer, {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(postImagesBucket)
        .getPublicUrl(uploadedPath);
      if (!publicUrlData.publicUrl.startsWith("https://")) {
        throw new Error("The post image URL could not be created.");
      }

      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          author_id: userId,
          image_url: publicUrlData.publicUrl,
          caption: cleanCaption || null,
          location_name: cleanLocation || null,
          is_public: true,
        })
        .select("id")
        .single();
      if (postError || !post) throw postError ?? new Error("Post could not be created.");

      uploadedPath = null;
      allowNavigationRef.current = true;
      publishingRef.current = false;
      setPublishing(false);
      router.replace({ pathname: "/post-details", params: { id: post.id } });
    } catch (publishError) {
      if (uploadedPath) {
        await supabase.storage.from(postImagesBucket).remove([uploadedPath]);
      }
      setError(
        publishError instanceof Error ? publishError.message : "Post could not be published.",
      );
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }, [caption, imageAsset, locationName, publishing]);

  return (
    <NoxaScreen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}>
        <View style={styles.header}>
          <NoxaTopBar
            left={
              <NoxaIconButton
                accessibilityLabel="Go back"
                disabled={publishing}
                icon="chevron-back"
                onPress={() => router.back()}
                variant="ghost"
              />
            }
            subtitle="Share your NOXA moment"
            title="New Post"
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityLabel={imageAsset ? "Change post image" : "Choose post image"}
            accessibilityRole="button"
            disabled={publishing}
            onPress={() => void chooseImage()}
            style={({ pressed }) => [styles.imageCard, pressed && styles.pressed]}>
            {imageAsset ? (
              <Image source={{ uri: imageAsset.uri }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imageEmpty}>
                <View style={styles.imageIcon}>
                  <Ionicons name="images-outline" size={31} color={colors.primaryHover} />
                </View>
                <Text style={styles.imageTitle}>Choose a photo</Text>
                <Text style={styles.imageCaption}>Square crop · up to 10 MB</Text>
              </View>
            )}
            {imageAsset ? (
              <View style={styles.changeBadge}>
                <Ionicons name="camera-outline" size={15} color={colors.text} />
                <Text style={styles.changeText}>Change</Text>
              </View>
            ) : null}
          </Pressable>

          <View style={styles.sectionCard}>
            <Text style={styles.eyebrow}>Post details</Text>
            <NoxaInput
              label="Caption"
              maxLength={2200}
              multiline
              onChangeText={setCaption}
              placeholder="Tell the story behind this moment…"
              style={styles.captionInput}
              value={caption}
            />
            <Text style={styles.counter}>{caption.length} / 2200</Text>
            <NoxaInput
              label="Location"
              maxLength={160}
              onChangeText={setLocationName}
              placeholder="Thessaloniki, Greece"
              value={locationName}
            />
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.primaryHover} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <NoxaButton
            disabled={!canPublish}
            fullWidth
            loading={publishing}
            onPress={() => void publishPost()}
            title="Publish post"
          />
        </View>
      </KeyboardAvoidingView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  content: { padding: spacing.lg, paddingBottom: 118, gap: spacing.lg },
  imageCard: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  imagePreview: { width: "100%", height: "100%" },
  imageEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  imageIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  imageTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "600" },
  imageCaption: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  changeBadge: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.glass,
  },
  changeText: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  sectionCard: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  eyebrow: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  captionInput: { minHeight: 118, paddingTop: spacing.md, textAlignVertical: "top" },
  counter: { marginTop: -spacing.sm, color: colors.textSubtle, fontSize: 9, fontWeight: "800", textAlign: "right" },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: { flex: 1, color: colors.primaryHover, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.glass,
  },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }, { scale: 0.99 }] },
});
