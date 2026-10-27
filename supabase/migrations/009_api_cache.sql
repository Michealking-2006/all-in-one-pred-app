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
