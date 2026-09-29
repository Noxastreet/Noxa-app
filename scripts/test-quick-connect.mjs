#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const migration = fs.readFileSync(
  path.join(repoRoot, 'supabase/migrations/20260929103000_quick_connect_friends.sql'),
  'utf8',
);

const ids = {
  owner: '11111111-1111-4111-8111-111111111111',
  scanner: '22222222-2222-4222-8222-222222222222',
  blocked: '33333333-3333-4333-8333-333333333333',
};

let checks = 0;
function pass(label) {
  checks += 1;
  console.log(`PASS ${String(checks).padStart(2, '0')} — ${label}`);
}

async function asRole(db, role, userId, operation) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  try {
    return await operation();
  } finally {
    await db.exec('reset role');
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function scalar(db, query, params = []) {
  const result = await db.query(query, params);
  assert.equal(result.rows.length, 1);
  const values = Object.values(result.rows[0]);
  assert.equal(values.length, 1);
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
  assert.fail(`${label}: expected an error`);
}

const bootstrap = `
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
    display_name text not null,
    username text,
    avatar_url text
  );

  create table public.follows (
    follower_id uuid not null references public.profiles(id) on delete cascade,
    following_id uuid not null references public.profiles(id) on delete cascade,
    primary key (follower_id, following_id),
    check (follower_id <> following_id)
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
  grant execute on function private.noxa_users_blocked(uuid, uuid) to authenticated;

  insert into public.profiles (id, display_name, username) values
    ('${ids.owner}', 'Owner Driver', 'owner'),
    ('${ids.scanner}', 'Scanner Driver', 'scanner'),
    ('${ids.blocked}', 'Blocked Driver', 'blocked');
`;

const db = await PGlite.create();

try {
  await db.exec(bootstrap);
  await db.exec(migration);
  pass('Quick Connect migration compiles on the social schema');

  const rpcRows = await db.query(`
    select
      p.proname,
      p.prosecdef,
      has_function_privilege('public', p.oid, 'execute') as public_execute,
      has_function_privilege('anon', p.oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'noxa_create_friend_connect',
        'noxa_revoke_friend_connect',
        'noxa_resolve_friend_connect',
        'noxa_redeem_friend_connect'
      )
    order by p.proname
  `);
  assert.equal(rpcRows.rows.length, 4);
  for (const row of rpcRows.rows) {
    assert.equal(row.prosecdef, true);
    assert.equal(row.public_execute, false);
    assert.equal(row.anon_execute, false);
    assert.equal(row.authenticated_execute, true);
  }
  pass('Quick Connect RPCs are authenticated SECURITY DEFINER functions');

  await expectError(
    'anonymous users cannot create Quick Connect sessions',
    () => asRole(db, 'anon', null, () =>
      scalar(db, 'select public.noxa_create_friend_connect()'),
    ),
    /(permission denied|authentication required)/i,
  );

  const first = await asRole(db, 'authenticated', ids.owner, () =>
    scalar(db, 'select public.noxa_create_friend_connect()'),
  );
  assert.match(first.code, /^[A-F0-9]{10}$/);
  assert.match(first.token, /^[0-9a-f-]{36}$/i);
  assert.ok(Date.parse(first.expires_at) > Date.now());
  pass('owner receives a short-lived token and human code');

  await expectError(
    'owner cannot resolve their own displayed code',
    () => asRole(db, 'authenticated', ids.owner, () =>
      scalar(db, 'select public.noxa_resolve_friend_connect($1)', [first.code]),
    ),
    /own Quick Connect code/i,
  );

  const preview = await asRole(db, 'authenticated', ids.scanner, () =>
    scalar(db, 'select public.noxa_resolve_friend_connect($1)', [first.code]),
  );
  assert.equal(preview.user_id, ids.owner);
  assert.equal(preview.display_name, 'Owner Driver');
  assert.equal(preview.already_friends, false);
  pass('scanner resolves only the safe owner preview before adding');

  const redeemed = await asRole(db, 'authenticated', ids.scanner, () =>
    scalar(db, 'select public.noxa_redeem_friend_connect($1)', [preview.session_id]),
  );
  assert.equal(redeemed.user_id, ids.owner);
  assert.equal(redeemed.friends, true);

  const reciprocal = await scalar(
    db,
    `select count(*)::integer
       from public.follows
       where (follower_id=$1 and following_id=$2)
          or (follower_id=$2 and following_id=$1)`,
    [ids.owner, ids.scanner],
  );
  assert.equal(reciprocal, 2);
  pass('redeem atomically creates mutual friendship');

  const consumed = await scalar(
    db,
    'select count(*)::integer from public.friend_connect_sessions where id=$1',
    [preview.session_id],
  );
  assert.equal(consumed, 0);
  pass('successful handshake consumes the session exactly once');

  await expectError(
    'consumed session cannot be redeemed again',
    () => asRole(db, 'authenticated', ids.scanner, () =>
      scalar(db, 'select public.noxa_redeem_friend_connect($1)', [preview.session_id]),
    ),
    /expired/i,
  );

  const replacedA = await asRole(db, 'authenticated', ids.owner, () =>
    scalar(db, 'select public.noxa_create_friend_connect()'),
  );
  const replacedB = await asRole(db, 'authenticated', ids.owner, () =>
    scalar(db, 'select public.noxa_create_friend_connect()'),
  );
  assert.notEqual(replacedA.session_id, replacedB.session_id);
  const oldLookup = await asRole(db, 'authenticated', ids.scanner, () =>
    scalar(db, 'select public.noxa_resolve_friend_connect($1)', [replacedA.code]),
  );
  assert.equal(oldLookup, null);
  pass('creating a new code immediately revokes the previous one');

  const friendsPreview = await asRole(db, 'authenticated', ids.scanner, () =>
    scalar(db, 'select public.noxa_resolve_friend_connect($1)', [replacedB.token]),
  );
  assert.equal(friendsPreview.already_friends, true);
  pass('preview reports an existing mutual friendship without duplicating rows');

  const blockedSession = await asRole(db, 'authenticated', ids.blocked, () =>
    scalar(db, 'select public.noxa_create_friend_connect()'),
  );
  await db.query(
    'insert into public.user_blocks (blocker_id, blocked_id) values ($1,$2)',
    [ids.owner, ids.blocked],
  );
  await expectError(
    'Quick Connect respects existing user blocks',
    () => asRole(db, 'authenticated', ids.owner, () =>
      scalar(db, 'select public.noxa_resolve_friend_connect($1)', [blockedSession.code]),
    ),
    /unavailable/i,
  );

  console.log(`Quick Connect database smoke passed (${checks} checks).`);
} finally {
  await db.close();
}
