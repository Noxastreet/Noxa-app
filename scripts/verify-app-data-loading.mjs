import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const supabase = fs.readFileSync('src/lib/supabase.ts', 'utf8');
const tabs = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');
const avatar = fs.readFileSync('src/components/ui/NoxaAvatar.tsx', 'utf8');
const canonical = fs.readFileSync('src/features/crews-events/CanonicalPrimitives.tsx', 'utf8');

assert(
  /let currentSessionUserPromise: Promise<User \| null> \| null = null/.test(supabase),
  'Concurrent session-user reads must share one in-flight promise.',
);
assert(
  /if \(!currentSessionUserPromise\)[\s\S]*supabase\.auth[\s\S]*\.getSession\(\)/.test(supabase),
  'getCurrentSessionUser must deduplicate concurrent getSession calls.',
);
assert(
  /finally \{[\s\S]*currentSessionUserPromise = null/.test(supabase),
  'Session-user deduplication must clear after completion so auth changes are not cached indefinitely.',
);

const readyIndex = tabs.indexOf("setDestination('ready');");
const profileLookupIndex = tabs.indexOf(".from('profiles')");
assert(readyIndex >= 0, 'Returning configured users must have an immediate ready path.');
assert(profileLookupIndex >= 0, 'Username reconciliation must remain present.');
assert(
  readyIndex < profileLookupIndex,
  'Configured returning users must render Tabs before the network profile lookup completes.',
);
assert(
  /if \(!profileError && !profile\?\.username\?\.trim\(\)\)[\s\S]*setDestination\('\/choose-username'\)/.test(tabs),
  'Background username reconciliation must still redirect incomplete accounts.',
);
assert(
  /if \(!visibilityComplete\)[\s\S]*setDestination\('\/visibility-setup'\)/.test(tabs),
  'Visibility setup gate must remain enforced.',
);

assert(
  /cachePolicy="memory-disk"/.test(avatar),
  'Shared NOXA avatars must use memory+disk caching.',
);
assert(
  /from "expo-image"/.test(canonical) && /cachePolicy="memory-disk"/.test(canonical),
  'Crew/Event canonical avatars must use expo-image memory+disk caching.',
);

if (!process.exitCode) {
  console.log('App data-loading performance contract passed.');
}
