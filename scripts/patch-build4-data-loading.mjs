import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, from, to, label) {
  const first = content.indexOf(from);
  if (first === -1) throw new Error(`Patch target not found: ${label}`);
  if (content.indexOf(from, first + from.length) !== -1) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  return content.slice(0, first) + to + content.slice(first + from.length);
}

function patchEvents() {
  const path = 'src/features/crews-events/CanonicalEventsScreen.tsx';
  let content = read(path);

  content = replaceOnce(
    content,
    'import { useCallback, useMemo, useState } from "react";',
    'import { useCallback, useMemo, useRef, useState } from "react";',
    'events react import',
  );
  content = replaceOnce(
    content,
    'import { supabase } from "@/src/lib/supabase";',
    'import { getCurrentSessionUser, supabase } from "@/src/lib/supabase";',
    'events supabase import',
  );
  content = replaceOnce(
    content,
    '  const [error, setError] = useState<string | null>(null);\n',
    '  const [error, setError] = useState<string | null>(null);\n  const hasLoadedRef = useRef(false);\n',
    'events loaded ref',
  );
  content = replaceOnce(
    content,
    '      const { data: authData } = await supabase.auth.getUser();\n      const currentUserId = authData.user?.id ?? null;\n',
    '      const currentUserId = (await getCurrentSessionUser())?.id ?? null;\n',
    'events cached user',
  );
  content = replaceOnce(
    content,
    '        setEvents([]);\n        setHeroAttendees([]);\n',
    '',
    'events preserve stale data',
  );
  content = replaceOnce(
    content,
    '        setLoading(false);\n        setRefreshing(false);\n        return;\n      }\n\n      const attendance',
    '        setLoading(false);\n        setRefreshing(false);\n        hasLoadedRef.current = true;\n        return;\n      }\n\n      const attendance',
    'events error completion',
  );
  content = replaceOnce(
    content,
    '      setEvents(models);\n      if (models[0]) await loadHeroProfiles(models[0].id);\n      else setHeroAttendees([]);\n      setLoading(false);\n      setRefreshing(false);',
    '      setEvents(models);\n      setLoading(false);\n      setRefreshing(false);\n      hasLoadedRef.current = true;\n      if (models[0]) void loadHeroProfiles(models[0].id);\n      else setHeroAttendees([]);',
    'events nonblocking hero load',
  );
  content = replaceOnce(
    content,
    '  useFocusEffect(\n    useCallback(() => {\n      void load();\n    }, [load]),\n  );',
    '  useFocusEffect(\n    useCallback(() => {\n      void load(!hasLoadedRef.current);\n    }, [load]),\n  );',
    'events focus refresh',
  );

  write(path, content);
}

function patchCrews() {
  const path = 'src/features/crews-events/CanonicalCrewsScreen.tsx';
  let content = read(path);

  content = replaceOnce(
    content,
    'import { useCallback, useMemo, useState } from "react";',
    'import { useCallback, useMemo, useRef, useState } from "react";',
    'crews react import',
  );
  content = replaceOnce(
    content,
    'import { supabase } from "@/src/lib/supabase";',
    'import { getCurrentSessionUser, supabase } from "@/src/lib/supabase";',
    'crews supabase import',
  );
  content = replaceOnce(
    content,
    '  const [creating, setCreating] = useState(false);\n',
    '  const [creating, setCreating] = useState(false);\n  const hasLoadedRef = useRef(false);\n',
    'crews loaded ref',
  );
  content = replaceOnce(
    content,
    '    const { data: authData } = await supabase.auth.getUser();\n    const currentUserId = authData.user?.id ?? null;\n',
    '    const currentUserId = (await getCurrentSessionUser())?.id ?? null;\n',
    'crews cached user',
  );
  content = replaceOnce(
    content,
    '      setError(firstError.message);\n      setLoading(false);\n      setRefreshing(false);\n      return;\n',
    '      setError(firstError.message);\n      setLoading(false);\n      setRefreshing(false);\n      hasLoadedRef.current = true;\n      return;\n',
    'crews error completion',
  );
  content = replaceOnce(
    content,
    '    setLoading(false);\n    setRefreshing(false);\n  }, []);',
    '    setLoading(false);\n    setRefreshing(false);\n    hasLoadedRef.current = true;\n  }, []);',
    'crews success completion',
  );
  content = replaceOnce(
    content,
    '  useFocusEffect(\n    useCallback(() => {\n      void load();\n    }, [load]),\n  );',
    '  useFocusEffect(\n    useCallback(() => {\n      void load(!hasLoadedRef.current);\n    }, [load]),\n  );',
    'crews focus refresh',
  );

  write(path, content);
}

function patchGarage() {
  const path = 'app/(tabs)/garage.tsx';
  let content = read(path);

  content = replaceOnce(
    content,
    "import { supabase } from '@/src/lib/supabase';",
    "import { getCurrentSessionUser, supabase } from '@/src/lib/supabase';",
    'garage supabase import',
  );
  content = replaceOnce(
    content,
    '    const { data: authData, error: authError } = await supabase.auth.getUser();\n    const user = authData.user;\n\n    if (authError || !user) {',
    '    const user = await getCurrentSessionUser();\n\n    if (!user) {',
    'garage cached user',
  );

  write(path, content);
}

function patchProfile() {
  const path = 'app/(tabs)/profile.tsx';
  let content = read(path);

  content = replaceOnce(
    content,
    "import { supabase } from '@/src/lib/supabase';",
    "import { getCurrentSessionUser, supabase } from '@/src/lib/supabase';",
    'profile supabase import',
  );
  content = replaceOnce(
    content,
    '  const [posts, setPosts] = useState<ProfilePost[]>([]);\n',
    '  const [posts, setPosts] = useState<ProfilePost[]>([]);\n  const hasLoadedProfileRef = useRef(false);\n',
    'profile loaded ref',
  );
  content = replaceOnce(
    content,
    '    setIsProfileLoading(true);\n    setProfileError(null);\n\n    const { data: authData } = await supabase.auth.getUser();\n    const user = authData.user;\n',
    '    if (!hasLoadedProfileRef.current) setIsProfileLoading(true);\n    setProfileError(null);\n\n    const user = await getCurrentSessionUser();\n',
    'profile cached user and spinner',
  );
  content = replaceOnce(
    content,
    '      setPosts([]);\n      setIsProfileLoading(false);\n      return;\n',
    '      setPosts([]);\n      hasLoadedProfileRef.current = true;\n      setIsProfileLoading(false);\n      return;\n',
    'profile signed-out completion',
  );
  content = replaceOnce(
    content,
    "      setProfileError('Unable to load profile.');\n      setIsProfileLoading(false);\n      return;\n",
    "      setProfileError('Unable to load profile.');\n      hasLoadedProfileRef.current = true;\n      setIsProfileLoading(false);\n      return;\n",
    'profile error completion',
  );
  content = replaceOnce(
    content,
    "    if (postsResult.error) setProfileError('Profile loaded, but moments are unavailable.');\n    setIsProfileLoading(false);\n",
    "    if (postsResult.error) setProfileError('Profile loaded, but moments are unavailable.');\n    hasLoadedProfileRef.current = true;\n    setIsProfileLoading(false);\n",
    'profile success completion',
  );

  write(path, content);
}

patchEvents();
patchCrews();
patchGarage();
patchProfile();

fs.unlinkSync(new URL(import.meta.url));
console.log('Build 4 data-loading patch applied.');
