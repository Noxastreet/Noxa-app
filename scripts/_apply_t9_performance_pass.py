from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, count))


# 1) Memoize the authenticated user in-process. Core tabs should not re-read the
# auth storage path on every focus just to recover the same user object.
replace(
    "src/lib/supabase.ts",
    "import { createClient } from '@supabase/supabase-js';",
    "import { createClient, type User } from '@supabase/supabase-js';",
)
replace(
    "src/lib/supabase.ts",
    "export async function getCurrentSessionUser() {\n  const { data } = await supabase.auth.getSession();\n  return data.session?.user ?? null;\n}\n",
    "let cachedSessionUser: User | null | undefined;\nlet sessionUserPromise: Promise<User | null> | null = null;\n\nsupabase.auth.onAuthStateChange((_event, session) => {\n  cachedSessionUser = session?.user ?? null;\n});\n\nexport async function getCurrentSessionUser() {\n  if (cachedSessionUser !== undefined) return cachedSessionUser;\n\n  if (!sessionUserPromise) {\n    sessionUserPromise = supabase.auth\n      .getSession()\n      .then(({ data }) => {\n        cachedSessionUser = data.session?.user ?? null;\n        return cachedSessionUser;\n      })\n      .finally(() => {\n        sessionUserPromise = null;\n      });\n  }\n\n  return sessionUserPromise;\n}\n",
)

# 2) Garage: keep a short stale window so tab hopping does not refetch the same
# vehicle list repeatedly. Mutations still call loadVehicles directly.
replace(
    "app/(tabs)/garage.tsx",
    "`;\n\nfunction vehicleMeta(vehicle: GarageVehicle) {",
    "`;\n\nconst GARAGE_REFRESH_TTL_MS = 60_000;\n\nfunction vehicleMeta(vehicle: GarageVehicle) {",
)
replace(
    "app/(tabs)/garage.tsx",
    "  const hasLoadedVehiclesRef = useRef(false);\n",
    "  const hasLoadedVehiclesRef = useRef(false);\n  const lastLoadedVehiclesAtRef = useRef(0);\n",
)
replace(
    "app/(tabs)/garage.tsx",
    "    } else {\n      setVehicles((data ?? []) as GarageVehicle[]);\n    }\n\n    hasLoadedVehiclesRef.current = true;",
    "    } else {\n      setVehicles((data ?? []) as GarageVehicle[]);\n      lastLoadedVehiclesAtRef.current = Date.now();\n    }\n\n    hasLoadedVehiclesRef.current = true;",
)
replace(
    "app/(tabs)/garage.tsx",
    "  useFocusEffect(\n    useCallback(() => {\n      void loadVehicles();\n    }, [loadVehicles]),\n  );",
    "  useFocusEffect(\n    useCallback(() => {\n      const shouldRefresh =\n        !hasLoadedVehiclesRef.current ||\n        Date.now() - lastLoadedVehiclesAtRef.current >= GARAGE_REFRESH_TTL_MS;\n      if (shouldRefresh) void loadVehicles();\n    }, [loadVehicles]),\n  );",
)

