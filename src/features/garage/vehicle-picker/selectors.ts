import {
  getCatalogForVehicleType,
  getCatalogVehicleGeneration,
  getCatalogVehicleMake,
  getCatalogVehicleModel,
  getCatalogVehicleYears,
  supportedVehicleTypes,
  type SupportedVehicleType,
} from "@/src/data/vehicleCatalogRegistry";

import { vehiclePickerMotionKey } from "./keys";
import type {
  VehicleGenerationPickerItem,
  VehicleMakePickerItem,
  VehicleModelPickerItem,
  VehicleTypePickerItem,
  VehicleYearPickerItem,
} from "./types";

const vehicleTypeLabel: Record<SupportedVehicleType, string> = {
  car: "Car",
  motorcycle: "Motorcycle",
};

export function getVehicleTypePickerItems(): VehicleTypePickerItem[] {
  return supportedVehicleTypes.map((vehicleType) => ({
    id: vehicleType,
    kind: "type" as const,
    label: vehicleTypeLabel[vehicleType],
    vehicleType,
    motionKey: vehiclePickerMotionKey.type(vehicleType),
  }));
}

export function getVehicleMakePickerItems(
  vehicleType: SupportedVehicleType = "car",
): VehicleMakePickerItem[] {
  return getCatalogForVehicleType(vehicleType)
    .map((make) => ({
      id: make.id,
      kind: "make" as const,
      label: make.name,
      vehicleType,
      makeId: make.id,
      motionKey: vehiclePickerMotionKey.make(vehicleType, make.id),
      popular: Boolean(make.popular),
    }))
    .sort((a, b) => {
      if (a.popular !== b.popular) return a.popular ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
}

export function getVehicleModelPickerItems(
  vehicleType: SupportedVehicleType,
  makeId: string,
): VehicleModelPickerItem[] {
  const make = getCatalogVehicleMake(vehicleType, makeId);
  if (!make) return [];

  return make.models
    .map((model) => ({
      id: model.id,
      kind: "model" as const,
      label: model.name,
      vehicleType,
      makeId,
      modelId: model.id,
      motionKey: vehiclePickerMotionKey.model(vehicleType, makeId, model.id),
      hasGenerations: Boolean(model.generations?.length),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export function getVehicleGenerationPickerItems(
  vehicleType: SupportedVehicleType,
  makeId: string,
  modelId: string,
): VehicleGenerationPickerItem[] {
  const model = getCatalogVehicleModel(vehicleType, makeId, modelId);
  if (!model?.generations?.length) return [];

  return model.generations.map((generation) => ({
    id: generation.id,
    kind: "generation" as const,
    label: generation.label,
    vehicleType,
    makeId,
    modelId,
    generationId: generation.id,
    motionKey: vehiclePickerMotionKey.generation(
      vehicleType,
      makeId,
      modelId,
      generation.id,
    ),
  }));
}

export function getVehicleYearPickerItems(
  vehicleType: SupportedVehicleType,
  makeId: string,
  modelId: string,
  generationId: string | null = null,
): VehicleYearPickerItem[] {
  return getCatalogVehicleYears(vehicleType, makeId, modelId, generationId).map((year) => ({
    id: String(year),
    kind: "year" as const,
    label: String(year),
    vehicleType,
    makeId,
    modelId,
    generationId,
    year,
    motionKey: vehiclePickerMotionKey.year(
      vehicleType,
      makeId,
      modelId,
      generationId,
      year,
    ),
  }));
}

export function hasVehiclePickerGenerationStep(
  vehicleType: SupportedVehicleType,
  makeId: string,
  modelId: string,
) {
  return getVehicleGenerationPickerItems(vehicleType, makeId, modelId).length > 0;
}

export function isValidVehiclePickerSelection(
  vehicleType: SupportedVehicleType,
  makeId: string,
  modelId: string,
  generationId: string | null,
  year: number,
) {
  const make = getCatalogVehicleMake(vehicleType, makeId);
  const model = getCatalogVehicleModel(vehicleType, makeId, modelId);
  if (!make || !model) return false;

  if (
    generationId &&
    !getCatalogVehicleGeneration(vehicleType, makeId, modelId, generationId)
  ) {
    return false;
  }

  return getCatalogVehicleYears(vehicleType, makeId, modelId, generationId).includes(year);
}
