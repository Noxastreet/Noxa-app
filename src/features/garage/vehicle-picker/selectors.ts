import {
  completeVehicleCatalog,
  getCompleteVehicleGeneration,
  getCompleteVehicleMake,
  getCompleteVehicleModel,
  getCompleteVehicleYears,
} from "@/src/data/completeVehicleCatalog";

import { vehiclePickerMotionKey } from "./keys";
import type {
  VehicleGenerationPickerItem,
  VehicleMakePickerItem,
  VehicleModelPickerItem,
  VehicleYearPickerItem,
} from "./types";

export function getVehicleMakePickerItems(): VehicleMakePickerItem[] {
  return completeVehicleCatalog
    .map((make) => ({
      id: make.id,
      kind: "make" as const,
      label: make.name,
      makeId: make.id,
      motionKey: vehiclePickerMotionKey.make(make.id),
      popular: Boolean(make.popular),
    }))
    .sort((a, b) => {
      if (a.popular !== b.popular) return a.popular ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
}

export function getVehicleModelPickerItems(makeId: string): VehicleModelPickerItem[] {
  const make = getCompleteVehicleMake(makeId);
  if (!make) return [];

  return make.models
    .map((model) => ({
      id: model.id,
      kind: "model" as const,
      label: model.name,
      makeId,
      modelId: model.id,
      motionKey: vehiclePickerMotionKey.model(makeId, model.id),
      hasGenerations: Boolean(model.generations?.length),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export function getVehicleGenerationPickerItems(
  makeId: string,
  modelId: string,
): VehicleGenerationPickerItem[] {
  const model = getCompleteVehicleModel(makeId, modelId);
  if (!model?.generations?.length) return [];

  return model.generations.map((generation) => ({
    id: generation.id,
    kind: "generation" as const,
    label: generation.label,
    makeId,
    modelId,
    generationId: generation.id,
    motionKey: vehiclePickerMotionKey.generation(makeId, modelId, generation.id),
  }));
}

export function getVehicleYearPickerItems(
  makeId: string,
  modelId: string,
  generationId: string | null = null,
): VehicleYearPickerItem[] {
  return getCompleteVehicleYears(makeId, modelId, generationId).map((year) => ({
    id: String(year),
    kind: "year" as const,
    label: String(year),
    makeId,
    modelId,
    generationId,
    year,
    motionKey: vehiclePickerMotionKey.year(makeId, modelId, generationId, year),
  }));
}

export function hasVehiclePickerGenerationStep(makeId: string, modelId: string) {
  return getVehicleGenerationPickerItems(makeId, modelId).length > 0;
}

export function isValidVehiclePickerSelection(
  makeId: string,
  modelId: string,
  generationId: string | null,
  year: number,
) {
  const make = getCompleteVehicleMake(makeId);
  const model = getCompleteVehicleModel(makeId, modelId);
  if (!make || !model) return false;

  if (generationId && !getCompleteVehicleGeneration(makeId, modelId, generationId)) {
    return false;
  }

  return getCompleteVehicleYears(makeId, modelId, generationId).includes(year);
}
