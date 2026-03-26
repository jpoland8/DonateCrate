do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'users_role_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users drop constraint users_role_check;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'partner_memberships_role_check'
      and conrelid = 'public.partner_memberships'::regclass
  ) then
    alter table public.partner_memberships drop constraint partner_memberships_role_check;
  end if;
end $$;

update public.users
set role = case
  when role = 'partner_manager' then 'partner_admin'
  when role = 'partner_operator' then 'partner_coordinator'
  else role
end,
updated_at = now()
where role in ('partner_manager', 'partner_operator');

update public.partner_memberships
set role = case
  when role = 'partner_manager' then 'partner_admin'
  when role = 'partner_operator' then 'partner_coordinator'
  else role
end,
updated_at = now()
where role in ('partner_manager', 'partner_operator');

alter table public.users
  add constraint users_role_check
  check (role in ('customer', 'admin', 'driver', 'partner_admin', 'partner_coordinator', 'partner_driver'));

alter table public.partner_memberships
  add constraint partner_memberships_role_check
  check (role in ('partner_admin', 'partner_coordinator', 'partner_driver'));
