create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  lat double precision,
  lng double precision,
  referral_code text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'converted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, postal_code)
);

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text unique not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb not null
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  route text not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.waitlist_entries enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.api_audit_log enable row level security;

drop policy if exists "waitlist_admin_read_write" on public.waitlist_entries;
create policy "waitlist_admin_read_write"
on public.waitlist_entries for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "waitlist_insert_public" on public.waitlist_entries;
create policy "waitlist_insert_public"
on public.waitlist_entries for insert
to anon, authenticated
with check (true);

drop policy if exists "stripe_events_admin_read_write" on public.stripe_webhook_events;
create policy "stripe_events_admin_read_write"
on public.stripe_webhook_events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "notification_prefs_owner_or_admin_all" on public.notification_preferences;
create policy "notification_prefs_owner_or_admin_all"
on public.notification_preferences for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = notification_preferences.user_id and u.auth_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = notification_preferences.user_id and u.auth_user_id = auth.uid()
  )
);

drop policy if exists "api_audit_admin_read_write" on public.api_audit_log;
create policy "api_audit_admin_read_write"
on public.api_audit_log for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

update public.service_zones
set center_lat = coalesce(center_lat, 35.8736),
    center_lng = coalesce(center_lng, -84.1764),
    updated_at = now()
where code = 'knoxville-37922';
