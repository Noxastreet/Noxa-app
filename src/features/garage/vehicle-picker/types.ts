import type { SupportedVehicleType } from "@/src/data/vehicleCatalogRegistry";

export type VehiclePickerStep =
  | "type"
  | "make"
  | "model"
  | "generation"
  | "year"
  | "color"
  | "photo"
  | "confirm";

export type VehiclePickerCardKind = "type" | "make" | "model" | "generation" | "year";

export type VehiclePickerSelection = {
  vehicleType: SupportedVehicleType | null;
  makeId: string | null;
  modelId: string | null;
  generationId: string | null;
  year: number | null;
};

type BasePickerCardItem = {
  id: string;
  label: string;
  motionKey: string;
  kind: VehiclePickerCardKind;
};

export type VehicleTypePickerItem = BasePickerCardItem & {
  kind: "type";
  vehicleType: SupportedVehicleType;
};

export type VehicleMakePickerItem = BasePickerCardItem & {
  kind: "make";
  vehicleType: SupportedVehicleType;
  makeId: string;
  popular: boolean;
};

export type VehicleModelPickerItem = BasePickerCardItem & {
  kind: "model";
  vehicleType: SupportedVehicleType;
  makeId: string;
  modelId: string;
  hasGenerations: boolean;
};

export type VehicleGenerationPickerItem = BasePickerCardItem & {
  kind: "generation";
  vehicleType: SupportedVehicleType;
  makeId: string;
  modelId: string;
  generationId: string;
};

export type VehicleYearPickerItem = BasePickerCardItem & {
  kind: "year";
  vehicleType: SupportedVehicleType;
  makeId: string;
  modelId: string;
  generationId: string | null;
  year: number;
};

export type VehiclePickerCardItem =
  | VehicleTypePickerItem
  | VehicleMakePickerItem
  | VehicleModelPickerItem
  | VehicleGenerationPickerItem
  | VehicleYearPickerItem;

export const emptyVehiclePickerSelection: VehiclePickerSelection = {
  vehicleType: null,
  makeId: null,
  modelId: null,
  generationId: null,
  year: null,
};
