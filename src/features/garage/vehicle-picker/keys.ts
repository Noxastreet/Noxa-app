import type { SupportedVehicleType } from "@/src/data/vehicleCatalogRegistry";

const ROOT = "vehicle-picker";

export const vehiclePickerMotionKey = {
  type: (vehicleType: SupportedVehicleType) => `${ROOT}:type:${vehicleType}`,
  make: (vehicleType: SupportedVehicleType, makeId: string) =>
    `${ROOT}:make:${vehicleType}:${makeId}`,
  model: (vehicleType: SupportedVehicleType, makeId: string, modelId: string) =>
    `${ROOT}:model:${vehicleType}:${makeId}:${modelId}`,
  generation: (
    vehicleType: SupportedVehicleType,
    makeId: string,
    modelId: string,
    generationId: string,
  ) => `${ROOT}:generation:${vehicleType}:${makeId}:${modelId}:${generationId}`,
  year: (
    vehicleType: SupportedVehicleType,
    makeId: string,
    modelId: string,
    generationId: string | null,
    year: number,
  ) =>
    `${ROOT}:year:${vehicleType}:${makeId}:${modelId}:${generationId ?? "all"}:${year}`,
} as const;

/**
 * Motion keys are intentionally independent from visible labels.
 * Future localization, sorting or copy changes must not change animation identity.
 */
export function isVehiclePickerMotionKey(value: string) {
  return value.startsWith(`${ROOT}:`);
}
