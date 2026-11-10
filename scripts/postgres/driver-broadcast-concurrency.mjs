import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { driverBroadcastFixtureSql } from '../lib/driver-broadcast-fixture.mjs';

// These tests create roles/tables in a disposable cluster. Never accept a hosted
// connection string, production database name or a non-loopback host.
assert.equal(process.env.NOXA_BROADCAST_TEST_ISOLATED, '1', 'Explicit isolated-test opt-in required');
assert.ok(['127.0.0.1', 'localhost'].includes(process.env.PGHOST), 'Only a local disposable PostgreSQL is allowed');
assert.match(process.env.PGDATABASE ?? '', /^noxa_broadcast_test(?:_[a-z0-9]+)?$/);
assert.ok(!process.env.DATABASE_URL, 'Do not pass a hosted DATABASE_URL');
const psql = process.env.PSQL_BIN ?? 'psql';
const env = { ...process.env, PGOPTIONS: '-c statement_timeout=12000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=15000 -c client_min_messages=warning' };
const psqlArgs = ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'];
const sessions = new Set();
const owner = '11111111-1111-4111-8111-111111111111';
const viewer = '22222222-2222-4222-8222-222222222222';
let sequence = 0;
function query(sql) {
  return execFileSync(psql, [...psqlArgs, '-c', sql], { env, encoding: 'utf8', timeout: 14000 }).trim();
}
async function until(predicate, label) {
  const deadline = Date.now() + 7000;
  while (!await predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await delay(25);
  }
}
function session() {
  const name = `noxa-lock-${process.pid}-${++sequence}`;
  const child = spawn(psql, psqlArgs, { env: { ...env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] });
  const state = { name, child, out: '', err: '', ended: false };
  child.stdout.on('data', (data) => { state.out += data; });
  child.stderr.on('data', (data) => { state.err += data; });
  state.done = new Promise((resolve) => {
    child.on('error', (error) => { state.ended = true; resolve({ code: -1, error }); });
    child.on('exit', (code) => { state.ended = true; resolve({ code }); });
  });
  state.write = (sql) => child.stdin.write(sql + '\n');
  state.marker = async (marker) => until(() => {
    if (state.ended) throw new Error(`PostgreSQL session ended: ${state.err}`);
    return state.out.includes(marker);
  }, marker);
  state.finish = async () => {
    child.stdin.end('commit;\n\\q\n');
    const result = await state.done;
    assert.equal(result.code, 0, state.err);
    sessions.delete(state);
  };
  sessions.add(state);
  return state;
}
const authenticated = `set role authenticated; set request.jwt.claim.sub='${owner}';`;
const sendSql = `select public.noxa_broadcast_my_driver_location('${owner}',38.01,23.02);`;
const send = () => query(`${authenticated} ${sendSql}`);
const topic = () => query(`select private.noxa_driver_broadcast_topic(user_id,broadcast_key) from public.driver_locations where user_id='${owner}'`);
function reset() {
  query(`delete from public.user_blocks; delete from public.follows; delete from public.driver_locations;
    insert into public.driver_locations(user_id,latitude,longitude,visibility_mode,updated_at,share_started_at,share_expires_at)
    values ('${owner}',38,23,'global',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '1 hour');`);
}
async function blocked(state) {
  await until(() => query(`select exists(select 1 from pg_stat_activity
    where application_name='${state.name}' and wait_event_type='Lock'
    and cardinality(pg_blocking_pids(pid))>0)`) === 't', 'observed real PostgreSQL lock wait');
}

