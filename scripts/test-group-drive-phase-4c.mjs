import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();

function compile(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected test dependency in ${file}: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

const routeProgress = compile('src/features/group-drive/runtime/routeProgress.ts');
const participantStack = compile('src/features/group-drive/runtime/participantStack.ts');
const presentationModule = compile(
  'src/features/group-drive/runtime/participantStackPresentation.ts',
  { './participantStack': participantStack },
);

const route = routeProgress.prepareDriveRoute({
  type: 'LineString',
  coordinates: [
    [23.72, 38.0],
    [23.82, 38.0],
  ],
}, 10_000);
assert.ok(route, 'stored LineString must prepare');

const now = new Date('2026-08-27T04:00:00.000Z');
const locations = [
  {
    id: 'loc-a', driveSessionId: 'drive-a', userId: 'user-a',
    latitude: 38.0, longitude: 23.75, heading: 90, status: 'moving',
    updatedAt: '2026-08-27T03:59:58.000Z',
  },
  {
    id: 'loc-b', driveSessionId: 'drive-a', userId: 'user-b',
    latitude: 38.0, longitude: 23.79, heading: 90, status: 'moving',
    updatedAt: '2026-08-27T03:59:59.000Z',
  },
  {
    id: 'loc-c', driveSessionId: 'drive-a', userId: 'user-c',
    latitude: 38.0, longitude: 23.77, heading: 90, status: 'moving',
    updatedAt: '2026-08-27T03:58:00.000Z',
  },
];

const progress = routeProgress.deriveGroupDriveParticipantProgress(
  'drive-a',
  route,
  ['user-a', 'user-b', 'user-c'],
  locations,
  routeProgress.emptyGroupDriveProgressState('drive-a'),
  now,
);
assert.equal(progress.byUserId['user-a'].status, 'fresh');
assert.equal(progress.byUserId['user-b'].status, 'fresh');
assert.equal(progress.byUserId['user-c'].status, 'stale');
assert.ok(
  progress.byUserId['user-b'].remainingMeters < progress.byUserId['user-a'].remainingMeters,
  'participant farther along the common route must have less remaining distance',
);

const ordered = participantStack.reduceParticipantStackOrder(
  participantStack.emptyParticipantStackOrderState(),
  Object.values(progress.byUserId),
);
assert.deepEqual(ordered.order, ['user-b', 'user-a', 'user-c']);

const presentation = presentationModule.buildParticipantStackPresentation(
  [
    { userId: 'user-a', displayName: 'Driver A' },
    { userId: 'user-b', displayName: 'Driver B' },
    { userId: 'user-c', displayName: 'Driver C' },
  ],
  progress.byUserId,
  ordered.order,
  'user-a',
);
assert.equal(presentation.rows[0].userId, 'user-b');
assert.equal(presentation.rows[0].kind, 'distance');
assert.equal(presentation.rows[0].canFocus, true);
assert.equal(presentation.rows[1].isCurrentUser, true);
assert.equal(presentation.rows[2].kind, 'unavailable');
assert.equal(presentation.rows[2].valueLabel, 'Unavailable');
assert.equal(presentation.rows[2].canFocus, false);
assert.equal(presentation.hiddenCount, 0);
assert.match(presentation.rows[0].valueLabel, /^\d+\.\d km$/);

console.log('Group Drive Phase 4C composition smoke: PASS (13 assertions)');
