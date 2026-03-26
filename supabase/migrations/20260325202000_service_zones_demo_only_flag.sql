alter table public.service_zones
add column if not exists demo_only boolean not null default false;

update public.service_zones
set demo_only = true
where lower(code) in ('test-sandbox-knoxville', 'partner-hope-west-knox')
   or lower(code) like 'test-%'
   or lower(code) like '%sandbox%'
   or lower(name) like 'test -%'
   or lower(name) like '%sandbox%';
