import assert from 'node:assert/strict';
import { driverBroadcastFixtureSql } from './lib/driver-broadcast-fixture.mjs';
import { PGlite } from '@electric-sql/pglite';

const db = await PGlite.create();
const owner = '11111111-1111-4111-8111-111111111111';
const viewer = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
async function scalar(sql, params = []) {
  return Object.values((await db.query(sql, params)).rows[0])[0];
}
async function as(role, user, operation) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
  try { return await operation(); }
  finally { await db.exec('reset role'); }
}
const send = (user = owner, lat = 38, lon = 23, expected = user) => as('authenticated', user, () =>
  scalar('select public.noxa_broadcast_my_driver_location($1::uuid,$2::float8,$3::float8)', [expected, lat, lon]));
const currentTopic = () => scalar(`select private.noxa_driver_broadcast_topic(user_id,broadcast_key) from public.driver_locations where user_id='${owner}'`);
const canRead = (topic, user = viewer) => as('authenticated', user, () => scalar('select private.noxa_can_read_driver_broadcast($1)', [topic]));

try {
  await db.exec(driverBroadcastFixtureSql());

  for (const schema of ['public', 'private']) {
    const acl = (await db.query(`select prosecdef,proconfig,
      has_function_privilege('anon',oid,'execute') as anon_execute,
      has_function_privilege('authenticated',oid,'execute') as user_execute
      from pg_proc where pronamespace=$1::regnamespace and proname='noxa_broadcast_my_driver_location'`, [schema])).rows[0];
    assert.equal(acl.prosecdef, schema === 'private');
    assert.equal(acl.anon_execute, false);
    assert.equal(acl.user_execute, true);
    assert.ok(acl.proconfig.includes('search_path=""'));
  }
  await assert.rejects(as('anon', null, () => scalar(`select public.noxa_broadcast_my_driver_location('${owner}',38,23)`)), /permission denied/);
  await assert.rejects(send(null), /authentication required/);
  await assert.rejects(send(owner,38,23,viewer), /location account changed/);
  assert.equal(await send(outsider), false, 'An unrelated account cannot publish the owner location');

  await db.exec(`insert into public.driver_locations(user_id,latitude,longitude,visibility_mode,updated_at,share_started_at,share_expires_at)
    values ('${owner}',38,23,'friends',now(),now(),now()+interval '1 hour');
    insert into public.follows values ('${owner}','${viewer}'),('${viewer}','${owner}');`);
  const before = await scalar(`select row_to_json(d) from public.driver_locations d where user_id='${owner}'`);
  let topic = await currentTopic();
  assert.equal(await canRead(topic), true, 'Mutual friend can subscribe');
  assert.equal(await canRead(topic, outsider), false, 'Outsider cannot subscribe');
  assert.equal(await send(), true);
  assert.deepEqual(await scalar(`select row_to_json(d) from public.driver_locations d where user_id='${owner}'`), before,
    'Sending does not create/update presence, session expiry, telemetry or history');

  const cachedAllowed = await canRead(topic);
  const oldTopic = topic;
  await db.exec(`insert into public.user_blocks values ('${owner}','${viewer}')`);
  topic = await currentTopic();
  assert.notEqual(topic, oldTopic, 'Real block trigger rotates the key');
  assert.equal(cachedAllowed, true, 'Model an already-authorized channel retaining cached permission');
  assert.equal(await canRead(oldTopic), false);
  assert.equal(await canRead(topic), false);
  const cutoff = await scalar('select max(id) from public.test_sent');
  assert.equal(await send(owner, 39.002, 24.003), true);
  const afterBlock = (await db.query('select * from public.test_sent where id > $1', [cutoff])).rows;
  assert.equal(afterBlock.length, 1);
  assert.equal(afterBlock[0].topic, topic, 'Only the server current topic receives the new coordinate');
  assert.notEqual(afterBlock[0].topic, oldTopic, 'Cached former channel receives no new coordinates');
  assert.equal(afterBlock[0].private, true);
  assert.equal(afterBlock[0].payload.user_id, owner);
  assert.deepEqual(Object.keys(afterBlock[0].payload).sort(), ['latitude','longitude','updated_at','user_id']);

  await db.exec(`delete from public.user_blocks; delete from public.follows where follower_id='${viewer}';`);
  assert.equal(await canRead(await currentTopic()), false, 'Former friend cannot read fresh topic');
  await db.exec(`update public.driver_locations set visibility_mode='crew' where user_id='${owner}';
    insert into public.crew_members values ('${outsider}','${owner}'),('${outsider}','${viewer}');`);
  topic = await currentTopic();
  assert.equal(await canRead(topic), true);
  await db.exec(`delete from public.crew_members where user_id='${viewer}'`);
  assert.notEqual(await currentTopic(), topic);
  assert.equal(await canRead(await currentTopic()), false, 'Removed crew member loses fresh-topic access');

  for (const [lat,lon] of [[null,23],[38,null],[91,23],[38,-181],['NaN',23],['Infinity',23]]) {
    await assert.rejects(send(owner,lat,lon), /invalid location sample/);
  }
  for (const update of ["visibility_mode='ghost'", "visibility_mode='unknown'", "updated_at=now()-interval '3 minutes'",
    "share_expires_at=now()-interval '1 second'"]) {
    await db.exec(`update public.driver_locations set visibility_mode='friends',updated_at=now(),share_expires_at=now()+interval '1 hour';
      update public.driver_locations set ${update};`);
    const count = await scalar('select count(*) from public.test_sent');
    assert.equal(await send(), false, update);
    assert.equal(await scalar('select count(*) from public.test_sent'), count);
  }
  await db.exec('delete from public.driver_locations');
  const count = await scalar('select count(*) from public.test_sent');
  assert.equal(await send(), false, 'Stop leaves no row to authorize another message');
  assert.equal(await scalar('select count(*) from public.test_sent'), count);

  // A future broad send policy cannot accidentally reopen the driver channel.
  await db.exec('create policy test_generic_send on realtime.messages for insert to authenticated with check (true)');
  await db.query("select set_config('realtime.topic',$1,false)", [oldTopic]);
  await assert.rejects(as('authenticated',owner,()=>db.exec("insert into realtime.messages values ('broadcast',true,'location','{}')")), /row-level security/);
  await db.query("select set_config('realtime.topic','other-topic',false)");
  await as('authenticated',owner,()=>db.exec("insert into realtime.messages values ('broadcast',true,'other','{}')"));
  console.log('Driver Broadcast SQL: PASS (real migration/rotation triggers, ACL, actor isolation, block/friend/crew revocation, expiry/Stop, malformed input, restrictive send policy; transport stubbed)');
} finally {
  await db.close();
}
