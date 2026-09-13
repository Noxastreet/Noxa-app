import fs from 'node:fs';

function replaceOnce(file, before, after) {
  const source = fs.readFileSync(file, 'utf8');
  const matches = source.split(before).length - 1;
  if (matches !== 1) {
    throw new Error(`${file}: expected exactly one patch anchor, found ${matches}`);
  }
  fs.writeFileSync(file, source.replace(before, after));
}

function write(file, content) {
  fs.mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  fs.writeFileSync(file, content);
}

// Shared navigation guard: one behavior for header Back, Android Back and swipe removal.
write('src/navigation/useUnsavedChangesGuard.ts', `import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

type UnsavedChangesGuardOptions = {
  hasUnsavedChanges: boolean;
  isBusy?: boolean;
};

export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  isBusy = false,
}: UnsavedChangesGuardOptions) {
  const navigation = useNavigation();
  const pendingNavigationRef = useRef<null | (() => void)>(null);
  const [bypass, setBypass] = useState(false);

  const navigateWithoutPrompt = useCallback((navigate: () => void) => {
    pendingNavigationRef.current = navigate;
    setBypass(true);
  }, []);

  useEffect(() => {
    if (!bypass) return;

    const navigate = pendingNavigationRef.current;
    if (!navigate) {
      setBypass(false);
      return;
    }

    pendingNavigationRef.current = null;
    navigate();

    const reset = setTimeout(() => setBypass(false), 0);
    return () => clearTimeout(reset);
  }, [bypass]);

  usePreventRemove((hasUnsavedChanges || isBusy) && !bypass, ({ data }) => {
    if (isBusy) {
      Alert.alert(
        'Saving changes…',
        'Wait for the save to finish before leaving this screen.',
      );
      return;
    }

    Alert.alert(
      'Discard changes?',
      'You have unsaved changes. If you leave now, they will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            navigateWithoutPrompt(() => navigation.dispatch(data.action)),
        },
      ],
    );
  });

  return { navigateWithoutPrompt };
}
`);

// Profile editor.
replaceOnce(
  'app/edit-profile.tsx',
  `import { supabase } from "@/src/lib/supabase";\nimport { colors, radius, spacing, typography } from "@/src/theme";`,
  `import { supabase } from "@/src/lib/supabase";\nimport { useUnsavedChangesGuard } from "@/src/navigation/useUnsavedChangesGuard";\nimport { colors, radius, spacing, typography } from "@/src/theme";`,
);
replaceOnce(
  'app/edit-profile.tsx',
  `const initialForm: ProfileForm = {\n  displayName: "",\n  username: "",\n  city: "",\n  bio: "",\n  countryCode: null,\n};`,
  `const initialForm: ProfileForm = {\n  displayName: "",\n  username: "",\n  city: "",\n  bio: "",\n  countryCode: null,\n};\n\nfunction snapshotProfileForm(form: ProfileForm) {\n  return JSON.stringify(form);\n}`,
);
replaceOnce(
  'app/edit-profile.tsx',
  `  const [selectedAvatar, setSelectedAvatar] = useState<SelectedAvatar | null>(null);\n  const [shouldRemoveAvatar, setShouldRemoveAvatar] = useState(false);\n\n  const setField =`,
  `  const [selectedAvatar, setSelectedAvatar] = useState<SelectedAvatar | null>(null);\n  const [shouldRemoveAvatar, setShouldRemoveAvatar] = useState(false);\n  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);\n  const hasUnsavedChanges =\n    baselineSnapshot !== null\n    && (snapshotProfileForm(form) !== baselineSnapshot\n      || selectedAvatar !== null\n      || shouldRemoveAvatar);\n  const { navigateWithoutPrompt } = useUnsavedChangesGuard({\n    hasUnsavedChanges,\n    isBusy: isSubmitting,\n  });\n\n  const setField =`,
);
replaceOnce(
  'app/edit-profile.tsx',
  `    setForm({\n      displayName: data.display_name ?? "",\n      username: data.username ?? "",\n      city: data.city ?? "",\n      bio: data.bio ?? "",\n      countryCode: (data as { country_code?: string | null }).country_code ?? null,\n    });\n    setAvatarUrl(data.avatar_url ?? null);`,
  `    const loadedForm: ProfileForm = {\n      displayName: data.display_name ?? "",\n      username: data.username ?? "",\n      city: data.city ?? "",\n      bio: data.bio ?? "",\n      countryCode: (data as { country_code?: string | null }).country_code ?? null,\n    };\n    setForm(loadedForm);\n    setBaselineSnapshot(snapshotProfileForm(loadedForm));\n    setAvatarUrl(data.avatar_url ?? null);`,
);
replaceOnce(
  'app/edit-profile.tsx',
  `      setIsSubmitting(false);\n      router.back();`,
  `      setIsSubmitting(false);\n      navigateWithoutPrompt(() => router.back());`,
);

