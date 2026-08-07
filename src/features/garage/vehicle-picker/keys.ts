const ROOT = "vehicle-picker";

export const vehiclePickerMotionKey = {
  make: (makeId: string) => `${ROOT}:make:${makeId}`,
  model: (makeId: string, modelId: string) =>
    `${ROOT}:model:${makeId}:${modelId}`,
  generation: (makeId: string, modelId: string, generationId: string) =>
    `${ROOT}:generation:${makeId}:${modelId}:${generationId}`,
  year: (
    makeId: string,
    modelId: string,
    generationId: string | null,
    year: number,
  ) =>
    `${ROOT}:year:${makeId}:${modelId}:${generationId ?? "all"}:${year}`,
} as const;

/**
 * Motion keys are intentionally independent from visible labels.
 * Future localization, sorting or copy changes must not change animation identity.
 */
export function isVehiclePickerMotionKey(value: string) {
  return value.startsWith(`${ROOT}:`);
}
