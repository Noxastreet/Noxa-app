import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

export type MapboxRuntime = "native" | "expo-go" | "web";

export function getMapboxRuntime(): MapboxRuntime {
  if (Platform.OS === "web") return "web";
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return "expo-go";
  }
  return "native";
}
