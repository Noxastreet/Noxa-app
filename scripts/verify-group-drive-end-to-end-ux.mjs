import fs from 'node:fs';

const lobbyRedirect = fs.readFileSync('app/group-drives/[id].tsx', 'utf8');
const lobbyCard = fs.readFileSync(
  'src/features/map-context/MapGroupDriveFlow.tsx',
  'utf8',
);
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
  lobbyRedirect.includes('pathname: "/(tabs)"') &&
    lobbyRedirect.includes('groupDriveId: driveSessionId'),
  'Legacy full-screen Lobby route must hand off to the persistent Map card.',
);
expect(
  lobbyCard.includes('| "lobby"') &&
    lobbyCard.includes('renderLobby') &&
    lobbyCard.includes('initialDriveId'),
  'Map Group Drive flow must own the pre-drive Lobby state.',
);
expect(
  lobbyCard.includes("I'm at A · Ready") &&
    lobbyCard.includes('Ready at A · tap to undo') &&
    lobbyCard.includes('Waiting for ${waitingCount} at A'),
  'Contextual Lobby must preserve Ready-at-A semantics and host gating.',
);
expect(
  lobbyCard.includes('Starting the drive cancels pending invitations') &&
    lobbyCard.includes('Ready coordinates the Lobby only. It never starts location sharing.'),
  'Contextual Lobby must preserve invitation and privacy disclosures.',
);
expect(
  lobbyCard.includes('subscribeToDriveLobbyStatus') &&
    lobbyCard.includes('setInterval(() => void loadLobby(lobbyDriveId), 5000)') &&
    lobbyCard.includes('AppState.addEventListener("change"'),
  'Contextual Lobby must reconcile realtime, polling, and foreground changes.',
);
expect(
  lobbyCard.includes('pathname: "/group-drives/[id]/active"') &&
    lobbyCard.includes('startDrive(lobbyDrive.id)'),
  'Contextual Lobby must route into Active Drive locally and on remote start.',
);
expect(
  lobbyRuntime.includes("table: 'drive_sessions'") &&
    lobbyRuntime.includes("status === 'active'"),
  'Lobby realtime must watch the drive session status transition.',
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
  !/startGroupDriveLocationSession|requestBackgroundPermissionsAsync|startLocationUpdatesAsync/.test(lobbyCard),
  'Pre-drive contextual Lobby must not start Group Drive background location sharing.',
);

if (failures.length) {
  console.error('Group Drive end-to-end UX contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Group Drive end-to-end UX contract: PASS');
