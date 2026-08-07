import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import CanonicalEventDetailScreen from "@/src/features/crews-events/CanonicalEventDetailScreen";
import { EntityCoverControl } from "@/src/features/crews-events/EntityCoverControl";

export default function EventDetailRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === "string" ? params.id : "";
  const [revision, setRevision] = useState(0);

  return (
    <View style={{ flex: 1 }}>
      <CanonicalEventDetailScreen key={`${eventId}-${revision}`} />
      {eventId ? (
        <EntityCoverControl
          entityId={eventId}
          kind="event"
          onChanged={() => setRevision((value) => value + 1)}
        />
      ) : null}
    </View>
  );
}
