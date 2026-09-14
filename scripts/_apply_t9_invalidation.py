from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1))


def insert_after(path: str, anchor: str, addition: str):
    replace_once(path, anchor, anchor + addition)

# Shared in-process invalidation primitive. Version counters let mounted tabs keep
# cached data across focus changes while mutations can force the next focus to
# refresh immediately without reverting to unconditional network reads.
Path("src/lib/dataInvalidation.ts").write_text('''export type DataDomain = "profile" | "garage" | "events" | "crews";\n\nconst versions: Record<DataDomain, number> = {\n  profile: 0,\n  garage: 0,\n  events: 0,\n  crews: 0,\n};\n\nexport function getDataVersion(domain: DataDomain) {\n  return versions[domain];\n}\n\nexport function invalidateData(...domains: DataDomain[]) {\n  for (const domain of domains) versions[domain] += 1;\n}\n''')

# Garage: consume invalidation only after a successful load; primary change also
# invalidates Profile because its featured vehicle can change.
insert_after(
    "app/(tabs)/garage.tsx",
    "import { NoxaBadge, NoxaScreen } from '@/src/components/ui';\n",
    "import { getDataVersion, invalidateData } from '@/src/lib/dataInvalidation';\n",
)
insert_after(
    "app/(tabs)/garage.tsx",
    "  const lastLoadedVehiclesAtRef = useRef(0);\n",
    "  const loadedGarageVersionRef = useRef(-1);\n",
)
replace_once(
    "app/(tabs)/garage.tsx",
    "      setVehicles((data ?? []) as GarageVehicle[]);\n      lastLoadedVehiclesAtRef.current = Date.now();\n",
    "      setVehicles((data ?? []) as GarageVehicle[]);\n      lastLoadedVehiclesAtRef.current = Date.now();\n      loadedGarageVersionRef.current = getDataVersion('garage');\n",
)
replace_once(
    "app/(tabs)/garage.tsx",
    "      const shouldRefresh =\n        !hasLoadedVehiclesRef.current ||\n        Date.now() - lastLoadedVehiclesAtRef.current >= GARAGE_REFRESH_TTL_MS;\n",
    "      const shouldRefresh =\n        !hasLoadedVehiclesRef.current ||\n        loadedGarageVersionRef.current !== getDataVersion('garage') ||\n        Date.now() - lastLoadedVehiclesAtRef.current >= GARAGE_REFRESH_TTL_MS;\n",
)
replace_once(
    "app/(tabs)/garage.tsx",
    "    } else {\n      await loadVehicles();\n    }\n    setPrimaryBusyId(null);\n",
    "    } else {\n      invalidateData('profile');\n      await loadVehicles();\n    }\n    setPrimaryBusyId(null);\n",
)

# Profile: refresh immediately after edit/garage invalidation while preserving the
# 60s focus TTL for unrelated tab switching.
insert_after(
    "app/(tabs)/profile.tsx",
    "import { NoxaAvatar, NoxaScreen } from '@/src/components/ui';\n",
    "import { getDataVersion } from '@/src/lib/dataInvalidation';\n",
)
insert_after(
    "app/(tabs)/profile.tsx",
    "  const lastLoadedProfileAtRef = useRef(0);\n",
    "  const loadedProfileVersionRef = useRef(-1);\n",
)
replace_once(
    "app/(tabs)/profile.tsx",
    "    lastLoadedProfileAtRef.current = Date.now();\n    setIsProfileLoading(false);\n",
    "    lastLoadedProfileAtRef.current = Date.now();\n    loadedProfileVersionRef.current = getDataVersion('profile');\n    setIsProfileLoading(false);\n",
)
replace_once(
    "app/(tabs)/profile.tsx",
    "      const shouldRefresh =\n        !hasLoadedProfileRef.current ||\n        Date.now() - lastLoadedProfileAtRef.current >= PROFILE_REFRESH_TTL_MS;\n",
    "      const shouldRefresh =\n        !hasLoadedProfileRef.current ||\n        loadedProfileVersionRef.current !== getDataVersion('profile') ||\n        Date.now() - lastLoadedProfileAtRef.current >= PROFILE_REFRESH_TTL_MS;\n",
)

# Profile editor marks Profile dirty only after the server mutation succeeds.
insert_after(
    "app/edit-profile.tsx",
    "import { isMissingColumnError, normalizeProfileCountryCode } from \"@/src/features/profile/profileIdentityPersistence\";\n",
    "import { invalidateData } from \"@/src/lib/dataInvalidation\";\n",
)
replace_once(
    "app/edit-profile.tsx",
    "      setIsSubmitting(false);\n      navigateWithoutPrompt(() => router.back());\n",
    "      invalidateData(\"profile\");\n      setIsSubmitting(false);\n      navigateWithoutPrompt(() => router.back());\n",
)

# Vehicle editor changes both Garage and Profile summary data.
insert_after(
    "app/vehicle-editor.tsx",
    "import { NoxaButton, NoxaScreen } from '@/src/components/ui';\n",
    "import { invalidateData } from '@/src/lib/dataInvalidation';\n",
)
replace_once(
    "app/vehicle-editor.tsx",
    "        setIsSubmitting(false);\n        navigateWithoutPrompt(() =>\n          router.replace({ pathname: '/vehicle-details', params: { id: vehicleId } }),\n        );\n",
    "        invalidateData('garage', 'profile');\n        setIsSubmitting(false);\n        navigateWithoutPrompt(() =>\n          router.replace({ pathname: '/vehicle-details', params: { id: vehicleId } }),\n        );\n",
)
replace_once(
    "app/vehicle-editor.tsx",
    "      setIsSubmitting(false);\n\n      if (vehicle?.id) {\n        navigateWithoutPrompt(() => router.back());\n      }\n",
    "      invalidateData('garage', 'profile');\n      setIsSubmitting(false);\n\n      if (vehicle?.id) {\n        navigateWithoutPrompt(() => router.back());\n      }\n",
)

# Vehicle picker/finalize is another creation path; invalidate after successful insert.
insert_after(
    "src/features/garage/vehicle-picker/VehicleFinalizeFlow.tsx",
    "import { supabase } from '@/src/lib/supabase';\n",
    "import { invalidateData } from '@/src/lib/dataInvalidation';\n",
)
# The finalize flow has one successful insert followed by navigation. Anchor on the
# setIsSaving(false) immediately after insert success via vehicle.id block.
replace_once(
    "src/features/garage/vehicle-picker/VehicleFinalizeFlow.tsx",
    "      if (vehicle?.id) {\n        router.replace({ pathname: '/vehicle-details', params: { id: vehicle.id } });\n      }\n",
    "      if (vehicle?.id) {\n        invalidateData('garage', 'profile');\n        router.replace({ pathname: '/vehicle-details', params: { id: vehicle.id } });\n      }\n",
)

# Vehicle deletion also invalidates both surfaces.
insert_after(
    "app/vehicle-details.tsx",
    "import { NoxaBadge, NoxaButton, NoxaScreen } from '@/src/components/ui';\n",
    "import { invalidateData } from '@/src/lib/dataInvalidation';\n",
)
replace_once(
    "app/vehicle-details.tsx",
    "    setIsDeleting(false);\n    router.replace('/(tabs)/garage');\n",
    "    invalidateData('garage', 'profile');\n    setIsDeleting(false);\n    router.replace('/(tabs)/garage');\n",
)

print('T9 cache invalidation pass applied')
