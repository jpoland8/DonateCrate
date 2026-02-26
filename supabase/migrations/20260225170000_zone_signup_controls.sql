alter table public.service_zones
add column if not exists signup_enabled boolean not null default false;

update public.service_zones
set signup_enabled = true
where code = 'knoxville-37922';