// Vehicle editor.
replaceOnce(
  'app/vehicle-editor.tsx',
  `import { supabase } from '@/src/lib/supabase';\nimport { colors, radius, shadows, spacing, typography } from '@/src/theme';`,
  `import { supabase } from '@/src/lib/supabase';\nimport { useUnsavedChangesGuard } from '@/src/navigation/useUnsavedChangesGuard';\nimport { colors, radius, shadows, spacing, typography } from '@/src/theme';`,
);
replaceOnce(
  'app/vehicle-editor.tsx',
  `function getParamId(id: string | string[] | undefined) {\n  return Array.isArray(id) ? id[0] : id;\n}`,
  `function getParamId(id: string | string[] | undefined) {\n  return Array.isArray(id) ? id[0] : id;\n}\n\nfunction snapshotVehicleEditor(form: VehicleForm, vehicleType: VehicleType) {\n  return JSON.stringify({ form, vehicleType });\n}`,
);
replaceOnce(
  'app/vehicle-editor.tsx',
  `  const [selectedCoverAsset, setSelectedCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);\n  const [isCoverRemoved, setIsCoverRemoved] = useState(false);\n\n  const setField =`,
  `  const [selectedCoverAsset, setSelectedCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);\n  const [isCoverRemoved, setIsCoverRemoved] = useState(false);\n  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);\n  const hasUnsavedChanges =\n    baselineSnapshot !== null\n    && (snapshotVehicleEditor(form, vehicleType) !== baselineSnapshot\n      || selectedCoverAsset !== null\n      || isCoverRemoved);\n  const { navigateWithoutPrompt } = useUnsavedChangesGuard({\n    hasUnsavedChanges,\n    isBusy: isSubmitting,\n  });\n\n  const setField =`,
);
replaceOnce(
  'app/vehicle-editor.tsx',
  `    if (!vehicleId) {\n      setForm(initialForm);\n      setVehicleType('car');\n      setLoadError(null);`,
  `    if (!vehicleId) {\n      setForm(initialForm);\n      setVehicleType('car');\n      setBaselineSnapshot(snapshotVehicleEditor(initialForm, 'car'));\n      setLoadError(null);`,
);
replaceOnce(
  'app/vehicle-editor.tsx',
  `    const loadedVehicle = vehicle as VehicleRecord;\n    setForm(formFromVehicle(loadedVehicle));\n    setVehicleType(loadedVehicle.vehicle_type === 'motorcycle' ? 'motorcycle' : 'car');`,
  `    const loadedVehicle = vehicle as VehicleRecord;\n    const loadedForm = formFromVehicle(loadedVehicle);\n    const loadedVehicleType = loadedVehicle.vehicle_type === 'motorcycle' ? 'motorcycle' : 'car';\n    setForm(loadedForm);\n    setVehicleType(loadedVehicleType);\n    setBaselineSnapshot(snapshotVehicleEditor(loadedForm, loadedVehicleType));`,
);
replaceOnce(
  'app/vehicle-editor.tsx',
  `        setIsSubmitting(false);\n        router.replace({ pathname: '/vehicle-details', params: { id: vehicleId } });\n        return;`,
  `        setIsSubmitting(false);\n        navigateWithoutPrompt(() =>\n          router.replace({ pathname: '/vehicle-details', params: { id: vehicleId } }),\n        );\n        return;`,
);
replaceOnce(
  'app/vehicle-editor.tsx',
  `      if (vehicle?.id) {\n        router.back();\n      }`,
  `      if (vehicle?.id) {\n        navigateWithoutPrompt(() => router.back());\n      }`,
);

