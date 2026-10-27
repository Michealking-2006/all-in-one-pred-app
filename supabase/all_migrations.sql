-- Scoutwave: ALL database migrations in one script (001 to 007), in order.
--
-- Safe to run more than once, and safe if some of them were run before: every statement is "if not exists" or
-- "create or replace", so nothing is dropped or overwritten and no data is touched.
--
-- How to run it: open the Supabase project that your app uses (the one in your SUPABASE_URL), then
-- SQL Editor > New query > paste this whole file > Run. The last query lists anything still missing (it should
-- return no rows). Run it on the project whose address matches SUPABASE_URL in Vercel and in src/api/supabase.js.


-- ======================================================================
-- 001_admin.sql
-- ======================================================================

-- Scoutwave admin dashboard (/mingt-t): storage for remote config, the support
-- inbox and the audit log. Run this once in the Supabase SQL editor.
--
-- Row Level Security is ON and there are deliberately NO policies: the browser
-- (publishable key) can read and write nothing here. Only the server functions
-- (api/mingt.js, api/config.js, api/feedback.js) touch these tables, using the
-- service-role key, which bypasses RLS and must never be shipped to the client.

create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind       text not null default 'contact',
  category   text,
  message    text not null,
  email      text,
  name       text,
  rating     smallint,
  app_version text,
  page       text,
  user_agent text,
  status     text not null default 'new' check (status in ('new','read','resolved')),
  note       text
);
create index if not exists support_messages_status_idx on public.support_messages (status, created_at desc);

create table if not exists public.admin_audit (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  actor  text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  ip     text
);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);

alter table public.app_config        enable row level security;
alter table public.support_messages  enable row level security;
alter table public.admin_audit       enable row level security;
-- (no policies on purpose)


-- ======================================================================
-- 002_entitlements.sql
-- ======================================================================

-- Premium and coins that follow the account (instead of living only on one
-- phone), managed from the admin dashboard (/mingt-t) and spent through the
-- server. Run once in the Supabase SQL editor, after 001_admin.sql.
--
-- RLS is ON with no policies: the browser can read and write nothing here.
-- Only the server functions (api/me.js, api/spend.js, api/mingt.js) touch it,
-- using the service-role key.

create table if not exists public.entitlements (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  is_vip          boolean     not null default false,
  vip_until       timestamptz,                       -- null while is_vip = true means "no end date"
  coins           integer     not null default 8 check (coins >= 0),
  unlocked_themes text[]      not null default '{}',
  unlocked_tips   bigint[]    not null default '{}',
  version         bigint      not null default 0,    -- optimistic concurrency: a write only lands if nobody else wrote first
  updated_at      timestamptz not null default now()
);

-- Every coin movement, so a balance can always be explained.
create table if not exists public.coin_ledger (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  delta         integer     not null,
  reason        text        not null,
  balance_after integer     not null,
  actor         text        not null default 'system'
);
create index if not exists coin_ledger_user_idx on public.coin_ledger (user_id, at desc);

alter table public.entitlements enable row level security;
alter table public.coin_ledger  enable row level security;
-- (no policies on purpose)


-- ======================================================================
-- 003_payments.sql
-- ======================================================================

-- Payments (Polar): one row per paid order, so a webhook that Polar sends twice
-- (or retries) can never grant Premium or coins twice. Run once in the Supabase
-- SQL editor, after 002_entitlements.sql.
--
-- RLS is ON with no policies: only the server (service-role key) touches it.

