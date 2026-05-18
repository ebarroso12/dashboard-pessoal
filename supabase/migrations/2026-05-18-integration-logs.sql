-- Migration: integration_logs
-- Rodar via Supabase SQL Editor antes do deploy

create table if not exists integration_logs (
  id          uuid         primary key default gen_random_uuid(),
  app         text         not null,
  action      text         not null,
  status      text         not null check (status in ('success', 'error', 'timeout')),
  latency_ms  integer,
  error_msg   text,
  created_at  timestamptz  default now()
);

create index if not exists integration_logs_app_ts
  on integration_logs (app, created_at desc);

-- TTL: adicionar ao cron.js existente:
-- await adminFetch('/integration_logs?created_at=lt.' + cutoff, { method: 'DELETE' });
