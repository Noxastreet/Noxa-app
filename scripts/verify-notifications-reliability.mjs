import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const source = fs.readFileSync('app/notifications.tsx', 'utf8');

assert(
  /useCallback, useMemo, useRef, useState/.test(source),
  'Notifications must keep a request sequence ref.',
);
assert(
  /const requestIdRef = useRef\(0\)/.test(source),
  'Notifications must track the newest load request.',
);
assert(
  /const requestId = \+\+requestIdRef\.current/.test(source),
  'Each notifications load must receive a monotonic request id.',
);
assert(
  /Promise\.all\([\s\S]*listMyGroupDrives\(\)[\s\S]*\]\)/.test(source),
  'Group Drive inbox loading must run with the primary activity requests.',
);
assert(
  !/listMyGroupDrives\(\)\.catch\(\(\) => \[\]\)/.test(source),
  'Group Drive loading failures must not be translated into an empty inbox.',
);
assert(
  /if \(requestId !== requestIdRef\.current\) return;[\s\S]*setActivities\(/.test(source),
  'Only the newest request may publish activity state.',
);
assert(
  /catch \{[\s\S]*if \(requestId !== requestIdRef\.current\) return;[\s\S]*setErrorMessage/.test(source),
  'A stale failed request must not overwrite newer state with an error.',
);
assert(
  /finally \{[\s\S]*if \(requestId === requestIdRef\.current\)[\s\S]*setIsLoading\(false\)[\s\S]*setIsRefreshing\(false\)/.test(source),
  'Only the newest request may clear loading indicators.',
);

if (!process.exitCode) {
  console.log('Notifications reliability contract passed.');
}
