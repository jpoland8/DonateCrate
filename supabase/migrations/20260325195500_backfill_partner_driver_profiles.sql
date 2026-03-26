insert into public.drivers (user_id, employee_id, active)
select
  pm.user_id,
  'PTNR-' || upper(substr(replace(pm.user_id::text, '-', ''), 1, 8)),
  true
from public.partner_memberships pm
where pm.active = true
  and pm.role in ('partner_coordinator', 'partner_driver')
on conflict (user_id) do update
set active = excluded.active;