# 3) Profile: render the identity after one critical query, then hydrate counts,
# garage summary and posts in the background. Also avoid refetch on rapid tab hops.
replace(
    "app/(tabs)/profile.tsx",
    "function AccountActions({ isSigningOut, onSignOut }: { isSigningOut: boolean; onSignOut: () => void }) {",
    "const PROFILE_REFRESH_TTL_MS = 60_000;\n\nfunction AccountActions({ isSigningOut, onSignOut }: { isSigningOut: boolean; onSignOut: () => void }) {",
)
replace(
    "app/(tabs)/profile.tsx",
    "  const hasLoadedProfileRef = useRef(false);\n",
    "  const hasLoadedProfileRef = useRef(false);\n  const lastLoadedProfileAtRef = useRef(0);\n",
)
old_profile = """    const [profileResult, followersResult, followingResult, vehiclesResult, postsResult] = await Promise.all([\n      supabase\n        .from('profiles')\n        .select('id, display_name, username, avatar_url, bio, city, country_code')\n        .eq('id', user.id)\n        .single(),\n      supabase\n        .from('follows')\n        .select('follower_id', { count: 'exact', head: true })\n        .eq('following_id', user.id),\n      supabase\n        .from('follows')\n        .select('following_id', { count: 'exact', head: true })\n        .eq('follower_id', user.id),\n      supabase\n        .from('vehicles')\n        .select('id, vehicle_type, brand, model, year, horsepower, color, cover_image_url, is_primary', { count: 'exact' })\n        .eq('owner_id', user.id)\n        .order('is_primary', { ascending: false })\n        .order('created_at', { ascending: false })\n        .limit(1)\n        .maybeSingle(),\n      supabase\n        .from('posts')\n        .select('id,image_url,created_at')\n        .eq('author_id', user.id)\n        .order('created_at', { ascending: false })\n        .limit(12),\n    ]);\n\n    if (profileResult.error || followersResult.error || followingResult.error || vehiclesResult.error) {\n      setProfileError('Unable to load profile.');\n      hasLoadedProfileRef.current = true;\n      setIsProfileLoading(false);\n      return;\n    }\n\n    setProfileData(profileResult.data as CurrentUserProfile);\n    setFollowersCount(followersResult.count ?? 0);\n    setFollowingCount(followingResult.count ?? 0);\n    setVehiclesCount(vehiclesResult.count ?? 0);\n    setFeaturedVehicle((vehiclesResult.data as ProfileVehicle | null) ?? null);\n    setPosts(postsResult.error ? [] : (postsResult.data ?? []) as ProfilePost[]);\n    if (postsResult.error) setProfileError('Profile loaded, but moments are unavailable.');\n    hasLoadedProfileRef.current = true;\n    setIsProfileLoading(false);\n"""
new_profile = """    const profileResult = await supabase\n      .from('profiles')\n      .select('id, display_name, username, avatar_url, bio, city, country_code')\n      .eq('id', user.id)\n      .single();\n\n    if (profileResult.error) {\n      setProfileError('Unable to load profile.');\n      hasLoadedProfileRef.current = true;\n      setIsProfileLoading(false);\n      return;\n    }\n\n    setProfileData(profileResult.data as CurrentUserProfile);\n    hasLoadedProfileRef.current = true;\n    lastLoadedProfileAtRef.current = Date.now();\n    setIsProfileLoading(false);\n\n    const [followersResult, followingResult, vehiclesResult, postsResult] = await Promise.all([\n      supabase\n        .from('follows')\n        .select('follower_id', { count: 'exact', head: true })\n        .eq('following_id', user.id),\n      supabase\n        .from('follows')\n        .select('following_id', { count: 'exact', head: true })\n        .eq('follower_id', user.id),\n      supabase\n        .from('vehicles')\n        .select('id, vehicle_type, brand, model, year, horsepower, color, cover_image_url, is_primary', { count: 'exact' })\n        .eq('owner_id', user.id)\n        .order('is_primary', { ascending: false })\n        .order('created_at', { ascending: false })\n        .limit(1)\n        .maybeSingle(),\n      supabase\n        .from('posts')\n        .select('id,image_url,created_at')\n        .eq('author_id', user.id)\n        .order('created_at', { ascending: false })\n        .limit(12),\n    ]);\n\n    if (!followersResult.error) setFollowersCount(followersResult.count ?? 0);\n    if (!followingResult.error) setFollowingCount(followingResult.count ?? 0);\n    if (!vehiclesResult.error) {\n      setVehiclesCount(vehiclesResult.count ?? 0);\n      setFeaturedVehicle((vehiclesResult.data as ProfileVehicle | null) ?? null);\n    }\n    if (!postsResult.error) setPosts((postsResult.data ?? []) as ProfilePost[]);\n\n    if (\n      followersResult.error ||\n      followingResult.error ||\n      vehiclesResult.error ||\n      postsResult.error\n    ) {\n      setProfileError('Profile loaded, but some activity is still updating.');\n    }\n"""
replace("app/(tabs)/profile.tsx", old_profile, new_profile)
replace(
    "app/(tabs)/profile.tsx",
    "  useFocusEffect(\n    useCallback(() => {\n      void loadProfile();\n    }, [loadProfile]),\n  );",
    "  useFocusEffect(\n    useCallback(() => {\n      const shouldRefresh =\n        !hasLoadedProfileRef.current ||\n        Date.now() - lastLoadedProfileAtRef.current >= PROFILE_REFRESH_TTL_MS;\n      if (shouldRefresh) void loadProfile();\n    }, [loadProfile]),\n  );",
)

