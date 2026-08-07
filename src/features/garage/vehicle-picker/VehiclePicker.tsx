import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  getCatalogVehicleGeneration,
  getCatalogVehicleMake,
  getCatalogVehicleModel,
  type SupportedVehicleType,
} from '@/src/data/vehicleCatalogRegistry';
import { colors, radius, spacing, typography } from '@/src/theme';

import {
  getVehicleGenerationPickerItems,
  getVehicleMakePickerItems,
  getVehicleModelPickerItems,
  getVehicleTypePickerItems,
  getVehicleYearPickerItems,
  hasVehiclePickerGenerationStep,
} from './selectors';
import { emptyVehiclePickerSelection, type VehiclePickerSelection, type VehiclePickerStep } from './types';
import { GenerationCard } from './components/GenerationCard';
import { MakeCard } from './components/MakeCard';
import { ModelCard } from './components/ModelCard';
import { PopularMakeCard } from './components/PopularMakeCard';
import { VehicleIdentityPreview } from './components/VehicleIdentityPreview';
import { VehiclePickerStage } from './components/VehiclePickerStage';
import { VehicleTypeCard } from './components/VehicleTypeCard';
import { VehicleTypeIcon } from './components/VehicleTypeIcon';
import { YearCard } from './components/YearCard';
import { pickerMotion } from './motion';

type VehiclePickerProps = {
  onCancel: () => void;
  onComplete: (selection: VehiclePickerSelection) => void;
  onManualEntry?: (vehicleType: SupportedVehicleType | null) => void;
};

const stepNumber: Partial<Record<VehiclePickerStep, number>> = {
  type: 1,
  make: 2,
  model: 3,
  generation: 4,
  year: 5,
  confirm: 6,
};

const preferredPopularMakeIds: Record<SupportedVehicleType, string[]> = {
  car: ['bmw', 'mercedes-benz', 'audi', 'volkswagen', 'toyota', 'honda', 'mazda', 'nissan'],
  motorcycle: ['honda', 'yamaha', 'kawasaki', 'suzuki', 'ducati', 'bmw-motorrad', 'ktm', 'triumph'],
};

