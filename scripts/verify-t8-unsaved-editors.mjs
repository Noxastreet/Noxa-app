import fs from 'node:fs';

function requireText(path, snippets) {
  const source = fs.readFileSync(path, 'utf8');
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      throw new Error(`${path}: missing T8 contract: ${snippet}`);
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
