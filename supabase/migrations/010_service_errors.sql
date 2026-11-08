-- Why things fail, for the admin only. Every time a service we depend on (the football data provider, the news
-- provider, the AI note writer) refuses or fails a request, the server saves the REAL reason here, one row per
-- day / service / kind / endpoint. The app shows people a plain "try again" message; this table is where the
-- admin panel (Monitor > Errors) reads the truth, e.g. "account suspended" or "daily limit reached".
-- Run once in the Supabase SQL editor. RLS is ON with no policies: only the server (service-role key) touches it.
create table if not exists public.service_errors (
  day        date        not null,
  source     text        not null,   -- football | news | predict | ai
  kind       text        not null,   -- banned | key | plan | quota | rate | network | config | other
  endpoint   text        not null,
  reason     text        not null,   -- the provider's own words, newest occurrence (admin only)
  status     integer,                -- HTTP status the provider answered with, when there was one
  count      integer     not null default 0,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  primary key (day, source, kind, endpoint)
);
create index if not exists service_errors_last_idx on public.service_errors (last_at desc);
alter table public.service_errors enable row level security;

create or replace function public.bump_service_error(p_day date, p_source text, p_kind text, p_endpoint text, p_reason text, p_status integer)
returns void language sql security definer set search_path = public as $$
  insert into public.service_errors (day, source, kind, endpoint, reason, status, count)
  values (p_day, p_source, p_kind, p_endpoint, left(p_reason, 400), p_status, 1)
  on conflict (day, source, kind, endpoint) do update
    set count = service_errors.count + 1, reason = excluded.reason, status = excluded.status, last_at = now();
$$;
revoke all on function public.bump_service_error(date, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.bump_service_error(date, text, text, text, text, integer) to service_role;
