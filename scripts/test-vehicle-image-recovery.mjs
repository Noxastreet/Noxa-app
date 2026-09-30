import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise real component error handlers and subsequent renders; no snapshots.
function subject(path, name) {
  const states = []; let cursor = 0;
  const token = new Proxy(() => {}, { get: (_t, key) => key === Symbol.toPrimitive ? () => 16 : token });
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const native = new Proxy({ StyleSheet: { create: (s) => s }, Platform: { OS: 'ios' } }, { get: (t, k) => t[k] ?? String(k) });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (v) => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
    useEffect() {}, useCallback: (fn) => fn, useMemo: (fn) => fn(),
  };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText + '\nexports.subject = ' + name + ';';
  vm.runInNewContext(code, { exports, console, require(module) {
    if (module === 'react') return react;
    if (module === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (module === 'react-native') return native;
    if (module === 'react-native-reanimated') return { __esModule: true, default: { View: 'Animated.View', Image: 'Animated.Image' }, useReducedMotion: () => false };
    return new Proxy({}, { get: () => token });
  } });
  return (props) => { cursor = 0; return exports.subject(props); };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const vehicle = { id: 'real', brand: 'Porsche', model: '911', year: 2020, vehicle_type: 'car', horsepower: null, color: null, is_public: true, cover_image_url: 'first-photo' };
for (const [path, name, props, replace] of [
  ['app/(tabs)/garage.tsx', 'VehicleArtwork', { vehicle }, (uri) => ({ vehicle: { ...vehicle, cover_image_url: uri } })],
  ['app/vehicle-details.tsx', 'VehicleHero', { vehicle }, (uri) => ({ vehicle: { ...vehicle, cover_image_url: uri } })],
  ['app/driver-profile/[id].tsx', 'FeaturedVehicle', { vehicle }, (uri) => ({ vehicle: { ...vehicle, cover_image_url: uri } })],
  ['app/(tabs)/profile.tsx', 'GarageFeature', { vehicle, vehiclesCount: 1 }, (uri) => ({ vehicle: { ...vehicle, cover_image_url: uri }, vehiclesCount: 1 })],
  ['src/features/crews-events/CanonicalPrimitives.tsx', 'CanonicalArtwork', { uri: 'first-photo' }, (uri) => ({ uri })],
]) {
  const render = subject(path, name);
  const photo = nodes(render(props)).find((n) => n.type === 'ImageBackground');
  assert.ok(photo, name + ': available photo renders');
  photo.props.onError();
  assert.ok(!nodes(render(props)).some((n) => n.type === 'ImageBackground'), name + ': failed photo uses existing absent-image artwork');
  assert.ok(nodes(render(replace('new-photo'))).some((n) => n.type === 'ImageBackground'), name + ': a different real URI is attempted');
  // Late error for an old photo must never hide the current photo.
  photo.props.onError();
  assert.ok(nodes(render(replace('new-photo'))).some((n) => n.type === 'ImageBackground'), name + ': stale error does not hide a different URI');
}
{
  const render = subject('src/features/garage/vehicle-picker/components/VehiclePhotoCard.tsx', 'VehiclePhotoCard');
  const props = { photoUri: 'first-photo', vehicleType: 'car', onChoose() {}, onRemove() {} };
  nodes(render(props)).find((n) => n.type === 'Animated.Image').props.onError();
  const failed = nodes(render(props));
  assert.ok(!failed.some((n) => n.type === 'Animated.Image'), 'Failed cover is absent');
  assert.ok(!failed.some((n) => n.props?.children === 'COVER READY'), 'Failed photo must not claim readiness');
  assert.ok(failed.some((n) => n.props?.children === 'Photo unavailable. Choose another photo.'), 'Recovery is explicit');
  assert.ok(failed.some((n) => n.props?.accessibilityLabel === 'Remove cover photo'), 'Failed cover remains removable');
}
console.log('Vehicle artwork failed-image recovery and truthful editor state passed.');
