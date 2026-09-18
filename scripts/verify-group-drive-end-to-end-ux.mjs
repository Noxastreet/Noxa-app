import fs from 'node:fs';

const lobbyScreen = fs.readFileSync('app/group-drives/[id].tsx', 'utf8');
const lobbyRuntime = fs.readFileSync('src/features/group-drive/lobby.ts', 'utf8');
const participantStack = fs.readFileSync(
  'src/features/group-drive/components/GroupDriveParticipantStack.tsx',
  'utf8',
);
const activeScreen = fs.readFileSync('app/group-drives/[id]/active.tsx', 'utf8');

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(
  /Meet point|Meet at A/i.test(lobbyScreen) &&
    lobbyScreen.includes('Navigate to A') &&
    lobbyScreen.includes('Show my distance'),
  'Lobby must expose a clear meeting-at-A approach flow.',
);
expect(
  lobbyScreen.includes('readLocalNavigationLocation') &&
    lobbyScreen.includes('calculateDriveRoute(['),
  'Lobby must calculate the current user route to point A.',
);
expect(
  lobbyScreen.includes('not shared with Group Drive participants') &&
    lobbyScreen.includes('Ready does not start live sharing'),
  'Lobby approach flow must preserve explicit privacy disclosure.',
);
expect(
  lobbyScreen.includes('Waiting for 1 driver at A') &&
    lobbyScreen.includes('waitingCount === 0'),
  'Host Start must wait until accepted participants are ready at A.',
);
expect(
  lobbyScreen.includes("router.replace({ pathname: '/group-drives/[id]/active'") &&
    lobbyScreen.includes('subscribeToDriveLobbyStatus'),
  'Lobby must route into Active Drive locally and on remote start.',
);
expect(
  lobbyRuntime.includes("table: 'drive_sessions'") &&
    lobbyRuntime.includes("status === 'active'"),
  'Lobby realtime must watch the drive session status transition.',
);
expect(
  lobbyScreen.includes("AppState.addEventListener('change'") &&
    lobbyScreen.includes("state === 'active'"),
  'Lobby must reconcile drive status immediately when the app returns to foreground.',
);
expect(
  participantStack.includes("row.kind === 'unavailable' ? '—' : row.valueLabel"),
  'Active participant avatars must display truthful remaining-distance state.',
);
expect(
  activeScreen.includes('<GroupDriveParticipantStack') &&
    activeScreen.includes('buildParticipantStackPresentation'),
  'Active Drive must render the distance-aware participant stack.',
);
expect(
  !/startGroupDriveLocationSession|requestBackgroundPermissionsAsync|startLocationUpdatesAsync/.test(lobbyScreen),
  'Pre-drive Lobby must not start Group Drive background location sharing.',
);

if (failures.length) {
  console.error('Group Drive end-to-end UX contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Group Drive end-to-end UX contract: PASS');
