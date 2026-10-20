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
