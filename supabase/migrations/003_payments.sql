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
