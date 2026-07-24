import { type ComponentType, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { MapboxStateView } from "./MapboxStateView";
import { hasMapboxNativeModule } from "./native";
import type { LatLng } from "./types";

type Props = { coordinate: LatLng };

export function MapboxEventPreviewCompat(props: Props) {
  const [Preview, setPreview] = useState<ComponentType<Props> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const canUseMapbox = hasMapboxNativeModule();
  useEffect(() => {
    let mounted = true;
    if (!canUseMapbox) return undefined;
    import("./MapboxEventPreview")
      .then((module) => mounted && setPreview(() => module.MapboxEventPreview))
      .catch(() => mounted && setLoadFailed(true));
    return () => { mounted = false; };
  }, [canUseMapbox]);
  if (Preview) return <Preview {...props} />;
  return <View style={StyleSheet.absoluteFillObject}><MapboxStateView loading={canUseMapbox && !loadFailed} /></View>;
}