# 4) Events: bound the feed and only fetch attendance rows for events currently
# on screen. Keep a short focus TTL instead of re-reading on every tab switch.
replace(
    "src/features/crews-events/CanonicalEventsScreen.tsx",
    "type EventCardModel = EventRow & {\n  attendeeCount: number;\n  myResponse: \"going\" | \"maybe\" | null;\n};\n",
    "type EventCardModel = EventRow & {\n  attendeeCount: number;\n  myResponse: \"going\" | \"maybe\" | null;\n};\n\nconst EVENTS_REFRESH_TTL_MS = 60_000;\nconst EVENTS_FEED_LIMIT = 40;\n",
)
replace(
    "src/features/crews-events/CanonicalEventsScreen.tsx",
    "  const hasLoadedRef = useRef(false);\n",
    "  const hasLoadedRef = useRef(false);\n  const lastLoadedAtRef = useRef(0);\n",
)
replace(
    "src/features/crews-events/CanonicalEventsScreen.tsx",
    ".or(`starts_at.gte.${feedFloor.toISOString()},ends_at.gt.${now.toISOString()}`)\n        .order(\"starts_at\", { ascending: true });",
    ".or(`starts_at.gte.${feedFloor.toISOString()},ends_at.gt.${now.toISOString()}`)\n        .order(\"starts_at\", { ascending: true })\n        .limit(EVENTS_FEED_LIMIT);",
)
replace(
    "src/features/crews-events/CanonicalEventsScreen.tsx",
    "      setEvents(baseModels);\n      setLoading(false);",
    "      setEvents(baseModels);\n      lastLoadedAtRef.current = Date.now();\n      setLoading(false);",
)
old_attendance = """      void supabase\n        .from(\"event_attendees\")\n        .select(\"event_id,user_id,response,joined_at\")\n        .then((attendanceResult) => {\n          if (attendanceResult.error) return;\n\n          const attendance = (attendanceResult.data ?? []) as AttendanceRow[];\n          const counts = new Map<string, number>();\n          const mine = new Map<string, \"going\" | \"maybe\">();\n\n          for (const row of attendance) {\n            if (row.response === \"going\") {\n              counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);\n            }\n            if (row.user_id === currentUserId) mine.set(row.event_id, row.response);\n          }\n\n          setEvents((current) =>\n            current.map((event) => ({\n              ...event,\n              attendeeCount: counts.get(event.id) ?? 0,\n              myResponse: mine.get(event.id) ?? null,\n            })),\n          );\n        });\n"""
new_attendance = """      const eventIds = baseModels.map((event) => event.id);\n      if (eventIds.length > 0) {\n        void supabase\n          .from(\"event_attendees\")\n          .select(\"event_id,user_id,response,joined_at\")\n          .in(\"event_id\", eventIds)\n          .then((attendanceResult) => {\n            if (attendanceResult.error) return;\n\n            const attendance = (attendanceResult.data ?? []) as AttendanceRow[];\n            const counts = new Map<string, number>();\n            const mine = new Map<string, \"going\" | \"maybe\">();\n\n            for (const row of attendance) {\n              if (row.response === \"going\") {\n                counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);\n              }\n              if (row.user_id === currentUserId) mine.set(row.event_id, row.response);\n            }\n\n            setEvents((current) =>\n              current.map((event) => ({\n                ...event,\n                attendeeCount: counts.get(event.id) ?? 0,\n                myResponse: mine.get(event.id) ?? null,\n              })),\n            );\n          });\n      }\n"""
replace("src/features/crews-events/CanonicalEventsScreen.tsx", old_attendance, new_attendance)
replace(
    "src/features/crews-events/CanonicalEventsScreen.tsx",
    "  useFocusEffect(\n    useCallback(() => {\n      void load(!hasLoadedRef.current);\n    }, [load]),\n  );",
    "  useFocusEffect(\n    useCallback(() => {\n      const shouldRefresh =\n        !hasLoadedRef.current ||\n        Date.now() - lastLoadedAtRef.current >= EVENTS_REFRESH_TTL_MS;\n      if (shouldRefresh) void load(!hasLoadedRef.current);\n    }, [load]),\n  );",
)

