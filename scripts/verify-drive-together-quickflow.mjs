#!/usr/bin/env node

import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const quickMigration = fs.readFileSync(
  'supabase/migrations/20260927120358_drive_together_quickflow.sql',
  'utf8',
);
const destinationMigration = fs.readFileSync(
  'supabase/migrations/20260928130000_drive_together_shared_destination.sql',
  'utf8',
);
const arrivalGuardMigration = fs.readFileSync(
  'supabase/migrations/20261001115500_guard_quick_drive_arrival.sql',
  'utf8',
);
const api = fs.readFileSync('src/features/group-drive/api.ts', 'utf8');
const layer = fs.readFileSync(
  'src/features/group-drive/DriveTogetherMapLayer.tsx',
  'utf8',
);
const navigation = fs.readFileSync(
  'src/features/group-drive/runtime/useQuickDriveNavigation.ts',
  'utf8',
);
const quickRoomRealtime = fs.readFileSync(
  'src/features/group-drive/runtime/quickRoomRealtime.ts',
  'utf8',
);
const sheet = fs.readFileSync(
  'src/features/group-drive/components/DriveTogetherSheet.tsx',
  'utf8',
);
const participantRail = fs.readFileSync(
  'src/features/group-drive/components/DriveTogetherParticipantRail.tsx',
  'utf8',
);
const mapRuntime = fs.readFileSync(
  'src/features/mapbox/MapboxLiveMap.tsx',
  'utf8',
);
const map = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
const bridge = fs.readFileSync(
  'src/features/notifications/PushNotificationBridge.tsx',
  'utf8',
);
const notifications = fs.readFileSync('app/notifications.tsx', 'utf8');