// Event editor.
replaceOnce(
  'app/event-editor.tsx',
  `import { supabase } from "@/src/lib/supabase";\nimport { colors, radius, shadows, spacing, typography } from "@/src/theme";`,
  `import { supabase } from "@/src/lib/supabase";\nimport { useUnsavedChangesGuard } from "@/src/navigation/useUnsavedChangesGuard";\nimport { colors, radius, shadows, spacing, typography } from "@/src/theme";`,
);
replaceOnce(
  'app/event-editor.tsx',
  `const timeFormatter = new Intl.DateTimeFormat("en-GB", {\n  hour: "2-digit",\n  minute: "2-digit",\n  hour12: false,\n});`,
  `const timeFormatter = new Intl.DateTimeFormat("en-GB", {\n  hour: "2-digit",\n  minute: "2-digit",\n  hour12: false,\n});\n\nfunction snapshotEventForm(form: EventForm) {\n  return JSON.stringify(form);\n}`,
);
replaceOnce(
  'app/event-editor.tsx',
  `  const [crewLoadError, setCrewLoadError] = useState<string | null>(null);\n  const [loading, setLoading] = useState(Boolean(eventId));\n  const [saving, setSaving] = useState(false);`,
  `  const [crewLoadError, setCrewLoadError] = useState<string | null>(null);\n  const [loading, setLoading] = useState(true);\n  const [saving, setSaving] = useState(false);`,
);
replaceOnce(
  'app/event-editor.tsx',
  `  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);\n  const [draftDate, setDraftDate] = useState<Date>(futureStart());\n\n  const title =`,
  `  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);\n  const [draftDate, setDraftDate] = useState<Date>(futureStart());\n  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);\n  const hasUnsavedChanges =\n    baselineSnapshot !== null && snapshotEventForm(form) !== baselineSnapshot;\n  const { navigateWithoutPrompt } = useUnsavedChangesGuard({\n    hasUnsavedChanges,\n    isBusy: saving,\n  });\n\n  const title =`,
);
replaceOnce(
  'app/event-editor.tsx',
  `  useEffect(() => {\n    void loadEvent();\n  }, [loadEvent]);\n\n  const openPicker =`,
  `  useEffect(() => {\n    void loadEvent();\n  }, [loadEvent]);\n\n  useEffect(() => {\n    if (!loading && !error && baselineSnapshot === null) {\n      setBaselineSnapshot(snapshotEventForm(form));\n    }\n  }, [baselineSnapshot, error, form, loading]);\n\n  const openPicker =`,
);
replaceOnce(
  'app/event-editor.tsx',
  `    router.replace({\n      pathname: "/event-details",\n      params: { id: result.data.id },\n    });\n    setSaving(false);`,
  `    setSaving(false);\n    navigateWithoutPrompt(() =>\n      router.replace({\n        pathname: "/event-details",\n        params: { id: result.data.id },\n      }),\n    );`,
);
replaceOnce(
  'app/event-editor.tsx',
  `  }, [currentUserId, eventId, form, isEditing, saving, validate]);`,
  `  }, [currentUserId, eventId, form, isEditing, navigateWithoutPrompt, saving, validate]);`,
);

write('scripts/verify-t8-unsaved-editors.mjs', `import fs from 'node:fs';

function requireText(path, snippets) {
  const source = fs.readFileSync(path, 'utf8');
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      throw new Error(\`${path}: missing T8 contract: \${snippet}\`);
    }
  }
}

requireText('src/navigation/useUnsavedChangesGuard.ts', [
  'usePreventRemove',
  'Discard changes?',
  'hasUnsavedChanges || isBusy',
  'navigation.dispatch(data.action)',
  'navigateWithoutPrompt',
]);

requireText('app/edit-profile.tsx', [
  'useUnsavedChangesGuard',
  'snapshotProfileForm',
  'baselineSnapshot',
  'navigateWithoutPrompt(() => router.back())',
]);

requireText('app/vehicle-editor.tsx', [
  'useUnsavedChangesGuard',
  'snapshotVehicleEditor',
  'baselineSnapshot',
  'navigateWithoutPrompt(() =>',
]);

requireText('app/event-editor.tsx', [
  'useUnsavedChangesGuard',
  'snapshotEventForm',
  'baselineSnapshot',
  'navigateWithoutPrompt(() =>',
]);

console.log('T8 unsaved editor navigation contract: PASS');
`);

replaceOnce(
  'package.json',
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",`,
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n    "verify:t8-unsaved-editors": "node ./scripts/verify-t8-unsaved-editors.mjs",`,
);
replaceOnce(
  '.github/workflows/quality.yml',
  `      - name: Home / Map F12 performance contract\n        run: npm run verify:home-map-performance\n`,
  `      - name: Home / Map F12 performance contract\n        run: npm run verify:home-map-performance\n\n      - name: T8 unsaved editor navigation contract\n        run: npm run verify:t8-unsaved-editors\n`,
);

fs.rmSync('scripts/apply-t8-unsaved-editors.mjs');
fs.rmSync('.github/workflows/t8-unsaved-editors-patch.yml');

console.log('Applied T8 unsaved editor patch and removed temporary helper files.');
