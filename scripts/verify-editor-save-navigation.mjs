import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const cases = [
  {
    label: 'Profile editor',
    path: 'app/edit-profile.tsx',
    busyRef: 'submittingRef',
    busyState: 'isSubmitting',
    successNavigation: /allowNavigationRef\.current = true;[\s\S]*submittingRef\.current = false;[\s\S]*router\.back\(\)/,
  },
  {
    label: 'Vehicle editor',
    path: 'app/vehicle-editor.tsx',
    busyRef: 'submittingRef',
    busyState: 'isSubmitting',
    successNavigation: /allowNavigationRef\.current = true;[\s\S]*submittingRef\.current = false;[\s\S]*(router\.replace|router\.back)\(/,
  },
  {
    label: 'Event editor',
    path: 'app/event-editor.tsx',
    busyRef: 'savingRef',
    busyState: 'saving',
    successNavigation: /allowNavigationRef\.current = true;[\s\S]*savingRef\.current = false;[\s\S]*router\.replace\(/,
  },
];

const eventEditor = fs.readFileSync('app/event-editor.tsx', 'utf8');
assert(
  eventEditor.includes('pendingCreateEventIdRef') &&
    eventEditor.includes('Crypto.randomUUID()'),
  'Event create must keep one stable client-generated id across an uncertain mobile save.',
);
assert(
  /insert\(\{ id: createEventId![\s\S]*creator_id: userId \}\)/.test(eventEditor),
  'Event create must send its stable id with the INSERT.',
);
assert(
  /select\("id,creator_id"\)[\s\S]*eq\("id", createEventId\)[\s\S]*recovery\.data\?\.creator_id === userId/.test(eventEditor),
  'Event create must reconcile the stable id after an uncertain INSERT response.',
);
assert(
  !eventEditor.includes('const { data: authData } = await supabase.auth.getUser();'),
  'Event save must not add a redundant network getUser call before its database mutation.',
);

for (const item of cases) {
  const source = fs.readFileSync(item.path, 'utf8');
  assert(source.includes('useNavigation'), `${item.label} must use the navigation object.`);
  assert(source.includes('navigation.addListener("beforeRemove"') || source.includes("navigation.addListener('beforeRemove'"), `${item.label} must guard route removal while saving.`);
  assert(source.includes(`${item.busyRef}.current = true`), `${item.label} must arm the guard before async save work starts.`);
  assert(source.includes('allowNavigationRef.current = false'), `${item.label} must reset the success escape hatch at save start.`);
  assert(source.includes(`if (!${item.busyRef}.current || allowNavigationRef.current) return;`), `${item.label} must only block user navigation during an active save.`);
  assert(source.includes('event.preventDefault()'), `${item.label} must prevent route removal during an active save.`);
  assert(source.includes(`disabled={${item.busyState}}`) || source.includes(`<BackButton disabled={${item.busyState}} />`), `${item.label} visible Back control must be disabled while saving.`);
  assert(item.successNavigation.test(source), `${item.label} must unlock navigation before its successful back/replace.`);
}

if (!process.exitCode) {
  console.log('Editor save navigation contract passed.');
}
