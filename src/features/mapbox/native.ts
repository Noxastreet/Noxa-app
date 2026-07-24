import { NativeModules, Platform, UIManager } from "react-native";

export function hasMapboxNativeModule() {
  if (Platform.OS === "web") return false;
  return Boolean(
    NativeModules.RNMBXModule && UIManager.getViewManagerConfig?.("RNMBXMapView"),
  );
}
