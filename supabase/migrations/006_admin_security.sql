-- Admin sign-in hardening: login lockout that survives serverless restarts,
-- one-time authenticator codes, and revocable server-side sessions.
-- Run once in the Supabase SQL editor, after 005. Until it is run the admin
-- area still works, but with reduced protection (the dashboard says so).
--
-- RLS is ON with no policies and the functions are callable only by the
-- service role, so nothing here is reachable from the app or a browser.

create table if not exists public.admin_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_login_state (
  scope        text primary key,          -- 'ip:<hash>' or 'global'
  fails        integer     not null default 0,
  level        integer     not null default 0,   -- how many lockouts in a row (lock time doubles per level)
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  id             uuid primary key,
  created_at     timestamptz not null default now(),
  last_seen      timestamptz not null default now(),
  expires_at     timestamptz not null,
  ip             text not null default '',
  last_ip        text not null default '',
  ua_hash        text not null,
  ua             text not null default '',
  revoked_at     timestamptz,
  revoked_reason text
);
create index if not exists admin_sessions_live_idx on public.admin_sessions (revoked_at, expires_at);

-- A code is accepted only if its 30-second step is NEWER than the last one used: a code that was
-- seen once (shoulder-surfing, a phishing page, logs) can't be replayed. Returns false on reuse.
create or replace function public.admin_use_totp_step(p_step bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  insert into public.admin_state (key, value) values ('totp_step', to_jsonb(p_step))
  on conflict (key) do update set value = to_jsonb(p_step), updated_at = now()
    where (public.admin_state.value #>> '{}')::bigint < p_step;
  get diagnostics changed = row_count;
  return changed > 0;
end $$;

-- Seconds left on a lockout (0 = not locked).
create or replace function public.admin_login_status(p_scope text) returns integer
language sql security definer set search_path = public as $$
  select coalesce((select greatest(0, ceil(extract(epoch from (locked_until - now())))::integer)
                   from public.admin_login_state where scope = p_scope), 0);
$$;

-- Records one failed attempt. After p_max failures within an hour the scope is locked for
-- p_base_seconds, doubling each time it is locked again (up to a day) when p_escalate is true.
create or replace function public.admin_login_fail(p_scope text, p_max integer, p_base_seconds integer, p_escalate boolean)
returns table (fails integer, locked_seconds integer, level integer)
language plpgsql security definer set search_path = public as $$
declare r public.admin_login_state%rowtype;
begin
  insert into public.admin_login_state (scope) values (p_scope) on conflict (scope) do nothing;
  select * into r from public.admin_login_state where scope = p_scope for update;
  if r.updated_at < now() - interval '1 hour' and (r.locked_until is null or r.locked_until < now()) then r.fails := 0; end if;
  if r.updated_at < now() - interval '24 hours' then r.level := 0; end if;
  r.fails := r.fails + 1;
  if r.fails >= p_max then
    r.level := r.level + 1;
    r.locked_until := now() + make_interval(secs => least(86400, p_base_seconds * (case when p_escalate then power(2, r.level - 1) else 1 end))::integer);
    r.fails := 0;
  end if;
  update public.admin_login_state set fails = r.fails, level = r.level, locked_until = r.locked_until, updated_at = now() where scope = p_scope;
  return query select r.fails, coalesce(greatest(0, ceil(extract(epoch from (r.locked_until - now())))::integer), 0), r.level;
end $$;

create or replace function public.admin_login_ok(p_scope text) returns void
language sql security definer set search_path = public as $$
  delete from public.admin_login_state where scope = p_scope;
$$;

alter table public.admin_state       enable row level security;
alter table public.admin_login_state enable row level security;
alter table public.admin_sessions    enable row level security;
-- (no policies on purpose)

revoke all on function public.admin_use_totp_step(bigint) from public, anon, authenticated;
revoke all on function public.admin_login_status(text) from public, anon, authenticated;
revoke all on function public.admin_login_fail(text, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.admin_login_ok(text) from public, anon, authenticated;
grant execute on function public.admin_use_totp_step(bigint) to service_role;
grant execute on function public.admin_login_status(text) to service_role;
grant execute on function public.admin_login_fail(text, integer, integer, boolean) to service_role;
grant execute on function public.admin_login_ok(text) to service_role;
