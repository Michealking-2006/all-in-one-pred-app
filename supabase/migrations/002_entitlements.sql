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
