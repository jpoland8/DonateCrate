alter table public.service_zones
add column if not exists launch_target_enabled boolean not null default true;

