create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'customer'
  )
  on conflict (auth_user_id) do update
    set email = excluded.email,
        full_name = case
          when excluded.full_name = '' then public.users.full_name
          else excluded.full_name
        end,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role = 'admin'
  );
$$;

alter table public.users enable row level security;
alter table public.addresses enable row level security;
alter table public.service_zones enable row level security;
alter table public.zone_memberships enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.pickup_cycles enable row level security;
alter table public.pickup_requests enable row level security;
alter table public.drivers enable row level security;
alter table public.routes enable row level security;
alter table public.pickup_stops enable row level security;
alter table public.referrals enable row level security;
alter table public.credits_ledger enable row level security;
alter table public.notification_events enable row level security;

drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin"
on public.users for select
to authenticated
using (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists "users_update_self_or_admin" on public.users;
create policy "users_update_self_or_admin"
on public.users for update
to authenticated
using (auth_user_id = auth.uid() or public.is_admin())
with check (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists "addresses_owner_or_admin_all" on public.addresses;
create policy "addresses_owner_or_admin_all"
on public.addresses for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = addresses.user_id and u.auth_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = addresses.user_id and u.auth_user_id = auth.uid()
  )
);

drop policy if exists "service_zones_read_authenticated" on public.service_zones;
create policy "service_zones_read_authenticated"
on public.service_zones for select
to authenticated
using (true);

drop policy if exists "service_zones_admin_write" on public.service_zones;
create policy "service_zones_admin_write"
on public.service_zones for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "pricing_plans_read_authenticated" on public.pricing_plans;
create policy "pricing_plans_read_authenticated"
on public.pricing_plans for select
to authenticated
using (true);

drop policy if exists "pricing_plans_admin_write" on public.pricing_plans;
create policy "pricing_plans_admin_write"
on public.pricing_plans for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "zone_memberships_owner_or_admin_all" on public.zone_memberships;
create policy "zone_memberships_owner_or_admin_all"
on public.zone_memberships for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = zone_memberships.user_id and u.auth_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = zone_memberships.user_id and u.auth_user_id = auth.uid()
  )
);

drop policy if exists "subscriptions_owner_or_admin_all" on public.subscriptions;
create policy "subscriptions_owner_or_admin_all"
on public.subscriptions for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = subscriptions.user_id and u.auth_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = subscriptions.user_id and u.auth_user_id = auth.uid()
  )
);

drop policy if exists "pickup_cycles_read_authenticated" on public.pickup_cycles;
create policy "pickup_cycles_read_authenticated"
on public.pickup_cycles for select
to authenticated
using (true);

drop policy if exists "pickup_cycles_admin_write" on public.pickup_cycles;
create policy "pickup_cycles_admin_write"
on public.pickup_cycles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "pickup_requests_owner_or_admin_all" on public.pickup_requests;
create policy "pickup_requests_owner_or_admin_all"
on public.pickup_requests for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = pickup_requests.user_id and u.auth_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = pickup_requests.user_id and u.auth_user_id = auth.uid()
  )
);

drop policy if exists "drivers_read_authenticated" on public.drivers;
create policy "drivers_read_authenticated"
on public.drivers for select
to authenticated
using (true);

drop policy if exists "drivers_admin_write" on public.drivers;
create policy "drivers_admin_write"
on public.drivers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "routes_read_authenticated" on public.routes;
create policy "routes_read_authenticated"
on public.routes for select
to authenticated
using (true);

drop policy if exists "routes_admin_write" on public.routes;
create policy "routes_admin_write"
on public.routes for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "pickup_stops_read_authenticated" on public.pickup_stops;
create policy "pickup_stops_read_authenticated"
on public.pickup_stops for select
to authenticated
using (true);

drop policy if exists "pickup_stops_admin_write" on public.pickup_stops;
create policy "pickup_stops_admin_write"
on public.pickup_stops for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "referrals_owner_or_admin_all" on public.referrals;
create policy "referrals_owner_or_admin_all"
on public.referrals for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where (u.id = referrals.referrer_user_id or u.id = referrals.referred_user_id)
      and u.auth_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where (u.id = referrals.referrer_user_id or u.id = referrals.referred_user_id)
      and u.auth_user_id = auth.uid()
  )
);

drop policy if exists "credits_owner_or_admin_read" on public.credits_ledger;
create policy "credits_owner_or_admin_read"
on public.credits_ledger for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = credits_ledger.user_id and u.auth_user_id = auth.uid()
  )
);

drop policy if exists "credits_admin_write" on public.credits_ledger;
create policy "credits_admin_write"
on public.credits_ledger for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "notification_events_owner_or_admin_read" on public.notification_events;
create policy "notification_events_owner_or_admin_read"
on public.notification_events for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = notification_events.user_id and u.auth_user_id = auth.uid()
  )
);

drop policy if exists "notification_events_admin_write" on public.notification_events;
create policy "notification_events_admin_write"
on public.notification_events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