function matchesQuery(label: string, query: string) {
  return label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

function SearchField({ onChangeText, placeholder, value }: { onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        style={styles.searchInput}
        value={value}
      />
      {value ? (
        <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ManualEntryAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.manualAction, pressed && styles.pressed]}>
      <Ionicons name="create-outline" size={17} color={colors.textMuted} />
      <Text style={styles.manualText}>CAN’T FIND IT? ADD MANUALLY</Text>
    </Pressable>
  );
}

export function VehiclePicker({ onCancel, onComplete, onManualEntry }: VehiclePickerProps) {
  const [step, setStep] = useState<VehiclePickerStep>('type');
  const [selection, setSelection] = useState<VehiclePickerSelection>(emptyVehiclePickerSelection);
  const [query, setQuery] = useState('');

  const make = selection.vehicleType && selection.makeId
    ? getCatalogVehicleMake(selection.vehicleType, selection.makeId)
    : null;
  const model = selection.vehicleType && selection.makeId && selection.modelId
    ? getCatalogVehicleModel(selection.vehicleType, selection.makeId, selection.modelId)
    : null;
  const generation = selection.vehicleType && selection.makeId && selection.modelId && selection.generationId
    ? getCatalogVehicleGeneration(selection.vehicleType, selection.makeId, selection.modelId, selection.generationId)
    : null;

  const makeItems = useMemo(
    () => selection.vehicleType ? getVehicleMakePickerItems(selection.vehicleType) : [],
    [selection.vehicleType],
  );
  const modelItems = useMemo(
    () => selection.vehicleType && selection.makeId
      ? getVehicleModelPickerItems(selection.vehicleType, selection.makeId)
      : [],
    [selection.makeId, selection.vehicleType],
  );
  const generationItems = useMemo(
    () => selection.vehicleType && selection.makeId && selection.modelId
      ? getVehicleGenerationPickerItems(selection.vehicleType, selection.makeId, selection.modelId)
      : [],
    [selection.makeId, selection.modelId, selection.vehicleType],
  );
  const yearItems = useMemo(
    () => selection.vehicleType && selection.makeId && selection.modelId
      ? getVehicleYearPickerItems(selection.vehicleType, selection.makeId, selection.modelId, selection.generationId)
      : [],
    [selection.generationId, selection.makeId, selection.modelId, selection.vehicleType],
  );

  const filteredMakes = useMemo(() => makeItems.filter((item) => matchesQuery(item.label, query)), [makeItems, query]);
  const filteredModels = useMemo(() => modelItems.filter((item) => matchesQuery(item.label, query)), [modelItems, query]);

  const popularMakes = useMemo(() => {
    if (!selection.vehicleType) return [];
    const preferredIds = preferredPopularMakeIds[selection.vehicleType];
    const itemsById = new Map(makeItems.map((item) => [item.makeId, item]));
    const preferred = preferredIds.flatMap((makeId) => {
      const item = itemsById.get(makeId);
      return item ? [item] : [];
    });
    const preferredSet = new Set(preferred.map((item) => item.makeId));
    const fallback = makeItems.filter((item) => item.popular && !preferredSet.has(item.makeId));
    return [...preferred, ...fallback].slice(0, 8);
  }, [makeItems, selection.vehicleType]);

  const otherMakes = useMemo(() => {
    const popularIds = new Set(popularMakes.map((item) => item.makeId));
    return makeItems.filter((item) => !popularIds.has(item.makeId));
  }, [makeItems, popularMakes]);

  const selectType = (vehicleType: SupportedVehicleType) => {
    setSelection({ ...emptyVehiclePickerSelection, vehicleType });
    setQuery('');
    setStep('make');
  };

  const selectMake = (makeId: string) => {
    setSelection((current) => ({ ...current, makeId, modelId: null, generationId: null, year: null }));
    setQuery('');
    setStep('model');
  };

  const selectModel = (modelId: string) => {
    if (!selection.vehicleType || !selection.makeId) return;
    const hasGenerations = hasVehiclePickerGenerationStep(selection.vehicleType, selection.makeId, modelId);
    setSelection((current) => ({ ...current, modelId, generationId: null, year: null }));
    setQuery('');
    setStep(hasGenerations ? 'generation' : 'year');
  };

  const selectGeneration = (generationId: string) => {
    setSelection((current) => ({ ...current, generationId, year: null }));
    setStep('year');
  };

  const selectYear = (year: number) => {
    setSelection((current) => ({ ...current, year }));
    setStep('confirm');
  };

  const goBack = () => {
    setQuery('');
    if (step === 'type') {
      onCancel();
      return;
    }
    if (step === 'make') {
      setSelection(emptyVehiclePickerSelection);
      setStep('type');
      return;
    }
    if (step === 'model') {
      setSelection((current) => ({ ...current, makeId: null, modelId: null, generationId: null, year: null }));
      setStep('make');
      return;
    }
    if (step === 'generation') {
      setSelection((current) => ({ ...current, modelId: null, generationId: null, year: null }));
      setStep('model');
      return;
    }
    if (step === 'year') {
      if (selection.generationId) {
        setSelection((current) => ({ ...current, generationId: null, year: null }));
        setStep('generation');
      } else {
        setSelection((current) => ({ ...current, modelId: null, year: null }));
        setStep('model');
      }
      return;
    }
    if (step === 'confirm') {
      setSelection((current) => ({ ...current, year: null }));
      setStep('year');
    }
  };

  const progress = stepNumber[step] ?? 1;
  const progressWidth = `${Math.min(progress, 6) / 6 * 100}%` as `${number}%`;
  const hasMakeQuery = query.trim().length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.progressTrack}>
        <Animated.View layout={pickerMotion.layout} style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {step === 'type' ? (
          <VehiclePickerStage
            eyebrow="NOXA GARAGE"
            onBack={goBack}
            subtitle="Start with the machine that represents you."
            title="What do you drive?">
            <View style={styles.stack}>
              {getVehicleTypePickerItems().map((item) => (
                <VehicleTypeCard key={item.motionKey} item={item} onPress={() => selectType(item.vehicleType)} />
              ))}
            </View>
          </VehiclePickerStage>
        ) : null}

        {step === 'make' && selection.vehicleType ? (
          <VehiclePickerStage
            eyebrow={selection.vehicleType === 'car' ? 'CAR' : 'MOTORCYCLE'}
            onBack={goBack}
            subtitle="Search or pick a familiar manufacturer."
            title="Choose make">
            <SearchField onChangeText={setQuery} placeholder="Search make" value={query} />

            {hasMakeQuery ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>SEARCH RESULTS</Text>
                <View style={styles.stack}>
                  {filteredMakes.map((item) => (
                    <MakeCard key={item.motionKey} item={item} onPress={() => selectMake(item.makeId)} />
                  ))}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>POPULAR</Text>
                  <View style={styles.popularGrid}>
                    {popularMakes.map((item) => (
                      <View key={`${item.motionKey}:popular-cell`} style={styles.popularCell}>
                        <PopularMakeCard item={item} onPress={() => selectMake(item.makeId)} />
                      </View>
                    ))}
                  </View>
                </View>

                {otherMakes.length > 0 ? (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionLabel}>MORE MAKES</Text>
                    <View style={styles.stack}>
                      {otherMakes.map((item) => (
                        <MakeCard key={item.motionKey} item={item} onPress={() => selectMake(item.makeId)} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            )}

            {filteredMakes.length === 0 ? <Text style={styles.emptyText}>No matching makes.</Text> : null}
            {onManualEntry ? <ManualEntryAction onPress={() => onManualEntry(selection.vehicleType)} /> : null}
          </VehiclePickerStage>
        ) : null}

        {step === 'model' && selection.vehicleType && selection.makeId ? (
          <VehiclePickerStage
            eyebrow={make?.name ?? 'MODEL'}
            onBack={goBack}
            subtitle="Choose the exact model."
            title="Choose model">
            <VehicleIdentityPreview make={make?.name} vehicleType={selection.vehicleType} />
            <SearchField onChangeText={setQuery} placeholder="Search model" value={query} />
            <View style={styles.stack}>
              {filteredModels.map((item) => (
                <ModelCard key={item.motionKey} item={item} onPress={() => selectModel(item.modelId)} />
              ))}
            </View>
            {filteredModels.length === 0 ? <Text style={styles.emptyText}>No matching models.</Text> : null}
            {onManualEntry ? <ManualEntryAction onPress={() => onManualEntry(selection.vehicleType)} /> : null}
          </VehiclePickerStage>
        ) : null}

        {step === 'generation' && selection.vehicleType && selection.makeId && selection.modelId ? (
          <VehiclePickerStage
            eyebrow={model?.name ?? 'GENERATION'}
            onBack={goBack}
            subtitle="Pick the generation that matches your vehicle."
            title="Choose generation">
            <VehicleIdentityPreview make={make?.name} model={model?.name} vehicleType={selection.vehicleType} />
            <View style={styles.stack}>
              {generationItems.map((item) => (
                <GenerationCard key={item.motionKey} item={item} onPress={() => selectGeneration(item.generationId)} />
              ))}
            </View>
          </VehiclePickerStage>
        ) : null}

        {step === 'year' && selection.vehicleType && selection.makeId && selection.modelId ? (
          <VehiclePickerStage
            eyebrow={generation?.label ?? model?.name ?? 'YEAR'}
            onBack={goBack}
            subtitle="Choose the production year."
            title="Choose year">
            <VehicleIdentityPreview
              generation={generation?.label}
              make={make?.name}
              model={model?.name}
              vehicleType={selection.vehicleType}
            />
            <View style={styles.yearGrid}>
              {yearItems.map((item) => (
                <View key={item.motionKey} style={styles.yearCell}>
                  <YearCard item={item} onPress={() => selectYear(item.year)} />
                </View>
              ))}
            </View>
          </VehiclePickerStage>
        ) : null}

        {step === 'confirm' && selection.vehicleType && selection.makeId && selection.modelId && selection.year ? (
          <VehiclePickerStage
            eyebrow="YOUR VEHICLE"
            onBack={goBack}
            subtitle="Confirm the identity before adding details."
            title="Looks right?">
            <View style={styles.confirmCard}>
              <View style={styles.confirmTopline}>
                <View style={styles.confirmIcon}>
                  <VehicleTypeIcon vehicleType={selection.vehicleType} size={24} color={colors.primaryHover} />
                </View>
                <Text style={styles.confirmEyebrow}>{selection.vehicleType === 'motorcycle' ? 'MOTORCYCLE' : 'CAR'}</Text>
              </View>
              <Text style={styles.confirmTitle}>{[make?.name, model?.name].filter(Boolean).join(' ')}</Text>
              <Text style={styles.confirmMeta}>{[generation?.label, selection.year].filter(Boolean).join(' · ')}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => onComplete(selection)}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>USE THIS VEHICLE</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.text} />
              </Pressable>
            </View>
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },
  stack: {
    gap: spacing.sm,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  popularCell: {
    width: '48%',
  },
  searchWrap: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceBase,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  emptyText: {
    paddingVertical: spacing.xl,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  manualAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  manualText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  yearCell: {
    width: '30.8%',
  },
  confirmCard: {
    padding: spacing.xl,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface,
  },
  confirmTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
  },
  confirmEyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  confirmTitle: {
    marginTop: spacing.lg,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
    textTransform: 'uppercase',
  },
  confirmMeta: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
