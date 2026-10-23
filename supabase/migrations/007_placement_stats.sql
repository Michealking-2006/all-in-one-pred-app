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
