import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];

const appJson = JSON.parse(read('app.json'));
const target = read('targets/NoxaDriveActivity/NoxaDriveLiveActivity.swift');
const targetConfig = read('targets/NoxaDriveActivity/expo-target.config.js');
const nativeModule = read('modules/noxa-live-activity/ios/NoxaLiveActivityModule.swift');
const bridge = read('src/features/group-drive/liveActivity.ts');
const active = read('app/group-drives/[id]/active.tsx');
const completion = read('src/features/group-drive/completion.ts');
const layout = read('app/_layout.tsx');

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
if (/CLLocationManager|startLocationUpdates|watchPosition|Supabase|Realtime/i.test(nativeModule + bridge)) {
  failures.push('Live Activity layer must not introduce location, Supabase, or realtime ownership');
}
if (!/syncGroupDriveLiveActivity/.test(active)) {
  failures.push('Active Drive does not synchronize Live Activity state');
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

if (failures.length) {
  console.error('NOXA iOS Live Activity contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('NOXA iOS Live Activity contract passed.');
