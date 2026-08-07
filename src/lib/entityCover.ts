import * as ImagePicker from "expo-image-picker";

import { supabase } from "@/src/lib/supabase";

export type CoverEntityKind = "crew" | "event";

const entityCoversBucket = "entity-covers";
const maxCoverImageBytes = 6 * 1024 * 1024;
const supportedCoverMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

type UploadedCoverImage = {
  path: string;
  publicUrl: string;
};

function normalizeMimeType(mimeType?: string | null) {
  return mimeType?.toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : mimeType?.toLowerCase();
}

function getSafeExtension(
  asset: ImagePicker.ImagePickerAsset,
  contentType: string,
) {
  const fromFileName = asset.fileName?.split(".").pop()?.toLowerCase();
  const fromUri = asset.uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  const candidate = fromFileName || fromUri;

  if (
    candidate &&
    ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(candidate)
  ) {
    return candidate === "jpg" ? "jpeg" : candidate;
  }

  return contentType.split("/")[1] ?? "jpeg";
}

function getOwnedEntityCoverPath(
  publicUrl: string | null,
  kind: CoverEntityKind,
  entityId: string,
) {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${entityCoversBucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    const [folderKind, folderId] = path.split("/");
    const expectedKind = kind === "crew" ? "crews" : "events";
    return folderKind === expectedKind && folderId === entityId ? path : null;
  } catch {
    return null;
  }
}

export async function chooseCoverAsset() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library access is required to choose a cover image.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: false,
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.8,
    exif: false,
  });

  return result.canceled ? null : (result.assets[0] ?? null);
}

export async function uploadEntityCover(
  asset: ImagePicker.ImagePickerAsset,
  kind: CoverEntityKind,
  entityId: string,
): Promise<UploadedCoverImage> {
  const contentType = normalizeMimeType(asset.mimeType);
  if (
    !contentType ||
    !supportedCoverMimeTypes.includes(
      contentType as (typeof supportedCoverMimeTypes)[number],
    )
  ) {
    throw new Error("Choose a JPEG, PNG, WEBP, HEIC, or HEIF image.");
  }

  const arrayBuffer = await fetch(asset.uri).then((response) =>
    response.arrayBuffer(),
  );
  if (arrayBuffer.byteLength > maxCoverImageBytes) {
    throw new Error("Choose an image smaller than 6 MB.");
  }

  const extension = getSafeExtension(asset, contentType);
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const folderKind = kind === "crew" ? "crews" : "events";
  const path = `${folderKind}/${entityId}/${Date.now()}-${randomSuffix}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(entityCoversBucket)
    .upload(path, arrayBuffer, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(entityCoversBucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function setEntityCover(
  kind: CoverEntityKind,
  entityId: string,
  publicUrl: string | null,
) {
  const rpcName =
    kind === "crew" ? "noxa_set_crew_cover" : "noxa_set_event_cover";
  const idKey = kind === "crew" ? "target_crew_id" : "target_event_id";
  const { data, error } = await supabase.rpc(rpcName, {
    [idKey]: entityId,
    target_cover_url: publicUrl,
  });

  if (error) throw error;
  if (data !== true) throw new Error("You do not have permission to change this cover.");
}

export async function removeEntityCoverObject(
  publicUrl: string | null,
  kind: CoverEntityKind,
  entityId: string,
) {
  const path = getOwnedEntityCoverPath(publicUrl, kind, entityId);
  if (!path) return;

  const { error } = await supabase.storage
    .from(entityCoversBucket)
    .remove([path]);
  if (error) {
    console.warn("Unable to clean up previous entity cover image.", error.message);
  }
}

export async function removeUploadedEntityCover(path: string) {
  const { error } = await supabase.storage
    .from(entityCoversBucket)
    .remove([path]);
  if (error) {
    console.warn("Unable to clean up uploaded entity cover image.", error.message);
  }
}
