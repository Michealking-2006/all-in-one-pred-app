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
