import fs from 'node:fs';

const path = 'app/(tabs)/index.tsx';
const source = fs.readFileSync(path, 'utf8');
const from = `  const selectMapboxEvent = useCallback(\n    (event: MapboxEvent) => {\n      const fullEvent = events.find((candidate) => candidate.id === event.id);\n      if (fullEvent) selectEvent(fullEvent);\n    },\n    [events, selectEvent],\n  );`;
const to = `  const selectMapboxEvent = useCallback(\n    (event: MapboxEvent) => {\n      const fullEvent = events.find((candidate) => candidate.id === event.id);\n      if (!fullEvent) return;\n      // Keep route identity stable: while routing to one event, tapping another\n      // marker must not relabel the existing route with a different event.\n      if (isRouteMode && focusEventId && fullEvent.id !== focusEventId) return;\n      selectEvent(fullEvent);\n    },\n    [events, focusEventId, isRouteMode, selectEvent],\n  );`;
const matches = source.split(from).length - 1;
if (matches !== 1) {
  throw new Error(`Expected exactly one Map event selection block, found ${matches}.`);
}
fs.writeFileSync(path, source.replace(from, to));
console.log('Applied T8 event route consistency guard.');
