import fs from 'node:fs';

const file = 'app/(tabs)/index.tsx';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`F12 patch anchor missing: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`F12 patch anchor is not unique: ${label}`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceOnceAfter(label, anchor, before, after) {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`F12 patch scope missing: ${label}`);
  const first = source.indexOf(before, anchorIndex);
  if (first < 0) throw new Error(`F12 patch anchor missing in scope: ${label}`);
  const scopeEnd = source.indexOf('\n  const ', anchorIndex + anchor.length);
  if (scopeEnd >= 0) {
    const second = source.indexOf(before, first + before.length);
    if (second >= 0 && second < scopeEnd) {
      throw new Error(`F12 patch anchor is not unique in scope: ${label}`);
    }
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  'ActiveDriver updated_at',
  `type ActiveDriver = {\n  user_id: string;\n  latitude: number;\n  longitude: number;\n  profile: ProfileMarkerRow | null;\n};`,
  `type ActiveDriver = {\n  user_id: string;\n  latitude: number;\n  longitude: number;\n  updated_at: string;\n  profile: ProfileMarkerRow | null;\n};`,
);

replaceOnce(
  'normalizeActiveDriver updated_at',
  `  return {\n    user_id: row.user_id,\n    latitude: row.latitude,\n    longitude: row.longitude,\n    profile,\n  };`,
  `  return {\n    user_id: row.user_id,\n    latitude: row.latitude,\n    longitude: row.longitude,\n    updated_at: row.updated_at,\n    profile,\n  };`,
);

replaceOnce(
  'driver runtime refs',
  `  const activeDriversRequestIdRef = useRef(0);\n  const activeDriversRefreshInFlightRef = useRef(false);\n  const activeDriversRefreshQueuedRef = useRef(false);`,
  `  const activeDriversRequestIdRef = useRef(0);\n  const activeDriversRefreshInFlightRef = useRef(false);\n  const activeDriversRefreshQueuedRef = useRef(false);\n  const activeDriversRef = useRef<ActiveDriver[]>([]);\n  const currentUserIdRef = useRef<string | null>(null);\n  const mapFocusedRef = useRef(false);`,
);

replaceOnce(
  'driver refs current assignment',
  `  driverLocationRef.current = driverLocation;`,
  `  driverLocationRef.current = driverLocation;\n  activeDriversRef.current = activeDrivers;`,
);

replaceOnceAfter(
  'current user ref',
  `  const refreshActiveDrivers = useCallback(async () => {`,
  `      const userId = sessionData.session?.user.id;\n      if (!userId) {`,
  `      const userId = sessionData.session?.user.id;\n      currentUserIdRef.current = userId ?? null;\n      if (!userId) {`,
);

replaceOnce(
  'clear active driver ref without session',
  `          setActiveDrivers([]);\n          setActiveDriversRequestState("ready");`,
  `          activeDriversRef.current = [];\n          setActiveDrivers([]);\n          setActiveDriversRequestState("ready");`,
);

replaceOnce(
  'merge fetched drivers',
  `      const drivers = ((data ?? []) as ActiveDriverRow[])\n        .map(normalizeActiveDriver)\n        .filter((driver): driver is ActiveDriver => driver !== null);\n\n      setActiveDrivers(drivers);\n      setActiveDriversRequestState("ready");`,
  `      const drivers = ((data ?? []) as ActiveDriverRow[])\n        .map(normalizeActiveDriver)\n        .filter((driver): driver is ActiveDriver => driver !== null);\n      const currentByUserId = new Map(\n        activeDriversRef.current.map((driver) => [driver.user_id, driver]),\n      );\n      const mergedDrivers = drivers.map((driver) => {\n        const current = currentByUserId.get(driver.user_id);\n        if (!current) return driver;\n        const currentUpdatedAt = Date.parse(current.updated_at);\n        const fetchedUpdatedAt = Date.parse(driver.updated_at);\n        return Number.isFinite(currentUpdatedAt) &&\n          (!Number.isFinite(fetchedUpdatedAt) || currentUpdatedAt > fetchedUpdatedAt)\n          ? current\n          : driver;\n      });\n\n      activeDriversRef.current = mergedDrivers;\n      setActiveDrivers(mergedDrivers);\n      setActiveDriversRequestState("ready");`,
);

const oldLifecycle = `  useEffect(() => {\n    let isActive = true;\n    isMountedRef.current = true;\n    void restoreLiveDriveSession();\n    void refreshActiveDrivers();\n    void loadCurrentProfile();\n    void loadMyDriverIds();\n    const { data: authListener } = supabase.auth.onAuthStateChange(\n      (event, session) => {\n        if (!isActive) return;\n        if (event === "SIGNED_OUT" || !session) {\n          setCurrentProfile(null);\n          setMyDriverIds(new Set());\n          void stopSharing(true);\n          return;\n        }\n        void loadCurrentProfile();\n        void loadMyDriverIds();\n      },\n    );\n    const refreshInterval = setInterval(() => {\n      if (isActive && isAppForegroundRef.current) void refreshActiveDrivers();\n    }, DRIVER_LIST_REFRESH_MS);\n    const channel = supabase.channel(createDriverLocationsMapTopic());\n    channel.on(\n      "postgres_changes",\n      { event: "*", schema: "public", table: "driver_locations" },\n      () => {\n        if (isActive) void refreshActiveDrivers();\n      },\n    );\n    channel.subscribe((status) => {\n      if (status === "CHANNEL_ERROR" && isActive && isMountedRef.current) {\n        setSharingError(\n          (current) => current ?? "Live driver updates are reconnecting.",\n        );\n      }\n    });\n\n    return () => {\n      isActive = false;\n      isMountedRef.current = false;\n      activeDriversRequestIdRef.current += 1;\n      latestPresencePayloadRef.current = null;\n      sharingUserIdRef.current = null;\n      clearInterval(refreshInterval);\n      void supabase.removeChannel(channel);\n      authListener.subscription.unsubscribe();\n    };\n  }, [\n    loadCurrentProfile,\n    loadMyDriverIds,\n    refreshActiveDrivers,\n    restoreLiveDriveSession,\n    stopSharing,\n  ]);`;

const newLifecycle = `  useEffect(() => {\n    let isActive = true;\n    isMountedRef.current = true;\n    void restoreLiveDriveSession();\n    void loadCurrentProfile();\n    void loadMyDriverIds();\n    const { data: authListener } = supabase.auth.onAuthStateChange(\n      (event, session) => {\n        if (!isActive) return;\n        if (event === "SIGNED_OUT" || !session) {\n          currentUserIdRef.current = null;\n          activeDriversRef.current = [];\n          setActiveDrivers([]);\n          setCurrentProfile(null);\n          setMyDriverIds(new Set());\n          void stopSharing(true);\n          return;\n        }\n        currentUserIdRef.current = session.user.id;\n        void loadCurrentProfile();\n        void loadMyDriverIds();\n      },\n    );\n\n    return () => {\n      isActive = false;\n      isMountedRef.current = false;\n      mapFocusedRef.current = false;\n      activeDriversRequestIdRef.current += 1;\n      activeDriversRef.current = [];\n      currentUserIdRef.current = null;\n      latestPresencePayloadRef.current = null;\n      sharingUserIdRef.current = null;\n      authListener.subscription.unsubscribe();\n    };\n  }, [\n    loadCurrentProfile,\n    loadMyDriverIds,\n    restoreLiveDriveSession,\n    stopSharing,\n  ]);\n\n  useFocusEffect(\n    useCallback(() => {\n      let isActive = true;\n      mapFocusedRef.current = true;\n      void refreshActiveDrivers();\n\n      const refreshInterval = setInterval(() => {\n        if (isActive && isAppForegroundRef.current) void refreshActiveDrivers();\n      }, DRIVER_LIST_REFRESH_MS);\n      const channel = supabase.channel(createDriverLocationsMapTopic());\n      channel.on(\n        "postgres_changes",\n        { event: "*", schema: "public", table: "driver_locations" },\n        (payload) => {\n          if (!isActive || !isAppForegroundRef.current) return;\n          const nextRow = payload.new as Partial<ActiveDriverRow>;\n          const oldRow = payload.old as Partial<ActiveDriverRow>;\n          const userId =\n            typeof nextRow.user_id === "string"\n              ? nextRow.user_id\n              : typeof oldRow.user_id === "string"\n                ? oldRow.user_id\n                : null;\n          if (!userId) {\n            void refreshActiveDrivers();\n            return;\n          }\n          if (userId === currentUserIdRef.current) return;\n\n          if (payload.eventType === "DELETE") {\n            const nextDrivers = activeDriversRef.current.filter(\n              (driver) => driver.user_id !== userId,\n            );\n            if (nextDrivers.length !== activeDriversRef.current.length) {\n              activeDriversRef.current = nextDrivers;\n              setActiveDrivers(nextDrivers);\n            }\n            return;\n          }\n\n          const latitude =\n            typeof nextRow.latitude === "number" ? nextRow.latitude : Number.NaN;\n          const longitude =\n            typeof nextRow.longitude === "number" ? nextRow.longitude : Number.NaN;\n          const updatedAt =\n            typeof nextRow.updated_at === "string" ? nextRow.updated_at : null;\n          if (!updatedAt || !hasValidLatLng(latitude, longitude)) {\n            void refreshActiveDrivers();\n            return;\n          }\n\n          const driverIndex = activeDriversRef.current.findIndex(\n            (driver) => driver.user_id === userId,\n          );\n          if (driverIndex < 0) {\n            // New or newly-visible drivers still go through the authorized joined\n            // SELECT so profile disclosure remains governed by the existing query.\n            void refreshActiveDrivers();\n            return;\n          }\n\n          const current = activeDriversRef.current[driverIndex];\n          const currentUpdatedAt = Date.parse(current.updated_at);\n          const nextUpdatedAt = Date.parse(updatedAt);\n          if (\n            Number.isFinite(currentUpdatedAt) &&\n            Number.isFinite(nextUpdatedAt) &&\n            nextUpdatedAt <= currentUpdatedAt\n          ) {\n            return;\n          }\n\n          const nextDrivers = [...activeDriversRef.current];\n          nextDrivers[driverIndex] = {\n            ...current,\n            latitude,\n            longitude,\n            updated_at: updatedAt,\n          };\n          activeDriversRef.current = nextDrivers;\n          setActiveDrivers(nextDrivers);\n        },\n      );\n      channel.subscribe((status) => {\n        if (status === "SUBSCRIBED" && isActive) {\n          // Close the snapshot-to-subscription gap once, not on every location event.\n          void refreshActiveDrivers();\n        } else if (\n          status === "CHANNEL_ERROR" &&\n          isActive &&\n          isMountedRef.current\n        ) {\n          setSharingError(\n            (current) => current ?? "Live driver updates are reconnecting.",\n          );\n        }\n      });\n\n      return () => {\n        isActive = false;\n        mapFocusedRef.current = false;\n        clearInterval(refreshInterval);\n        void supabase.removeChannel(channel);\n      };\n    }, [refreshActiveDrivers]),\n  );`;

replaceOnce('map data lifecycle', oldLifecycle, newLifecycle);

replaceOnce(
  'AppState focused refresh',
  `  useEffect(() => {\n    const subscription = AppState.addEventListener("change", (nextState) => {\n      isAppForegroundRef.current = nextState === "active";\n      if (nextState === "active") void restoreLiveDriveSession();\n    });\n    return () => subscription.remove();\n  }, [restoreLiveDriveSession]);`,
  `  useEffect(() => {\n    const subscription = AppState.addEventListener("change", (nextState) => {\n      isAppForegroundRef.current = nextState === "active";\n      if (nextState === "active") {\n        void restoreLiveDriveSession();\n        if (mapFocusedRef.current) void refreshActiveDrivers();\n      }\n    });\n    return () => subscription.remove();\n  }, [refreshActiveDrivers, restoreLiveDriveSession]);`,
);

fs.writeFileSync(file, source);
console.log('Applied F12 Home Map performance patch.');
