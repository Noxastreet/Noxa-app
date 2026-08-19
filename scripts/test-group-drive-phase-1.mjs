#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const migrationPath = path.join(
  repoRoot,
  'supabase/migrations/20260819080201_group_drive_phase_1.sql',
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const runbookPath = path.join(
  repoRoot,
  'docs/security/NOXA_GROUP_DRIVE_PHASE_1_RUNBOOK.md',
);
const runbook = fs.readFileSync(runbookPath, 'utf8');
const rollbackMatch = runbook.match(
  /## Emergency rollback[\s\S]*?```sql\n([\s\S]*?)\n```/,
);

assert.ok(rollbackMatch, 'Emergency rollback SQL is missing from the runbook');
const rollbackSql = rollbackMatch[1];

const ids = {
  host: '11111111-1111-4111-8111-111111111111',
  participant: '22222222-2222-4222-8222-222222222222',
  pending: '33333333-3333-4333-8333-333333333333',
  outsider: '44444444-4444-4444-8444-444444444444',
  blocked: '55555555-5555-4555-8555-555555555555',
  crew: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

const expectedTables = [
  'drive_invitations',
  'drive_location_state',
  'drive_participants',
  'drive_sessions',
  'drive_stops',
];

const expectedRpcNames = [
  'noxa_cancel_drive',
  'noxa_cancel_drive_invitation',
  'noxa_create_drive_session',
  'noxa_end_drive',
  'noxa_get_drive_invitation_preview',
  'noxa_get_drive_summary',
  'noxa_invite_crew_to_drive',
  'noxa_invite_user_to_drive',
  'noxa_leave_drive',
  'noxa_list_my_group_drives',
  'noxa_remove_drive_participant',
  'noxa_respond_to_drive_invitation',
  'noxa_set_drive_route',
  'noxa_start_drive',
  'noxa_update_drive_details',
];

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

  assert.fail(`${label}: expected the operation to fail`);
}

async function asRole(db, role, userId, operation) {
  assert.match(role, /^(anon|authenticated|service_role)$/);
  await db.exec(`set role ${role}`);

  if (userId) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      userId,
    ]);
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

async function setRoute(db, driveSessionId) {
  return asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      `select public.noxa_set_drive_route(
        $1,
        37.9838,
        23.7275,
        'Start',
        37.9500,
        23.6500,
        'Approximate destination',
        $2::jsonb,
        12500,
        1100,
        'local-test'
      )`,
      [driveSessionId, JSON.stringify({ type: 'LineString', coordinates: [] })],
    ),
  );
}

async function inviteAndAccept(db, driveSessionId, userId) {
  const invitationId = await asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      'select public.noxa_invite_user_to_drive($1, $2, null)',
      [driveSessionId, userId],
    ),
  );

  const accepted = await asRole(db, 'authenticated', userId, () =>
    scalar(
      db,
      'select public.noxa_respond_to_drive_invitation($1, true)',
      [invitationId],
    ),
  );
  assert.equal(accepted, true);
  return invitationId;
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
    ('${ids.participant}', 'Participant'),
    ('${ids.pending}', 'Pending'),
    ('${ids.outsider}', 'Outsider'),
    ('${ids.blocked}', 'Blocked');

  insert into public.follows (follower_id, following_id) values
    ('${ids.host}', '${ids.participant}'),
    ('${ids.participant}', '${ids.host}'),
    ('${ids.host}', '${ids.pending}'),
    ('${ids.pending}', '${ids.host}');

  insert into public.crews (id, name)
  values ('${ids.crew}', 'Local Test Crew');

  insert into public.crew_members (crew_id, user_id) values
    ('${ids.crew}', '${ids.host}'),
    ('${ids.crew}', '${ids.pending}'),
    ('${ids.crew}', '${ids.blocked}');
