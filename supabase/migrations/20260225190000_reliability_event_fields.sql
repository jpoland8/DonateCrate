alter table public.stripe_webhook_events
  add column if not exists processing_state text not null default 'received'
    check (processing_state in ('received', 'processed', 'failed')),
  add column if not exists processing_error text,
  add column if not exists handled_at timestamptz,
  add column if not exists correlation_id text;

create index if not exists stripe_webhook_events_processing_state_idx
  on public.stripe_webhook_events (processing_state);

create index if not exists stripe_webhook_events_correlation_id_idx
  on public.stripe_webhook_events (correlation_id);

alter table public.notification_events
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text,
  add column if not exists correlation_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notification_events_status_idx
  on public.notification_events (status);

create index if not exists notification_events_correlation_id_idx
  on public.notification_events (correlation_id);
