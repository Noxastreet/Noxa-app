-- Quick Connect: short-lived, one-time in-person friend pairing for Drive Together.
-- The session table is never directly readable by clients. Authenticated SECURITY
-- DEFINER RPCs expose only the owner preview for a presented token/code.

create table if not exists public.friend_connect_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  connect_token uuid not null default gen_random_uuid(),
  short_code text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  constraint friend_connect_sessions_owner_unique unique (owner_id),
  constraint friend_connect_sessions_token_unique unique (connect_token),
  constraint friend_connect_sessions_code_unique unique (short_code),
  constraint friend_connect_sessions_code_format check (short_code ~ '^[A-F0-9]{10}$'),
  constraint friend_connect_sessions_expiry check (expires_at > created_at)
);

create index if not exists friend_connect_sessions_expires_at_idx
  on public.friend_connect_sessions(expires_at);

alter table public.friend_connect_sessions enable row level security;

revoke all on table public.friend_connect_sessions from public, anon, authenticated;

comment on table public.friend_connect_sessions is
  'One-time, short-lived Quick Connect handshakes. Access is only through authenticated RPCs.';

create or replace function private.noxa_normalize_connect_code(raw_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(raw_value, ''), '[^A-Fa-f0-9]', '', 'g'));
$$;

revoke all on function private.noxa_normalize_connect_code(text)
  from public, anon, authenticated, service_role;

create or replace function public.noxa_create_friend_connect()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  next_token uuid;
  next_code text;
  session_id uuid;
  session_expires_at timestamptz;
  attempts integer := 0;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = actor
  ) then
    raise exception 'NOXA profile not found';
  end if;

  delete from public.friend_connect_sessions
  where owner_id = actor or expires_at <= now();

  loop
    attempts := attempts + 1;
    if attempts > 8 then
      raise exception 'Could not generate a Quick Connect code';
    end if;

    next_token := gen_random_uuid();
    next_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    begin
      insert into public.friend_connect_sessions (
        owner_id,
        connect_token,
        short_code,
        expires_at
      ) values (
        actor,
        next_token,
        next_code,
        now() + interval '5 minutes'
      )
      returning id, expires_at
      into session_id, session_expires_at;
      exit;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  return jsonb_build_object(
    'session_id', session_id,
    'token', next_token::text,
    'code', next_code,
    'expires_at', session_expires_at
  );
end;
$$;

revoke all on function public.noxa_create_friend_connect()
  from public, anon, authenticated;
grant execute on function public.noxa_create_friend_connect()
  to authenticated;

create or replace function public.noxa_revoke_friend_connect()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  deleted_count integer;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  delete from public.friend_connect_sessions
  where owner_id = actor;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.noxa_revoke_friend_connect()
  from public, anon, authenticated;
grant execute on function public.noxa_revoke_friend_connect()
  to authenticated;

create or replace function public.noxa_resolve_friend_connect(
  presented_value text
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  normalized_code text;
  parsed_token uuid;
  target_session public.friend_connect_sessions%rowtype;
  mutual boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  normalized_code := private.noxa_normalize_connect_code(presented_value);

  begin
    parsed_token := presented_value::uuid;
  exception
    when invalid_text_representation then
      parsed_token := null;
  end;

  select *
  into target_session
  from public.friend_connect_sessions
  where expires_at > now()
    and (
      (parsed_token is not null and connect_token = parsed_token)
      or (char_length(normalized_code) = 10 and short_code = normalized_code)
    )
  order by created_at desc
  limit 1;

  if target_session.id is null then
    return null;
  end if;

  if target_session.owner_id = actor then
    raise exception 'This is your own Quick Connect code';
  end if;

  if private.noxa_users_blocked(actor, target_session.owner_id) then
    raise exception 'This driver is unavailable';
  end if;

  mutual :=
    exists (
      select 1
      from public.follows
      where follower_id = actor
        and following_id = target_session.owner_id
    )
    and exists (
      select 1
      from public.follows
      where follower_id = target_session.owner_id
        and following_id = actor
    );

  return (
    select jsonb_build_object(
      'session_id', target_session.id,
      'user_id', profiles.id,
      'display_name', profiles.display_name,
      'username', profiles.username,
      'avatar_url', profiles.avatar_url,
      'already_friends', mutual,
      'expires_at', target_session.expires_at
    )
    from public.profiles
    where profiles.id = target_session.owner_id
  );
end;
$$;

revoke all on function public.noxa_resolve_friend_connect(text)
  from public, anon, authenticated;
grant execute on function public.noxa_resolve_friend_connect(text)
  to authenticated;

create or replace function public.noxa_redeem_friend_connect(
  target_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_session public.friend_connect_sessions%rowtype;
  owner_profile public.profiles%rowtype;
begin
  if actor is null or target_session_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_session
  from public.friend_connect_sessions
  where id = target_session_id
  for update;

  if target_session.id is null or target_session.expires_at <= now() then
    if target_session.id is not null then
      delete from public.friend_connect_sessions where id = target_session.id;
    end if;
    raise exception 'Quick Connect code expired';
  end if;

  if target_session.owner_id = actor then
    raise exception 'This is your own Quick Connect code';
  end if;

  if private.noxa_users_blocked(actor, target_session.owner_id) then
    raise exception 'This driver is unavailable';
  end if;

  select *
  into owner_profile
  from public.profiles
  where id = target_session.owner_id;

  if owner_profile.id is null then
    delete from public.friend_connect_sessions where id = target_session.id;
    raise exception 'NOXA profile not found';
  end if;

  insert into public.follows (follower_id, following_id)
  values
    (actor, target_session.owner_id),
    (target_session.owner_id, actor)
  on conflict (follower_id, following_id) do nothing;

  delete from public.friend_connect_sessions
  where id = target_session.id;

  return jsonb_build_object(
    'user_id', owner_profile.id,
    'display_name', owner_profile.display_name,
    'username', owner_profile.username,
    'avatar_url', owner_profile.avatar_url,
    'friends', true
  );
end;
$$;

revoke all on function public.noxa_redeem_friend_connect(uuid)
  from public, anon, authenticated;
grant execute on function public.noxa_redeem_friend_connect(uuid)
  to authenticated;
