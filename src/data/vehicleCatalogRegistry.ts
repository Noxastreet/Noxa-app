import {
  completeVehicleCatalog,
  getCompleteVehicleGeneration,
  getCompleteVehicleMake,
  getCompleteVehicleModel,
  getCompleteVehicleYears,
} from "./completeVehicleCatalog";
import { motorcycleCatalog } from "./motorcycleCatalog";
import { getYearsForRanges, type VehicleCatalogMake } from "./vehicleCatalog";

export type SupportedVehicleType = "car" | "motorcycle";

export const supportedVehicleTypes: SupportedVehicleType[] = ["car", "motorcycle"];

export const vehicleCatalogRegistry: Record<SupportedVehicleType, VehicleCatalogMake[]> = {
  car: completeVehicleCatalog,
  motorcycle: motorcycleCatalog,
};

export function getCatalogForVehicleType(vehicleType: SupportedVehicleType) {
  return vehicleCatalogRegistry[vehicleType];
}

export function getCatalogVehicleMake(vehicleType: SupportedVehicleType, makeId: string) {
  if (vehicleType === "car") return getCompleteVehicleMake(makeId);
  return motorcycleCatalog.find((make) => make.id === makeId) ?? null;
}

export function getCatalogVehicleModel(
  vehicleType: SupportedVehicleType,
  makeId: string,
  modelId: string,
) {
  if (vehicleType === "car") return getCompleteVehicleModel(makeId, modelId);
  return getCatalogVehicleMake(vehicleType, makeId)?.models.find((model) => model.id === modelId) ?? null;
}

export function getCatalogVehicleGeneration(
  vehicleType: SupportedVehicleType,
  makeId: string,
  modelId: string,
  generationId: string,
) {
  if (vehicleType === "car") {
    return getCompleteVehicleGeneration(makeId, modelId, generationId);
  }

  return (
    getCatalogVehicleModel(vehicleType, makeId, modelId)?.generations?.find(
      (generation) => generation.id === generationId,
    ) ?? null
  );
}

export function getCatalogVehicleYears(
  vehicleType: SupportedVehicleType,
  makeId: string,
  modelId: string,
  generationId?: string | null,
) {
  if (vehicleType === "car") {
    return getCompleteVehicleYears(makeId, modelId, generationId);
  }

  const model = getCatalogVehicleModel(vehicleType, makeId, modelId);
  if (!model) return [];

  if (generationId) {
    const generation = model.generations?.find((item) => item.id === generationId);
    return generation ? getYearsForRanges(generation.yearRanges) : [];
  }

  return getYearsForRanges(model.yearRanges);
}