assert(
  /add column if not exists drive_mode text not null default 'planned'/.test(quickMigration)
    && /drive_mode in \('planned', 'quick'\)/.test(quickMigration),
  'Quick Drive must remain additive to the existing drive_sessions table.',
);
assert(
  !/^as \$$/m.test(destinationMigration) && !/^\$;$/m.test(destinationMigration),
  'Shared-destination PL/pgSQL dollar quotes must remain balanced.',
);
assert(
  /destination_latitude/.test(destinationMigration)
    && /destination_longitude/.test(destinationMigration)
    && /destination_version/.test(destinationMigration)
    && /proposed_destination_by/.test(destinationMigration),
  'Quick rooms must persist one canonical shared destination and one pending proposal.',
);
assert(
  /function public\.noxa_create_quick_drive_with_destination/.test(destinationMigration)
    && /target_count < 1 or target_count > 7/.test(destinationMigration)
    && /Drive Together supports 2 to 8 drivers/.test(destinationMigration)
    && /Drive Together requires mutual friends/.test(destinationMigration),
  'Destination-first room creation must enforce mutual friends and the 2-8 driver limit.',
);
assert(
  /function public\.noxa_invite_quick_drive_user/.test(destinationMigration)
    && /current_session\.status not in \('draft', 'active'\)/.test(destinationMigration),
  'Quick rooms must support host late-invite while waiting or active.',
);
assert(
  /function public\.noxa_respond_to_drive_invitation/.test(destinationMigration)
    && /current_session\.drive_mode = 'quick'/.test(destinationMigration)
    && /current_session\.status not in \('draft', 'active'\)/.test(destinationMigration)
    && /case when current_session\.status = 'active' then 'active' else 'accepted' end/.test(destinationMigration),
  'Quick invitation acceptance must support first join and late join without a Start step.',
);
assert(
  /function public\.noxa_propose_quick_drive_destination/.test(destinationMigration)
    && /function public\.noxa_respond_quick_drive_destination_proposal/.test(destinationMigration)
    && /Only the Drive Together host can approve a destination/.test(destinationMigration),
  'Any active participant may request a destination and the host must own approval.',
);
assert(
  /remaining_distance_meters/.test(destinationMigration)
    && /route_destination_version/.test(destinationMigration)
    && /function public\.noxa_upsert_quick_drive_navigation_progress/.test(destinationMigration),
  'Each participant must publish only their own remaining distance for the current destination version.',
);
assert(
  /all_arrived/.test(destinationMigration)
    && /delete from public\.drive_sessions/.test(destinationMigration)
    && /drive_mode = 'quick'/.test(destinationMigration),
  'Quick rooms must auto-end ephemerally with no retained trip history.',
);
assert(
  /create or replace function private\.noxa_prepare_drive_location_state\(\)/.test(arrivalGuardMigration)
    && /direct_destination_meters > 75/.test(arrivalGuardMigration)
    && /new\.status := 'moving'/.test(arrivalGuardMigration)
    && /new\.remaining_distance_meters := greatest/.test(arrivalGuardMigration),
  'Server state must reject impossible arrived rows that are geographically far from the shared destination.',
);
assert(
  /function public\.noxa_start_drive/.test(
    fs.readFileSync('supabase/migrations/20260819201500_group_drive_phase_1_lobby_safety.sql', 'utf8'),
  ),
  'The existing planned Group Drive start contract must remain present.',
);
assert(
  /export async function createQuickDriveRoom/.test(api)
    && /export async function inviteQuickDriveUser/.test(api)
    && /export async function proposeQuickDriveDestination/.test(api)
    && /export async function publishQuickDriveNavigationProgress/.test(api)
    && /export async function findMyHostedQuickDriveId/.test(api),
  'Shared-destination Drive Together client APIs are incomplete.',
);
assert(
  /subscribeToQuickDriveRoomState/.test(layer)
    && /subscribeToActiveDriveRealtime/.test(layer)
    && /startGroupDriveLocationSession/.test(layer)
    && /groupDriveLocations/.test(layer)
    && /useQuickDriveNavigation/.test(layer),
  'Home/Map must reuse the existing Group Drive room, realtime, and location runtimes.',
);
assert(
  /DriveTogetherSheet/.test(layer)
    && /DriveTogetherParticipantRail/.test(layer)
    && /createQuickDriveRoom/.test(layer)
    && /composerMode === 'create-destination'/.test(layer),
  'Drive Together must be destination-first and controlled from one map bottom sheet.',
);
assert(
  /sheetSnap === 'collapsed'/.test(layer)
    && /sheetSnap === 'expanded'/.test(layer)
    && /return <View style=\{styles\.roomShell\}>\{header\}<\/View>/.test(layer),
  'Collapsed, medium, and expanded Drive Together states must render intentionally instead of clipping one oversized tree.',
);
assert(
  /Cancel Drive Together\?/.test(layer)
    && /cancelDrive\(roomId\)[\s\S]*then\(\(cancelled\)/.test(layer)
    && /if \(!cancelled\)/.test(layer),
  'Cancel room must confirm, validate the backend result, and fail visibly instead of clearing UI optimistically.',
);
assert(
  /onPanelVisibilityChange\(sheetVisible\)/.test(layer)
    && /!driveTogetherPanelVisible && !driveTogetherNavigation && selectedEvent/.test(map),
  'Drive Together must suppress competing event/route cards while its panel is visible.',
);
assert(
  /const \[panelOpen, setPanelOpen\] = useState\(false\)/.test(layer)
    && /const sheetVisible = panelOpen/.test(layer)
    && !/Boolean\(roomId\)[\s\S]{0,80}sheetVisible/.test(layer),
  'Recovering an existing Drive Together room must not auto-open the bottom sheet.',
);
assert(
  /setPanelOpen\(true\)[\s\S]{0,500}if \(roomId \|\| invite\)/.test(layer)
    && /setPanelOpen\(false\)/.test(layer)
    && /Hide Drive Together panel/.test(layer),
  'Drive Together panel visibility must be an explicit user-controlled state.',
);
assert(
  /useNavigation/.test(map)
    && /const hideRootTabs = driveTogetherPanelVisible \|\| isRouteFocusMode/.test(map)
    && /tabBarStyle: hideRootTabs \? \{ display: "none" \} : undefined/.test(map),
  'Root navigation must hide while Drive Together or focused navigation owns the bottom chrome.',
);
assert(
  /PanResponder/.test(sheet)
    && /'collapsed' \| 'medium' \| 'expanded'/.test(sheet),
  'Drive Together sheet must expose collapsed, medium, and expanded interactive states.',
);
assert(
  /topOffset: number/.test(sheet)
    && /bottomInset: number/.test(sheet)
    && /windowHeight - topOffset - bottomOffset/.test(sheet)
    && /COLLAPSED_HEIGHT = 108/.test(sheet)
    && /left: 0/.test(sheet)
    && /right: 0/.test(sheet),
  'Drive Together must use a compact attached map sheet that respects safe-area chrome.',
);
assert(
  /distanceLabel/.test(participantRail)
    && !/behind|ahead/i.test(participantRail),
  'Participant rail must show destination distance, never inter-driver distance.',
);
assert(
  /calculateDriveRoute/.test(navigation)
    && /projectQuickNavigation/.test(navigation)
    && /updateQuickRerouteState/.test(navigation)
    && /nextManeuver/.test(
      fs.readFileSync('src/features/group-drive/runtime/quickNavigation.ts', 'utf8'),
    ),
  'Each device must calculate its own route, maneuver progress, and reroute state.',
);
assert(
  /distanceToPreparedRouteEndMeters/.test(
    fs.readFileSync('src/features/group-drive/runtime/quickNavigation.ts', 'utf8'),
  )
    && /Math\.max\([\s\S]*projection\.remainingMeters[\s\S]*directDestinationMeters/.test(
      fs.readFileSync('src/features/group-drive/runtime/quickNavigation.ts', 'utf8'),
    )
    && /arrived:\s*directDestinationMeters <= QUICK_DRIVE_ARRIVAL_METERS/.test(
      fs.readFileSync('src/features/group-drive/runtime/quickNavigation.ts', 'utf8'),
    ),
  'Drive Together arrival must be gated by physical distance to the destination, not route projection alone.',
);

assert(
  !/watchLocalNavigationLocation|readLocalNavigationLocation|watchPositionAsync|startLocationUpdatesAsync/.test(navigation),
  'Quick navigation must not create a second GPS watcher or background location task.',
);
assert(
  /postgres_changes/.test(quickRoomRealtime)
    && /table: 'drive_sessions'/.test(quickRoomRealtime)
    && /ROOM_RECONCILE_MS = 5_000/.test(quickRoomRealtime),
  'Room destination/state sync must use Realtime with a reconciliation fallback.',
);
assert(
  !/MapboxLiveMapCompat/.test(layer)
    && !/Location\.startLocationUpdatesAsync/.test(layer)
    && !/TaskManager\.defineTask/.test(layer),
  'Drive Together layer must not create a second MapView or GPS/background task.',
);
assert(
  /routeDestination/.test(mapRuntime)
    && /isDestinationPicking/.test(mapRuntime)
    && /onMapPress/.test(mapRuntime),
  'The existing Mapbox MapView must own destination rendering and map picking.',
);
assert(
  /lineColor:\s*colors\.routeActive/.test(mapRuntime)
    && /lineWidth:\s*7\.5/.test(mapRuntime)
    && /routeActive:\s*'#FF1744'/.test(
      fs.readFileSync('src/theme/colors.ts', 'utf8'),
    ),
  'Active navigation routes must use the high-visibility bright-red route treatment.',
);
assert(
  /driveTogetherFollowSessionRef/.test(map)
    && /driveTogetherOwnsNavigation = Boolean\(driveTogetherNavigation\)/.test(map)
    && /effectiveRouteMode = driveTogetherOwnsNavigation \|\| isRouteMode/.test(map)
    && /enteringDrive[\s\S]*setIsDriveTogetherFollowing\(true\)/.test(map),
  'Drive Together must enter user-follow camera mode without fitting distant participants.',
);

assert(
  /DriveTogetherMapLayer/.test(map)
    && /accessibilityLabel="Drive Together"/.test(map)
    && /setDriveTogetherOpen\(true\)/.test(map)
    && /for \(const driver of driveTogetherDrivers\) merged\.set\(driver\.user_id, driver\)/.test(map)
    && /routeDestination=\{driveTogetherNavigation\?\.destination/.test(map),
  'Home/Map must own the Drive Together entry, participant markers, route, and destination pin.',
);
assert(
  !/accessibilityLabel="Group Drives"[\s\S]{0,300}router\.push\("\/group-drives"\)/.test(map),
  'Home/Map must not send the primary Drive Together action into the legacy wizard.',
);
assert(
  /pathname: '\/\(tabs\)'[\s\S]*driveInvitationId/.test(bridge),
  'Native drive-invitation pushes must reopen Home/Map.',
);
assert(
  /item\.kind === 'drive'[\s\S]*pathname: '\/\(tabs\)'[\s\S]*driveInvitationId/.test(notifications),
  'In-app drive invitations must reopen Home/Map.',
);
assert(
  /item\.kind === 'crew' \|\| item\.kind === 'drive'/.test(notifications)
    && /respondToDriveInvitation\(item\.sourceId, accept\)/.test(notifications)
    && /getDriveInvitationPreview\(item\.sourceId\)/.test(notifications),
  'Drive Together invitations in Activity must perform a real backend Accept/Decline.',
);
assert(
  /useFocusEffect/.test(layer)
    && /findMyActiveQuickDriveId\(\)/.test(layer)
    && /findMyHostedQuickDriveId\(\)/.test(layer)
    && /getPendingQuickDriveInvitation\(\)/.test(layer),
  'Home/Map must recover active, hosted-waiting, and invited quick rooms on focus.',
);
assert(
  fs.existsSync('app/group-drives/details.tsx')
    && fs.existsSync('app/group-drives/route.tsx')
    && fs.existsSync('app/group-drives/[id].tsx'),
  'Legacy planned Group Drive flow must remain available as a reversible fallback.',
);

if (!process.exitCode) {
  console.log('Drive Together shared-destination static contract passed.');
}
