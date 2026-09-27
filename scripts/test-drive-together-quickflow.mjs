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
const lobbySql = fs.readFileSync(
  path.join(repoRoot, 'supabase/migrations/20260819201500_group_drive_phase_1_lobby_safety.sql'),
  'utf8',
);
const quickSql = fs.readFileSync(
  path.join(repoRoot, 'supabase/migrations/20260927112000_drive_together_quickflow.sql'),
  'utf8',
);

const ids = {
  host: '11111111-1111-4111-8111-111111111111',
  friend: '22222222-2222-4222-8222-222222222222',
  secondFriend: '33333333-3333-4333-8333-333333333333',
  outsider: '44444444-4444-4444-8444-444444444444',
  blocked: '55555555-5555-4555-8555-555555555555',
};

let checks = 0;
function pass(label) {
  checks += 1;
  console.log(`PASS ${String(checks).padStart(2, '0')} — ${label}`);
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

async function expectError(label, operation, pattern) {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern, `${label}: unexpected error: ${message}`);
    pass(label);
    return;
  }
  assert.fail(`${label}: expected the operation to fail`);
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
    display_name text,
    username text,
    avatar_url text
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

  insert into public.profiles (id, display_name, username) values
    ('${ids.host}', 'Host', 'host'),
    ('${ids.friend}', 'Friend', 'friend'),
    ('${ids.secondFriend}', 'Second Friend', 'secondfriend'),
    ('${ids.outsider}', 'Outsider', 'outsider'),
    ('${ids.blocked}', 'Blocked', 'blocked');

  insert into public.follows (follower_id, following_id) values
    ('${ids.host}', '${ids.friend}'),
    ('${ids.friend}', '${ids.host}'),
    ('${ids.host}', '${ids.secondFriend}'),
    ('${ids.secondFriend}', '${ids.host}'),
    ('${ids.host}', '${ids.blocked}'),
    ('${ids.blocked}', '${ids.host}');

  insert into public.user_blocks (blocker_id, blocked_id)
  values ('${ids.blocked}', '${ids.host}');
