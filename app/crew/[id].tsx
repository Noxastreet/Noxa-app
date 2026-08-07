import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import CanonicalCrewDetailScreen from "@/src/features/crews-events/CanonicalCrewDetailScreen";
import { EntityCoverControl } from "@/src/features/crews-events/EntityCoverControl";

export default function CrewDetailRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const crewId = Array.isArray(params.id) ? params.id[0] : params.id || "";
  const [revision, setRevision] = useState(0);

  return (
    <View style={{ flex: 1 }}>
      <CanonicalCrewDetailScreen key={`${crewId}-${revision}`} />
      {crewId ? (
        <EntityCoverControl
          entityId={crewId}
          kind="crew"
          onChanged={() => setRevision((value) => value + 1)}
        />
      ) : null}
    </View>
  );
}
