import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NoxaButton, NoxaInput, NoxaScreen } from '@/src/components/ui';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

const colorsAvailable = [
  { name: 'Graphite', value: '#2E3038' },
  { name: 'Pearl', value: '#E6E3DC' },
  { name: 'Racing Red', value: colors.primary },
  { name: 'Midnight', value: '#050608' },
];

const vehicleImagesBucket = 'vehicle-images';
const maxCoverImageBytes = 6 * 1024 * 1024;
const supportedCoverMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

type VehicleForm = {
  brand: string;
  model: string;
  year: string;
  horsepower: string;
  color: string;
  transmission: string;
  drivetrain: string;
  tuningStage: string;
  zeroToHundred: string;
  description: string;
  coverImageUrl: string;
  isPublic: boolean;
};

type VehicleErrors = Partial<Record<keyof VehicleForm | 'form', string>>;

type VehicleRecord = {
  id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  horsepower: number | null;
  color: string | null;
  transmission: string | null;
  drivetrain: string | null;
  tuning_stage: string | null;
  zero_to_hundred: number | null;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean | null;
};

type NormalizedVehicle = {
  brand: string;
  model: string | null;
  year: number | null;
  horsepower: number;
  color: string;
  transmission: string | null;
  drivetrain: string | null;
  tuning_stage: string | null;
  zero_to_hundred: number | null;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
};

type UploadedCoverImage = {
  path: string;
  publicUrl: string;
};

const initialForm: VehicleForm = {
  brand: '',
  model: '',
  year: '',
  horsepower: '',
  color: colorsAvailable[0].name,
  transmission: '',
  drivetrain: '',
  tuningStage: '',
  zeroToHundred: '',
  description: '',
  coverImageUrl: '',
  isPublic: true,
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    return Number.NaN;
  }

  return Number.parseInt(trimmed, 10);
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function validateForm(form: VehicleForm): { errors: VehicleErrors; values?: NormalizedVehicle } {
  const errors: VehicleErrors = {};
  const brand = form.brand.trim();
  const model = optionalText(form.model);
  const year = parseOptionalInteger(form.year);
  const horsepower = parseOptionalInteger(form.horsepower);
  const color = form.color.trim();
  const transmission = optionalText(form.transmission);
  const drivetrain = optionalText(form.drivetrain);
  const tuningStage = optionalText(form.tuningStage);
  const zeroToHundred = parseOptionalNumber(form.zeroToHundred);
  const description = optionalText(form.description);
  if (!brand) {
    errors.brand = 'Brand is required.';
  } else if (brand.length > 60) {
    errors.brand = 'Brand must be 60 characters or less.';
  }

  if (model && model.length > 60) {
    errors.model = 'Model must be 60 characters or less.';
  }

  if (Number.isNaN(year) || (year !== null && (year < 1886 || year > 2100))) {
    errors.year = 'Year must be an integer from 1886 to 2100.';
  }

  if (Number.isNaN(horsepower)) {
    errors.horsepower = 'Horsepower must be an integer.';
  } else if (horsepower === null) {
    errors.horsepower = 'Horsepower is required.';
  } else if (horsepower < 1 || horsepower > 5000) {
    errors.horsepower = 'Horsepower must be between 1 and 5000.';
  }

  if (!color) {
    errors.color = 'Color is required.';
  } else if (color.length > 40) {
    errors.color = 'Color must be 40 characters or less.';
  }

  if (transmission && transmission.length > 40) {
    errors.transmission = 'Transmission must be 40 characters or less.';
  }

  if (drivetrain && drivetrain.length > 40) {
    errors.drivetrain = 'Drivetrain must be 40 characters or less.';
  }

  if (tuningStage && tuningStage.length > 40) {
    errors.tuningStage = 'Tuning stage must be 40 characters or less.';
  }

  if (Number.isNaN(zeroToHundred) || (zeroToHundred !== null && (zeroToHundred <= 0 || zeroToHundred > 60))) {
    errors.zeroToHundred = '0–100 must be greater than 0 and no more than 60 seconds.';
  }

  if (description && description.length > 1000) {
    errors.description = 'Description must be 1000 characters or less.';
  }

  if (Object.keys(errors).length > 0 || horsepower === null || Number.isNaN(horsepower)) {
    return { errors };
  }

  return {
    errors,
    values: {
      brand,
      model,
      year: Number.isNaN(year) ? null : year,
      horsepower,
      color,
      transmission,
      drivetrain,
      tuning_stage: tuningStage,
      zero_to_hundred: Number.isNaN(zeroToHundred) ? null : zeroToHundred,
      description,
      cover_image_url: null,
      is_public: form.isPublic,
    },
  };
}

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

