#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const baseSql = fs.readFileSync(
  path.join(repoRoot, 'supabase/migrations/20260819080201_group_drive_phase_1.sql'),
  'utf8',
);
const amendmentSql = fs.readFileSync(
  path.join(
    repoRoot,
    'supabase/migrations/20260819201500_group_drive_phase_1_lobby_safety.sql',
  ),
  'utf8',
);

const ids = {
  host: '11111111-1111-4111-8111-111111111111',
  participant: '22222222-2222-4222-8222-222222222222',
};

let checks = 0;
function pass(label) {
  checks += 1;
  console.log(`PASS ${String(checks).padStart(2, '0')} — ${label}`);
}

async function expectError(label, operation, pattern) {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern, `${label}: unexpected error: ${message}`);
    pass(label);
    return;
  }
  assert.fail(`${label}: expected operation to fail`);
}

async function asRole(db, role, userId, operation) {
  await db.exec(`set role ${role}`);
  if (userId) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  } else {
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
  }
  try {
    return await operation();
  } finally {
    await db.exec('reset role');
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function scalar(db, query, params = []) {
  const result = await db.query(query, params);
  assert.equal(result.rows.length, 1, `Expected one row for: ${query}`);
  const values = Object.values(result.rows[0]);
  assert.equal(values.length, 1, `Expected one column for: ${query}`);
  return values[0];
}

async function createDrive(db, title) {
  return asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      'select public.noxa_create_drive_session($1, null, null, null)',
      [title],
    ),
  );
}

async function setRoute(db, driveSessionId, suffix = '') {
  return asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      `select public.noxa_set_drive_route(
        $1,
        37.9838,
        23.7275,
        $2,
        37.9500,
        23.6500,
        $3,
        $4::jsonb,
        12500,
        1100,
        'local-test'
      )`,
      [
        driveSessionId,
        `Start${suffix}`,
        `Destination${suffix}`,
        JSON.stringify({
          type: 'LineString',
          coordinates: [
            [23.7275, 37.9838],
            [23.65, 37.95],
          ],
        }),
      ],
    ),
  );
}

async function inviteAndAccept(db, driveSessionId) {
  const invitationId = await asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      'select public.noxa_invite_user_to_drive($1, $2, null)',
      [driveSessionId, ids.participant],
    ),
  );
  const accepted = await asRole(db, 'authenticated', ids.participant, () =>
    scalar(
      db,
      'select public.noxa_respond_to_drive_invitation($1, true)',
      [invitationId],
    ),
  );
  assert.equal(accepted, true);
}

