import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) {
    throw new Error(`${label}: expected exactly 1 match in ${path}, found ${matches}`);
  }
  fs.writeFileSync(path, source.replace(from, to));
}

const eventsPath = 'src/features/crews-events/CanonicalEventsScreen.tsx';
replaceExact(eventsPath, 'function NearbyStrip({ count }: { count: number }) {', 'function NearTermStrip({ count }: { count: number }) {', 'rename misleading NearbyStrip');
replaceExact(eventsPath, '<Text style={styles.nearbyEyebrow}>NEARBY NOW</Text>', '<Text style={styles.nearbyEyebrow}>LIVE & NEXT 7 DAYS</Text>', 'truthful timing eyebrow');
replaceExact(eventsPath, '? `${count} event${count === 1 ? "" : "s"} available around you`\n            : "New local events will appear here"', '? `${count} event${count === 1 ? "" : "s"} live or starting within 7 days`\n            : "No live or near-term events right now"', 'truthful timing copy');
replaceExact(eventsPath, 'const nearbyCount = events.filter((event) => {', 'const nearTermCount = events.filter((event) => {', 'rename temporal count');
replaceExact(eventsPath, '<NearbyStrip count={nearbyCount} />', '<NearTermStrip count={nearTermCount} />', 'use truthful strip');
replaceExact(eventsPath, '    nearbyCount,', '    nearTermCount,', 'memo dependency');
replaceExact(eventsPath, '<Text style={styles.pageSubtitle}>What is happening around you.</Text>', '<Text style={styles.pageSubtitle}>What is live and coming up.</Text>', 'remove unsupported proximity claim');
replaceExact(eventsPath, '  createButton: {\n    minHeight: 36,', '  createButton: {\n    minHeight: 44,', 'Events create target');

replaceExact('src/features/crews-events/CanonicalCrewsScreen.tsx', '  createButton: {\n    minHeight: 36,', '  createButton: {\n    minHeight: 44,', 'Crews create target');
replaceExact('app/(tabs)/garage.tsx', '  addButton: {\n    minHeight: 38,', '  addButton: {\n    minHeight: 44,', 'Garage add target');
replaceExact('app/(tabs)/events.tsx', '    minHeight: 40,', '    minHeight: 44,', 'Events history target');

replaceExact('package.json', '    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",', '    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n    "verify:t8-core-truth-accessibility": "node ./scripts/verify-t8-core-truth-accessibility.mjs",', 'package verification script');

replaceExact('.github/workflows/quality.yml', '      - name: Home / Map F12 performance contract\n        run: npm run verify:home-map-performance\n', '      - name: Home / Map F12 performance contract\n        run: npm run verify:home-map-performance\n\n      - name: T8 core truth/accessibility contract\n        run: npm run verify:t8-core-truth-accessibility\n', 'quality verification step');

console.log('T8 core truth/accessibility patch applied.');