function getPreviousOwnedVehicleImagePath(publicUrl: string | null, userId: string) {
  if (!publicUrl) {
    return null;
  }

  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${vehicleImagesBucket}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    const [ownerFolder] = path.split('/');

    return ownerFolder === userId ? path : null;
  } catch {
    return null;
  }
}

function getSaveErrorMessage(error: { message?: string } | unknown) {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';

  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
    return 'Unable to connect. Check your internet connection.';
  }

  return message || 'Unable to save vehicle. Please try again.';
}

function BackButton() {
  return (
    <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
  );
}

function FormSection({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function ColorSelector({ disabled, error, onSelect, selectedColor }: { disabled: boolean; error?: string; onSelect: (color: string) => void; selectedColor: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>Color</Text>
      <View style={styles.colorRow}>
        {colorsAvailable.map((option) => {
          const isSelected = selectedColor === option.name;

          return (
            <Pressable
              key={option.name}
              accessibilityRole="radio"
              accessibilityLabel={`Select ${option.name}`}
              accessibilityState={{ checked: isSelected }}
              disabled={disabled}
              onPress={() => onSelect(option.name)}
              style={({ pressed }) => [styles.colorChip, isSelected && styles.colorChipSelected, pressed && styles.pressed, disabled && styles.disabled]}
            >
              <View style={[styles.swatch, { backgroundColor: option.value }]} />
              <Text style={styles.colorName}>{option.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function VehicleCoverEditor({
  brand,
  disabled,
  horsepower,
  isBusy,
  isPublic,
  model,
  onChoose,
  onRemove,
  previewUri,
  year,
}: {
  brand: string;
  disabled: boolean;
  horsepower: string;
  isBusy: boolean;
  isPublic: boolean;
  model: string;
  onChoose: () => void;
  onRemove: () => void;
  previewUri: string | null;
  year: string;
}) {
  const hasImage = Boolean(previewUri);
  const vehicleName = [brand.trim(), model.trim()].filter(Boolean).join(' ');

  return (
    <View style={styles.coverEditor}>
      <View style={styles.coverPreview}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.coverPreviewImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <View style={styles.coverGlow} />
            <Ionicons name="car-sport" size={54} color={colors.primaryHover} />
          </View>
        )}
        <View style={styles.coverScrim} />
        <View style={styles.coverTopline}>
          <View style={styles.garageBadge}>
            <Ionicons name="speedometer-outline" size={14} color={colors.primaryHover} />
            <Text style={styles.garageBadgeText}>GARAGE PROFILE</Text>
          </View>
          <Text style={styles.coverVisibility}>{isPublic ? 'PUBLIC' : 'PRIVATE'}</Text>
        </View>
        <View style={styles.coverCopy}>
          <Text numberOfLines={2} style={styles.coverVehicleName}>
            {vehicleName || 'YOUR NEXT BUILD'}
          </Text>
          <View style={styles.coverSpecs}>
            <Text style={styles.coverSpec}>{year.trim() || 'YEAR'}</Text>
            <View style={styles.specDot} />
            <Text style={styles.coverSpec}>{horsepower.trim() ? `${horsepower.trim()} HP` : 'POWER'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.coverActions}>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={onChoose} style={({ pressed }) => [styles.coverActionButton, pressed && styles.pressed, disabled && styles.disabled]}>
          <Ionicons name="image" size={16} color={colors.text} />
          <Text style={styles.coverActionText}>{hasImage ? 'CHANGE COVER' : 'CHOOSE COVER'}</Text>
        </Pressable>
        {hasImage ? (
          <Pressable accessibilityRole="button" disabled={disabled} onPress={onRemove} style={({ pressed }) => [styles.coverActionButton, styles.coverRemoveButton, pressed && styles.pressed, disabled && styles.disabled]}>
            <Ionicons name="trash-outline" size={16} color={colors.primary} />
            <Text style={[styles.coverActionText, styles.coverRemoveText]}>REMOVE</Text>
          </Pressable>
        ) : null}
        {isBusy ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      </View>
      <Text style={styles.coverHelp}>JPEG, PNG, WEBP, HEIC or HEIF · up to 6 MB</Text>
    </View>
  );
}

function VisibilityOption({ active, description, disabled, icon, label, onPress }: { active: boolean; description: string; disabled: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.visibilityOption, active && styles.visibilityOptionActive, pressed && styles.pressed, disabled && styles.disabled]}>
      <View style={[styles.visibilityIcon, active && styles.visibilityIconActive]}>
        <Ionicons name={icon} size={20} color={active ? colors.primaryHover : colors.textMuted} />
      </View>
      <Text style={styles.visibilityTitle}>{label}</Text>
      <Text style={styles.visibilityDescription}>{description}</Text>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

function formFromVehicle(vehicle: VehicleRecord): VehicleForm {
  return {
    brand: vehicle.brand ?? '',
    model: vehicle.model ?? '',
    year: vehicle.year === null ? '' : String(vehicle.year),
    horsepower: vehicle.horsepower === null ? '' : String(vehicle.horsepower),
    color: vehicle.color ?? colorsAvailable[0].name,
    transmission: vehicle.transmission ?? '',
    drivetrain: vehicle.drivetrain ?? '',
    tuningStage: vehicle.tuning_stage ?? '',
    zeroToHundred: vehicle.zero_to_hundred === null ? '' : String(vehicle.zero_to_hundred),
    description: vehicle.description ?? '',
    coverImageUrl: vehicle.cover_image_url ?? '',
    isPublic: vehicle.is_public ?? true,
  };
}

function getParamId(id: string | string[] | undefined) {
  return Array.isArray(id) ? id[0] : id;
}

function FieldError({ children, message }: { children: ReactNode; message?: string }) {
  return (
    <View style={styles.fieldWrap}>
      {children}
      {message ? <Text style={styles.errorText}>{message}</Text> : null}
    </View>
  );
}

export default function VehicleEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const vehicleId = getParamId(id);
  const isEditMode = Boolean(vehicleId);
  const [form, setForm] = useState<VehicleForm>(initialForm);
  const [errors, setErrors] = useState<VehicleErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCoverAsset, setSelectedCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isCoverRemoved, setIsCoverRemoved] = useState(false);

  const setField = (field: keyof VehicleForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const coverPreviewUri = selectedCoverAsset?.uri ?? (!isCoverRemoved && form.coverImageUrl ? form.coverImageUrl : null);

  const chooseCoverImage = async () => {
    if (isSubmitting) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to choose a vehicle cover. You can still save the vehicle without a cover image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.78,
      exif: false,
    });

    if (result.canceled) {
      return;
    }

    const [asset] = result.assets;

    if (asset) {
      setSelectedCoverAsset(asset);
      setIsCoverRemoved(false);
      setErrors((current) => ({ ...current, coverImageUrl: undefined, form: undefined }));
    }
  };

  const removeCoverImage = () => {
    if (isSubmitting) {
      return;
    }

    setSelectedCoverAsset(null);
    setIsCoverRemoved(true);
    setErrors((current) => ({ ...current, coverImageUrl: undefined, form: undefined }));
  };

  const uploadCoverImage = async (asset: ImagePicker.ImagePickerAsset, userId: string): Promise<UploadedCoverImage> => {
    const contentType = normalizeMimeType(asset.mimeType);

    if (!contentType || !supportedCoverMimeTypes.includes(contentType as (typeof supportedCoverMimeTypes)[number])) {
      throw new Error('Please choose a JPEG, PNG, WEBP, HEIC, or HEIF image.');
    }

    const arrayBuffer = await fetch(asset.uri).then((response) => response.arrayBuffer());

    if (arrayBuffer.byteLength > maxCoverImageBytes) {
      throw new Error('Please choose an image smaller than 6 MB.');
    }

    const extension = getSafeExtension(asset, contentType);
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const path = `${userId}/${Date.now()}-${randomSuffix}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(vehicleImagesBucket).upload(path, arrayBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(vehicleImagesBucket).getPublicUrl(path);

    return { path, publicUrl: data.publicUrl };
  };

  const removeOwnedCoverImage = async (publicUrl: string | null, userId: string) => {
    const path = getPreviousOwnedVehicleImagePath(publicUrl, userId);

    if (!path) {
      return;
    }

    const { error } = await supabase.storage.from(vehicleImagesBucket).remove([path]);

    if (error) {
      console.warn('Unable to clean up previous vehicle cover image.', error.message);
    }
  };


  const loadVehicleForEdit = useCallback(async () => {
    if (!vehicleId) {
      setForm(initialForm);
      setLoadError(null);
      setIsLoadingVehicle(false);
      return;
    }

    setIsLoadingVehicle(true);
    setLoadError(null);
    setErrors({});

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setLoadError(userError ? getSaveErrorMessage(userError) : 'Sign in to edit this vehicle.');
      setIsLoadingVehicle(false);
      return;
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, brand, model, year, horsepower, color, transmission, drivetrain, tuning_stage, zero_to_hundred, description, cover_image_url, is_public')
      .eq('id', vehicleId)
      .eq('owner_id', userData.user.id)
      .maybeSingle();

    if (vehicleError) {
      setLoadError(getSaveErrorMessage(vehicleError));
      setIsLoadingVehicle(false);
      return;
    }

    if (!vehicle) {
      setLoadError('Vehicle not found or you do not have permission to edit it.');
      setIsLoadingVehicle(false);
      return;
    }

    setForm(formFromVehicle(vehicle as VehicleRecord));
    setSelectedCoverAsset(null);
    setIsCoverRemoved(false);
    setIsLoadingVehicle(false);
  }, [vehicleId]);

  useEffect(() => {
    void loadVehicleForEdit();
  }, [loadVehicleForEdit]);

  const saveVehicle = async () => {
    if (isSubmitting || isLoadingVehicle) {
      return;
    }

    setErrors({});
    const validation = validateForm(form);

    if (!validation.values || Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        setErrors({ form: getSaveErrorMessage(error) });
        setIsSubmitting(false);
        return;
      }

      const user = data.user;

      if (!user) {
        setErrors({ form: 'Sign in to save your vehicle.' });
        setIsSubmitting(false);
        return;
      }

      let uploadedCoverImage: UploadedCoverImage | null = null;
      let coverImageUrl = isEditMode ? validation.values.cover_image_url : null;

      if (selectedCoverAsset) {
        uploadedCoverImage = await uploadCoverImage(selectedCoverAsset, user.id);
        coverImageUrl = uploadedCoverImage.publicUrl;
      } else if (isEditMode && !isCoverRemoved) {
        coverImageUrl = form.coverImageUrl || null;
      } else {
        coverImageUrl = null;
      }

      const vehiclePayload = {
        brand: validation.values.brand,
        model: validation.values.model,
        year: validation.values.year,
        horsepower: validation.values.horsepower,
        color: validation.values.color,
        transmission: validation.values.transmission,
        drivetrain: validation.values.drivetrain,
        tuning_stage: validation.values.tuning_stage,
        zero_to_hundred: validation.values.zero_to_hundred,
        description: validation.values.description,
        cover_image_url: coverImageUrl,
        is_public: validation.values.is_public,
      };

      if (isEditMode && vehicleId) {
        const { data: updatedVehicle, error: updateError } = await supabase.from('vehicles').update(vehiclePayload).eq('id', vehicleId).eq('owner_id', user.id).select('id').maybeSingle();

        if (updateError) {
          if (uploadedCoverImage) {
            await supabase.storage.from(vehicleImagesBucket).remove([uploadedCoverImage.path]);
          }

          setIsSubmitting(false);
          setErrors({ form: getSaveErrorMessage(updateError) });
          return;
        }

        if (!updatedVehicle) {
          if (uploadedCoverImage) {
            await supabase.storage.from(vehicleImagesBucket).remove([uploadedCoverImage.path]);
          }

          setIsSubmitting(false);
          setErrors({ form: 'Vehicle not found or you do not have permission to edit it.' });
          return;
        }

        if (isCoverRemoved || uploadedCoverImage) {
          await removeOwnedCoverImage(form.coverImageUrl, user.id);
        }

        setIsSubmitting(false);
        router.replace({ pathname: '/vehicle-details', params: { id: vehicleId } });
        return;
      }

      const { data: vehicle, error: insertError } = await supabase
        .from('vehicles')
        .insert({
          owner_id: user.id,
          ...vehiclePayload,
        })
        .select('id')
        .single();

      if (insertError) {
        if (uploadedCoverImage) {
          await supabase.storage.from(vehicleImagesBucket).remove([uploadedCoverImage.path]);
        }

        setIsSubmitting(false);
        setErrors({ form: getSaveErrorMessage(insertError) });
        return;
      }

      setIsSubmitting(false);

      if (vehicle?.id) {
        router.back();
      }
    } catch (error) {
      setIsSubmitting(false);
      setErrors({ form: getSaveErrorMessage(error) });
    }
  };

  if (isLoadingVehicle) {
    return (
      <NoxaScreen padded={false}>
        <View style={styles.stateWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateTitle}>Loading vehicle...</Text>
        </View>
      </NoxaScreen>
    );
  }

  if (loadError) {
    return (
      <NoxaScreen padded={false}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Unable to edit vehicle</Text>
          <Text style={styles.stateCopy}>{loadError}</Text>
          <NoxaButton title="Back" onPress={() => router.back()} />
        </View>
      </NoxaScreen>
    );
  }

  return (
    <NoxaScreen padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoiding}>
        <View style={styles.editorHeader}>
          <BackButton />
          <Text style={styles.headerTitle}>{isEditMode ? 'EDIT VEHICLE' : 'ADD VEHICLE'}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <VehicleCoverEditor
            brand={form.brand}
            disabled={isSubmitting}
            horsepower={form.horsepower}
            isBusy={isSubmitting && Boolean(selectedCoverAsset)}
            isPublic={form.isPublic}
            model={form.model}
            onChoose={chooseCoverImage}
            onRemove={removeCoverImage}
            previewUri={coverPreviewUri}
            year={form.year}
          />

          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          <FormSection eyebrow="01 / IDENTITY" title="Name the machine">
            <FieldError message={errors.brand}>
              <NoxaInput editable={!isSubmitting} label="Brand · required" maxLength={60} onChangeText={(value) => setField('brand', value)} placeholder="Porsche" value={form.brand} autoCapitalize="words" />
            </FieldError>
            <FieldError message={errors.model}>
              <NoxaInput editable={!isSubmitting} label="Model" maxLength={60} onChangeText={(value) => setField('model', value)} placeholder="911 GT3 RS" value={form.model} autoCapitalize="words" />
            </FieldError>
            <FieldError message={errors.year}>
              <NoxaInput editable={!isSubmitting} label="Year" onChangeText={(value) => setField('year', value)} placeholder="2024" value={form.year} keyboardType="number-pad" />
            </FieldError>
            <ColorSelector disabled={isSubmitting} error={errors.color} onSelect={(value) => setField('color', value)} selectedColor={form.color} />
          </FormSection>

          {errors.coverImageUrl ? <Text style={styles.formError}>{errors.coverImageUrl}</Text> : null}

          <FormSection eyebrow="02 / PERFORMANCE" title="Define the build">
            <FieldError message={errors.horsepower}>
              <NoxaInput editable={!isSubmitting} label="Horsepower · required" onChangeText={(value) => setField('horsepower', value)} placeholder="518" value={form.horsepower} keyboardType="number-pad" />
            </FieldError>
            <FieldError message={errors.tuningStage}>
              <NoxaInput editable={!isSubmitting} label="Tuning stage" maxLength={40} onChangeText={(value) => setField('tuningStage', value)} placeholder="Stage 2 / Track build / OEM+" value={form.tuningStage} />
            </FieldError>
            <FieldError message={errors.zeroToHundred}>
              <NoxaInput editable={!isSubmitting} label="0–100 km/h · seconds" onChangeText={(value) => setField('zeroToHundred', value)} placeholder="3.8" value={form.zeroToHundred} keyboardType="decimal-pad" />
            </FieldError>
            <FieldError message={errors.transmission}>
              <NoxaInput editable={!isSubmitting} label="Transmission" maxLength={40} onChangeText={(value) => setField('transmission', value)} placeholder="Manual / DCT / Automatic" value={form.transmission} />
            </FieldError>
            <FieldError message={errors.drivetrain}>
              <NoxaInput editable={!isSubmitting} label="Drivetrain" maxLength={40} onChangeText={(value) => setField('drivetrain', value)} placeholder="RWD / AWD / FWD" value={form.drivetrain} />
            </FieldError>
          </FormSection>

          <FormSection eyebrow="03 / STORY" title="Give it context">
            <FieldError message={errors.description}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput editable={!isSubmitting} maxLength={1000} multiline onChangeText={(value) => setField('description', value)} placeholder="Tell the story behind the build…" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} style={styles.textArea} textAlignVertical="top" value={form.description} />
                <Text style={styles.characterCount}>{form.description.length} / 1000</Text>
              </View>
            </FieldError>
          </FormSection>

          <FormSection eyebrow="04 / VISIBILITY" title="Choose the audience">
            <View style={styles.visibilityOptions}>
              <VisibilityOption active={form.isPublic} description="Visible to every NOXA driver" disabled={isSubmitting} icon="earth-outline" label="Public" onPress={() => setField('isPublic', true)} />
              <VisibilityOption active={!form.isPublic} description="Visible only to you" disabled={isSubmitting} icon="lock-closed-outline" label="Private" onPress={() => setField('isPublic', false)} />
            </View>
          </FormSection>
        </ScrollView>
        <View style={styles.fixedFooter}>
          <NoxaButton disabled={isSubmitting} loading={isSubmitting} onPress={saveVehicle} title={isEditMode ? 'SAVE CHANGES' : 'ADD TO GARAGE'} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </NoxaScreen>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  editorHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surfaceBase,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.subtitle,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 124,
    gap: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }, { scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  coverEditor: {
    gap: spacing.sm,
  },
  coverPreview: {
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  coverPreviewImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090A0E',
  },
  coverGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  coverScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  coverTopline: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  garageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: 'rgba(10,10,14,0.78)',
  },
  garageBadgeText: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  coverVisibility: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  coverCopy: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    gap: spacing.xs,
  },
  coverVehicleName: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h2,
    lineHeight: typography.lineHeight.h2,
    fontWeight: '900',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  coverSpecs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  coverSpec: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  specDot: {
    width: 4,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryHover,
  },
  coverActions: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  coverActionButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  coverRemoveButton: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  coverActionText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  coverRemoveText: {
    color: colors.primaryHover,
  },
  coverHelp: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
  },
  sectionCard: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sectionTitle: {
    marginTop: spacing.xxs,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sectionContent: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldWrap: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorChip: {
    width: '47%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorChipSelected: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorName: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  textArea: {
    minHeight: 118,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: typography.body,
  },
  characterCount: {
    textAlign: 'right',
    color: colors.textSubtle,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  errorText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  formError: {
    padding: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateCopy: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  visibilityOptions: {
    flexDirection: 'row',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  visibilityIconActive: {
    backgroundColor: colors.primaryMuted,
  },
  visibilityTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  visibilityDescription: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  radio: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  fixedFooter: {
    position: 'absolute',
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
});
