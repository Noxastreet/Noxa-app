import { useCallback, useEffect, useRef, useState } from 'react';

import {
  calculateDriveRoute,
  publishQuickDriveNavigationProgress,
} from '../api';
import type {
  DriveDestination,
  DriveRouteResult,
} from '../types';
import {
  readLocalNavigationLocation,
  watchLocalNavigationLocation,
  type LocalNavigationLocation,
} from './localNavigationLocation';
import {
  emptyQuickRerouteState,
  prepareQuickRoute,
  projectQuickNavigation,
  updateQuickRerouteState,
  type QuickNavigationProjection,
  type QuickRerouteState,
} from './quickNavigation';

type QuickNavigationStatus =
  | 'idle'
  | 'locating'
  | 'routing'
  | 'navigating'
  | 'rerouting'
  | 'arrived'
  | 'error';

type Options = {
  driveSessionId: string | null;
  destination: DriveDestination | null;
  active: boolean;
  publishProgressEnabled: boolean;
  onRoomEnded?: () => void;
};

const PROGRESS_PUBLISH_MIN_MS = 4_500;
const PROGRESS_PUBLISH_DELTA_METERS = 15;

export function useQuickDriveNavigation({
  driveSessionId,
  destination,
  active,
  publishProgressEnabled,
  onRoomEnded,
}: Options) {
  const [route, setRoute] = useState<DriveRouteResult | null>(null);
  const [location, setLocation] = useState<LocalNavigationLocation | null>(null);
  const [projection, setProjection] = useState<QuickNavigationProjection | null>(null);
  const [status, setStatus] = useState<QuickNavigationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const routeRef = useRef<DriveRouteResult | null>(null);
  const preparedRouteRef = useRef<ReturnType<typeof prepareQuickRoute>>(null);
  const locationRef = useRef<LocalNavigationLocation | null>(null);
  const destinationRef = useRef<DriveDestination | null>(null);
  const routingPromiseRef = useRef<Promise<void> | null>(null);
  const routeGenerationRef = useRef(0);
  const rerouteStateRef = useRef<QuickRerouteState>(emptyQuickRerouteState());
  const lastPublishedAtRef = useRef(0);
  const lastPublishedDistanceRef = useRef<number | null>(null);
  const lastPublishedArrivedRef = useRef(false);

  const resetRoute = useCallback(() => {
    routeGenerationRef.current += 1;
    routeRef.current = null;
    preparedRouteRef.current = null;
    rerouteStateRef.current = emptyQuickRerouteState();
    lastPublishedDistanceRef.current = null;
    lastPublishedArrivedRef.current = false;
    setRoute(null);
    setProjection(null);
  }, []);

  const buildRoute = useCallback(async (
    origin: LocalNavigationLocation,
    rerouting = false,
  ) => {
    const target = destinationRef.current;
    if (!active || !driveSessionId || !target) return;
    if (routingPromiseRef.current) return routingPromiseRef.current;

    const generation = ++routeGenerationRef.current;
    if (mountedRef.current) {
      setStatus(rerouting ? 'rerouting' : 'routing');
      setError(null);
    }

    const promise = calculateDriveRoute([
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: target.latitude, longitude: target.longitude },
    ])
      .then((nextRoute) => {
        if (
          !mountedRef.current
          || generation !== routeGenerationRef.current
          || destinationRef.current?.version !== target.version
        ) {
          return;
        }
        const prepared = prepareQuickRoute(nextRoute);
        if (!prepared) throw new Error('The route could not be prepared.');
        routeRef.current = nextRoute;
        preparedRouteRef.current = prepared;
        rerouteStateRef.current = {
          offRouteConfirmations: 0,
          lastRerouteAtMs: Date.now(),
        };
        setRoute(nextRoute);
        setStatus('navigating');
      })
      .catch((routeError) => {
        if (!mountedRef.current || generation !== routeGenerationRef.current) return;
        setStatus('error');
        setError(routeError instanceof Error ? routeError.message : 'Route unavailable.');
      })
      .finally(() => {
        if (routingPromiseRef.current === promise) routingPromiseRef.current = null;
      });

    routingPromiseRef.current = promise;
    return promise;
  }, [active, driveSessionId]);

  const publishProgress = useCallback(async (
    currentLocation: LocalNavigationLocation,
    currentProjection: QuickNavigationProjection,
  ) => {
    const target = destinationRef.current;
    if (!active || !publishProgressEnabled || !driveSessionId || !target) return;

    const now = Date.now();
    const distanceDelta =
      lastPublishedDistanceRef.current === null
        ? Infinity
        : Math.abs(
            currentProjection.remainingDistanceMeters
              - lastPublishedDistanceRef.current,
          );
    const arrivedChanged =
      currentProjection.arrived !== lastPublishedArrivedRef.current;
    if (
      !arrivedChanged
      && now - lastPublishedAtRef.current < PROGRESS_PUBLISH_MIN_MS
      && distanceDelta < PROGRESS_PUBLISH_DELTA_METERS
    ) {
      return;
    }

    lastPublishedAtRef.current = now;
    lastPublishedDistanceRef.current = currentProjection.remainingDistanceMeters;
    lastPublishedArrivedRef.current = currentProjection.arrived;

    try {
      const result = await publishQuickDriveNavigationProgress(
        driveSessionId,
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          heading: currentLocation.heading,
          destinationVersion: target.version,
          remainingDistanceMeters: currentProjection.remainingDistanceMeters,
          status: currentProjection.arrived ? 'arrived' : 'moving',
        },
      );
      if (result.ended) onRoomEnded?.();
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : '';
      if (/destination changed/i.test(message)) {
        const latestLocation = locationRef.current;
        resetRoute();
        if (latestLocation) void buildRoute(latestLocation, true);
      }
    }
  }, [
    active,
    buildRoute,
    driveSessionId,
    onRoomEnded,
    publishProgressEnabled,
    resetRoute,
  ]);

  const handleLocation = useCallback((nextLocation: LocalNavigationLocation) => {
    locationRef.current = nextLocation;
    if (mountedRef.current) setLocation(nextLocation);

    const prepared = preparedRouteRef.current;
    const currentRoute = routeRef.current;
    if (!prepared || !currentRoute) {
      if (!routingPromiseRef.current) void buildRoute(nextLocation, false);
      return;
    }

    const nextProjection = projectQuickNavigation(
      prepared,
      currentRoute.maneuvers,
      nextLocation,
    );
    if (!nextProjection) return;

    if (mountedRef.current) {
      setProjection(nextProjection);
      setStatus(nextProjection.arrived ? 'arrived' : 'navigating');
    }

    void publishProgress(nextLocation, nextProjection);

    if (nextProjection.arrived) return;

    const reroute = updateQuickRerouteState(
      rerouteStateRef.current,
      nextProjection.distanceFromRouteMeters,
      Date.now(),
    );
    rerouteStateRef.current = reroute.state;
    if (reroute.shouldReroute) void buildRoute(nextLocation, true);
  }, [buildRoute, publishProgress]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      routeGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    destinationRef.current = destination;
    resetRoute();
    if (!active || !driveSessionId || !destination) {
      setStatus('idle');
      setError(null);
      return;
    }

    let disposed = false;
    setStatus('locating');
    void readLocalNavigationLocation(true)
      .then((current) => {
        if (disposed || !current) {
          if (!disposed) {
            setStatus('error');
            setError('Location is required to build your route.');
          }
          return;
        }
        handleLocation(current);
      })
      .catch(() => {
        if (!disposed) {
          setStatus('error');
          setError('Current location is unavailable.');
        }
      });

    return () => {
      disposed = true;
    };
  }, [
    active,
    destination,
    driveSessionId,
    handleLocation,
    resetRoute,
  ]);

  useEffect(() => {
    if (!active || !driveSessionId || !destination) return undefined;
    let disposed = false;
    let stopWatching: (() => void) | null = null;

    void watchLocalNavigationLocation((nextLocation) => {
      if (!disposed) handleLocation(nextLocation);
    }).then((stop) => {
      if (disposed) stop();
      else stopWatching = stop;
    });

    return () => {
      disposed = true;
      stopWatching?.();
    };
  }, [active, destination, driveSessionId, handleLocation]);

  const retry = useCallback(() => {
    const current = locationRef.current;
    if (current) void buildRoute(current, true);
  }, [buildRoute]);

  return {
    route,
    location,
    projection,
    status,
    error,
    retry,
  };
}
