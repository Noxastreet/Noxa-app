\set ON_ERROR_STOP on

-- Isolated PostgreSQL fixture for the exact proposed migration.
-- Synthetic users only. Never connects to the production Supabase database.
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE TABLE public.drive_sessions (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  active_expires_at timestamptz NOT NULL
);
CREATE TABLE public.drive_participants (
  drive_session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL
);
CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL
);
CREATE TABLE public.drive_location_state (
  id uuid PRIMARY KEY,
  drive_session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE FUNCTION private.noxa_is_active_drive_participant(target_drive_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.drive_sessions ds
      JOIN public.drive_participants dp ON dp.drive_session_id = ds.id
      WHERE ds.id = target_drive_session_id
        AND ds.status = 'active'
        AND ds.active_expires_at > now()
        AND dp.user_id = (SELECT auth.uid())
        AND dp.status = 'active'
    );
$$;

CREATE FUNCTION private.noxa_users_blocked(first_user_id uuid, second_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = first_user_id AND blocked_id = second_user_id)
       OR (blocker_id = second_user_id AND blocked_id = first_user_id)
  );
$$;

GRANT USAGE ON SCHEMA public, auth, private TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION private.noxa_is_active_drive_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.noxa_users_blocked(uuid,uuid) TO authenticated;
GRANT SELECT ON public.drive_location_state TO authenticated;
ALTER TABLE public.drive_location_state ENABLE ROW LEVEL SECURITY;

-- Mirror the pre-existing policies verified in the live NOXA project.
CREATE POLICY drive_location_state_select_active_members
ON public.drive_location_state FOR SELECT TO authenticated
USING (private.noxa_is_active_drive_participant(drive_session_id));

CREATE POLICY drive_location_state_blocks_hide
ON public.drive_location_state AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid())
  OR NOT private.noxa_users_blocked((SELECT auth.uid()), user_id));

-- Apply the actual PR migration to the isolated DB (no reimplementation).
\i supabase/migrations/20261023181500_expire_stale_group_drive_location_reads.sql

-- Prove that a RESTRICTIVE policy is installed, not a permissive OR bypass.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drive_location_state'
      AND policyname = 'drive_location_state_fresh_for_viewers'
      AND permissive = 'RESTRICTIVE'
      AND cmd = 'SELECT'
  ) THEN RAISE EXCEPTION 'No restrictive freshness policy'; END IF;
END;
$$;

-- Drive members: A, B, C, D. O is an outsider.
INSERT INTO public.drive_sessions VALUES
('11111111-1111-4111-8111-111111111111','active',now() + interval '1 hour');
INSERT INTO public.drive_participants VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active'),
('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active'),
('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','active'),
('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','active');
INSERT INTO public.user_blocks VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO public.drive_location_state VALUES
('10101010-1010-4010-8010-101010101010','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()-interval '5 minutes'),
('20202020-2020-4020-8020-202020202020','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now()-interval '10 seconds'),
('30303030-3030-4030-8030-303030303030','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',now()-interval '10 seconds'),
('40404040-4040-4040-8040-404040404040','11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd',now()-interval '5 minutes');

-- Viewer A: stale *own* position + fresh B; blocked C and stale D hidden.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $$
DECLARE shown uuid[];
BEGIN
  SELECT array_agg(user_id ORDER BY user_id) INTO shown FROM public.drive_location_state;
  IF shown IS DISTINCT FROM ARRAY[
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
  ] THEN RAISE EXCEPTION 'Viewer A unexpected visibility'; END IF;
END;
$$;

-- Outsider is authenticated, but has no active Drive Together membership.
SELECT set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.drive_location_state) <> 0
  THEN RAISE EXCEPTION 'Outsider can read Drive Together positions'; END IF;
END;
$$;

-- Viewer B: B recent + C recent; stale A and stale D hidden.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $$
DECLARE shown uuid[];
BEGIN
  SELECT array_agg(user_id ORDER BY user_id) INTO shown FROM public.drive_location_state;
  IF shown IS DISTINCT FROM ARRAY[
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
  ] THEN RAISE EXCEPTION 'Viewer B unexpected visibility'; END IF;
END;
$$;
RESET ROLE;

-- Blocking B mid-session must hide B from A even while B's row is fresh.
INSERT INTO public.user_blocks VALUES
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $$
DECLARE shown uuid[];
BEGIN
  SELECT array_agg(user_id ORDER BY user_id) INTO shown FROM public.drive_location_state;
  IF shown IS DISTINCT FROM ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid]
  THEN RAISE EXCEPTION 'Blocked viewer retained position access'; END IF;
END;
$$;
RESET ROLE;

-- Anonymous role does not have read permission at all.
DO $$
BEGIN
  IF has_table_privilege('anon','public.drive_location_state','SELECT')
  THEN RAISE EXCEPTION 'Anonymous access unexpectedly granted'; END IF;
END;
$$;

\echo 'NOXA isolated Group Drive SQL RLS tests: PASS'
