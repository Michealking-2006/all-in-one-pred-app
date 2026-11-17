-- Followed-player alerts: which players a device follows (as { "playerId": clubId }), and which events of a live match
-- have already been looked at, so each goal / assist / card is announced once.
-- Run once in the Supabase SQL editor. Until it is run, followed-player alerts stay off and everything else is unchanged.
alter table public.push_subscriptions add column if not exists players jsonb not null default '{}'::jsonb;
alter table public.push_fixture_state add column if not exists event_keys text[];
