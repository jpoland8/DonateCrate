create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text unique not null,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin', 'driver')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.service_zones (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  anchor_postal_code text not null,
  center_lat double precision,
  center_lng double precision,
  radius_miles numeric(5,2) not null default 3.00,
  min_active_subscribers integer not null default 40,
  status text not null default 'active' check (status in ('pending', 'launching', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zone_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  zone_id uuid not null references public.service_zones(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'waitlist', 'inactive')),
  created_at timestamptz not null default now(),
  unique (user_id, zone_id)
);

create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.service_zones(id) on delete set null,
  name text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  stripe_price_id text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pricing_plan_id uuid references public.pricing_plans(id) on delete set null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pickup_cycles (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.service_zones(id) on delete cascade,
  cycle_month date not null,
  pickup_date date not null,
  request_cutoff_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (zone_id, cycle_month)
);

create table if not exists public.pickup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pickup_cycle_id uuid not null references public.pickup_cycles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'skipped', 'confirmed', 'picked_up', 'not_ready', 'missed')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pickup_cycle_id)
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete cascade,
  employee_id text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.service_zones(id) on delete cascade,
  pickup_cycle_id uuid not null references public.pickup_cycles(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'assigned', 'in_progress', 'completed', 'canceled')),
  created_at timestamptz not null default now()
);

create table if not exists public.pickup_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  pickup_request_id uuid not null references public.pickup_requests(id) on delete cascade,
  stop_order integer not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'picked_up', 'not_ready', 'no_access', 'rescheduled')),
  completed_at timestamptz,
  proof_photo_url text,
  unique (route_id, stop_order)
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.users(id) on delete cascade,
  referred_user_id uuid references public.users(id) on delete set null,
  referral_code text unique not null,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'credited', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.credits_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  event_type text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  provider_message_id text,
  created_at timestamptz not null default now()
);

insert into public.service_zones (code, name, anchor_postal_code, radius_miles, min_active_subscribers, status)
values ('knoxville-37922', 'Knoxville 37922', '37922', 3.00, 40, 'active')
on conflict (code) do nothing;

insert into public.pricing_plans (name, amount_cents, currency, active)
values ('Launch Monthly', 500, 'usd', true)
on conflict do nothing;
