import { type ComponentType, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { MapboxStateView } from "./MapboxStateView";
import { getMapboxRuntime } from "./native";
import type { LatLng } from "./types";

type Props = { coordinate: LatLng };

export function MapboxEventPreviewCompat(props: Props) {
  const [Preview, setPreview] = useState<ComponentType<Props> | null>(null);
  const [runtime] = useState(getMapboxRuntime);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (runtime !== "native") return undefined;

    import("./MapboxEventPreview")
      .then((module) => mounted && setPreview(() => module.MapboxEventPreview))
      .catch((error) => {
        if (mounted) {
          console.error("[noxa-mapbox] Failed to load MapboxEventPreview.", error);
          setLoadFailed(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [runtime]);

  if (Preview) return <Preview {...props} />;

  if (runtime === "native" && !loadFailed) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <MapboxStateView loading />
      </View>
    );
  }

  const state = runtime === "expo-go"
    ? {
        title: "Map preview unavailable in Expo Go",
        message: "Use a NOXA development or production build to load the native Mapbox preview.",
      }
    : runtime === "web"
      ? {
          title: "Map preview unavailable on web",
          message: "The native map preview is available in the iOS and Android app.",
        }
      : {
          title: "Map preview failed to load",
          message: "The native Mapbox module could not be initialized in this build.",
        };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapboxStateView {...state} />
    </View>
  );
}
