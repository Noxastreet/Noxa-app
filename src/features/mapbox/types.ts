import type { EventCategory } from "@/src/lib/eventExperience";

export type LatLng = { latitude: number; longitude: number };

export type MapRegion = LatLng & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapboxDriver = {
  user_id: string;
  latitude: number;
  longitude: number;
  label: string;
  avatar_url: string | null;
  username?: string | null;
  vehicle_label?: string | null;
  distance_meters?: number | null;
  can_invite_directly?: boolean;
  is_relevant?: boolean;
  is_dimmed?: boolean;
};

export type MapboxEvent = {
  id: string;
  title: string;
  category: EventCategory;
  latitude: number;
  longitude: number;
};

export type MapboxMapFilter = "all" | "drivers" | "events";

export type MapboxRoute = {
  coordinates: LatLng[];
};

export type MapboxLiveMapProps = {
  initialRegion: MapRegion;
  driverLocation: LatLng | null;
  activeDrivers: MapboxDriver[];
  events: MapboxEvent[];
  route: MapboxRoute | null;
  selectedEventId: string | null;
  mapFilter: MapboxMapFilter;
  isRouteMode: boolean;
  followUserLocation: boolean;
  onFollowUserLocationChange: (following: boolean) => void;
  onUserPan: () => void;
  onMapPress?: () => void;
  selectedDriverId?: string | null;
  onDriverPress: (driverId: string) => void;
  onDriverProfilePress?: (driverId: string) => void;
  onDriverInvitePress?: (driverId: string) => void;
  onEventPress: (event: MapboxEvent) => void;
};

export type LiveMapHandle = {
  animateToRegion: (region: MapRegion, duration?: number) => void;
  fitToCoordinates: (
    points: LatLng[],
    options?: {
      animated?: boolean;
      edgePadding?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
      };
    },
  ) => void;
};
