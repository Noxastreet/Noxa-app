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

const participantStack = compile('src/features/group-drive/runtime/participantStack.ts', {
  './routeProgress': {},
});
const presentation = compile('src/features/group-drive/runtime/participantStackPresentation.ts', {
  './participantStack': participantStack,
  './routeProgress': {},
});

const progress = (userId, remainingMeters, status = 'fresh', overrides = {}) => ({
  userId,
  locationId: `location-${userId}`,
  status,
  remainingMeters,
  progressFraction: remainingMeters === null ? null : 1 - remainingMeters / 10_000,
  distanceFromRouteMeters: remainingMeters === null ? null : 0,
  updatedAt: '2026-08-21T10:00:00.000Z',
  retainedFromLastStable: false,
  ...overrides,
});

assert.equal(presentation.formatParticipantRemainingDistance(2_449), '2.4 km');
assert.equal(presentation.formatParticipantRemainingDistance(40), '0.1 km');
assert.equal(presentation.formatParticipantRemainingDistance(-10), '0.1 km');
assert.equal(presentation.formatParticipantRemainingDistance(Number.NaN), 'Unavailable');

const identities = [
  { userId: 'arrived', displayName: 'Alex Rivera' },
  { userId: 'near', displayName: 'Kim Morgan', initials: 'km' },
  { userId: 'middle', displayName: 'Nick Stone' },
  { userId: 'far', displayName: 'Sam Lee' },
  { userId: 'other', displayName: 'Mia Chen' },
  { userId: 'self', displayName: 'Taylor Driver' },
  { userId: 'unknown', displayName: 'Jamie Lane' },
];
const progressByUserId = {
  arrived: progress('arrived', 0, 'arrived'),
  near: progress('near', 2_449),
  middle: progress('middle', 3_800),
  far: progress('far', 5_100),
  other: progress('other', 5_500),
  self: progress('self', 6_000),
  unknown: progress('unknown', null, 'unknown', { locationId: null }),
};
const result = presentation.buildParticipantStackPresentation(
  identities,
  progressByUserId,
  ['arrived', 'near', 'middle', 'far', 'other', 'self', 'unknown'],
  'self',
);

assert.deepEqual(result.visibleUserIds, ['arrived', 'near', 'middle', 'far', 'self']);
assert.equal(result.currentUserReserved, true);
assert.equal(result.hiddenCount, 2);
assert.equal(result.moreAccessibilityLabel, '2 more participants. Open participant list.');
assert.deepEqual(result.rows.map(({ kind }) => kind), ['arrived', 'distance', 'distance', 'distance', 'distance']);
assert.equal(result.rows[0].valueLabel, 'Arrived');
assert.equal(result.rows[0].initials, 'AR');
assert.equal(result.rows[1].valueLabel, '2.4 km');
assert.equal(result.rows[1].initials, 'KM');
assert.equal(result.rows[4].isCurrentUser, true);
assert.match(result.rows[4].accessibilityLabel, /^You, Taylor Driver, 6\.0 kilometres remaining$/);

const unavailable = presentation.buildParticipantStackPresentation(
  identities,
  progressByUserId,
  ['unknown'],
  'self',
);
assert.equal(unavailable.rows[0].kind, 'unavailable');
assert.equal(unavailable.rows[0].valueLabel, 'Unavailable');
assert.equal(unavailable.rows[0].canFocus, false);
assert.match(unavailable.rows[0].accessibilityLabel, /location unavailable$/);

const retained = presentation.buildParticipantStackPresentation(
  identities,
  { near: progress('near', 2_500, 'off_route', { retainedFromLastStable: true }) },
  ['near'],
  'self',
);
assert.equal(retained.rows[0].kind, 'distance');
assert.equal(retained.rows[0].valueLabel, '2.5 km');
assert.equal(retained.rows[0].canFocus, true);

const stale = presentation.buildParticipantStackPresentation(
  identities,
  { near: progress('near', null, 'stale') },
  ['missing-identity', 'near'],
  'self',
);
assert.equal(stale.rows.length, 1, 'unknown identities are excluded from the visible window');
assert.equal(stale.rows[0].kind, 'unavailable');
assert.equal(stale.rows[0].canFocus, false);

console.log('Group Drive Phase 4B participant presentation smoke: PASS (25 checks)');
