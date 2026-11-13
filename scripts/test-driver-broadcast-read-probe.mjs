import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { driverBroadcastFixtureSql } from './lib/driver-broadcast-fixture.mjs';

const db = await PGlite.create();
const owner = '11111111-1111-4111-8111-111111111111';
const friend = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
async function scalar(sql, args = []) { return Object.values((await db.query(sql, args)).rows[0])[0]; }
async function readAs(userId, topic, sql) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('realtime.topic',$2,false)", [userId,topic]);
  await db.exec('set role authenticated');
  try { return await scalar(sql); } finally { await db.exec('reset role'); }
}
try {
  await db.exec(driverBroadcastFixtureSql({ applyReadProbeFix: false }));
  await db.exec(`insert into public.driver_locations(user_id,latitude,longitude,visibility_mode,updated_at,share_started_at,share_expires_at)
    values ('${owner}',38,23,'friends',now(),now(),now()+interval '1 hour');
    insert into public.follows values ('${owner}','${friend}'),('${friend}','${owner}');`);
  const topic = await scalar(`select private.noxa_driver_broadcast_topic(user_id,broadcast_key) from public.driver_locations where user_id='${owner}'`);
  await db.query("insert into realtime.messages(extension,private,topic) values ('broadcast',null,$1),('broadcast',true,'another-topic'),('presence',true,$1)", [topic]);
  assert.equal(await readAs(friend,topic,`select private.noxa_can_read_driver_broadcast('${topic}')`), true);
  assert.equal(await readAs(friend,topic,`select count(*) from realtime.messages where topic='${topic}' and extension='broadcast'`), 0,
    'Baseline: valid audience still cannot read a Supabase-style probe without private=true');

  const file = fs.readdirSync('supabase/migrations').find((name) => name.endsWith('_fix_driver_broadcast_read_probe.sql'));
  await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  assert.equal(await readAs(friend,topic,'select count(*) from realtime.messages'), 1, 'Authorized friend can read its Broadcast probe');
  assert.equal(await readAs(owner,topic,'select count(*) from realtime.messages'), 1);
  assert.equal(await readAs(outsider,topic,'select count(*) from realtime.messages'), 0);
  assert.equal(await readAs(friend,'another-topic','select count(*) from realtime.messages'), 0);
  await db.exec(`insert into public.user_blocks values ('${owner}','${friend}')`);
  assert.equal(await readAs(friend,topic,'select count(*) from realtime.messages'), 0, 'Old topic is revoked');
  const newTopic = await scalar(`select private.noxa_driver_broadcast_topic(user_id,broadcast_key) from public.driver_locations where user_id='${owner}'`);
  await db.query("insert into realtime.messages(extension,private,topic) values ('broadcast',null,$1)", [newTopic]);
  assert.equal(await readAs(friend,newTopic,'select count(*) from realtime.messages'), 0, 'Block still overrides an otherwise valid relationship');
  await db.exec('delete from public.user_blocks');
  const freshTopic = await scalar(`select private.noxa_driver_broadcast_topic(user_id,broadcast_key) from public.driver_locations where user_id='${owner}'`);
  await db.query("insert into realtime.messages(extension,private,topic) values ('broadcast',null,$1)", [freshTopic]);
  await db.exec(`update public.driver_locations set updated_at=now()-interval '3 minutes'`);
  assert.equal(await readAs(friend,freshTopic,'select count(*) from realtime.messages'), 0, 'Freshness still applies');
  await db.exec(`update public.driver_locations set updated_at=now(),share_expires_at=now()-interval '1 second'`);
  assert.equal(await readAs(friend,freshTopic,'select count(*) from realtime.messages'), 0, 'Expiry still applies');
  console.log('Read probe regression: PASS (old policy reproduces denial; fixed policy preserves topic/audience/block/freshness/expiry restrictions)');
} finally { await db.close(); }
