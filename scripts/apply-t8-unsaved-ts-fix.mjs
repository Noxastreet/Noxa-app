import fs from 'node:fs';

const path = 'app/event-editor.tsx';
const source = fs.readFileSync(path, 'utf8');
const before = `    setSaving(false);\n    navigateWithoutPrompt(() =>\n      router.replace({\n        pathname: "/event-details",\n        params: { id: result.data.id },\n      }),\n    );`;
const after = `    const savedEventId = result.data.id;\n    setSaving(false);\n    navigateWithoutPrompt(() =>\n      router.replace({\n        pathname: "/event-details",\n        params: { id: savedEventId },\n      }),\n    );`;
const matches = source.split(before).length - 1;
if (matches !== 1) throw new Error(`expected 1 event save anchor, found ${matches}`);
fs.writeFileSync(path, source.replace(before, after));
console.log('Applied T8 unsaved TypeScript narrowing fix.');