# 5) Crews: bound the discovery feed and scope all secondary reads to the crew
# IDs actually loaded. Profile avatars are fetched only for those members.
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    "type Crew = CrewRow & {\n  ownerName: string;\n  memberCount: number;\n  currentUserRole: CrewRole | null;\n  isCurrentUserMember: boolean;\n  pendingJoinRequestId: string | null;\n};\n",
    "type Crew = CrewRow & {\n  ownerName: string;\n  memberCount: number;\n  currentUserRole: CrewRole | null;\n  isCurrentUserMember: boolean;\n  pendingJoinRequestId: string | null;\n};\n\nconst CREWS_REFRESH_TTL_MS = 60_000;\nconst CREWS_FEED_LIMIT = 40;\n",
)
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    "  const hasLoadedRef = useRef(false);\n",
    "  const hasLoadedRef = useRef(false);\n  const lastLoadedAtRef = useRef(0);\n",
)
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    ".order(\"created_at\", { ascending: false });",
    ".order(\"created_at\", { ascending: false })\n      .limit(CREWS_FEED_LIMIT);",
)
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    "    setCrews(baseModels);\n    setEvents([]);",
    "    setCrews(baseModels);\n    lastLoadedAtRef.current = Date.now();\n    setEvents([]);",
)
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    "    if (rows.length === 0) return;\n\n    const requestsQuery = currentUserId",
    "    if (rows.length === 0) return;\n\n    const crewIds = rows.map((row) => row.id);\n    const requestsQuery = currentUserId",
)
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    "      supabase.from(\"crew_members\").select(\"crew_id,user_id,role\"),",
    "      supabase\n        .from(\"crew_members\")\n        .select(\"crew_id,user_id,role\")\n        .in(\"crew_id\", crewIds),",
)
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    ".not(\"crew_id\", \"is\", null)\n        .eq(\"status\", \"scheduled\")",
    ".in(\"crew_id\", crewIds)\n        .eq(\"status\", \"scheduled\")",
)
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    "      supabase\n        .from(\"profiles\")\n        .select(\"id,display_name,username,avatar_url\")\n        .limit(8),\n    ]).then(([membersResult, requestsResult, eventsResult, profilesResult]) => {",
    "    ]).then(async ([membersResult, requestsResult, eventsResult]) => {",
)
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    "      if (!eventsResult.error) setEvents((eventsResult.data ?? []) as CrewEvent[]);\n      if (!profilesResult.error) {\n        setProfiles((profilesResult.data ?? []) as CanonicalProfile[]);\n      }\n      if (isInitialLoad) {",
    "      if (!eventsResult.error) setEvents((eventsResult.data ?? []) as CrewEvent[]);\n\n      const profileIds = Array.from(\n        new Set(memberRows.map((member) => member.user_id)),\n      ).slice(0, 8);\n      if (profileIds.length > 0) {\n        const profilesResult = await supabase\n          .from(\"profiles\")\n          .select(\"id,display_name,username,avatar_url\")\n          .in(\"id\", profileIds);\n        if (!profilesResult.error) {\n          setProfiles((profilesResult.data ?? []) as CanonicalProfile[]);\n        }\n      }\n      if (isInitialLoad) {",
)
replace(
    "src/features/crews-events/CanonicalCrewsScreen.tsx",
    "  useFocusEffect(\n    useCallback(() => {\n      void load(!hasLoadedRef.current);\n    }, [load]),\n  );",
    "  useFocusEffect(\n    useCallback(() => {\n      const shouldRefresh =\n        !hasLoadedRef.current ||\n        Date.now() - lastLoadedAtRef.current >= CREWS_REFRESH_TTL_MS;\n      if (shouldRefresh) void load(!hasLoadedRef.current);\n    }, [load]),\n  );",
)

