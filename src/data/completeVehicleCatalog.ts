import {
  VEHICLE_CATALOG_YEAR,
  getYearsForRanges,
  vehicleCatalog,
  type VehicleCatalogGeneration,
  type VehicleCatalogMake,
  type VehicleCatalogModel,
} from "./vehicleCatalog";
import { vehicleCatalogPhase2 } from "./vehicleCatalogPhase2";
import { vehicleCatalogPhase3 } from "./vehicleCatalogPhase3";

export const completeVehicleCatalog: VehicleCatalogMake[] = [
  ...vehicleCatalog,
  ...vehicleCatalogPhase2,
  ...vehicleCatalogPhase3,
];

export function getCompleteVehicleMake(makeId: string) {
  return completeVehicleCatalog.find((make) => make.id === makeId) ?? null;
}

export function getCompleteVehicleModel(makeId: string, modelId: string) {
  return getCompleteVehicleMake(makeId)?.models.find((model) => model.id === modelId) ?? null;
}

export function getCompleteVehicleGeneration(
  makeId: string,
  modelId: string,
  generationId: string,
) {
  return (
    getCompleteVehicleModel(makeId, modelId)?.generations?.find(
      (generation) => generation.id === generationId,
    ) ?? null
  );
}

export function getCompleteVehicleYears(
  makeId: string,
  modelId: string,
  generationId?: string | null,
) {
  const model = getCompleteVehicleModel(makeId, modelId);
  if (!model) return [];

  if (generationId) {
    const generation = model.generations?.find((item) => item.id === generationId);
    return generation ? getYearsForRanges(generation.yearRanges) : [];
  }

  return getYearsForRanges(model.yearRanges);
}

type CatalogIdentityIssue = {
  scope: "make" | "model" | "generation";
  id: string;
  parentId?: string;
};

/**
 * Development helper: stable ids are part of the picker/motion contract.
 * Duplicate ids make list reconciliation and shared transitions ambiguous.
 */
export function findVehicleCatalogIdentityIssues(
  catalog: VehicleCatalogMake[] = completeVehicleCatalog,
): CatalogIdentityIssue[] {
  const issues: CatalogIdentityIssue[] = [];
  const makeIds = new Set<string>();

  for (const make of catalog) {
    if (makeIds.has(make.id)) {
      issues.push({ scope: "make", id: make.id });
    }
    makeIds.add(make.id);

    const modelIds = new Set<string>();
    for (const model of make.models) {
      if (modelIds.has(model.id)) {
        issues.push({ scope: "model", id: model.id, parentId: make.id });
      }
      modelIds.add(model.id);

      const generationIds = new Set<string>();
      for (const generation of model.generations ?? []) {
        if (generationIds.has(generation.id)) {
          issues.push({
            scope: "generation",
            id: generation.id,
            parentId: `${make.id}/${model.id}`,
          });
        }
        generationIds.add(generation.id);
      }
    }
  }

  return issues;
}

export type {
  VehicleCatalogGeneration,
  VehicleCatalogMake,
  VehicleCatalogModel,
};
export { VEHICLE_CATALOG_YEAR };
