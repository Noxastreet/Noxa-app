import type { LatLng } from "./types";

export type EventLocationPickerProps = {
  confirmLabel?: string;
  headerTitle?: string;
  initialCoordinate: LatLng;
  isLocating: boolean;
  onCancel: () => void;
  onConfirm: (coordinate: LatLng) => void;
  onUseCurrentLocation: () => void;
};
