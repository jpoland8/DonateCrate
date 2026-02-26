alter table public.service_zones
add column if not exists center_address text;

update public.service_zones
set center_address = coalesce(center_address, 'Near ZIP ' || anchor_postal_code)
where center_address is null;

