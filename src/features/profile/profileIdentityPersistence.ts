import type * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/src/lib/supabase';

const avatarBucket = 'avatars';
export const maxProfileAvatarBytes = 5 * 1024 * 1024;
export const supportedProfileAvatarMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

export type ProfileIdentityValues = {
  displayName: string;
  username: string;
  city: string;
};

export type ProfileIdentityErrors = Partial<Record<keyof ProfileIdentityValues | 'avatar' | 'form', string>>;

export function normalizeProfileUsername(value: string) {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export function validateProfileIdentity(values: ProfileIdentityValues) {
  const errors: ProfileIdentityErrors = {};
  const displayName = values.displayName.trim();
  const username = normalizeProfileUsername(values.username);
  const city = values.city.trim();

  if (!displayName) {
    errors.displayName = 'Display name is required.';
  } else if (displayName.length < 2 || displayName.length > 40) {
    errors.displayName = 'Display name must be 2–40 characters.';
  }

  if (username) {
    if (username.length < 3 || username.length > 20) {
      errors.username = 'Username must be 3–20 characters.';
    } else if (!/^[a-z0-9_]+$/.test(username)) {
      errors.username = 'Use only lowercase letters, numbers, and underscores.';
    }
  }

  if (city.length > 60) {
    errors.city = 'City must be 60 characters or less.';
  }

  return {
    errors,
    values: { displayName, username, city },
  };
}

export function normalizeProfileAvatarMimeType(mimeType?: string | null) {
  if (!mimeType) return null;
  const normalized = mimeType.toLowerCase();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

export function isSupportedProfileAvatarMimeType(mimeType: string | null): mimeType is (typeof supportedProfileAvatarMimeTypes)[number] {
  return Boolean(mimeType && supportedProfileAvatarMimeTypes.includes(mimeType as (typeof supportedProfileAvatarMimeTypes)[number]));
}

function getAvatarExtension(asset: ImagePicker.ImagePickerAsset, mimeType: string) {
  const fileExtension = asset.fileName?.split('.').pop()?.toLowerCase();

  if (fileExtension && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(fileExtension)) {
    return fileExtension === 'jpeg' ? 'jpg' : fileExtension;
  }

  switch (mimeType) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic': return 'heic';
    case 'image/heif': return 'heif';
    default: return 'jpg';
  }
}

function getOwnedAvatarPath(avatarUrl: string | null, userId: string) {
  if (!avatarUrl || !avatarUrl.startsWith('https://')) return null;

  const marker = `/object/public/${avatarBucket}/`;
  const markerIndex = avatarUrl.indexOf(marker);
  if (markerIndex === -1) return null;

  const path = decodeURIComponent(avatarUrl.slice(markerIndex + marker.length).split('?')[0]);
  return path.startsWith(`${userId}/`) ? path : null;
}

async function uploadAvatar(userId: string, asset: ImagePicker.ImagePickerAsset) {
  const mimeType = normalizeProfileAvatarMimeType(asset.mimeType);

  if (!isSupportedProfileAvatarMimeType(mimeType)) {
    throw new Error('Choose a JPEG, PNG, WebP, HEIC, or HEIF image.');
  }

  if (asset.fileSize && asset.fileSize > maxProfileAvatarBytes) {
    throw new Error('Avatar must be 5 MB or less.');
  }

  const arrayBuffer = await fetch(asset.uri).then((response) => response.arrayBuffer());
  if (arrayBuffer.byteLength > maxProfileAvatarBytes) {
    throw new Error('Avatar must be 5 MB or less.');
  }

  const extension = getAvatarExtension(asset, mimeType);
  const random = Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${Date.now()}-${random}.${extension}`;
  const { error } = await supabase.storage.from(avatarBucket).upload(path, arrayBuffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(avatarBucket).getPublicUrl(path);
  if (!data.publicUrl.startsWith('https://')) {
    await supabase.storage.from(avatarBucket).remove([path]);
    throw new Error('Unable to create a secure avatar URL.');
  }

  return { path, publicUrl: data.publicUrl };
}

export function getProfileIdentityErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';

  if (code === '23505') return 'This username is already taken.';
  if (message.includes('5 MB')) return message;
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
    return 'Unable to connect. Check your internet connection.';
  }

  return message || 'Unable to save profile. Please try again.';
}

export async function saveProfileIdentity({
  avatarAsset,
  currentAvatarUrl,
  userId,
  values,
}: {
  avatarAsset: ImagePicker.ImagePickerAsset | null;
  currentAvatarUrl: string | null;
  userId: string;
  values: ProfileIdentityValues;
}) {
  const validation = validateProfileIdentity(values);
  if (Object.keys(validation.errors).length > 0) {
    return { errors: validation.errors, avatarUrl: currentAvatarUrl };
  }

  let uploadedAvatar: { path: string; publicUrl: string } | null = null;

  try {
    if (avatarAsset) {
      uploadedAvatar = await uploadAvatar(userId, avatarAsset);
    }

    const nextAvatarUrl = uploadedAvatar?.publicUrl ?? currentAvatarUrl;
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: validation.values.displayName,
        username: validation.values.username || null,
        city: validation.values.city || null,
        avatar_url: nextAvatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;

    if (uploadedAvatar) {
      const oldPath = getOwnedAvatarPath(currentAvatarUrl, userId);
      if (oldPath) await supabase.storage.from(avatarBucket).remove([oldPath]);
    }

    return { errors: {}, avatarUrl: nextAvatarUrl };
  } catch (error) {
    if (uploadedAvatar) await supabase.storage.from(avatarBucket).remove([uploadedAvatar.path]);
    return {
      errors: { form: getProfileIdentityErrorMessage(error) } as ProfileIdentityErrors,
      avatarUrl: currentAvatarUrl,
    };
  }
}