const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create schema private;

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  set search_path = ''
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create table public.profiles (
    id uuid primary key,
    display_name text not null
  );

  create table public.crews (
    id uuid primary key,
    name text not null
  );

  create table public.crew_members (
    crew_id uuid not null references public.crews(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    primary key (crew_id, user_id)
  );

  create table public.follows (
    follower_id uuid not null references public.profiles(id) on delete cascade,
    following_id uuid not null references public.profiles(id) on delete cascade,
    primary key (follower_id, following_id)
  );

  create table public.user_blocks (
    blocker_id uuid not null references public.profiles(id) on delete cascade,
    blocked_id uuid not null references public.profiles(id) on delete cascade,
    primary key (blocker_id, blocked_id)
  );

  create or replace function private.noxa_users_blocked(first_user uuid, second_user uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select exists (
      select 1
      from public.user_blocks
      where (blocker_id = first_user and blocked_id = second_user)
         or (blocker_id = second_user and blocked_id = first_user)
    );
  $$;

  revoke all on function private.noxa_users_blocked(uuid, uuid)
    from public, anon, authenticated, service_role;
  grant usage on schema private to authenticated;
  grant execute on function private.noxa_users_blocked(uuid, uuid)
    to authenticated;

  create publication supabase_realtime;

  insert into public.profiles (id, display_name) values
    ('${ids.host}', 'Host'),
    ('${ids.participant}', 'Participant');

  insert into public.follows (follower_id, following_id) values
    ('${ids.host}', '${ids.participant}'),
    ('${ids.participant}', '${ids.host}');
`;

const db = await PGlite.create();

try {
  await db.exec(bootstrapSql);
  await db.exec(baseSql);
  await db.exec(amendmentSql);
  pass('base migration plus lobby safety amendment compile together');

  const readyColumn = await scalar(
    db,
    `select count(*)::integer
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'drive_participants'
       and column_name = 'ready_at'
       and data_type = 'timestamp with time zone'`,
  );
  assert.equal(readyColumn, 1);
  pass('drive_participants has one nullable ready_at coordination field');

  const readyRpc = await db.query(`
    select
      p.prosecdef,
      p.proconfig,
      has_function_privilege('public', p.oid, 'execute') as public_execute,
      has_function_privilege('anon', p.oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'noxa_set_drive_ready'
  `);
  assert.deepEqual(readyRpc.rows, [
    {
      prosecdef: true,
      proconfig: ['search_path=""'],
      public_execute: false,
      anon_execute: false,
      authenticated_execute: true,
    },
  ]);
  pass('Ready RPC is narrow authenticated SECURITY DEFINER surface');

  const driveA = await createDrive(db, 'Lobby Safety A');
  const driveB = await createDrive(db, 'Lobby Safety B');
  await setRoute(db, driveA, ' A');
  await setRoute(db, driveB, ' B');
  await inviteAndAccept(db, driveA);
  await inviteAndAccept(db, driveB);

  const ready = await asRole(db, 'authenticated', ids.participant, () =>
    scalar(db, 'select public.noxa_set_drive_ready($1, true)', [driveA]),
  );
  assert.equal(ready, true);
  assert.equal(
    await scalar(
      db,
      `select ready_at is not null
       from public.drive_participants
       where drive_session_id = $1 and user_id = $2`,
      [driveA, ids.participant],
    ),
    true,
  );
  pass('accepted participant can mark only their own Lobby readiness');

  await expectError(
    'host cannot use participant Ready',
    () =>
      asRole(db, 'authenticated', ids.host, () =>
        scalar(db, 'select public.noxa_set_drive_ready($1, true)', [driveA]),
      ),
    /host controls Start/i,
  );

  await setRoute(db, driveA, ' A2');
  assert.equal(
    await scalar(
      db,
      `select ready_at is null
       from public.drive_participants
       where drive_session_id = $1 and user_id = $2`,
      [driveA, ids.participant],
    ),
    true,
  );
  pass('route version change clears participant readiness');

  await asRole(db, 'authenticated', ids.participant, () =>
    scalar(db, 'select public.noxa_set_drive_ready($1, true)', [driveA]),
  );
  const futureStart = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const detailsUpdated = await asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      'select public.noxa_update_drive_details($1, $2, null, null, $3::timestamptz)',
      [driveA, 'Lobby Safety A', futureStart],
    ),
  );
  assert.equal(detailsUpdated, true);
  assert.equal(
    await scalar(
      db,
      `select ready_at is null
       from public.drive_participants
       where drive_session_id = $1 and user_id = $2`,
      [driveA, ids.participant],
    ),
    true,
  );
  pass('scheduled-time change clears participant readiness');

  await asRole(db, 'authenticated', ids.participant, () =>
    scalar(db, 'select public.noxa_set_drive_ready($1, true)', [driveA]),
  );
  const startedA = await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_start_drive($1)', [driveA]),
  );
  assert.equal(startedA, true);
  const afterStart = await db.query(
    `select status, ready_at
     from public.drive_participants
     where drive_session_id = $1 and user_id = $2`,
    [driveA, ids.participant],
  );
  assert.deepEqual(afterStart.rows, [{ status: 'active', ready_at: null }]);
  pass('Start clears readiness while existing lifecycle activates participants');

  await expectError(
    'Ready cannot be changed after Group Drive start',
    () =>
      asRole(db, 'authenticated', ids.participant, () =>
        scalar(db, 'select public.noxa_set_drive_ready($1, true)', [driveA]),
      ),
    /only before the Group Drive starts/i,
  );

  await expectError(
    'second Group Drive start is rejected while a shared user is already active',
    () =>
      asRole(db, 'authenticated', ids.host, () =>
        scalar(db, 'select public.noxa_start_drive($1)', [driveB]),
      ),
    /already active in another Group Drive/i,
  );
  assert.equal(
    await scalar(db, 'select status from public.drive_sessions where id = $1', [driveB]),
    'draft',
  );
  pass('rejected overlapping start leaves the second session unchanged');

  const endedA = await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_end_drive($1)', [driveA]),
  );
  assert.equal(endedA, true);
  const startedBAfterEnd = await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_start_drive($1)', [driveB]),
  );
  assert.equal(startedBAfterEnd, true);
  pass('a new Group Drive may start after the conflicting drive is terminal');

  const locationRows = await scalar(
    db,
    'select count(*)::integer from public.drive_location_state',
  );
  assert.equal(locationRows, 0);
  pass('Lobby readiness and Start hardening create no exact-location rows');

  console.log(`\nGroup Drive Phase 1 lobby safety smoke: PASS (${checks} checks)`);
  console.log('Production and hosted Supabase were not contacted.');
} finally {
  await db.close();
}
