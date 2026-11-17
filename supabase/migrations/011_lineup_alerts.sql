-- Lineup alerts: remember which matches already had their "lineups are in" push, so it is sent once per match.
-- Run once in the Supabase SQL editor. Until it is run, lineup alerts stay off (everything else works as before).
alter table public.push_fixture_state add column if not exists lineup_sent boolean not null default false;
