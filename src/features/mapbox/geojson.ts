import type {
  LatLng,
  MapboxDriver,
  MapboxEvent,
  MapboxRoute,
} from "./types";

type PointFeatureProperties = {
  id: string;
  type: "driver" | "event";
  title: string;
  selected?: boolean;
};

type LineFeatureProperties = {
  id: string;
};

export type PointFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  PointFeatureProperties
>;

export type RouteFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  LineFeatureProperties
>;

export function toPosition(point: LatLng): [number, number] {
  return [point.longitude, point.latitude];
}

export function createDriverFeatureCollection(
  drivers: MapboxDriver[],
): PointFeatureCollection {
  return {
    type: "FeatureCollection",
    features: drivers.map((driver) => ({
      type: "Feature",
      id: driver.user_id,
      properties: {
        id: driver.user_id,
        type: "driver",
        title: driver.label,
      },
      geometry: {
        type: "Point",
        coordinates: toPosition(driver),
      },
    })),
  };
}

export function createEventFeatureCollection(
  events: MapboxEvent[],
  selectedEventId: string | null,
): PointFeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map((event) => ({
      type: "Feature",
      id: event.id,
      properties: {
        id: event.id,
        type: "event",
        title: event.title,
        selected: event.id === selectedEventId,
      },
      geometry: {
        type: "Point",
        coordinates: toPosition(event),
      },
    })),
  };
}

export function createRouteFeature(route: MapboxRoute | null): RouteFeature | null {
  if (!route || route.coordinates.length < 2) return null;
  return {
    type: "Feature",
    properties: { id: "active-route" },
    geometry: {
      type: "LineString",
      coordinates: route.coordinates.map(toPosition),
    },
  };
}
