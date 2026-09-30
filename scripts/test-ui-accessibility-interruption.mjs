import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the real components with deterministic native/animation adapters.
// Exercise interruption, not snapshots of implementation strings.
function harness(path, privateName) {
  const values = [];
  const effects = [];
  let valueIndex = 0;
  let effectIndex = 0;
  let reduced = false;
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText + (privateName ? '\nexports.subject = ' + privateName + ';' : '');
  const token = new Proxy({}, { get: () => 16 });
  const react = {
    useEffect(fn, dependencies) {
      const i = effectIndex++;
      const previous = effects[i];
      if (!previous || dependencies.some((v, j) => v !== previous.dependencies[j])) {
        previous?.cleanup?.();
        effects[i] = { dependencies, cleanup: fn() };
      }
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(module) {
      if (module === 'react') return react;
      if (module === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (module === 'react-native') return { Pressable: 'Pressable', View: 'View', Text: 'Text', Platform: { OS: 'ios' }, StyleSheet: { create: (s) => s } };
      if (module === 'react-native-reanimated') return {
        __esModule: true, default: { View: 'Animated.View' },
        useSharedValue(initial) { const i = valueIndex++; return values[i] ??= { value: initial }; },
        useReducedMotion: () => reduced,
        useAnimatedStyle: (fn) => fn,
        withSpring: (v) => v, withTiming: (v) => v,
        cancelAnimation: () => {},
        interpolate: (v, input, output) => output[0] + v * (output[1] - output[0]),
      };
      if (module === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 0 }) };
      if (module === '@/src/theme') return { colors: token, geometry: { cut: token, controlHeight: token }, spacing: token, radius: token, shadows: token, typography: { v2: { label: token } }, animations: { spring: { press: {}, tab: {}, surface: {} }, press: 80, pressOpacity: 0.88, pressedScale: 0.98, iconPressedScale: 0.92 } };
      return {};
    },
  });
  return {
    values,
    render(props, reduceMotion = false) {
      valueIndex = 0; effectIndex = 0; reduced = reduceMotion;
      const component = privateName ? exports.subject : Object.values(exports).find((v) => typeof v === 'function');
      return component(props);
    },
    cleanup() { effects.forEach((effect) => effect.cleanup?.()); },
  };
}
for (const [path, props] of [
  ['src/components/ui/NoxaButton.tsx', { title: 'Continue' }],
  ['src/components/ui/NoxaIconButton.tsx', { icon: 'close', accessibilityLabel: 'Close' }],
  ['src/components/ui/NoxaPressableSurface.tsx', { onPress: () => {}, children: 'Content' }],
]) {
  const h = harness(path);
  const view = h.render(props);
  view.props.onPressIn({});
  assert.ok(h.values[0].value < 1, path + ': press feedback');
  h.render({ ...props, disabled: true });
  assert.equal(h.values[0].value, 1, path + ': disabled interruption restores scale');
  assert.equal(h.values[1].value, 1, path + ': disabled interruption restores opacity');
  const resumed = h.render(props);
  resumed.props.onPressIn({});
  h.render(props, true);
  assert.equal(h.values[0].value, 1, path + ': Reduce Motion interruption restores scale');
  h.cleanup();
}
const tabs = harness('components/noxa-bottom-tab-bar.tsx', 'MotionTabItem');
const props = { focused: true, icons: { active: 'map', inactive: 'map-outline' }, label: 'Map', onPress() {}, onLongPress() {} };
const tab = tabs.render(props, true);
tab.props.onPressIn();
const iconStyle = tab.props.children[0].props.style();
assert.equal(iconStyle.transform[0].translateY, 0, 'Reduced Motion tab cannot move');
assert.equal(iconStyle.transform[1].scale, 1, 'Reduced Motion tab cannot scale even while pressed');
assert.equal(tab.props.accessibilityState.selected, true);
const unfocused = tabs.render({ ...props, focused: false }, true);
assert.equal(tabs.values[1].value, 0, 'Switching tabs clears interrupted press state');
assert.equal(unfocused.props.accessibilityState.selected, false);
tabs.cleanup();

const palette = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/theme/colors.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: palette });
function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
for (const foreground of ['text', 'textMuted', 'textQuiet', 'textAccent', 'textCritical']) {
  for (const background of ['background', 'surfaceBase', 'surface', 'surfaceSoft', 'surfaceRaised', 'surfacePressed']) {
    const ratio = (luminance(palette.colors[foreground]) + 0.05) / (luminance(palette.colors[background]) + 0.05);
    assert.ok(ratio >= 4.5, foreground + ' on ' + background + ': ' + ratio);
  }
}
console.log('UI interruption, Reduced Motion and readable text contrast smoke passed.');