# 6) Map: use the memoized auth user, avoid a duplicate active-driver snapshot on
# every focus, do not flash loading over already-rendered data, reuse recent event
# data, and use last-known GPS for a fast first camera position while fresh GPS
# updates in the background.
replace(
    "app/(tabs)/index.tsx",
    "import {\n  isJwtValidationError,\n  refreshSupabaseSessionOnce,\n  supabase,\n} from \"@/src/lib/supabase\";",
    "import {\n  getCurrentSessionUser,\n  isJwtValidationError,\n  refreshSupabaseSessionOnce,\n  supabase,\n} from \"@/src/lib/supabase\";",
)
replace(
    "app/(tabs)/index.tsx",
    "const DRIVER_LIST_REFRESH_MS = 30 * 1000;\n",
    "const DRIVER_LIST_REFRESH_MS = 30 * 1000;\nconst MAP_EVENTS_REFRESH_TTL_MS = 60_000;\n",
)
replace(
    "app/(tabs)/index.tsx",
    "  const eventsRef = useRef<EventMarkerRow[]>([]);\n",
    "  const eventsRef = useRef<EventMarkerRow[]>([]);\n  const lastEventsLoadedAtRef = useRef(0);\n",
)
old_location = """        const position = await Location.getCurrentPositionAsync({\n          accuracy: Location.Accuracy.Balanced,\n        });\n        const point = {\n          latitude: position.coords.latitude,\n          longitude: position.coords.longitude,\n        };\n        if (isMountedRef.current) setDriverLocation(point);\n        return point;\n"""
new_location = """        if (!requestPermission) {\n          const lastKnown = await Location.getLastKnownPositionAsync({\n            maxAge: 60_000,\n            requiredAccuracy: 2_000,\n          });\n          if (lastKnown) {\n            const cachedPoint = {\n              latitude: lastKnown.coords.latitude,\n              longitude: lastKnown.coords.longitude,\n            };\n            if (isMountedRef.current) setDriverLocation(cachedPoint);\n\n            void Location.getCurrentPositionAsync({\n              accuracy: Location.Accuracy.Balanced,\n            })\n              .then((freshPosition) => {\n                if (!isMountedRef.current) return;\n                setDriverLocation({\n                  latitude: freshPosition.coords.latitude,\n                  longitude: freshPosition.coords.longitude,\n                });\n              })\n              .catch(() => undefined);\n            return cachedPoint;\n          }\n        }\n\n        const position = await Location.getCurrentPositionAsync({\n          accuracy: Location.Accuracy.Balanced,\n        });\n        const point = {\n          latitude: position.coords.latitude,\n          longitude: position.coords.longitude,\n        };\n        if (isMountedRef.current) setDriverLocation(point);\n        return point;\n"""
replace("app/(tabs)/index.tsx", old_location, new_location)
replace(
    "app/(tabs)/index.tsx",
    "      const { data: sessionData } = await supabase.auth.getSession();\n      const userId = sessionData.session?.user.id;",
    "      const userId = (await getCurrentSessionUser())?.id;",
    count=4,
)
replace(
    "app/(tabs)/index.tsx",
    "  const loadEvents = useCallback(async () => {\n    if (isMountedRef.current) setEventsRequestState(\"loading\");",
    "  const loadEvents = useCallback(async () => {\n    if (isMountedRef.current && eventsRef.current.length === 0) {\n      setEventsRequestState(\"loading\");\n    }",
)
replace(
    "app/(tabs)/index.tsx",
    "      eventsRef.current = rows;\n      if (isMountedRef.current) {",
    "      eventsRef.current = rows;\n      lastEventsLoadedAtRef.current = Date.now();\n      if (isMountedRef.current) {",
)
replace(
    "app/(tabs)/index.tsx",
    "    if (isMountedRef.current) setActiveDriversRequestState(\"loading\");",
    "    if (isMountedRef.current && activeDriversRef.current.length === 0) {\n      setActiveDriversRequestState(\"loading\");\n    }",
)
replace(
    "app/(tabs)/index.tsx",
    "      const { data: sessionData, error: sessionError } =\n        await supabase.auth.getSession();\n\n      if (sessionError) {\n        logMapDataFailure(\"drivers\", sessionError);\n        if (\n          isMountedRef.current &&\n          activeDriversRequestIdRef.current === requestId\n        ) {\n          setActiveDriversRequestState(\"error\");\n        }\n        return;\n      }\n\n      const userId = sessionData.session?.user.id;",
    "      const userId = (await getCurrentSessionUser())?.id;",
)
replace(
    "app/(tabs)/index.tsx",
    "      mapFocusedRef.current = true;\n      void refreshActiveDrivers();\n\n      const refreshInterval",
    "      mapFocusedRef.current = true;\n\n      const refreshInterval",
)
replace(
    "app/(tabs)/index.tsx",
    "          setSharingError(\n            (current) => current ?? \"Live driver updates are reconnecting.\",\n          );",
    "          setSharingError(\n            (current) => current ?? \"Live driver updates are reconnecting.\",\n          );\n          void refreshActiveDrivers();",
)
old_map_focus = """        const [point, rows] = await Promise.all([\n          loadDriverLocation({ requestPermission: false }),\n          loadEvents(),\n        ]);\n"""
new_map_focus = """        const shouldRefreshEvents =\n          Boolean(focusEventId) ||\n          eventsRef.current.length === 0 ||\n          Date.now() - lastEventsLoadedAtRef.current >= MAP_EVENTS_REFRESH_TTL_MS;\n        const [point, rows] = await Promise.all([\n          loadDriverLocation({ requestPermission: false }),\n          shouldRefreshEvents ? loadEvents() : Promise.resolve(eventsRef.current),\n        ]);\n"""
replace("app/(tabs)/index.tsx", old_map_focus, new_map_focus)