try {
  assert.equal(query('select current_database()'), process.env.PGDATABASE);
  assert.equal(query("select count(*) from pg_tables where schemaname in ('public','private','auth','realtime')"), '0',
    'Refuse to alter a database which is not empty');
  execFileSync(psql, psqlArgs, { env, input: driverBroadcastFixtureSql(), encoding: 'utf8', timeout: 14000 });
  console.log(`PostgreSQL ${query('show server_version')} — isolated multi-connection tests`);

  // Publication holds a SHARE row lock through transaction commit. A real block
  // trigger must wait; after it commits, every next message chooses its new key.
  reset();
  const oldTopic = topic();
  const sender = session();
  sender.write(`begin; ${authenticated} ${sendSql}\n\\echo SENT_WITH_LOCK`);
  await sender.marker('SENT_WITH_LOCK');
  const blocker = session();
  blocker.write(`insert into public.user_blocks values ('${owner}','${viewer}');\n\\echo BLOCKED`);
  await blocked(blocker);
  assert.ok(!blocker.out.includes('BLOCKED'));
  await sender.finish();
  await blocker.marker('BLOCKED'); await blocker.finish();
  assert.notEqual(topic(), oldTopic);
  const cutoff = query('select max(id) from public.test_sent');
  assert.equal(send(), 't');
  assert.equal(query(`select count(*) from public.test_sent where id>${cutoff} and topic='${oldTopic}'`), '0');
  assert.equal(query(`select count(*) from public.test_sent where id>${cutoff} and topic='${topic()}'`), '1');
  console.log('PASS: confirmed block serializes with an issued publication; no later point uses old topic');

  // Stop's DELETE cannot confirm while an issued publication still owns the row.
  reset();
  const sending = session();
  sending.write(`begin; ${authenticated} ${sendSql}\n\\echo SEND_PENDING`);
  await sending.marker('SEND_PENDING');
  const stopping = session();
  stopping.write(`delete from public.driver_locations where user_id='${owner}';\n\\echo STOP_CONFIRMED`);
  await blocked(stopping);
  assert.ok(!stopping.out.includes('STOP_CONFIRMED'));
  await sending.finish();
  await stopping.marker('STOP_CONFIRMED'); await stopping.finish();
  const stoppedCount = query('select count(*) from public.test_sent');
  assert.equal(send(), 'f');
  assert.equal(query('select count(*) from public.test_sent'), stoppedCount);
  console.log('PASS: Stop waits for in-flight publication; no point is sent after confirmed deletion');

  // Opposite order: publication waiting behind rotation must use the committed
  // current row/key, rather than the snapshot from before the lock wait.
  reset();
  const previousTopic = topic();
  const rotating = session();
  rotating.write(`begin; update public.driver_locations set broadcast_key=gen_random_uuid() where user_id='${owner}';\n\\echo ROTATION_HELD`);
  await rotating.marker('ROTATION_HELD');
  const waitingSender = session();
  waitingSender.write(`${authenticated} ${sendSql}\n\\echo SEND_AFTER_ROTATION`);
  await blocked(waitingSender);
  await rotating.finish();
  await waitingSender.marker('SEND_AFTER_ROTATION'); await waitingSender.finish();
  assert.notEqual(topic(), previousTopic);
  assert.equal(query('select topic from public.test_sent order by id desc limit 1'), topic());
  console.log('PASS: publication behind a concurrent rotation reads the newly committed key');

  // A session may expire while the sender waits. now() would retain the older
  // transaction timestamp; the RPC must use clock_timestamp after row locking.
  reset();
  const expiryLock = session();
  expiryLock.write(`begin; update public.driver_locations set share_expires_at=clock_timestamp()+interval '700 milliseconds' where user_id='${owner}';\n\\echo EXPIRY_HELD`);
  await expiryLock.marker('EXPIRY_HELD');
  const expiringSender = session();
  expiringSender.write(`begin; ${authenticated} ${sendSql}\n\\echo EXPIRY_SEND_DONE`);
  await blocked(expiringSender);
  // Wait using a server-side clock observation, rather than assuming timers.
  const target = Number(query("select extract(epoch from clock_timestamp())*1000")) + 900;
  await until(() => Number(query("select extract(epoch from clock_timestamp())*1000")) > target, 'expiry elapsed while lock held');
  // The lock-holder UPDATE has its own existing table-trigger message. Count
  // only the distinct smooth sample from the RPC under test, not that fixture
  // update becoming visible at commit.
  const sampleCountSql = "select count(*) from public.test_sent where event='location' and payload->>'latitude'='38.01'";
  const expiryCount = query(sampleCountSql);
  await expiryLock.finish();
  await expiringSender.marker('EXPIRY_SEND_DONE'); await expiringSender.finish();
  assert.ok(expiringSender.out.split(/\s+/).includes('f'), 'Expired sender must return false after lock acquisition');
  assert.equal(query(sampleCountSql), expiryCount, 'Expired RPC must not emit its pending coordinate');
  console.log('PASS: expiry during a lock wait is rejected using the current server clock');
  console.log('PASS: all four real PostgreSQL concurrency scenarios; Realtime transport remains stubbed');
} finally {
  for (const state of sessions) {
    state.child.stdin.end('rollback;\n\\q\n');
    state.child.kill('SIGTERM');
  }
  await Promise.all([...sessions].map((state) => state.done));
}
