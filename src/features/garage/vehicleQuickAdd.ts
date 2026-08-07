import type * as ImagePicker from 'expo-image-picker';

import {
  getCatalogVehicleMake,
  getCatalogVehicleModel,
} from '@/src/data/vehicleCatalogRegistry';
import { supabase } from '@/src/lib/supabase';

import { isValidVehiclePickerSelection } from './vehicle-picker/selectors';
import type { VehiclePickerSelection } from './vehicle-picker/types';
import type { VehicleColorOption } from './vehicle-picker/vehicleColors';

const vehicleImagesBucket = 'vehicle-images';
const maxCoverImageBytes = 6 * 1024 * 1024;
const supportedCoverMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

type UploadedVehicleCover = {
  path: string;
  publicUrl: string;
};

type CreateVehicleFromPickerInput = {
  color: VehicleColorOption;
  coverAsset: ImagePicker.ImagePickerAsset | null;
  selection: VehiclePickerSelection;
};

function normalizeMimeType(mimeType?: string | null) {
  return mimeType?.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType?.toLowerCase();
}

function getSafeExtension(asset: ImagePicker.ImagePickerAsset, contentType: string) {
  const fromFileName = asset.fileName?.split('.').pop()?.toLowerCase();
  const fromUri = asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  const candidate = fromFileName || fromUri;

  if (candidate && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(candidate)) {
    return candidate === 'jpg' ? 'jpeg' : candidate;
  }

  return contentType.split('/')[1] ?? 'jpeg';
}

async function uploadVehicleCover(asset: ImagePicker.ImagePickerAsset, userId: string): Promise<UploadedVehicleCover> {
  const contentType = normalizeMimeType(asset.mimeType);

  if (!contentType || !supportedCoverMimeTypes.includes(contentType as (typeof supportedCoverMimeTypes)[number])) {
    throw new Error('Please choose a JPEG, PNG, WEBP, HEIC, or HEIF image.');
  }

  if (asset.fileSize && asset.fileSize > maxCoverImageBytes) {
    throw new Error('Please choose an image smaller than 6 MB.');
  }

  const arrayBuffer = await fetch(asset.uri).then((response) => response.arrayBuffer());

  if (arrayBuffer.byteLength > maxCoverImageBytes) {
    throw new Error('Please choose an image smaller than 6 MB.');
  }

  const extension = getSafeExtension(asset, contentType);
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${Date.now()}-${randomSuffix}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(vehicleImagesBucket).upload(path, arrayBuffer, {
    cacheControl: '3600',
    contentType,
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(vehicleImagesBucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export function getVehicleQuickAddErrorMessage(error: unknown) {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';

  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
    return 'Unable to connect. Check your internet connection.';
  }

  return message || 'Unable to add vehicle. Please try again.';
}

export async function createVehicleFromPicker({ color, coverAsset, selection }: CreateVehicleFromPickerInput) {
  if (!isValidVehiclePickerSelection(selection)) {
    throw new Error('Vehicle selection is incomplete.');
  }

  const vehicleType = selection.vehicleType;
  const makeId = selection.makeId;
  const modelId = selection.modelId;

  if (!vehicleType || !makeId || !modelId || !selection.year) {
    throw new Error('Vehicle selection is incomplete.');
  }

  const make = getCatalogVehicleMake(vehicleType, makeId);
  const model = getCatalogVehicleModel(vehicleType, makeId, modelId);

  if (!make || !model) {
    throw new Error('This catalog vehicle could not be resolved.');
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    throw authError ?? new Error('Sign in to add a vehicle.');
  }

  let uploadedCover: UploadedVehicleCover | null = null;

  try {
    if (coverAsset) {
      uploadedCover = await uploadVehicleCover(coverAsset, user.id);
    }

    const { data: vehicle, error: insertError } = await supabase
      .from('vehicles')
      .insert({
        owner_id: user.id,
        vehicle_type: vehicleType,
        catalog_make_id: makeId,
        catalog_model_id: modelId,
        catalog_generation_id: selection.generationId,
        brand: make.name,
        model: model.name,
        year: selection.year,
        horsepower: null,
        color: color.name,
        color_hex: color.hex,
        cover_image_url: uploadedCover?.publicUrl ?? null,
        is_public: true,
      })
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    if (!vehicle?.id) {
      throw new Error('Vehicle was saved, but its id was not returned.');
    }

    return vehicle.id as string;
  } catch (error) {
    if (uploadedCover) {
      await supabase.storage.from(vehicleImagesBucket).remove([uploadedCover.path]);
    }

    throw error;
  }
}
