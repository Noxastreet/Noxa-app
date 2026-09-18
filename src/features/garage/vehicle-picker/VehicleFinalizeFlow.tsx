import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getCatalogVehicleGeneration,
  getCatalogVehicleMake,
  getCatalogVehicleModel,
} from '@/src/data/vehicleCatalogRegistry';
import { colors, radius, spacing, typography } from '@/src/theme';

import { createVehicleFromPicker, getVehicleQuickAddErrorMessage } from '../vehicleQuickAdd';
import { ColorCard } from './components/ColorCard';
import { VehicleIdentityPreview } from './components/VehicleIdentityPreview';
import { VehiclePhotoCard } from './components/VehiclePhotoCard';
import { VehiclePickerStage } from './components/VehiclePickerStage';
import { VehicleTypeIcon } from './components/VehicleTypeIcon';
import type { VehiclePickerSelection } from './types';
import { vehicleColorOptions, type VehicleColorOption } from './vehicleColors';

type FinalizeStep = 'color' | 'photo' | 'confirm';

type VehicleFinalizeFlowProps = {
  onBackToPicker: () => void;
  onSaved: (vehicleId: string) => void;
  selection: VehiclePickerSelection;
};

const progressByStep: Record<FinalizeStep, `${number}%`> = {
  color: '75%',
  photo: '87.5%',
  confirm: '100%',
};

export function VehicleFinalizeFlow({ onBackToPicker, onSaved, selection }: VehicleFinalizeFlowProps) {
  const [step, setStep] = useState<FinalizeStep>('color');
  const [selectedColor, setSelectedColor] = useState<VehicleColorOption | null>(null);
  const [coverAsset, setCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const vehicleType = selection.vehicleType ?? 'car';
  const make = selection.vehicleType && selection.makeId
    ? getCatalogVehicleMake(selection.vehicleType, selection.makeId)
    : null;
  const model = selection.vehicleType && selection.makeId && selection.modelId
    ? getCatalogVehicleModel(selection.vehicleType, selection.makeId, selection.modelId)
    : null;
  const generation = selection.vehicleType && selection.makeId && selection.modelId && selection.generationId
    ? getCatalogVehicleGeneration(selection.vehicleType, selection.makeId, selection.modelId, selection.generationId)
    : null;

  const vehicleName = useMemo(
    () => [make?.name, model?.name].filter(Boolean).join(' ') || 'YOUR VEHICLE',
    [make?.name, model?.name],
  );

  const choosePhoto = async () => {
    if (isSaving) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access to choose a vehicle cover. You can continue without a photo.',
      );
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

    if (!result.canceled && result.assets[0]) {
      setCoverAsset(result.assets[0]);
      setSaveError(null);
    }
  };

  const goBack = () => {
    setSaveError(null);

    if (step === 'color') {
      onBackToPicker();
      return;
    }

    if (step === 'photo') {
      setStep('color');
      return;
    }

    setStep('photo');
  };

  const saveVehicle = async () => {
    if (!selectedColor || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const vehicleId = await createVehicleFromPicker({
        color: selectedColor,
        coverAsset,
        selection,
      });
      onSaved(vehicleId);
    } catch (error) {
      setSaveError(getVehicleQuickAddErrorMessage(error));
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressByStep[step] }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'color' ? (
          <VehiclePickerStage
            eyebrow="Your vehicle"
            onBack={goBack}
            subtitle="Choose the closest color. You can refine it later in Garage."
            title="Choose color">
            <VehicleIdentityPreview
              generation={generation?.label}
              make={make?.name}
              model={model?.name}
              vehicleType={vehicleType}
              year={selection.year}
            />
            <View style={styles.colorGrid}>
              {vehicleColorOptions.map((option) => (
                <View key={option.id} style={styles.colorCell}>
                  <ColorCard
                    color={option}
                    onPress={() => {
                      setSelectedColor(option);
                      setSaveError(null);
                    }}
                    selected={selectedColor?.id === option.id}
                  />
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={!selectedColor}
              onPress={() => setStep('photo')}
              style={({ pressed }) => [styles.primaryButton, !selectedColor && styles.disabled, pressed && selectedColor && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={17} color={colors.text} />
            </Pressable>
          </VehiclePickerStage>
        ) : null}

        {step === 'photo' ? (
          <VehiclePickerStage
            eyebrow={selectedColor?.name ?? 'Photo'}
            onBack={goBack}
            subtitle="Make the vehicle recognizable in Garage. A photo is optional."
            title="Add a photo">
            <VehicleIdentityPreview
              generation={generation?.label}
              make={make?.name}
              model={model?.name}
              vehicleType={vehicleType}
              year={selection.year}
            />
            <VehiclePhotoCard
              disabled={isSaving}
              onChoose={() => void choosePhoto()}
              onRemove={() => setCoverAsset(null)}
              photoUri={coverAsset?.uri ?? null}
              vehicleType={vehicleType}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep('confirm')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{coverAsset ? 'Continue' : 'Continue without photo'}</Text>
              <Ionicons name="arrow-forward" size={17} color={colors.text} />
            </Pressable>
          </VehiclePickerStage>
        ) : null}

        {step === 'confirm' && selectedColor ? (
          <VehiclePickerStage
            eyebrow="Ready for Garage"
            onBack={goBack}
            subtitle="You can add power, tuning and other build details later."
            title="Add to garage">
            <View style={styles.finalCard}>
              <View style={styles.finalArtwork}>
                {coverAsset ? (
                  <Image source={{ uri: coverAsset.uri }} style={styles.finalImage} />
                ) : (
                  <View style={styles.finalPlaceholder}>
                    <VehicleTypeIcon vehicleType={vehicleType} size={56} color={colors.primaryHover} />
                  </View>
                )}
                <View style={styles.finalShade} />
                <View style={styles.finalCopy}>
                  <Text numberOfLines={2} style={styles.finalTitle}>{vehicleName}</Text>
                  <Text style={styles.finalMeta}>
                    {[generation?.label, selection.year, selectedColor.name].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
              <View style={styles.finalNote}>
                <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
                <Text style={styles.finalNoteText}>Saved as Public by default. Visibility can be changed later.</Text>
              </View>
            </View>

            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void saveVehicle()}
              style={({ pressed }) => [styles.primaryButton, isSaving && styles.disabled, pressed && !isSaving && styles.pressed]}>
              {isSaving ? <ActivityIndicator color={colors.text} size="small" /> : <Ionicons name="add" size={18} color={colors.text} />}
              <Text style={styles.primaryButtonText}>{isSaving ? 'ADDING…' : 'ADD TO GARAGE'}</Text>
            </Pressable>
          </VehiclePickerStage>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.divider,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorCell: {
    width: '48%',
  },
  primaryButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  finalCard: {
    overflow: 'hidden',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  finalArtwork: {
    height: 156,
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  finalImage: {
    width: '100%',
    height: '100%',
  },
  finalPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,6,10,0.30)',
  },
  finalCopy: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  finalTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    ...typography.v2.section,
    fontWeight: '800',
  },
  finalMeta: {
    marginTop: spacing.xs,
    color: 'rgba(240,240,244,0.72)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  finalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  finalNoteText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  errorText: {
    color: colors.primaryHover,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
