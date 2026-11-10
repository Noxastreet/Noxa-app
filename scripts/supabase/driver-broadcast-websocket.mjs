import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

assert.equal(process.env.NOXA_BROADCAST_TEST_ISOLATED, '1');
const status = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const url = status.API_URL ?? status.api_url;
assert.ok(url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Only local Supabase is allowed');
const anonKey = status.ANON_KEY ?? status.anon_key;
const serviceKey = status.SERVICE_ROLE_KEY ?? status.service_role_key;
assert.ok(anonKey && serviceKey, 'Local test API credentials missing');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, options);
const clients = [admin];
function checked(result, operation) {
  assert.ok(!result.error, `${operation} failed (${result.error?.code ?? 'unknown'})`);
  return result.data;
}
async function until(predicate, label, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (!await predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await delay(50);
  }
}
async function account(label) {
  const email = `noxa-${label}-${randomUUID()}@example.test`;
  const password = randomUUID();
  const user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create local QA user').user;
  const client = createClient(url, anonKey, options); clients.push(client);
  const { session } = checked(await client.auth.signInWithPassword({ email, password }), 'local sign in');
  await client.realtime.setAuth(session.access_token);
  return { id: user.id, client };
}
function subscribe(client, topic) {
  const messages = [];
  const channel = client.channel(topic, { config: { private: true, broadcast: { ack: true } } });
  channel.on('broadcast', { event: 'location' }, ({ payload }) => messages.push(payload));
  const ready = new Promise((resolve) => {
    channel.subscribe((state) => {
      if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(state)) resolve(state);
    });
  });
  return { channel, messages, ready };
}
async function ready(subscription) {
  assert.equal(await Promise.race([subscription.ready, delay(12000, 'WAIT_TIMEOUT')]), 'SUBSCRIBED');
}
const hasSample = (subscription, latitude) => subscription.messages.some((point) => point.latitude === latitude);

try {
  const a = await account('a'); const b = await account('b'); const outsider = await account('outsider');
  checked(await admin.from('driver_locations').insert({
    user_id: a.id, latitude: 38, longitude: 23, visibility_mode: 'friends',
    updated_at: new Date().toISOString(), share_started_at: new Date().toISOString(),
    share_expires_at: new Date(Date.now() + 3600000).toISOString(),
  }), 'seed active local session');
  checked(await admin.from('follows').insert([
    { follower_id: a.id, following_id: b.id }, { follower_id: b.id, following_id: a.id },
  ]), 'seed mutual QA relationship');
  const topic = async () => {
    const row = checked(await admin.from('driver_locations').select('broadcast_key').eq('user_id', a.id).single(), 'read current test topic');
    return `noxa-driver:${a.id}:${row.broadcast_key}`;
  };
  const rpc = (latitude) => a.client.rpc('noxa_broadcast_my_driver_location', {
    expected_user_id: a.id, sample_latitude: latitude, sample_longitude: 23.02,
  });

  const oldTopic = await topic();
  const viewer = subscribe(b.client, oldTopic); const sender = subscribe(a.client, oldTopic);
  await Promise.all([ready(viewer), ready(sender)]);
  assert.equal(checked(await rpc(40.101), 'authorized smooth publication'), true);
  await until(() => hasSample(viewer, 40.101), 'positive-control private Broadcast delivery');
  console.log('PASS: signed-in mutual friend receives a real private WebSocket message from the RPC');

  // Even an authorized reader/owner cannot bypass the RPC with raw GPS sends.
  await sender.channel.send({ type: 'broadcast', event: 'location', payload: {
    user_id: a.id, latitude: 41.202, longitude: 23.02, updated_at: new Date().toISOString(),
  } });
  await delay(1200);
  assert.equal(hasSample(viewer, 41.202), false, 'Direct client GPS send must not reach an authorized reader');
  console.log('PASS: direct raw client Broadcast is denied while normal private delivery works');

  const denied = subscribe(outsider.client, oldTopic);
  const deniedState = await Promise.race([denied.ready, delay(12000, 'WAIT_TIMEOUT')]);
  assert.ok(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(deniedState), 'An outsider must not join the known private topic');
  await outsider.client.removeChannel(denied.channel);
  const spoof = await outsider.client.rpc('noxa_broadcast_my_driver_location', {
    expected_user_id: a.id, sample_latitude: 42.303, sample_longitude: 23.02,
  });
  assert.ok(spoof.error, 'An outsider cannot send coordinates under another account');
  console.log('PASS: third account cannot join the private topic or impersonate its publisher');

  checked(await admin.from('user_blocks').insert({ blocker_id: a.id, blocked_id: b.id }), 'commit block with real rotation trigger');
  const newTopic = await topic(); assert.notEqual(newTopic, oldTopic);
  assert.equal(viewer.channel.state, 'joined', 'Revoked peer stays subscribed to model cached channel permissions');
  const currentOwner = subscribe(a.client, newTopic); await ready(currentOwner);
  assert.equal(checked(await rpc(43.404), 'publication after block'), true);
  await until(() => hasSample(currentOwner, 43.404), 'positive-control current-topic delivery after block');
  await delay(1200);
  assert.equal(hasSample(viewer, 43.404), false, 'Already-connected revoked peer receives no new coordinate');
  console.log('PASS: blocking rotates the topic; cached old WebSocket receives no subsequent coordinate');

  checked(await admin.from('driver_locations').delete().eq('user_id', a.id), 'commit local Stop deletion');
  assert.equal(checked(await rpc(44.505), 'publication after Stop'), false);
  await delay(700);
  assert.equal(hasSample(currentOwner, 44.505), false);
  console.log('PASS: a confirmed Stop prevents further RPC/WebSocket publication');

  checked(await admin.from('driver_locations').insert({
    user_id: a.id, latitude: 38, longitude: 23, visibility_mode: 'friends',
    updated_at: new Date().toISOString(), share_started_at: new Date(Date.now() - 3600000).toISOString(),
    share_expires_at: new Date(Date.now() - 1000).toISOString(),
  }), 'seed expired local QA session');
  assert.equal(checked(await rpc(45.606), 'publication after expiry'), false);
  console.log('PASS: an expired session cannot publish through the authenticated RPC');
  console.log('PASS: local Supabase Auth/PostgREST/private Realtime acceptance (three synthetic accounts; real transport)');
} finally {
  await Promise.allSettled(clients.map((client) => client.removeAllChannels()));
}
