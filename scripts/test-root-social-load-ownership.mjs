import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const flush = async () => { for (let i = 0; i < 16; i += 1) await Promise.resolve(); };
function subject(path, privateName) {
  const states = [], refs = [], callbacks = [], queries = [];
  let focus;
  const token = new Proxy(() => {}, { get: (_t, key) => key === Symbol.toPrimitive ? () => 16 : token });
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(value) {
      const i = states.length; states.push(typeof value === 'function' ? value() : value);
      return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useRef(value) { const ref = { current: value }; refs.push(ref); return ref; },
    useCallback(fn) { callbacks.push(fn); return fn; },
    useMemo(fn) { return fn(); }, useEffect() {},
  };
  const supabase = {
    from(table) {
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      const query = { table, resolve, fields: null };
      queries.push(query);
      const builder = new Proxy({}, { get: (_t, key) => {
        if (key === 'then') return promise.then.bind(promise);
        if (key === 'catch') return promise.catch.bind(promise);
        return (...args) => { if (key === 'select') query.fields = args[0]; return builder; };
      } });
      return builder;
    },
  };
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText + (privateName ? '\nexports.subject = ' + privateName + ';' : '');
  vm.runInNewContext(code, {
    exports, console,
    require(module) {
      if (module === 'react') return react;
      if (module === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (module === 'react-native') return { View: 'View', Text: 'Text', StyleSheet: { create: (s) => s }, Platform: { OS: 'ios' } };
      if (module === 'expo-router') return { useFocusEffect: (fn) => { focus = fn; }, router: { push() {} } };
      if (module === '@/src/lib/supabase') return { supabase, getCurrentSessionUser: async () => ({ id: 'current' }) };
      if (module === '@/src/hooks/useResponsive') return { useResponsive: () => ({ gutter: 16 }) };
      if (module === '@/src/theme') return { colors: token, spacing: token, radius: token, geometry: token, typography: token };
      // Existing date/lifecycle helpers are irrelevant to response ownership.
      return new Proxy({}, { get: (_t, key) => key === 'getEventLifecycle' ? () => 'scheduled' : token });
    },
  });
  const tree = !privateName ? exports.default() : null;
  return { states, refs, callbacks, queries, focus, tree, component: exports.subject };
}
function findQuery(h, table, fields, after = 0) {
  const q = h.queries.slice(after).find((q) => q.table === table && (!fields || q.fields === fields));
  assert.ok(q, table + ' query missing');
  return q;
}
const crew = { id: 'new', owner_id: 'owner', name: 'New crew', profiles: { display_name: 'Owner' }, is_public: true, join_policy: 'open' };
const event = { id: 'new', title: 'New event', category: 'drive', starts_at: '2030-01-01T12:00:00Z', ends_at: null, status: 'scheduled' };
for (const [path, baseTable, row] of [
  ['src/features/crews-events/CanonicalCrewsScreen.tsx', 'crews', crew],
  ['src/features/crews-events/CanonicalEventsScreen.tsx', 'events', event],
]) {
  const h = subject(path);
  const firstCleanup = h.focus();
  await flush();
  const oldBase = findQuery(h, baseTable);
  const newStart = h.queries.length;
  firstCleanup();
  const newCleanup = h.focus();
  await flush();
  const freshBase = findQuery(h, baseTable, null, newStart);
  freshBase.resolve({ data: [row], error: null });
  await flush();
  assert.equal(h.states[0][0].id, 'new', path + ': fresh base arrives first');
  assert.equal(h.states[0][0][baseTable === 'crews' ? 'memberCount' : 'attendeeCount'], null, 'Unloaded context must not be represented as zero');
  oldBase.resolve({ data: [{ ...row, id: 'old' }], error: null });
  await flush();
  assert.equal(h.states[0][0].id, 'new', path + ': old base cannot replace fresh rows');
  newCleanup();
  const before = JSON.stringify(h.states);
  for (const q of h.queries) if (q !== oldBase && q !== freshBase) q.resolve({ data: [], error: null });
  await flush();
  assert.equal(JSON.stringify(h.states), before, path + ': optional responses cannot commit after blur');
}
// Enrichment from the previous refresh must not mutate a new event/crew list.
for (const [path, baseTable, row] of [
  ['src/features/crews-events/CanonicalCrewsScreen.tsx', 'crews', crew],
  ['src/features/crews-events/CanonicalEventsScreen.tsx', 'events', event],
]) {
  const h = subject(path);
  const cleanup = h.focus();
  await flush();
  findQuery(h, baseTable).resolve({ data: [{ ...row, id: 'old' }], error: null });
  await flush();
  const oldOptional = h.queries.filter((q) => q.table !== baseTable || q.fields?.startsWith('id,crew_id'));
  cleanup();
  const nextStart = h.queries.length;
  h.focus();
  await flush();
  findQuery(h, baseTable, null, nextStart).resolve({ data: [row], error: null });
  await flush();
  const before = JSON.stringify(h.states);
  oldOptional.forEach((q) => q.resolve({ data: [{ crew_id: 'old', event_id: 'old', user_id: 'current', role: 'member', response: 'going' }], error: null }));
  await flush();
  assert.equal(JSON.stringify(h.states), before, path + ': previous enrichment cannot overwrite a new refresh');
}
// Fresh successful empty membership/attendance is a real zero, unlike unavailable data.
for (const [path, baseTable, row] of [
  ['src/features/crews-events/CanonicalCrewsScreen.tsx', 'crews', crew],
  ['src/features/crews-events/CanonicalEventsScreen.tsx', 'events', event],
]) {
  const h = subject(path); h.focus(); await flush();
  const base = findQuery(h, baseTable); base.resolve({ data: [row], error: null }); await flush();
  h.queries.filter((q) => q !== base).forEach((q) => q.resolve({ data: [], error: null }));
  await flush();
  assert.equal(h.states[0][0][baseTable === 'crews' ? 'memberCount' : 'attendeeCount'], 0, 'Confirmed empty backend context is zero');
}
// A profile response already in flight for the former hero must also be discarded.
{
  const h = subject('src/features/crews-events/CanonicalEventsScreen.tsx');
  const cleanup = h.focus(); await flush();
  findQuery(h, 'events').resolve({ data: [{ ...event, id: 'old' }], error: null }); await flush();
  findQuery(h, 'event_attendees', 'user_id').resolve({ data: [{ user_id: 'old-person' }], error: null }); await flush();
  const oldProfile = findQuery(h, 'profiles');
  cleanup(); const after = h.queries.length; h.focus(); await flush();
  findQuery(h, 'events', null, after).resolve({ data: [event], error: null }); await flush();
  oldProfile.resolve({ data: [{ id: 'old-person', display_name: 'Former hero attendee' }], error: null }); await flush();
  assert.equal(h.states[1].length, 0, 'Former hero profile cannot leak into the current event');
}

function textValues(tree) {
  if (!tree || typeof tree !== 'object') return [];
  const children = tree.props?.children;
  const list = Array.isArray(children) ? children : [children];
  return list.flatMap((x) => (typeof x === 'string' || typeof x === 'number') ? [String(x)] : Array.isArray(x) ? x.flatMap(textValues) : textValues(x));
}
const stack = subject('src/features/crews-events/CanonicalPrimitives.tsx', 'CanonicalAvatarStack');
assert.equal(textValues(stack.component({ profiles: [], total: 0 })).length, 0, 'Empty stacks must not invent people');
assert.equal(textValues(stack.component({ profiles: [], total: 3 })).join(''), '+3', 'Only the confirmed real total is presented');
console.log('Root social request ownership, unavailable counts and honest identity smoke passed.');

function elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
// Explicit filter choice owns UI before optional context resolves and after return.
{
  const h = subject('src/features/crews-events/CanonicalCrewsScreen.tsx');
  const filter = elements(h.tree).find((node) => node.type?.name === 'CrewFilterControl');
  assert.ok(filter, 'Crew filter renders');
  assert.equal(filter.props.value, 'discover', 'Unloaded relationships must not create a false empty personal list');
  const cleanup = h.focus(); await flush();
  const base = findQuery(h, 'crews'); base.resolve({ data: [crew], error: null }); await flush();
  filter.props.onChange('discover');
  h.queries.filter((q) => q !== base).forEach((q) => q.resolve({ data: [{ crew_id: 'new', user_id: 'current', role: 'member' }], error: null }));
  await flush();
  assert.equal(h.states[4], 'discover', 'Late enrichment must preserve the explicit selection');
  cleanup(); const after=h.queries.length; h.focus(); await flush();
  const refreshed=findQuery(h,'crews',null,after);refreshed.resolve({data:[crew],error:null});await flush();
  h.queries.slice(after).filter(q=>q!==refreshed).forEach(q=>q.resolve({data:[{crew_id:'new',user_id:'current',role:'member'}],error:null}));
  await flush();
  assert.equal(h.states[4], 'discover', 'Focus refresh must preserve the explicit selection');
}
console.log('Crew filter agency across delayed enrichment and focus recovery passed.');
