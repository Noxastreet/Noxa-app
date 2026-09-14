import fs from 'node:fs';

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly 1 match in ${path}, found ${matches}`);
  fs.writeFileSync(path, source.replace(from, to));
}

const activePath = 'app/group-drives/[id]/active.tsx';

replaceExact(
  activePath,
  `import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';`,
  `import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';`,
  'AppState import',
);

replaceExact(
  activePath,
  `  const detailsRef = useRef<GroupDriveDetails | null>(null);\n  const locationPromptedRef = useRef(false);`,
  `  const detailsRef = useRef<GroupDriveDetails | null>(null);\n  const locationPromptedRef = useRef(false);\n  const accessVerifiedRef = useRef(false);\n  const appStateRef = useRef(AppState.currentState);`,
  'foreground verification refs',
);

replaceExact(
  activePath,
  `  const offerLocationSharing = useCallback(() => {`,
  `  const handleAccessRevoked = useCallback(() => {\n    accessVerifiedRef.current = false;\n    detailsRef.current = null;\n    setConnection('closed');\n    setSelectedUserId(null);\n    setDetails(null);\n    setSnapshot(null);\n    setError('Your access to this Active Drive ended.');\n    void stopGroupDriveLocationSession().finally(() => {\n      router.replace('/group-drives');\n    });\n  }, []);\n\n  const offerLocationSharing = useCallback(() => {`,
  'fail-closed access handler',
);

replaceExact(
  activePath,
  `      detailsRef.current = nextDetails;\n      setDetails(nextDetails);\n      applySnapshot(nextSnapshot);`,
  `      accessVerifiedRef.current = true;\n      detailsRef.current = nextDetails;\n      setDetails(nextDetails);\n      applySnapshot(nextSnapshot);`,
  'initial access verification',
);

replaceExact(
  activePath,
  `        onSnapshot: (liveSnapshot) => {\n          if (!disposed) applySnapshot(liveSnapshot);\n        },`,
  `        onSnapshot: (liveSnapshot) => {\n          if (!disposed && accessVerifiedRef.current) applySnapshot(liveSnapshot);\n        },`,
  'ignore stale snapshots while foreground access is unverified',
);

replaceExact(
  activePath,
  `        onAccessRevoked: () => {\n          if (disposed) return;\n          setConnection('closed');\n          setError('Your access to this Active Drive ended.');\n          void stopGroupDriveLocationSession().finally(() => {\n            if (!disposed) router.replace('/group-drives');\n          });\n        },`,
  `        onAccessRevoked: () => {\n          if (disposed) return;\n          handleAccessRevoked();\n        },`,
  'shared realtime access revocation path',
);

replaceExact(
  activePath,
  `  }, [applySnapshot, driveSessionId, offerLocationSharing]);\n\n  const identities = useMemo(`,
  `  }, [applySnapshot, driveSessionId, handleAccessRevoked, offerLocationSharing]);\n\n  useEffect(() => {\n    let disposed = false;\n    const subscription = AppState.addEventListener('change', (nextState) => {\n      const previousState = appStateRef.current;\n      appStateRef.current = nextState;\n      const returningToForeground =\n        (previousState === 'background' || previousState === 'inactive')\n        && nextState === 'active';\n\n      if (!returningToForeground || !driveSessionId) return;\n\n      accessVerifiedRef.current = false;\n      setSnapshot(null);\n      setConnection('reconnecting');\n\n      void loadActiveDriveRealtimeSnapshot(driveSessionId)\n        .then((nextSnapshot) => {\n          if (disposed) return;\n          accessVerifiedRef.current = true;\n          applySnapshot(nextSnapshot);\n          setError(null);\n        })\n        .catch((foregroundError) => {\n          if (disposed) return;\n          const message = foregroundError instanceof Error\n            ? foregroundError.message\n            : 'Active Drive state could not be synchronized.';\n          if (/access is no longer available/i.test(message)) {\n            handleAccessRevoked();\n            return;\n          }\n          setError(message);\n        });\n    });\n\n    return () => {\n      disposed = true;\n      subscription.remove();\n    };\n  }, [applySnapshot, driveSessionId, handleAccessRevoked]);\n\n  const identities = useMemo(`,
  'foreground reconcile effect',
);

replaceExact(
  'package.json',
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n`,
  `    "verify:home-map-performance": "node ./scripts/verify-home-map-performance.mjs",\n    "verify:t8-active-drive-foreground-reconcile": "node ./scripts/verify-t8-active-drive-foreground-reconcile.mjs",\n`,
  'package verifier script',
);

const verifierPath = 'scripts/verify-t8-active-drive-foreground-reconcile.mjs';
replaceExact(
  verifierPath,
  `assert.ok(active.includes('const appStateRef = useRef(AppState.currentState);'), 'Active Drive must track previous AppState.');`,
  `assert.ok(active.includes('const appStateRef = useRef(AppState.currentState);'), 'Active Drive must track previous AppState.');\nassert.ok(active.includes('const accessVerifiedRef = useRef(false);'), 'Active Drive must explicitly gate cached snapshots while foreground access is unverified.');`,
  'access verification ref contract',
);
replaceExact(
  verifierPath,
  `assert.ok(active.includes('setSnapshot(null);'), 'Access revocation must remove cached location snapshot before navigation completes.');`,
  `assert.ok(active.includes('setSnapshot(null);'), 'Access revocation/foreground verification must remove cached location snapshot before stale coordinates can render.');\nassert.ok(active.includes('!disposed && accessVerifiedRef.current'), 'Realtime snapshots must be ignored while foreground access is unverified.');`,
  'stale snapshot gating contract',
);
replaceExact(
  verifierPath,
  `console.log('T8 Active Drive foreground reconcile contract: PASS (12 checks)');`,
  `console.log('T8 Active Drive foreground reconcile contract: PASS (14 checks)');`,
  'contract count',
);

console.log('Applied T8 Active Drive foreground reconcile patch.');
