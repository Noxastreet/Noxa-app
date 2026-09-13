import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly 1 match, found ${matches}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceExact(
  'src/features/group-drive/runtime/nativeLocation.ts',
  `export function getGroupDriveLocationSession() {\n  const session = readStoredSession();\n  if (!session) return null;\n  if (Date.now() >= Date.parse(session.activeExpiresAt)) {\n    void clearLocalRuntime();\n    return null;\n  }\n  return session;\n}\n\nexport async function requestGroupDriveLocationPermissions() {`,
  `export function getGroupDriveLocationSession() {\n  const session = readStoredSession();\n  if (!session) return null;\n  if (Date.now() >= Date.parse(session.activeExpiresAt)) {\n    void clearLocalRuntime();\n    return null;\n  }\n  return session;\n}\n\nexport type GroupDriveLocationRuntimeReconcileResult = {\n  sharing: boolean;\n  reason: 'permission_revoked' | 'writer_stopped' | null;\n  session: GroupDriveLocationSession | null;\n};\n\nexport async function reconcileGroupDriveLocationRuntime(\n  driveSessionId: string,\n): Promise<GroupDriveLocationRuntimeReconcileResult> {\n  const session = getGroupDriveLocationSession();\n  if (!session || session.driveSessionId !== driveSessionId) {\n    return { sharing: false, reason: null, session: null };\n  }\n\n  const [foreground, background, taskStarted] = await Promise.all([\n    Location.getForegroundPermissionsAsync(),\n    Location.getBackgroundPermissionsAsync(),\n    Location.hasStartedLocationUpdatesAsync(GROUP_DRIVE_LOCATION_TASK_NAME),\n  ]);\n  const permissionsGranted =\n    foreground.status === Location.PermissionStatus.GRANTED\n    && background.status === Location.PermissionStatus.GRANTED;\n\n  if (permissionsGranted && taskStarted) {\n    return { sharing: true, reason: null, session };\n  }\n\n  // Fail closed when OS permission or the native writer changed while NOXA was backgrounded.\n  await clearLocalRuntime();\n  return {\n    sharing: false,\n    reason: permissionsGranted ? 'writer_stopped' : 'permission_revoked',\n    session,\n  };\n}\n\nexport async function requestGroupDriveLocationPermissions() {`,
  'native runtime reconciliation',
);

replaceExact(
  'app/group-drives/[id]/location-sharing.tsx',
  `import { StyleSheet, Text, View } from 'react-native';`,
  `import { AppState, StyleSheet, Text, View } from 'react-native';`,
  'AppState import',
);
replaceExact(
  'app/group-drives/[id]/location-sharing.tsx',
  `  getGroupDriveLocationSession,\n  getPendingGroupDriveServerAction,`,
  `  getPendingGroupDriveServerAction,\n  reconcileGroupDriveLocationRuntime,`,
  'reconcile import',
);
replaceExact(
  'app/group-drives/[id]/location-sharing.tsx',
  `      const session = getGroupDriveLocationSession();\n      const isSharing = session?.driveSessionId === driveSessionId;\n      setSharing(isSharing);\n\n      const pending = getPendingGroupDriveServerAction(driveSessionId);\n      if (isSharing && pending?.kind === 'clear_location') {\n        // A new explicit sharing session supersedes an older cleanup intent.\n        clearPendingGroupDriveServerAction('clear_location', driveSessionId);\n        setCleanupPending(false);\n      } else {\n        setCleanupPending(pending?.kind === 'clear_location');\n      }\n      setError(null);`,
  `      const runtime = await reconcileGroupDriveLocationRuntime(driveSessionId);\n      let runtimeError: string | null = null;\n      let runtimeCleanupPending = false;\n\n      if (runtime.reason) {\n        const cleanup = await retryGroupDriveLocationCleanup(driveSessionId);\n        runtimeCleanupPending = !cleanup.serverCleared;\n        runtimeError = runtime.reason === 'permission_revoked'\n          ? 'Group Drive sharing stopped because location permission is no longer granted. Re-enable location permission, then start sharing again.'\n          : 'Group Drive sharing stopped because the background location writer is no longer active. Start sharing again to resume.';\n      }\n\n      const isSharing = runtime.sharing;\n      setSharing(isSharing);\n\n      const pending = getPendingGroupDriveServerAction(driveSessionId);\n      if (isSharing && pending?.kind === 'clear_location') {\n        // A new explicit sharing session supersedes an older cleanup intent.\n        clearPendingGroupDriveServerAction('clear_location', driveSessionId);\n        setCleanupPending(false);\n      } else {\n        setCleanupPending(runtimeCleanupPending || pending?.kind === 'clear_location');\n      }\n      setError(runtimeError);`,
  'sharing refresh reconciliation',
);
replaceExact(
  'app/group-drives/[id]/location-sharing.tsx',
  `  useEffect(() => {\n    void refresh();\n  }, [refresh]);\n\n  useEffect(() => {\n    if (!driveSessionId || !active) return;`,
  `  useEffect(() => {\n    void refresh();\n  }, [refresh]);\n\n  useEffect(() => {\n    const subscription = AppState.addEventListener('change', (nextState) => {\n      if (nextState === 'active') void refresh();\n    });\n    return () => subscription.remove();\n  }, [refresh]);\n\n  useEffect(() => {\n    if (!driveSessionId || !active) return;`,
  'foreground reconciliation listener',
);

