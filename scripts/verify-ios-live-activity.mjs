import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];

const appJson = JSON.parse(read('app.json'));
const target = read('targets/NoxaDriveActivity/NoxaDriveLiveActivity.swift');
const targetConfig = read('targets/NoxaDriveActivity/expo-target.config.js');
const nativeModule = read('modules/noxa-live-activity/ios/NoxaLiveActivityModule.swift');
const bridge = read('src/features/group-drive/liveActivity.ts');
const lobby = read('app/group-drives/[id].tsx');
const active = read('app/group-drives/[id]/active.tsx');
const completion = read('src/features/group-drive/completion.ts');
const layout = read('app/_layout.tsx');
const mapScreen = read('app/(tabs)/index.tsx');
const quickDriveLayer = read('src/features/group-drive/DriveTogetherMapLayer.tsx');

if (!appJson.expo?.plugins?.some((plugin) => plugin === '@bacons/apple-targets')) {
  failures.push('Apple targets config plugin is not registered');
}
if (appJson.expo?.ios?.infoPlist?.NSSupportsLiveActivities !== true) {
  failures.push('NSSupportsLiveActivities is not enabled');
}
for (const pattern of [
  /ActivityConfiguration\(for: NoxaDriveActivityAttributes\.self\)/,
  /DynamicIsland \{/,
  /compactLeading:/,
  /compactTrailing:/,
  /minimal:/,
  /widgetURL\(/,
  /noxa:\/\/drive-together\//,
]) {
  if (!pattern.test(target)) failures.push(`Live Activity target missing ${pattern}`);
}
for (const pattern of [
  /type:\s*['"]widget['"]/,
  /bundleIdentifier:\s*['"]\.driveactivity['"]/,
  /ActivityKit/,
  /WidgetKit/,
  /SwiftUI/,
]) {
  if (!pattern.test(targetConfig)) failures.push(`target config missing ${pattern}`);
}
for (const pattern of [
  /ActivityAuthorizationInfo/,
  /Activity\.request/,
  /\.update\(/,
  /\.end\(/,
  /endAllDriveActivities/,
]) {
  if (!pattern.test(nativeModule)) failures.push(`native ActivityKit bridge missing ${pattern}`);
}

const sharedAttributeShape = [
  /struct NoxaDriveActivityAttributes: ActivityAttributes/,
  /struct ContentState: Codable, Hashable/,
  /var destinationTitle: String/,
  /var etaMinutes: Int\?/,
  /var remainingDistanceMeters: Double\?/,
  /var participantCount: Int/,
  /var progress: Double\?/,
  /var status: String/,
  /var driveSessionId: String/,
];
for (const pattern of sharedAttributeShape) {
  if (!pattern.test(target) || !pattern.test(nativeModule)) {
    failures.push(`ActivityAttributes schema diverged between app and extension: ${pattern}`);
  }
}
if (/CLLocationManager|startLocationUpdates|watchPosition|Supabase|Realtime/i.test(nativeModule + bridge)) {
  failures.push('Live Activity layer must not introduce location, Supabase, or realtime ownership');
}
if (!/startDrive\(drive\.id\)[\s\S]*syncGroupDriveLiveActivity/.test(lobby)) {
  failures.push('Drive start does not bootstrap Live Activity before opening Active Drive');
}
if (!/syncGroupDriveLiveActivity/.test(active)) {
  failures.push('Active Drive does not synchronize Live Activity state');
}
if (!/retryDelays/.test(active) || !/AppState\.addEventListener/.test(active)) {
  failures.push('Active Drive does not retry Live Activity bootstrap or recover on foreground');
}
if (!/endGroupDriveLiveActivity/.test(completion)) {
  failures.push('Group Drive completion does not end Live Activity');
}
if (!/drive-together/.test(layout)) {
  failures.push('Drive Together Live Activity deep link is not wired');
}
if (!/endAllGroupDriveLiveActivities/.test(layout)) {
  failures.push('Sign-out Live Activity cleanup is not wired');
}

for (const pattern of [
  /event-route:/,
  /quick-drive:/,
  /pair-race:/,
  /syncNoxaNavigationLiveActivity/,
  /endNoxaNavigationLiveActivity/,
]) {
  if (!pattern.test(bridge)) failures.push(`Generic NOXA Live Activity bridge missing ${pattern}`);
}
if (!/event-route/.test(target) || !/noxa:\/\/event-route\//.test(target) || !/noxa:\/\/map/.test(target)) {
  failures.push('Widget deep links are not aware of Event and map navigation contexts');
}
if (!/NoxaLiveActivityDeepLinkBridge/.test(layout) || !/mapMode: 'route'/.test(layout)) {
  failures.push('Live Activity app deep links do not restore the active navigation context');
}
if (!/syncNoxaNavigationLiveActivity/.test(mapScreen) || !/eventRouteLiveActivityIdRef/.test(mapScreen)) {
  failures.push('Event route navigation does not synchronize the system Live Activity');
}
if (!/quickDriveLiveActivityIdRef/.test(mapScreen) || !/driveTogetherNavigation\.driveSessionId/.test(mapScreen)) {
  failures.push('Quick Drive navigation does not synchronize the system Live Activity');
}
for (const pattern of [
  /driveSessionId: string/,
  /destinationTitle: string/,
  /remainingDurationSeconds: number \| null/,
  /progress: number \| null/,
  /participantCount: number/,
]) {
  if (!pattern.test(quickDriveLayer)) failures.push(`Quick Drive overlay missing Live Activity state: ${pattern}`);
}
if (!/activity\.attributes\.driveSessionId != record\.driveSessionId/.test(nativeModule)) {
  failures.push('Native bridge does not enforce one active NOXA Live Activity');
}

if (failures.length) {
  console.error('NOXA iOS Live Activity contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('NOXA iOS Live Activity contract passed.');
