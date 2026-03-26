alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('customer', 'admin', 'driver', 'partner_manager', 'partner_operator'));

create table if not exists public.nonprofit_partners (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  legal_name text,
  support_email text,
  support_phone text,
  active boolean not null default true,
  receipt_mode text not null default 'partner_issued'
    check (receipt_mode in ('partner_issued', 'platform_on_behalf', 'manual')),
  payout_model text not null default 'inventory_only'
    check (payout_model in ('inventory_only', 'revenue_share', 'hybrid')),
  platform_share_bps integer not null default 10000 check (platform_share_bps between 0 and 10000),
  partner_share_bps integer not null default 0 check (partner_share_bps between 0 and 10000),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nonprofit_partners_share_total_check
    check (platform_share_bps + partner_share_bps <= 10000)
);

create table if not exists public.partner_memberships (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.nonprofit_partners(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('partner_manager', 'partner_operator')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, user_id)
);

create table if not exists public.partner_branding (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.nonprofit_partners(id) on delete cascade,
  display_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  receipt_footer text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_domain_connections (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.nonprofit_partners(id) on delete cascade,
  domain text not null unique,
  subdomain text,
  status text not null default 'pending'
    check (status in ('pending', 'pending_dns', 'verified', 'failed', 'disabled')),
  verification_method text not null default 'dns'
    check (verification_method in ('dns', 'manual')),
  dns_record_name text,
  dns_record_type text,
  dns_record_value text,
  return_path_domain text,
  provider_account_ref text,
  email_from_name text,
  email_from_address text,
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_receipt_templates (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.nonprofit_partners(id) on delete cascade,
  subject_line text,
  preview_text text,
  hero_heading text,
  intro_text text,
  tax_statement text,
  signature_name text,
  signature_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_zones
  add column if not exists operation_model text not null default 'donatecrate_operated'
    check (operation_model in ('donatecrate_operated', 'partner_operated')),
  add column if not exists partner_id uuid references public.nonprofit_partners(id) on delete set null,
  add column if not exists partner_pickup_date_override_allowed boolean not null default false,
  add column if not exists partner_notes text;

alter table public.pickup_cycles
  add column if not exists scheduled_by_partner_id uuid references public.nonprofit_partners(id) on delete set null,
  add column if not exists pickup_window_label text;

alter table public.routes
  add column if not exists partner_id uuid references public.nonprofit_partners(id) on delete set null,
  add column if not exists fulfillment_mode text not null default 'employee_driver'
    check (fulfillment_mode in ('employee_driver', 'partner_team')),
  add column if not exists partner_visible boolean not null default false;

create index if not exists idx_partner_memberships_user_id on public.partner_memberships(user_id);
create index if not exists idx_service_zones_partner_id on public.service_zones(partner_id);
create index if not exists idx_routes_partner_id on public.routes(partner_id);

update public.service_zones
set operation_model = 'partner_operated'
where partner_id is not null
  and operation_model = 'donatecrate_operated';

alter table public.nonprofit_partners enable row level security;
alter table public.partner_memberships enable row level security;
alter table public.partner_branding enable row level security;
alter table public.partner_domain_connections enable row level security;
alter table public.partner_receipt_templates enable row level security;

create or replace function public.is_partner_member(target_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_memberships pm
    join public.users u on u.id = pm.user_id
    where pm.partner_id = target_partner_id
      and pm.active = true
      and u.auth_user_id = auth.uid()
  );
$$;

drop policy if exists "nonprofit_partners_admin_or_member_read" on public.nonprofit_partners;
create policy "nonprofit_partners_admin_or_member_read"
on public.nonprofit_partners for select
to authenticated
using (public.is_admin() or public.is_partner_member(id));

drop policy if exists "nonprofit_partners_admin_write" on public.nonprofit_partners;
create policy "nonprofit_partners_admin_write"
on public.nonprofit_partners for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "partner_memberships_admin_or_self_read" on public.partner_memberships;
create policy "partner_memberships_admin_or_self_read"
on public.partner_memberships for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.users u
    where u.id = partner_memberships.user_id
      and u.auth_user_id = auth.uid()
  )
  or public.is_partner_member(partner_id)
);

drop policy if exists "partner_memberships_admin_write" on public.partner_memberships;
create policy "partner_memberships_admin_write"
on public.partner_memberships for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "partner_branding_admin_or_member_read" on public.partner_branding;
create policy "partner_branding_admin_or_member_read"
on public.partner_branding for select
to authenticated
using (public.is_admin() or public.is_partner_member(partner_id));

drop policy if exists "partner_branding_admin_write" on public.partner_branding;
create policy "partner_branding_admin_write"
on public.partner_branding for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "partner_domain_connections_admin_or_member_read" on public.partner_domain_connections;
create policy "partner_domain_connections_admin_or_member_read"
on public.partner_domain_connections for select
to authenticated
using (public.is_admin() or public.is_partner_member(partner_id));

drop policy if exists "partner_domain_connections_admin_write" on public.partner_domain_connections;
create policy "partner_domain_connections_admin_write"
on public.partner_domain_connections for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "partner_receipt_templates_admin_or_member_read" on public.partner_receipt_templates;
create policy "partner_receipt_templates_admin_or_member_read"
on public.partner_receipt_templates for select
to authenticated
using (public.is_admin() or public.is_partner_member(partner_id));

drop policy if exists "partner_receipt_templates_admin_write" on public.partner_receipt_templates;
create policy "partner_receipt_templates_admin_write"
on public.partner_receipt_templates for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