replaceExact(
  'scripts/test-group-drive-phase-3b.mjs',
  `assert.equal(native.getGroupDriveLocationSession()?.driveSessionId, 'drive-a');\n\nrpcError = { message: 'Network request failed' };`,
  `assert.equal(native.getGroupDriveLocationSession()?.driveSessionId, 'drive-a');\n\nlet runtimeState = await native.reconcileGroupDriveLocationRuntime('drive-a');\nassert.equal(runtimeState.sharing, true, 'granted permissions plus a running task must reconcile as sharing');\nassert.equal(runtimeState.reason, null);\nforegroundStatus = 'denied';\nruntimeState = await native.reconcileGroupDriveLocationRuntime('drive-a');\nassert.equal(runtimeState.sharing, false, 'revoked OS permission must fail closed');\nassert.equal(runtimeState.reason, 'permission_revoked');\nassert.equal(taskStarted, false, 'permission reconciliation must stop the native writer');\nassert.equal(native.getGroupDriveLocationSession(), null, 'permission reconciliation must clear stale local sharing state');\nforegroundStatus = 'granted';\nconst resumedConsent = native.acceptGroupDriveLocationDisclosure('drive-a');\nawait native.startGroupDriveLocationSession(resumedConsent);\nassert.equal(taskStarted, true, 'sharing can be explicitly restarted after permission is restored');\n\nrpcError = { message: 'Network request failed' };`,
  'deterministic permission revoke smoke',
);
replaceExact(
  'scripts/test-group-drive-phase-3b.mjs',
  `console.log('Group Drive Phase 3B deterministic native runtime smoke: PASS (18 assertions)');`,
  `console.log('Group Drive Phase 3B deterministic native runtime smoke: PASS (25 assertions)');`,
  'smoke assertion count',
);

replaceExact(
  'scripts/verify-group-drive-phase-3b.mjs',
  `    ['background permission request missing', /requestBackgroundPermissionsAsync/],\n    ['server-owned active expiry missing', /activeExpiresAt/],`,
  `    ['background permission request missing', /requestBackgroundPermissionsAsync/],\n    ['foreground permission recheck missing', /getForegroundPermissionsAsync/],\n    ['background permission recheck missing', /getBackgroundPermissionsAsync/],\n    ['native task state recheck missing', /hasStartedLocationUpdatesAsync\\(GROUP_DRIVE_LOCATION_TASK_NAME\\)/],\n    ['runtime reconciliation primitive missing', /reconcileGroupDriveLocationRuntime/],\n    ['server-owned active expiry missing', /activeExpiresAt/],`,
  'static native reconciliation contract',
);
replaceExact(
  'scripts/verify-group-drive-phase-3b.mjs',
  `  if (!/Join and Ready never enable (?:location )?sharing/.test(consentScreen)) {\n    failures.push('consent screen must state that Join/Ready do not enable sharing');\n  }`,
  `  if (!/Join and Ready never enable (?:location )?sharing/.test(consentScreen)) {\n    failures.push('consent screen must state that Join/Ready do not enable sharing');\n  }\n  if (!/AppState\\.addEventListener\\('change'[\\s\\S]*nextState === 'active'[\\s\\S]*refresh\\(\\)/.test(consentScreen)) {\n    failures.push('consent screen must reconcile sharing when the app returns from OS settings');\n  }\n  if (!/reconcileGroupDriveLocationRuntime\\(driveSessionId\\)/.test(consentScreen)) {\n    failures.push('consent screen must recheck OS permissions and native writer state');\n  }`,
  'static screen reconciliation contract',
);

console.log('Applied T8 GPS permission reconciliation patch.');