`;

const db = await PGlite.create();

try {
  await db.exec(bootstrapSql);
  await db.exec(migrationSql);
  pass('full Phase 1 migration compiles in in-memory PostgreSQL');

  const tableResult = await db.query(`
    select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any($1::text[])
    order by c.relname
  `, [expectedTables]);
  assert.deepEqual(
    tableResult.rows.map((row) => row.table_name),
    expectedTables,
  );
  assert.ok(tableResult.rows.every((row) => row.rls_enabled === true));
  pass('exact five-table boundary exists with RLS enabled');

  const locationColumns = await db.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drive_location_state'
    order by ordinal_position
  `);
  assert.deepEqual(
    locationColumns.rows.map((row) => row.column_name),
    [
      'drive_session_id',
      'user_id',
      'latitude',
      'longitude',
      'heading',
      'status',
      'updated_at',
    ],
  );
  pass('location state stores no speed, accuracy, telemetry, or history');

  const rpcResult = await db.query(`
    select distinct p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'noxa_%drive%'
    order by p.proname
  `);
  assert.deepEqual(
    rpcResult.rows.map((row) => row.proname),
    expectedRpcNames,
  );
  pass('exact authenticated Group Drive RPC surface is present');

  const hardeningResult = await db.query(`
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
      and p.proname = any($1::text[])
    order by p.proname
  `, [expectedRpcNames]);
  assert.equal(hardeningResult.rows.length, expectedRpcNames.length);
  for (const row of hardeningResult.rows) {
    assert.equal(row.prosecdef, true, `${row.proname} must be SECURITY DEFINER`);
    assert.ok(
      row.proconfig?.includes('search_path=""'),
      `${row.proname} must fix an empty search_path`,
    );
    assert.equal(row.public_execute, false);
    assert.equal(row.anon_execute, false);
    assert.equal(row.authenticated_execute, true);
  }
  pass('RPC privileges and SECURITY DEFINER search_path are hardened');

  const realtimeCount = await scalar(
    db,
    `select count(*)::integer
     from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'drive_location_state'`,
  );
  assert.equal(realtimeCount, 1);
  pass('ephemeral location table is registered for Realtime');

  await expectError(
    'authenticated RPC rejects a missing JWT subject',
    () =>
      asRole(db, 'authenticated', null, () =>
        scalar(
          db,
          "select public.noxa_create_drive_session('No auth', null, null, null)",
        ),
      ),
    /Authentication required/i,
  );

  const driveId = await createDrive(db, 'Athens Night Drive');
  const hostParticipant = await db.query(
    `select role, status
     from public.drive_participants
     where drive_session_id = $1 and user_id = $2`,
    [driveId, ids.host],
  );
  assert.deepEqual(hostParticipant.rows, [{ role: 'host', status: 'accepted' }]);
  pass('session creation atomically creates the accepted host row');

  await expectError(
    'authenticated clients cannot write durable session rows directly',
    () =>
      asRole(db, 'authenticated', ids.host, () =>
        db.query(
          `insert into public.drive_sessions (host_id, title)
           values ($1, 'Direct write')`,
          [ids.host],
        ),
      ),
    /permission denied|row-level security/i,
  );

  const routeVersion = await setRoute(db, driveId);
  assert.equal(routeVersion, 1);
  pass('host can store a validated two-point route through the RPC');

  await expectError(
    'non-friend individual invitation is rejected',
    () =>
      asRole(db, 'authenticated', ids.host, () =>
        scalar(
          db,
          'select public.noxa_invite_user_to_drive($1, $2, null)',
          [driveId, ids.outsider],
        ),
      ),
    /mutual friend/i,
  );

  const acceptedInvitationId = await asRole(
    db,
    'authenticated',
    ids.host,
    () =>
      scalar(
        db,
        'select public.noxa_invite_user_to_drive($1, $2, null)',
        [driveId, ids.participant],
      ),
  );
  const pendingInvitationId = await asRole(
    db,
    'authenticated',
    ids.host,
    () =>
      scalar(
        db,
        'select public.noxa_invite_user_to_drive($1, $2, null)',
        [driveId, ids.pending],
      ),
  );

  const preview = await asRole(db, 'authenticated', ids.participant, () =>
    db.query(
      'select * from public.noxa_get_drive_invitation_preview($1)',
      [acceptedInvitationId],
    ),
  );
  assert.equal(preview.rows.length, 1);
  assert.deepEqual(Object.keys(preview.rows[0]), [
    'drive_session_id',
    'title',
    'host_display_name',
    'scheduled_start_at',
    'route_distance_meters',
    'route_duration_seconds',
    'approximate_destination_label',
  ]);
  assert.equal(preview.rows[0].approximate_destination_label, 'Approximate destination');

  const pendingRawCounts = await asRole(
    db,
    'authenticated',
    ids.participant,
    async () => ({
      sessions: await scalar(
        db,
        'select count(*)::integer from public.drive_sessions where id = $1',
        [driveId],
      ),
      stops: await scalar(
        db,
        'select count(*)::integer from public.drive_stops where drive_session_id = $1',
        [driveId],
      ),
      participants: await scalar(
        db,
        'select count(*)::integer from public.drive_participants where drive_session_id = $1',
        [driveId],
      ),
    }),
  );
  assert.deepEqual(pendingRawCounts, { sessions: 0, stops: 0, participants: 0 });
  pass('pending invitation exposes only the limited preview RPC');

  const accepted = await asRole(db, 'authenticated', ids.participant, () =>
    scalar(
      db,
      'select public.noxa_respond_to_drive_invitation($1, true)',
      [acceptedInvitationId],
    ),
  );
  assert.equal(accepted, true);

  const acceptedRawCounts = await asRole(
    db,
    'authenticated',
    ids.participant,
    async () => ({
      sessions: await scalar(
        db,
        'select count(*)::integer from public.drive_sessions where id = $1',
        [driveId],
      ),
      stops: await scalar(
        db,
        'select count(*)::integer from public.drive_stops where drive_session_id = $1',
        [driveId],
      ),
      participants: await scalar(
        db,
        'select count(*)::integer from public.drive_participants where drive_session_id = $1',
        [driveId],
      ),
    }),
  );
  assert.deepEqual(acceptedRawCounts, { sessions: 1, stops: 2, participants: 2 });
  pass('accepted participant receives route and participant access');

  await expectError(
    'accepted participant cannot publish location before start',
    () =>
      asRole(db, 'authenticated', ids.participant, () =>
        db.query(
          `insert into public.drive_location_state
             (drive_session_id, user_id, latitude, longitude, status)
           values ($1, $2, 37.98, 23.72, 'stopped')`,
          [driveId, ids.participant],
        ),
      ),
    /row-level security/i,
  );

  const started = await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_start_drive($1)', [driveId]),
  );
  assert.equal(started, true);

  const lifecycle = await db.query(
    `select
       status,
       extract(epoch from (active_expires_at - started_at))::integer as active_seconds,
       (select count(*)::integer from public.drive_participants p
        where p.drive_session_id = drive_sessions.id and p.status = 'active') as active_participants,
       (select count(*)::integer from public.drive_invitations i
        where i.drive_session_id = drive_sessions.id and i.status = 'invited') as pending_invitations
     from public.drive_sessions
     where id = $1`,
    [driveId],
  );
  assert.deepEqual(lifecycle.rows, [
    {
      status: 'active',
      active_seconds: 28800,
      active_participants: 2,
      pending_invitations: 0,
    },
  ]);
  pass('start atomically activates participants, cancels pending, and sets 8h cap');

  const lateAccept = await asRole(db, 'authenticated', ids.pending, () =>
    scalar(
      db,
      'select public.noxa_respond_to_drive_invitation($1, true)',
      [pendingInvitationId],
    ),
  );
  assert.equal(lateAccept, false);
  const lateParticipantCount = await scalar(
    db,
    `select count(*)::integer from public.drive_participants
     where drive_session_id = $1 and user_id = $2`,
    [driveId, ids.pending],
  );
  assert.equal(lateParticipantCount, 0);
  pass('late acceptance is denied without creating a participant');

  await asRole(db, 'authenticated', ids.host, () =>
    db.query(
      `insert into public.drive_location_state
         (drive_session_id, user_id, latitude, longitude, status)
       values ($1, $2, 37.99, 23.73, 'moving')`,
      [driveId, ids.host],
    ),
  );
  await asRole(db, 'authenticated', ids.participant, () =>
    db.query(
      `insert into public.drive_location_state
         (drive_session_id, user_id, latitude, longitude, status, updated_at)
       values ($1, $2, 37.98, 23.72, 'moving', '2099-01-01')`,
      [driveId, ids.participant],
    ),
  );
  const locationState = await asRole(
    db,
    'authenticated',
    ids.participant,
    () =>
      db.query(
        `select user_id, updated_at < '2099-01-01'::timestamptz as server_owned_time
         from public.drive_location_state
         where drive_session_id = $1
         order by user_id`,
        [driveId],
      ),
  );
  assert.equal(locationState.rows.length, 2);
  assert.ok(locationState.rows.every((row) => row.server_owned_time === true));
  pass('active participants share one current row with server-owned timestamps');

  const forgedLocationUpdate = await asRole(
    db,
    'authenticated',
    ids.participant,
    () =>
      db.query(
        `update public.drive_location_state
         set latitude = 0
         where drive_session_id = $1 and user_id = $2`,
        [driveId, ids.host],
      ),
  );
  assert.equal(forgedLocationUpdate.affectedRows, 0);
  assert.equal(
    await scalar(
      db,
      `select latitude from public.drive_location_state
       where drive_session_id = $1 and user_id = $2`,
      [driveId, ids.host],
    ),
    37.99,
  );
  pass('participant cannot forge another participant location row');

  const outsiderLocationCount = await asRole(
    db,
    'authenticated',
    ids.outsider,
    () =>
      scalar(
        db,
        'select count(*)::integer from public.drive_location_state where drive_session_id = $1',
        [driveId],
      ),
  );
  assert.equal(outsiderLocationCount, 0);
  pass('unrelated account cannot read active Group Drive locations');

  await db.query(
    'insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)',
    [ids.host, ids.participant],
  );
  const blockedAccess = await asRole(
    db,
    'authenticated',
    ids.participant,
    async () => ({
      sessions: await scalar(
        db,
        'select count(*)::integer from public.drive_sessions where id = $1',
        [driveId],
      ),
      locations: await scalar(
        db,
        'select count(*)::integer from public.drive_location_state where drive_session_id = $1',
        [driveId],
      ),
    }),
  );
  assert.deepEqual(blockedAccess, { sessions: 0, locations: 0 });
  pass('bidirectional block immediately hides raw drive and location state');
  await db.query(
    'delete from public.user_blocks where blocker_id = $1 and blocked_id = $2',
    [ids.host, ids.participant],
  );

  const left = await asRole(db, 'authenticated', ids.participant, () =>
    scalar(db, 'select public.noxa_leave_drive($1)', [driveId]),
  );
  assert.equal(left, true);
  const leftLocationCount = await scalar(
    db,
    `select count(*)::integer from public.drive_location_state
     where drive_session_id = $1 and user_id = $2`,
    [driveId, ids.participant],
  );
  assert.equal(leftLocationCount, 0);
  const leftAccess = await asRole(
    db,
    'authenticated',
    ids.participant,
    async () => ({
      sessions: await scalar(
        db,
        'select count(*)::integer from public.drive_sessions where id = $1',
        [driveId],
      ),
      stops: await scalar(
        db,
        'select count(*)::integer from public.drive_stops where drive_session_id = $1',
        [driveId],
      ),
      participantRows: await scalar(
        db,
        'select count(*)::integer from public.drive_participants where drive_session_id = $1',
        [driveId],
      ),
    }),
  );
  assert.deepEqual(leftAccess, { sessions: 0, stops: 0, participantRows: 1 });
  pass('Leave deletes exact location and revokes raw access immediately');

  await expectError(
    'host cannot leave the active drive',
    () =>
      asRole(db, 'authenticated', ids.host, () =>
        scalar(db, 'select public.noxa_leave_drive($1)', [driveId]),
      ),
    /host must cancel or end/i,
  );

  const ended = await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_end_drive($1)', [driveId]),
  );
  assert.equal(ended, true);
  assert.equal(
    await scalar(
      db,
      'select count(*)::integer from public.drive_location_state where drive_session_id = $1',
      [driveId],
    ),
    0,
  );
  const summary = await asRole(db, 'authenticated', ids.participant, () =>
    db.query('select * from public.noxa_get_drive_summary($1)', [driveId]),
  );
  assert.equal(summary.rows.length, 1);
  assert.equal(summary.rows[0].session_status, 'completed');
  assert.equal(summary.rows[0].end_reason, 'host_completed');
  assert.ok(Array.isArray(summary.rows[0].participants));
  pass('End deletes all exact locations and leaves only limited summary access');

  const declineDriveId = await createDrive(db, 'Decline Test');
  const declinedInvitationId = await asRole(
    db,
    'authenticated',
    ids.host,
    () =>
      scalar(
        db,
        'select public.noxa_invite_user_to_drive($1, $2, null)',
        [declineDriveId, ids.participant],
      ),
  );
  const declined = await asRole(db, 'authenticated', ids.participant, () =>
    scalar(
      db,
      'select public.noxa_respond_to_drive_invitation($1, false)',
      [declinedInvitationId],
    ),
  );
  assert.equal(declined, true);
  assert.equal(
    await scalar(
      db,
      `select count(*)::integer from public.drive_participants
       where drive_session_id = $1 and user_id = $2`,
      [declineDriveId, ids.participant],
    ),
    0,
  );
  pass('declining an invitation never creates a participant row');

  await db.query(
    'insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)',
    [ids.host, ids.blocked],
  );
  const crewDriveId = await createDrive(db, 'Crew Snapshot');
  const crewInviteCount = await asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      'select public.noxa_invite_crew_to_drive($1, $2)',
      [crewDriveId, ids.crew],
    ),
  );
  assert.equal(crewInviteCount, 1);
  const crewRecipients = await db.query(
    `select invited_user_id, source_crew_id
     from public.drive_invitations
     where drive_session_id = $1`,
    [crewDriveId],
  );
  assert.deepEqual(crewRecipients.rows, [
    { invited_user_id: ids.pending, source_crew_id: ids.crew },
  ]);
  pass('Crew invite snapshots current members and excludes blocked users');

  await expectError(
    'blocked individual cannot be invited',
    () =>
      asRole(db, 'authenticated', ids.host, () =>
        scalar(
          db,
          'select public.noxa_invite_user_to_drive($1, $2, $3)',
          [crewDriveId, ids.blocked, ids.crew],
        ),
      ),
    /cannot be invited/i,
  );

  const cancelledBeforeStart = await asRole(
    db,
    'authenticated',
    ids.host,
    () => scalar(db, 'select public.noxa_cancel_drive($1)', [crewDriveId]),
  );
  assert.equal(cancelledBeforeStart, true);
  const preStartCancellation = await db.query(
    `select
       status,
       end_reason,
       (select count(*)::integer from public.drive_invitations i
        where i.drive_session_id = drive_sessions.id
          and i.status = 'invited') as invited_rows
     from public.drive_sessions
     where id = $1`,
    [crewDriveId],
  );
  assert.deepEqual(preStartCancellation.rows, [
    {
      status: 'cancelled',
      end_reason: 'host_cancelled',
      invited_rows: 0,
    },
  ]);
  pass('pre-start cancellation records reason and cancels invitations');

  await db.query(
    'delete from public.user_blocks where blocker_id = $1 and blocked_id = $2',
    [ids.host, ids.blocked],
  );

  const removalDriveId = await createDrive(db, 'Removal Test');
  await setRoute(db, removalDriveId);
  await inviteAndAccept(db, removalDriveId, ids.participant);
  await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_start_drive($1)', [removalDriveId]),
  );
  await asRole(db, 'authenticated', ids.participant, () =>
    db.query(
      `insert into public.drive_location_state
         (drive_session_id, user_id, latitude, longitude, status)
       values ($1, $2, 37.98, 23.72, 'moving')`,
      [removalDriveId, ids.participant],
    ),
  );
  const removed = await asRole(db, 'authenticated', ids.host, () =>
    scalar(
      db,
      'select public.noxa_remove_drive_participant($1, $2)',
      [removalDriveId, ids.participant],
    ),
  );
  assert.equal(removed, true);
  assert.equal(
    await scalar(
      db,
      `select count(*)::integer from public.drive_location_state
       where drive_session_id = $1 and user_id = $2`,
      [removalDriveId, ids.participant],
    ),
    0,
  );
  pass('host removal deletes the participant exact-location row atomically');

  await expectError(
    'host cannot remove the host participant row',
    () =>
      asRole(db, 'authenticated', ids.host, () =>
        scalar(
          db,
          'select public.noxa_remove_drive_participant($1, $2)',
          [removalDriveId, ids.host],
        ),
      ),
    /host cannot be removed/i,
  );

  await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_cancel_drive($1)', [removalDriveId]),
  );
  const cancelledSession = await db.query(
    'select status, end_reason from public.drive_sessions where id = $1',
    [removalDriveId],
  );
  assert.deepEqual(cancelledSession.rows, [
    { status: 'cancelled', end_reason: 'host_cancelled' },
  ]);
  pass('active cancellation records the terminal reason and clears locations');

  const expiringDriveId = await createDrive(db, 'Expiry Test');
  await setRoute(db, expiringDriveId);
  await inviteAndAccept(db, expiringDriveId, ids.participant);
  await asRole(db, 'authenticated', ids.host, () =>
    scalar(db, 'select public.noxa_start_drive($1)', [expiringDriveId]),
  );
  await asRole(db, 'authenticated', ids.host, () =>
    db.query(
      `insert into public.drive_location_state
         (drive_session_id, user_id, latitude, longitude, status)
       values ($1, $2, 37.99, 23.73, 'moving')`,
      [expiringDriveId, ids.host],
    ),
  );

  await db.exec(
    'alter table public.drive_sessions disable trigger drive_sessions_prepare_update',
  );
  await db.query(
    `update public.drive_sessions
     set
       started_at = now() - interval '9 hours',
       active_expires_at = now() - interval '1 hour'
     where id = $1`,
    [expiringDriveId],
  );
  await db.exec(
    'alter table public.drive_sessions enable trigger drive_sessions_prepare_update',
  );

  const expiredCount = await asRole(db, 'service_role', null, () =>
    scalar(db, 'select private.noxa_expire_group_drives()'),
  );
  assert.equal(expiredCount, 1);
  const expiryState = await db.query(
    `select status, end_reason,
       (select count(*)::integer from public.drive_location_state l
        where l.drive_session_id = drive_sessions.id) as location_rows
     from public.drive_sessions
     where id = $1`,
    [expiringDriveId],
  );
  assert.deepEqual(expiryState.rows, [
    { status: 'cancelled', end_reason: 'expired', location_rows: 0 },
  ]);
  pass('service-role expiry primitive terminates due sessions and deletes locations');

  await expectError(
    'authenticated clients cannot call the private expiry primitive',
    () =>
      asRole(db, 'authenticated', ids.host, () =>
        scalar(db, 'select private.noxa_expire_group_drives()'),
      ),
    /permission denied/i,
  );

  await db.exec(rollbackSql);
  const remainingGroupDriveTables = await scalar(
    db,
    `select count(*)::integer
     from pg_tables
     where schemaname = 'public'
       and tablename = any($1::text[])`,
    [expectedTables],
  );
  const remainingGroupDriveFunctions = await scalar(
    db,
    `select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where p.proname like 'noxa_%drive%'
       and n.nspname in ('public', 'private')`,
  );
  const preservedDependencies = await db.query(`
    select
      to_regclass('public.profiles') is not null as profiles,
      to_regclass('public.crews') is not null as crews,
      to_regclass('public.follows') is not null as follows,
      to_regclass('public.user_blocks') is not null as user_blocks,
      to_regprocedure('private.noxa_users_blocked(uuid,uuid)') is not null
        as blocking_helper
  `);
  assert.equal(remainingGroupDriveTables, 0);
  assert.equal(remainingGroupDriveFunctions, 0);
  assert.deepEqual(preservedDependencies.rows, [
    {
      profiles: true,
      crews: true,
      follows: true,
      user_blocks: true,
      blocking_helper: true,
    },
  ]);
  pass('documented rollback removes only Group Drive objects');

  console.log(`\nGroup Drive Phase 1 local database smoke: PASS (${checks} checks)`);
  console.log('Production and hosted Supabase were not contacted.');
} finally {
  await db.close();
}
