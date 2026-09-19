import { Redirect, type Href, useLocalSearchParams } from "expo-router";

export default function LegacyGroupDriveLobbyRedirect() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const driveSessionId = Array.isArray(params.id) ? params.id[0] : params.id;

  const destination = driveSessionId
    ? {
        pathname: "/(tabs)",
        params: { groupDriveId: driveSessionId },
      }
    : "/(tabs)";

  return <Redirect href={destination as Href} />;
}
