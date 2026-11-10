import assert from 'node:assert/strict';
import fs from 'node:fs';

function definition(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf(`create or replace function private.${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('$$;', start) + 3);
}

export function driverBroadcastFixtureSql({ realRealtime = false } = {}) {
  const migrations = fs.readdirSync('supabase/migrations').filter((name) => name.endsWith('_authorize_driver_broadcast_per_message.sql'));
  assert.equal(migrations.length, 1);
  const authSql = realRealtime ? `
    create schema if not exists private;
    grant usage on schema private to authenticated;
  ` : `
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema private; create schema realtime;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    grant usage on schema auth, private, realtime to authenticated, anon;
  `;
  const transportSql = realRealtime ? `
    grant select,insert on realtime.messages to authenticated;
    alter table public.follows enable row level security;
    alter table public.user_blocks enable row level security;
    alter table public.crew_members enable row level security;
    grant all on public.driver_locations,public.follows,public.user_blocks,public.crew_members to service_role;
  ` : `
    create table realtime.messages (extension text,private boolean,event text,payload jsonb);
    alter table realtime.messages enable row level security;
    grant insert,select on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as $$
      select current_setting('realtime.topic',true);
    $$;
    -- Capture stub for SQL tests only; never replace the real Supabase transport.
    create table public.test_sent (id serial primary key,payload jsonb,event text,topic text,private boolean);
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$
      insert into public.test_sent(payload,event,topic,private) values ($1,$2,$3,$4);
    $$;
  `;
  return [
    authSql,
    `
    create table public.driver_locations (
      user_id uuid primary key, latitude float8, longitude float8, heading float8,
      speed_mps float8, accuracy_meters float8, visibility_mode text,
      share_started_at timestamptz, share_expires_at timestamptz, updated_at timestamptz
    );
    alter table public.driver_locations enable row level security;
    -- No client table privileges: the actor-bound private function is the only send route.
    create table public.follows (follower_id uuid,following_id uuid);
    create table public.user_blocks (blocker_id uuid,blocked_id uuid);
    create table public.crew_members (crew_id uuid,user_id uuid);
  `,
    transportSql,
    definition('supabase/migrations/20260718103233_add_live_drive_background_sharing.sql', 'noxa_can_view_driver_location'),
    definition('supabase/migrations/20260715131402_add_moderation_and_blocks.sql', 'noxa_users_blocked'),
    fs.readFileSync('supabase/migrations/20261007112000_add_private_driver_broadcast.sql', 'utf8'),
    fs.readFileSync(`supabase/migrations/${migrations[0]}`, 'utf8'),
    realRealtime ? "notify pgrst, 'reload schema';" : '',
  ].join('\n');
}