# 7) Add an explicit static performance contract and run it in Quality.
Path("scripts/verify-t9-performance-pass.mjs").write_text("""import fs from 'node:fs';\n\nconst read = (path) => fs.readFileSync(path, 'utf8');\nconst checks = [];\nconst expect = (condition, message) => {\n  checks.push({ condition, message });\n  if (!condition) console.error(`FAIL: ${message}`);\n};\n\nconst supabase = read('src/lib/supabase.ts');\nconst garage = read('app/(tabs)/garage.tsx');\nconst profile = read('app/(tabs)/profile.tsx');\nconst events = read('src/features/crews-events/CanonicalEventsScreen.tsx');\nconst crews = read('src/features/crews-events/CanonicalCrewsScreen.tsx');\nconst map = read('app/(tabs)/index.tsx');\n\nexpect(supabase.includes('cachedSessionUser') && supabase.includes('sessionUserPromise'), 'session user is memoized and deduplicated');\nexpect(garage.includes('GARAGE_REFRESH_TTL_MS') && garage.includes('lastLoadedVehiclesAtRef'), 'Garage avoids refetch on rapid tab focus');\nexpect(profile.includes('PROFILE_REFRESH_TTL_MS') && profile.indexOf('setProfileData(profileResult.data') < profile.indexOf('const [followersResult'), 'Profile renders critical identity before secondary activity queries');\nexpect(events.includes('EVENTS_FEED_LIMIT') && events.includes('.in(\"event_id\", eventIds)'), 'Events feed is bounded and attendance is scoped to loaded events');\nexpect(crews.includes('CREWS_FEED_LIMIT') && crews.includes('.in(\"crew_id\", crewIds)') && crews.includes('profileIds'), 'Crews secondary queries are scoped to loaded crews');\nexpect(map.includes('MAP_EVENTS_REFRESH_TTL_MS') && map.includes('getLastKnownPositionAsync') && map.includes('shouldRefreshEvents'), 'Map reuses recent events and uses fast last-known GPS');\nexpect(!map.includes('mapFocusedRef.current = true;\\n      void refreshActiveDrivers();'), 'Map does not duplicate the active-driver snapshot before realtime subscribes');\n\nconst failures = checks.filter((check) => !check.condition);\nif (failures.length) process.exit(1);\nconsole.log(`T9 performance pass: ${checks.length} checks passed.`);\n""")

replace(
    "package.json",
    '    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n',
    '    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n    "verify:t9-performance-pass": "node ./scripts/verify-t9-performance-pass.mjs",\n',
)
replace(
    ".github/workflows/quality.yml",
    "      - name: Home / Map F12 performance contract\n        run: npm run verify:home-map-performance\n\n",
    "      - name: Home / Map F12 performance contract\n        run: npm run verify:home-map-performance\n\n      - name: T9 app data performance contract\n        run: npm run verify:t9-performance-pass\n\n",
)

print('performance pass codemod applied')
