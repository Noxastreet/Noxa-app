import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, from, to, label) {
  const index = content.indexOf(from);
  if (index === -1) throw new Error(`Patch target not found: ${label}`);
  if (content.indexOf(from, index + from.length) !== -1) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  return content.slice(0, index) + to + content.slice(index + from.length);
}

function replaceBetween(content, startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  if (start === -1) throw new Error(`Patch start not found: ${label}`);
  const end = content.indexOf(endMarker, start);
  if (end === -1) throw new Error(`Patch end not found: ${label}`);
  return content.slice(0, start) + replacement + content.slice(end);
}

function patchSupabase() {
  const path = 'src/lib/supabase.ts';
  let content = read(path);

  content = replaceOnce(
    content,
    'const REQUEST_TIMEOUT_MS = 5000;\nconst RETRY_DELAY_MS = 250;\nconst TRANSIENT_READ_STATUSES = new Set([408, 502, 503, 504]);',
    'const REQUEST_TIMEOUT_MS = 15000;\nconst RETRY_DELAY_MS = 500;\nconst TRANSIENT_READ_STATUSES = new Set([408, 429, 502, 503, 504]);',
    'Supabase timeout constants',
  );

  content = replaceOnce(
    content,
    `  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);\n\n  try {\n    return await fetch(input, { ...init, signal: controller.signal });\n  } finally {\n    clearTimeout(timeout);\n    detachUpstream?.();\n  }`,
    `  let timedOut = false;\n  const timeout = setTimeout(() => {\n    timedOut = true;\n    controller.abort();\n  }, REQUEST_TIMEOUT_MS);\n\n  try {\n    return await fetch(input, { ...init, signal: controller.signal });\n  } catch (error) {\n    if (timedOut && !upstreamSignal?.aborted) {\n      throw new Error('NOXA request timed out.');\n    }\n    throw error;\n  } finally {\n    clearTimeout(timeout);\n    detachUpstream?.();\n  }`,
    'Supabase timeout classification',
  );

  content = replaceOnce(
    content,
    `  } catch (error) {\n    if (!canRetry || init?.signal?.aborted) throw error;\n    await sleep(RETRY_DELAY_MS);\n    return fetchWithTimeout(input, init);\n  }`,
    `  } catch (error) {\n    const isTimeout =\n      error instanceof Error && error.message === 'NOXA request timed out.';\n    if (!canRetry || init?.signal?.aborted || isTimeout) throw error;\n    await sleep(RETRY_DELAY_MS);\n    return fetchWithTimeout(input, init);\n  }`,
    'Supabase retry policy',
  );

  write(path, content);
}

function patchEvents() {
  const path = 'src/features/crews-events/CanonicalEventsScreen.tsx';
  let content = read(path);

  const start = '  const load = useCallback(\n    async (showSpinner = true) => {';
  const end = '\n\n  useFocusEffect(';
  const replacement = `  const load = useCallback(\n    async (showSpinner = true) => {\n      if (showSpinner) setLoading(true);\n      setError(null);\n\n      const currentUserId = (await getCurrentSessionUser())?.id ?? null;\n      setUserId(currentUserId);\n\n      const now = new Date();\n      const feedFloor = new Date(now.getTime() - 24 * 60 * 60 * 1000);\n      const eventsResult = await supabase\n        .from("events")\n        .select(\n          "id,creator_id,crew_id,title,description,category,location_name,starts_at,ends_at,cover_image_url,is_public,status",\n        )\n        .eq("status", "scheduled")\n        .or(\`starts_at.gte.\${feedFloor.toISOString()},ends_at.gt.\${now.toISOString()}\`)\n        .order("starts_at", { ascending: true });\n\n      if (eventsResult.error) {\n        setError(eventsResult.error.message || "Events could not be loaded.");\n        setLoading(false);\n        setRefreshing(false);\n        hasLoadedRef.current = true;\n        return;\n      }\n\n      const baseModels = ((eventsResult.data ?? []) as EventRow[])\n        .filter((event) => {\n          const lifecycle = getEventLifecycle(event);\n          return lifecycle === "scheduled" || lifecycle === "live";\n        })\n        .map((event) => ({\n          ...event,\n          attendeeCount: 0,\n          myResponse: null,\n        }));\n\n      setEvents(baseModels);\n      setLoading(false);\n      setRefreshing(false);\n      hasLoadedRef.current = true;\n\n      if (baseModels[0]) void loadHeroProfiles(baseModels[0].id);\n      else setHeroAttendees([]);\n\n      void supabase\n        .from("event_attendees")\n        .select("event_id,user_id,response,joined_at")\n        .then((attendanceResult) => {\n          if (attendanceResult.error) return;\n\n          const attendance = (attendanceResult.data ?? []) as AttendanceRow[];\n          const counts = new Map<string, number>();\n          const mine = new Map<string, "going" | "maybe">();\n\n          for (const row of attendance) {\n            if (row.response === "going") {\n              counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);\n            }\n            if (row.user_id === currentUserId) mine.set(row.event_id, row.response);\n          }\n\n          setEvents((current) =>\n            current.map((event) => ({\n              ...event,\n              attendeeCount: counts.get(event.id) ?? 0,\n              myResponse: mine.get(event.id) ?? null,\n            })),\n          );\n        });\n    },\n    [loadHeroProfiles],\n  );`;

  content = replaceBetween(content, start, end, replacement, 'Events progressive load');
  write(path, content);
}

