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

  const state = runtime === "web"
    ? {
        title: "Map preview unavailable",
        message: "Open this event in the iOS or Android app to see its map preview.",
      }
    : runtime === "expo-go"
      ? {
          title: "Map preview unavailable",
          message: "Open NOXA in a development or production build to see the map preview.",
        }
      : {
          title: "Map preview unavailable",
          message: "The map preview could not load. Restart NOXA and try again.",
        };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapboxStateView {...state} />
    </View>
  );
}