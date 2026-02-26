create table if not exists public.affiliate_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.affiliate_codes enable row level security;

drop policy if exists "affiliate_codes_owner_or_admin_all" on public.affiliate_codes;
create policy "affiliate_codes_owner_or_admin_all"
on public.affiliate_codes for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = affiliate_codes.user_id and u.auth_user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.users u
    where u.id = affiliate_codes.user_id and u.auth_user_id = auth.uid()
  )
);

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'referrals'
      and constraint_name = 'referrals_referral_code_key'
  ) then
    alter table public.referrals drop constraint referrals_referral_code_key;
  end if;
end $$;

create index if not exists referrals_referral_code_idx on public.referrals(referral_code);
create unique index if not exists referrals_referred_user_once_idx
on public.referrals(referred_user_id)
where referred_user_id is not null;

