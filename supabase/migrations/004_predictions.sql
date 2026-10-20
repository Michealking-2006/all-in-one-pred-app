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
