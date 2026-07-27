import type { LatLng } from "./types";

export type EventLocationPickerProps = {
  initialCoordinate: LatLng;
  isLocating: boolean;
  onCancel: () => void;
  onConfirm: (coordinate: LatLng) => void;
  onUseCurrentLocation: () => void;
};
