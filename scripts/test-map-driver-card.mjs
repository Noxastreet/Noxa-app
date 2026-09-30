import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/features/map/MapDriverCard.tsx', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const defer = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function harness({ relevant = true, result = () => ({ data: null, error: null }) } = {}) {
  const states = [];
  const refs = [];
  const effects = [];
  const calls = [];
  const callbacks = [];
  let stateCursor = 0;
  let refCursor = 0;
  const tokens = new Proxy({}, { get: () => 16 });
  const motion = { duration() { return this; }, reduceMotion() { return this; } };
  const ui = new Proxy({}, { get: (_, name) => name });
  const react = {
    useState(initial) {
      const index = stateCursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useRef(initial) {
      const index = refCursor++;
      refs[index] ??= { current: initial };
      return refs[index];
    },
    useCallback(fn) { callbacks.push(fn); return fn; },
    useMemo(fn) { return fn(); },
    useEffect(fn) { effects.push(fn); },
  };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'viewer' } }, error: null }) },
    from(table) {
      const query = { table, filters: [], fields: null };
      const chain = {
        select(fields) { query.fields = fields; return chain; },
        eq(field, value) { query.filters.push([field, value]); return chain; },
        limit() { return chain; },
        maybeSingle() { return chain; },
        insert(value) { query.insert = value; return chain; },
        then(resolve, reject) {
          calls.push(query);
          return Promise.resolve(result(query)).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === 'react-native') return { ActivityIndicator: 'Loading', View: 'View', Text: 'Text', StyleSheet: { create: (s) => s } };
      if (name === 'react-native-reanimated') return { __esModule: true, default: { View: 'Animated' }, FadeInDown: motion, FadeOutDown: motion, ReduceMotion: { System: 0 } };
      if (name === '@expo/vector-icons') return { Ionicons: 'Icon' };
      if (name === 'expo-image') return { Image: 'Image' };
      if (name === 'expo-router') return { router: { push() {} } };
      if (name.endsWith('/supabase')) return { supabase };
      if (name.endsWith('/ui')) return ui;
      if (name.endsWith('/theme')) return { animations: tokens, colors: tokens, radius: tokens, spacing: tokens, typography: { fontFamily: tokens } };
      throw new Error('Unexpected import: ' + name);
    },
  });
  function render() {
    stateCursor = 0;
    refCursor = 0;
    callbacks.length = 0;
    effects.length = 0;
    return exports.MapDriverCard({
      driverId: 'driver', isRelevant: relevant, isInDrive: false, bottomOffset: 0,
      onClose() {}, onInviteToDrive() {}, onRelationshipChange() {},
    });
  }
  render();
  return { states, calls, callbacks, effects, render };
}

// Complete an older request after a newer retry. Its identity must never win.
const delayed = defer();
let profileRequests = 0;
const race = harness({ result(query) {
  if (query.table === 'profiles') {
    profileRequests += 1;
    return profileRequests === 1 ? delayed.promise : { data: { id: 'driver', display_name: 'Current' }, error: null };
  }
  return { data: null, error: null };
} });
const first = race.callbacks[0]();
await new Promise((resolve) => setImmediate(resolve));
await race.callbacks[0]();
assert.equal(race.states[0].displayName, 'Current');
delayed.resolve({ data: { id: 'driver', display_name: 'Stale' }, error: null });
await first;
assert.equal(race.states[0].displayName, 'Current');
assert.equal(race.states[3], false);

// A stranger lookup must request no face, real name or vehicle.
const stranger = harness({ relevant: false, result: (query) => ({
  data: query.table === 'profiles' ? { id: 'driver' } : query.table === 'crew_members' ? [] : null,
  error: null,
}) });
await stranger.callbacks[0]();
assert.equal(stranger.calls.find((q) => q.table === 'profiles').fields, 'id');
assert.equal(stranger.calls.some((q) => q.table === 'vehicles'), false);
assert.equal(stranger.states[0], null);
assert.equal(stranger.states[1], null);
assert.equal(stranger.states[5], null);
stranger.render();
await Promise.all([stranger.callbacks[1](), stranger.callbacks[1]()]);
assert.equal(stranger.calls.filter((q) => q.insert).length, 1);

// Missing/RLS-hidden identity is unavailable; network errors keep actions gated.
const unavailable = harness();
await unavailable.callbacks[0]();
assert.equal(unavailable.states[6], true);
unavailable.render();
await unavailable.callbacks[1]();
assert.equal(unavailable.calls.some((q) => q.insert), false);

const failed = harness({ result() { throw new Error('Offline'); } });
await failed.callbacks[0]();
assert.equal(failed.states[3], false);
assert.ok(failed.states[5]);
failed.render();
await failed.callbacks[1]();
assert.equal(failed.calls.some((q) => q.insert), false);

// Cleanup invalidates an in-flight load before a late identity response.
const closedResponse = defer();
const closed = harness({ result(query) {
  return query.table === 'profiles' ? closedResponse.promise : { data: null, error: null };
} });
const cleanup = closed.effects[0]();
await new Promise((resolve) => setImmediate(resolve));
cleanup();
closedResponse.resolve({ data: { id: 'driver', display_name: 'Late' }, error: null });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(closed.states[0], null);

const vehicleQuery = race.calls.find((q) => q.table === 'vehicles');
assert.ok(vehicleQuery.filters.some(([field, value]) => field === 'is_public' && value === true));
assert.ok(vehicleQuery.filters.some(([field, value]) => field === 'is_primary' && value === true));
console.log('Map driver card async/privacy smoke passed.');
