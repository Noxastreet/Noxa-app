import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for (const [path, name] of [
  ['src/components/ui/NoxaConfirmationSheet.tsx', 'NoxaConfirmationSheet'],
  ['src/features/crews-events/EntityActionSheet.tsx', 'EntityActionSheet'],
]) {
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const reduced of [false, true]) {
    const states = [];
    const refs = [];
    const callbacks = [];
    const completions = [];
    const token = new Proxy({}, { get: () => 16 });
    const react = {
      useState(value) {
        const index = states.length;
        states.push(value);
        return [value, (next) => { states[index] = next; }];
      },
      useRef(value) { const ref = { current: value }; refs.push(ref); return ref; },
      useCallback(fn) { callbacks.push(fn); return fn; },
      useMemo(fn) { return fn(); },
      useEffect() {},
    };
    class Value {
      constructor(value) { this.value = value; }
      stopAnimation(fn) { fn?.(this.value); }
      setValue(value) { this.value = value; }
    }
    const animation = {
      Value,
      spring: () => ({}),
      timing: () => ({}),
      parallel: () => ({ start: (complete) => { if (complete) completions.push(complete); } }),
    };
    const exports = {};
    vm.runInNewContext(code, {
      exports,
      require(module) {
        if (module === 'react') return react;
        if (module === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
        if (module === 'react-native') return {
          Animated: animation, StyleSheet: { create: (styles) => styles }, PanResponder: { create: () => ({ panHandlers: {} }) },
          useWindowDimensions: () => ({ height: 800 }),
        };
        if (module === 'react-native-reanimated') return { useReducedMotion: () => reduced };
        if (module === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) };
        if (module === '@expo/vector-icons') return { Ionicons: 'Icon' };
        if (module.endsWith('/theme')) return { animations: { micro: 180, fast: 120, step: 240, spring: { sheet: {}, surface: {} } }, colors: token, geometry: { cut: token, sheet: token }, spacing: token, typography: { fontFamily: token } };
        return new Proxy({}, { get: (_, key) => key });
      },
    });
    exports[name]({ visible: true, title: 'Confirm', body: 'Body', confirmTitle: 'Confirm', actions: [], onClose() {}, onConfirm() {}, onCancel() {} });
    let delivered = 0;
    const open = callbacks[0];
    const dismiss = callbacks[1];
    dismiss(() => { delivered += 1; });
    if (reduced) {
      assert.equal(states[0], false);
      assert.equal(delivered, 1);
    } else {
      open(); // Reopening/interrupting must invalidate the old closing callback.
      completions.shift()({ finished: true });
      assert.equal(states[0], true, name + ' must remain visible after a stale dismiss completion.');
      assert.equal(delivered, 0, name + ' must not run stale navigation/destructive actions.');
      // The component clears its dismissing flag when parent visibility reopens.
      const dismissing = refs.find((ref) => ref.current === true);
      assert.ok(dismissing);
      dismissing.current = false;
      dismiss(() => { delivered += 1; });
      completions.shift()({ finished: true });
      assert.equal(states[0], false);
      assert.equal(delivered, 1);
    }
  }
}
console.log('Sheet interruption and reduced-motion smoke passed.');
