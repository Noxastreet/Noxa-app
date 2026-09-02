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
    throw new Error(`Unexpected test dependency: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

const routeProgress = compile('src/features/group-drive/runtime/routeProgress.ts');
const participantStack = compile('src/features/group-drive/runtime/participantStack.ts', {
  './routeProgress': routeProgress,
});

const geometry = {
  type: 'LineString',
  coordinates: [[0, 0], [0.01, 0], [0.02, 0]],
};
const route = routeProgress.prepareDriveRoute(geometry, 2_000);
assert.ok(route, 'valid LineString should produce a prepared route');
assert.equal(routeProgress.prepareDriveRoute({ type: 'LineString', coordinates: [[0, 0]] }, 1), null);
assert.equal(routeProgress.prepareDriveRoute(geometry, 0), null);

const start = routeProgress.projectDriveLocation(route, 0, 0);
const middle = routeProgress.projectDriveLocation(route, 0, 0.01);
const end = routeProgress.projectDriveLocation(route, 0, 0.02);
assert.ok(Math.abs(start.remainingMeters - 2_000) < 0.001);
assert.ok(Math.abs(middle.remainingMeters - 1_000) < 1);
assert.ok(end.remainingMeters < 0.001);
assert.ok(routeProgress.projectDriveLocation(route, 0.003, 0.01).distanceFromRouteMeters > 300);

const row = (id, userId, longitude, latitude, updatedAt, status = 'moving') => ({
  id,
  driveSessionId: 'drive-a',
  userId,
  latitude,
  longitude,
  heading: null,
  status,
  updatedAt,
});

const atNoon = new Date('2026-08-20T12:00:00.000Z');
let progress = routeProgress.deriveGroupDriveParticipantProgress(
  'drive-a',
  route,
  ['user-a', 'user-b', 'user-c', 'user-d'],
  [
    row('a', 'user-a', 0.005, 0, '2026-08-20T12:00:00.000Z'),
    { ...row('foreign', 'user-a', 0.019, 0, '2026-08-20T12:00:01.000Z'), driveSessionId: 'drive-b' },
    row('b', 'user-b', 0.01, 0, '2026-08-20T11:59:14.000Z'),
    row('c', 'user-c', 0.02, 0, '2026-08-20T11:00:00.000Z', 'arrived'),
  ],
  undefined,
  atNoon,
);
assert.equal(progress.byUserId['user-a'].status, 'fresh');
assert.ok(Math.abs(progress.byUserId['user-a'].remainingMeters - 1_500) < 1);
assert.equal(progress.byUserId['user-b'].status, 'stale');
assert.equal(progress.byUserId['user-b'].remainingMeters, null);
assert.equal(progress.byUserId['user-c'].status, 'arrived');
assert.equal(progress.byUserId['user-c'].remainingMeters, 0);
assert.equal(progress.byUserId['user-d'].status, 'unknown');

progress = routeProgress.deriveGroupDriveParticipantProgress(
  'drive-a',
  route,
  ['user-a'],
  [row('a', 'user-a', 0.005, 0.003, '2026-08-20T12:00:15.000Z')],
  progress,
  new Date('2026-08-20T12:00:15.000Z'),
);
assert.equal(progress.byUserId['user-a'].status, 'off_route');
assert.equal(progress.byUserId['user-a'].retainedFromLastStable, true);
assert.ok(Math.abs(progress.byUserId['user-a'].remainingMeters - 1_500) < 1);

progress = routeProgress.deriveGroupDriveParticipantProgress(
  'drive-a',
  route,
  ['user-a'],
  [row('a', 'user-a', 0.006, 0.003, '2026-08-20T12:00:30.000Z')],
  progress,
  new Date('2026-08-20T12:00:30.000Z'),
);
assert.equal(progress.byUserId['user-a'].status, 'off_route');
assert.equal(progress.byUserId['user-a'].remainingMeters, null);
assert.equal(progress.byUserId['user-a'].retainedFromLastStable, false);

progress = routeProgress.deriveGroupDriveParticipantProgress(
  'drive-a',
  route,
  ['user-a'],
  [row('a', 'user-a', 0.007, 0, '2026-08-20T12:00:45.000Z')],
  progress,
  new Date('2026-08-20T12:00:45.000Z'),
);
assert.equal(progress.byUserId['user-a'].status, 'fresh');
assert.ok(Math.abs(progress.byUserId['user-a'].remainingMeters - 1_300) < 1);

const stackRow = (userId, remainingMeters, status = 'fresh') => ({
  userId,
  locationId: userId,
  status,
  remainingMeters,
  progressFraction: remainingMeters === null ? null : 1 - remainingMeters / 2_000,
  distanceFromRouteMeters: remainingMeters === null ? null : 0,
  updatedAt: '2026-08-20T12:00:00.000Z',
  retainedFromLastStable: false,
});

const retainedOrder = participantStack.reduceParticipantStackOrder(
  participantStack.emptyParticipantStackOrderState(),
  [
    stackRow('unknown-user', null, 'unknown'),
    { ...stackRow('settling-user', 700, 'off_route'), retainedFromLastStable: true },
  ],
);
assert.deepEqual(retainedOrder.order, ['settling-user', 'unknown-user']);

let order = participantStack.reduceParticipantStackOrder(
  participantStack.emptyParticipantStackOrderState(),
  [stackRow('user-a', 1_000), stackRow('user-b', 900), stackRow('user-c', null, 'unknown')],
);
assert.deepEqual(order.order, ['user-a', 'user-b', 'user-c'], 'sub-threshold noise preserves order');

order = participantStack.reduceParticipantStackOrder(order, [
  stackRow('user-a', 1_000), stackRow('user-b', 800), stackRow('user-c', null, 'unknown'),
]);
assert.deepEqual(order.order, ['user-a', 'user-b', 'user-c']);
assert.deepEqual(order.pendingOrder, ['user-b', 'user-a', 'user-c']);
assert.equal(order.pendingConfirmations, 1);

order = participantStack.reduceParticipantStackOrder(order, [
  stackRow('user-a', 990), stackRow('user-b', 790), stackRow('user-c', null, 'unknown'),
]);
assert.deepEqual(order.order, ['user-b', 'user-a', 'user-c']);
assert.equal(order.pendingOrder, null);

order = participantStack.reduceParticipantStackOrder(order, [
  stackRow('user-a', 980), stackRow('user-b', 780), stackRow('user-c', 0, 'arrived'),
]);
assert.deepEqual(order.order, ['user-b', 'user-a', 'user-c']);
order = participantStack.reduceParticipantStackOrder(order, [
  stackRow('user-a', 970), stackRow('user-b', 770), stackRow('user-c', 0, 'arrived'),
]);
assert.deepEqual(order.order, ['user-c', 'user-b', 'user-a']);

order = participantStack.reduceParticipantStackOrder(order, [
  stackRow('user-a', 960), stackRow('user-c', 0, 'arrived'),
]);
assert.equal(order.order.includes('user-b'), false, 'removed participants disappear immediately');

const window = participantStack.selectParticipantStackWindow(
  ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7'],
  'user-7',
);
assert.deepEqual(window.visibleUserIds, ['user-1', 'user-2', 'user-7']);
assert.equal(window.hiddenCount, 4);
assert.equal(window.currentUserReserved, true);

console.log('Group Drive Phase 4A route progress/stack smoke: PASS (35 checks)');