`;

const db = await PGlite.create();

try {
  await db.exec(bootstrapSql);
  await db.exec(baseSql);
  await db.exec(lobbySql);
  await db.exec(quickSql);
  pass('base, lobby-safety, and quick-flow migrations compile together');

  const driveMode = await db.query(`
    select data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drive_sessions'
      and column_name = 'drive_mode'
  `);
  assert.equal(driveMode.rows.length, 1);
  assert.equal(driveMode.rows[0].data_type, 'text');
  assert.equal(driveMode.rows[0].is_nullable, 'NO');
  assert.match(String(driveMode.rows[0].column_default), /planned/);
  pass('drive_mode is additive and defaults existing planned drives safely');

  const quickRpc = await db.query(`
    select
      p.proname,
      p.prosecdef,
      p.proconfig,
      has_function_privilege('public', p.oid, 'execute') as public_execute,
      has_function_privilege('anon', p.oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'noxa_create_quick_drive',
        'noxa_get_my_pending_quick_drive_invitation',
        'noxa_get_quick_drive_invitation'
      )
    order by p.proname
  `);
  assert.equal(quickRpc.rows.length, 3);
  for (const row of quickRpc.rows) {
    assert.equal(row.prosecdef, true, `${row.proname} must be SECURITY DEFINER`);
    assert.ok(row.proconfig?.includes('search_path=""'));
    assert.equal(row.public_execute, false);
    assert.equal(row.anon_execute, false);
    assert.equal(row.authenticated_execute, true);
  }
  pass('quick RPC surface is authenticated and hardened');

  await expectError(
    'quick creation rejects non-mutual users',
    () => asRole(db, 'authenticated', ids.host, () =>
      scalar(db, 'select public.noxa_create_quick_drive($1)', [ids.outsider]),
    ),
    /mutual friend/i,
  );

  await expectError(
    'quick creation respects existing block privacy',
    () => asRole(db, 'authenticated', ids.host, () =>
      scalar(db, 'select public.noxa_create_quick_drive($1)', [ids.blocked]),
    ),
    /cannot be invited/i,
  );

  const created = await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_create_quick_drive($1)', [ids.friend]),
  );
  const driveId = created.drive_session_id;
  const invitationId = created.invitation_id;
  assert.ok(driveId);
  assert.ok(invitationId);

  const draftState = await db.query(
    `select drive_mode, status, route_version, route_geometry, scheduled_start_at
     from public.drive_sessions
     where id = $1`,
    [driveId],
  );
  assert.deepEqual(draftState.rows, [{
    drive_mode: 'quick',
    status: 'draft',
    route_version: 0,
    route_geometry: null,
    scheduled_start_at: null,
  }]);
  pass('one tap creates a route-free, schedule-free private quick session');

  const sameInvite = await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_create_quick_drive($1)', [ids.friend]),
  );
  assert.equal(sameInvite.drive_session_id, driveId);
  assert.equal(sameInvite.invitation_id, invitationId);
  pass('repeated tap is idempotent for the same pending friend');

  await expectError(
    'host cannot fork another pending quick invitation',
    () => asRole(db, 'authenticated', ids.host, () =>
      scalar(db, 'select public.noxa_create_quick_drive($1)', [ids.secondFriend]),
    ),
    /finish or cancel/i,
  );

  const quickPreview = await asRole(db, 'authenticated', ids.friend, () =>
    scalar(db, 'select public.noxa_get_quick_drive_invitation($1)', [invitationId]),
  );
  assert.equal(quickPreview.drive_session_id, driveId);
  assert.equal(quickPreview.host_id, ids.host);
  pass('only the invitee can resolve a pending quick invitation');

  const outsiderPreview = await asRole(db, 'authenticated', ids.outsider, () =>
    scalar(db, 'select public.noxa_get_quick_drive_invitation($1)', [invitationId]),
  );
  assert.equal(outsiderPreview, null);
  pass('quick invitation lookup does not disclose it to outsiders');

  const accepted = await asRole(db, 'authenticated', ids.friend, () =>
    scalar(
      db,
      'select public.noxa_respond_to_drive_invitation($1, true)',
      [invitationId],
    ),
  );
  assert.equal(accepted, true);

  const activeState = await db.query(
    `select
       status,
       route_version,
       route_geometry,
       scheduled_start_at,
       extract(epoch from (active_expires_at - started_at))::integer as active_seconds,
       (select count(*)::integer
        from public.drive_participants p
        where p.drive_session_id = drive_sessions.id and p.status = 'active') as active_participants
     from public.drive_sessions
     where id = $1`,
    [driveId],
  );
  assert.deepEqual(activeState.rows, [{
    status: 'active',
    route_version: 0,
    route_geometry: null,
    scheduled_start_at: null,
    active_seconds: 28800,
    active_participants: 2,
  }]);
  pass('Join automatically activates both drivers without route, Ready, Lobby, or Start');

  const ended = await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_end_drive($1)', [driveId]),
  );
  assert.equal(ended, true);

  const secondCreated = await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_create_quick_drive($1)', [ids.secondFriend]),
  );
  const declined = await asRole(db, 'authenticated', ids.secondFriend, () =>
    scalar(
      db,
      'select public.noxa_respond_to_drive_invitation($1, false)',
      [secondCreated.invitation_id],
    ),
  );
  assert.equal(declined, true);
  assert.equal(
    await scalar(db, 'select status from public.drive_sessions where id = $1', [secondCreated.drive_session_id]),
    'cancelled',
  );
  pass('declining a pair invite closes the ephemeral quick session');

  const plannedId = await asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      "select public.noxa_create_drive_session('Planned Drive', null, null, null)",
    ),
  );
  const plannedInvitationId = await asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      'select public.noxa_invite_user_to_drive($1, $2, null)',
      [plannedId, ids.friend],
    ),
  );
  const plannedAccepted = await asRole(db, 'authenticated', ids.friend, () =>
    scalar(
      db,
      'select public.noxa_respond_to_drive_invitation($1, true)',
      [plannedInvitationId],
    ),
  );
  assert.equal(plannedAccepted, true);
  assert.equal(
    await scalar(db, 'select status from public.drive_sessions where id = $1', [plannedId]),
    'draft',
  );
  await expectError(
    'planned Group Drive still requires its calculated route',
    () => asRole(db, 'authenticated', ids.host, () =>
      scalar(db, 'select public.noxa_start_drive($1)', [plannedId]),
    ),
    /calculated start-to-end route/i,
  );

  console.log(`\nDrive Together quick-flow local database smoke: PASS (${checks} checks)`);
  console.log('Production and hosted Supabase were not contacted.');
} finally {
  await db.close();
}
