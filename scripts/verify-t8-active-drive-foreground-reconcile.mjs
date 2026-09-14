import assert from 'node:assert/strict';
import fs from 'node:fs';

const active = fs.readFileSync('app/group-drives/[id]/active.tsx', 'utf8');

assert.ok(active.includes("AppState,"), 'Active Drive must import AppState for foreground reconciliation.');
assert.ok(active.includes('const appStateRef = useRef(AppState.currentState);'), 'Active Drive must track previous AppState.');
assert.ok(active.includes('const handleAccessRevoked = useCallback(() => {'), 'Active Drive must centralize fail-closed access revocation handling.');
assert.ok(active.includes('setSnapshot(null);'), 'Access revocation must remove cached location snapshot before navigation completes.');
assert.ok(active.includes('setDetails(null);'), 'Access revocation must remove active drive details before navigation completes.');
assert.ok(active.includes("router.replace('/group-drives')"), 'Access revocation must leave the stale Active Drive route.');
assert.ok(active.includes("AppState.addEventListener('change'"), 'Active Drive must reconcile when app state changes.');
assert.ok(active.includes("nextState !== 'active'"), 'Foreground reconciliation must only run on active transition.');
assert.ok(active.includes('loadActiveDriveRealtimeSnapshot(driveSessionId)'), 'Foreground reconciliation must fetch a fresh server snapshot.');
assert.ok(active.includes('applySnapshot(nextSnapshot);'), 'Fresh foreground snapshot must replace cached runtime state.');
assert.ok(active.includes('handleAccessRevoked();'), 'Foreground access loss must use fail-closed handler.');
assert.ok(active.includes('onAccessRevoked: handleAccessRevoked'), 'Realtime access revocation must share the same fail-closed path.');

console.log('T8 Active Drive foreground reconcile contract: PASS (12 checks)');
