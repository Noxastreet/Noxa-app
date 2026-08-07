export type VehiclePickerStep =
  | "make"
  | "model"
  | "generation"
  | "year"
  | "color"
  | "photo"
  | "confirm";

export type VehiclePickerCardKind = "make" | "model" | "generation" | "year";

export type VehiclePickerSelection = {
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

export type VehicleMakePickerItem = BasePickerCardItem & {
  kind: "make";
  makeId: string;
  popular: boolean;
};

export type VehicleModelPickerItem = BasePickerCardItem & {
  kind: "model";
  makeId: string;
  modelId: string;
  hasGenerations: boolean;
};

export type VehicleGenerationPickerItem = BasePickerCardItem & {
  kind: "generation";
  makeId: string;
  modelId: string;
  generationId: string;
};

export type VehicleYearPickerItem = BasePickerCardItem & {
  kind: "year";
  makeId: string;
  modelId: string;
  generationId: string | null;
  year: number;
};

export type VehiclePickerCardItem =
  | VehicleMakePickerItem
  | VehicleModelPickerItem
  | VehicleGenerationPickerItem
  | VehicleYearPickerItem;

export const emptyVehiclePickerSelection: VehiclePickerSelection = {
  makeId: null,
  modelId: null,
  generationId: null,
  year: null,
};