function patchCrews() {
  const path = 'src/features/crews-events/CanonicalCrewsScreen.tsx';
  let content = read(path);

  const start = '  const load = useCallback(async (showSpinner = true) => {';
  const end = '\n\n  useFocusEffect(';
  const replacement = `  const load = useCallback(async (showSpinner = true) => {\n    if (showSpinner) setLoading(true);\n    setError(null);\n\n    const currentUserId = (await getCurrentSessionUser())?.id ?? null;\n    setUserId(currentUserId);\n\n    const crewsResult = await supabase\n      .from("crews")\n      .select(\n        "id,owner_id,name,description,city,logo_url,cover_image_url,is_public,join_policy,created_at,profiles:owner_id(display_name,username)",\n      )\n      .order("created_at", { ascending: false });\n\n    if (crewsResult.error) {\n      setError(crewsResult.error.message);\n      setLoading(false);\n      setRefreshing(false);\n      hasLoadedRef.current = true;\n      return;\n    }\n\n    const rows = (crewsResult.data ?? []) as CrewRow[];\n    const baseModels = rows.map((row) => ({\n      ...row,\n      ownerName: getOwnerName(row),\n      memberCount: 0,\n      currentUserRole: null,\n      isCurrentUserMember: false,\n      pendingJoinRequestId: null,\n    } satisfies Crew));\n\n    setCrews(baseModels);\n    setEvents([]);\n    setProfiles([]);\n    if (baseModels.length > 0) setFilter("discover");\n    setLoading(false);\n    setRefreshing(false);\n    hasLoadedRef.current = true;\n\n    if (rows.length === 0) return;\n\n    const requestsQuery = currentUserId\n      ? supabase\n          .from("crew_join_requests")\n          .select("id,crew_id,user_id,status")\n          .eq("user_id", currentUserId)\n          .eq("status", "pending")\n      : Promise.resolve({ data: [], error: null });\n\n    void Promise.all([\n      supabase.from("crew_members").select("crew_id,user_id,role"),\n      requestsQuery,\n      supabase\n        .from("events")\n        .select("id,crew_id,title,location_name,starts_at,cover_image_url")\n        .not("crew_id", "is", null)\n        .eq("status", "scheduled")\n        .gte("starts_at", new Date().toISOString())\n        .order("starts_at", { ascending: true })\n        .limit(8),\n      supabase\n        .from("profiles")\n        .select("id,display_name,username,avatar_url")\n        .limit(8),\n    ]).then(([membersResult, requestsResult, eventsResult, profilesResult]) => {\n      const memberRows = membersResult.error\n        ? []\n        : ((membersResult.data ?? []) as CrewMemberRow[]);\n      const requestRows = requestsResult.error\n        ? []\n        : ((requestsResult.data ?? []) as JoinRequestRow[]);\n      const memberCount = new Map<string, number>();\n      const roleByCrew = new Map<string, CrewRole>();\n\n      for (const member of memberRows) {\n        memberCount.set(member.crew_id, (memberCount.get(member.crew_id) ?? 0) + 1);\n        if (member.user_id === currentUserId) {\n          roleByCrew.set(member.crew_id, member.role);\n        }\n      }\n\n      const requestByCrew = new Map(\n        requestRows.map((request) => [request.crew_id, request.id]),\n      );\n      const models = rows.map((row) => {\n        const role = roleByCrew.get(row.id) ?? null;\n        return {\n          ...row,\n          ownerName: getOwnerName(row),\n          memberCount: memberCount.get(row.id) ?? 0,\n          currentUserRole: role,\n          isCurrentUserMember: role !== null,\n          pendingJoinRequestId: requestByCrew.get(row.id) ?? null,\n        } satisfies Crew;\n      });\n\n      setCrews(models);\n      if (!eventsResult.error) setEvents((eventsResult.data ?? []) as CrewEvent[]);\n      if (!profilesResult.error) {\n        setProfiles((profilesResult.data ?? []) as CanonicalProfile[]);\n      }\n      setFilter(models.some((crew) => crew.isCurrentUserMember) ? "mine" : "discover");\n    });\n  }, []);`;

  content = replaceBetween(content, start, end, replacement, 'Crews progressive load');
  write(path, content);
}

function patchMapbox() {
  const path = 'src/features/mapbox/MapboxLiveMap.tsx';
  let content = read(path);

  content = replaceOnce(
    content,
    `          onDidFinishLoadingMap={() => {\n            setHasError(false);\n            setIsLoaded(true);\n          }}\n          onMapLoadingError={() => {\n            setHasError(true);\n            setIsLoaded(false);\n          }}`,
    `          onDidFinishLoadingMap={() => {\n            setHasError(false);\n            setIsLoaded(true);\n          }}\n          onDidFinishLoadingStyle={() => {\n            setHasError(false);\n            setIsLoaded(true);\n          }}\n          onMapLoadingError={() => {\n            if (!isLoaded) setHasError(true);\n          }}`,
    'Mapbox non-fatal loading errors',
  );

  write(path, content);
}

patchSupabase();
patchEvents();
patchCrews();
patchMapbox();

fs.unlinkSync(new URL(import.meta.url));
console.log('iOS loading + Mapbox patch applied.');