create table if not exists public.payment_events (
  order_id    text primary key,                      -- Polar order id: the idempotency key
  at          timestamptz not null default now(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  product_id  text        not null,
  item        text        not null,                  -- e.g. premium:1m, coins:50
  grant_days  integer     not null default 0,
  grant_coins integer     not null default 0,
  refunded_at timestamptz
);
create index if not exists payment_events_user_idx on public.payment_events (user_id, at desc);

alter table public.payment_events enable row level security;
-- (no policies on purpose)


-- ======================================================================
-- 004_predictions.sql
-- ======================================================================

-- Server-side predictions: one row per fixture and model version, written by a
-- scheduled job BEFORE kick-off and graded after the match, so accuracy covers
-- every tracked match (not just ones a user opened). Also holds benchmark
-- predictions (bookmaker odds, and Forebet entered by hand) for comparison.
-- Run once in the Supabase SQL editor, after 003_payments.sql.
--
-- RLS is ON with no policies: only the server (service-role key) touches these.

create table if not exists public.predictions (
  fixture_id  bigint      not null,
  model       text        not null,                 -- e.g. poisson-v1: old and new models are graded separately
  made_at     timestamptz not null default now(),   -- always earlier than kickoff (the job enforces it)
  kickoff     timestamptz not null,
  league_id   integer     not null,
  league_name text        not null default '',
  season      integer     not null,
  home_id     integer     not null,
  home_name   text        not null default '',
  away_id     integer     not null,
  away_name   text        not null default '',
  prediction  jsonb       not null,                 -- what the app shows (same shape as the in-app model)
  matrix      jsonb,                                -- 9x9 score probability matrix (home goals x away goals)
  probs       jsonb       not null,                 -- unrounded probabilities used for scoring: home, draw, away, over25, btts
  inputs      jsonb       not null default '{}',    -- snapshot of what the model saw (for later retraining / backtests)
  analysis    jsonb,                                -- market comparison (edge vs bookmaker). Admin only, never sent to the app
  note        text,                                 -- optional plain-language explanation (OpenAI), never changes the numbers
  status      text        not null default 'pending' check (status in ('pending','graded','void')),
  home_goals  integer,
  away_goals  integer,
  graded_at   timestamptz,
  grade       jsonb,
  primary key (fixture_id, model)
);
create index if not exists predictions_kickoff_idx on public.predictions (kickoff desc);
create index if not exists predictions_status_idx  on public.predictions (status, kickoff);

-- Other sources for the same matches: 'market' (no-vig bookmaker probabilities)
-- and 'forebet' (typed in from their public page, before kick-off).
create table if not exists public.prediction_benchmarks (
  fixture_id bigint      not null,
  source     text        not null check (source in ('market','forebet')),
  made_at    timestamptz not null default now(),
  late       boolean     not null default false,   -- recorded after kick-off: kept for the record, excluded from comparisons
  probs      jsonb,                                -- { home, draw, away, over25?, btts? } as fractions 0..1, any may be missing
  top_scores jsonb,                                -- ["2-1","1-0",...] best first
  odds       jsonb,                                -- raw decimal odds the market probabilities came from
  primary key (fixture_id, source)
);

alter table public.predictions           enable row level security;
alter table public.prediction_benchmarks enable row level security;
-- (no policies on purpose)


-- ======================================================================
-- 005_usage_and_push.sql
-- ======================================================================

-- Usage charts (football API calls per day, cache hit rates) and push
-- notifications (devices that asked for alerts, and the last state of each
-- match being watched). Run once in the Supabase SQL editor, after 004.
--
-- RLS is ON with no policies: only the server (service-role key) touches these.

-- ---------------------------------------------------------------- usage
create table if not exists public.usage_daily (
  day      date    not null,
  source   text    not null,            -- proxy (the app via api/football.js), cron (prediction jobs), push (alert job; "sent"/"failed" count messages)
  endpoint text    not null,
  calls    integer not null default 0,
  errors   integer not null default 0,
  primary key (day, source, endpoint)
);

-- What the apps report about their own caches (counts only, no user data).
create table if not exists public.client_cache_daily (
  day     date primary key,
  memory  bigint not null default 0,    -- answered from memory
  stored  bigint not null default 0,    -- answered from the copy saved on the device
  network bigint not null default 0,    -- had to ask the server
  reports integer not null default 0
);

create or replace function public.bump_usage(p_day date, p_source text, p_endpoint text, p_calls integer, p_errors integer)
returns void language sql security definer set search_path = public as $$
  insert into public.usage_daily (day, source, endpoint, calls, errors) values (p_day, p_source, p_endpoint, p_calls, p_errors)
  on conflict (day, source, endpoint) do update set calls = usage_daily.calls + excluded.calls, errors = usage_daily.errors + excluded.errors;
$$;

create or replace function public.bump_client_cache(p_day date, p_memory bigint, p_stored bigint, p_network bigint)
returns void language sql security definer set search_path = public as $$
  insert into public.client_cache_daily (day, memory, stored, network, reports) values (p_day, p_memory, p_stored, p_network, 1)
  on conflict (day) do update set memory = client_cache_daily.memory + excluded.memory, stored = client_cache_daily.stored + excluded.stored,
    network = client_cache_daily.network + excluded.network, reports = client_cache_daily.reports + 1;
$$;

revoke all on function public.bump_usage(date, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.bump_client_cache(date, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.bump_usage(date, text, text, integer, integer) to service_role;
grant execute on function public.bump_client_cache(date, bigint, bigint, bigint) to service_role;

-- ---------------------------------------------------------------- push
create table if not exists public.push_subscriptions (
  endpoint    text primary key,                         -- the device's push address (a secret URL)
  user_id     uuid references auth.users(id) on delete cascade,
  p256dh      text   not null,
  auth        text   not null,
  prefs       jsonb  not null default '{}',             -- { goals, kickoff, whistles }
  fixtures    bigint[] not null default '{}',           -- starred matches
  teams       bigint[] not null default '{}',           -- starred clubs
  fail_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Last seen state of each watched match, so only CHANGES produce an alert.
create table if not exists public.push_fixture_state (
  fixture_id  bigint primary key,
  live        boolean not null default true,
  status      text    not null default '',
  goals_home  integer not null default 0,
  goals_away  integer not null default 0,
  home_id     integer, away_id integer,
  home_name   text    not null default '',
  away_name   text    not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.usage_daily          enable row level security;
alter table public.client_cache_daily   enable row level security;
alter table public.push_subscriptions   enable row level security;
alter table public.push_fixture_state   enable row level security;
-- (no policies on purpose)


-- ======================================================================
-- 006_admin_security.sql
-- ======================================================================

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


-- ======================================================================
-- 007_placement_stats.sql
-- ======================================================================

-- Placement analytics: how often each ad / promotion space was seen and tapped, per day and campaign.
-- Counts only: no user, device or address is stored. Run once in the Supabase SQL editor, after 006.
--
-- RLS is ON with no policies and the function is callable only by the service role.

create table if not exists public.placement_stats (
  day      date    not null,
  slot     text    not null,
  campaign text    not null,            -- 8 hex characters, changes when the headline or link changes
  event    text    not null check (event in ('view','click')),
  n        integer not null default 0,
  primary key (day, slot, campaign, event)
);

create or replace function public.bump_placement(p_day date, p_slot text, p_campaign text, p_event text, p_n integer)
returns void language sql security definer set search_path = public as $$
  insert into public.placement_stats (day, slot, campaign, event, n) values (p_day, p_slot, p_campaign, p_event, p_n)
  on conflict (day, slot, campaign, event) do update set n = placement_stats.n + excluded.n;
$$;

alter table public.placement_stats enable row level security;
-- (no policies on purpose)

revoke all on function public.bump_placement(date, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.bump_placement(date, text, text, text, integer) to service_role;


-- ======================================================================
-- Check: anything listed here is still missing. No rows = everything is in place.
-- ======================================================================
select 'table' as kind, t as missing from unnest(array['admin_audit', 'admin_login_state', 'admin_sessions', 'admin_state', 'app_config', 'client_cache_daily', 'coin_ledger', 'entitlements', 'payment_events', 'placement_stats', 'prediction_benchmarks', 'predictions', 'push_fixture_state', 'push_subscriptions', 'support_messages', 'usage_daily']) as t
  where not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t)
union all
select 'function', f from unnest(array['admin_login_fail', 'admin_login_ok', 'admin_login_status', 'admin_use_totp_step', 'bump_client_cache', 'bump_placement', 'bump_usage']) as f
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f)
union all
select 'row level security off', c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname = any(array['admin_audit', 'admin_login_state', 'admin_sessions', 'admin_state', 'app_config', 'client_cache_daily', 'coin_ledger', 'entitlements', 'payment_events', 'placement_stats', 'prediction_benchmarks', 'predictions', 'push_fixture_state', 'push_subscriptions', 'support_messages', 'usage_daily']) and not c.relrowsecurity;
-- Shared snapshot cache for the scheduled jobs: a season's league table and finished matches are fetched
-- once and reused by later runs (cron, "Record predictions now", other models) instead of paying the football
-- API again. Optional: the jobs work without it (they just fetch every time).
-- Run once in the Supabase SQL editor. RLS is ON with no policies: only the server (service-role key) touches it.
create table if not exists public.api_cache (
  key        text        primary key,
  data       jsonb       not null,
  fetched_at timestamptz not null default now()
);
alter table public.api_cache enable row level security;
