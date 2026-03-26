alter table public.service_zones
  add column if not exists recurring_pickup_day integer check (recurring_pickup_day between 1 and 31),
  add column if not exists default_cutoff_days_before integer not null default 7 check (default_cutoff_days_before between 0 and 30),
  add column if not exists default_pickup_window_label text,
  add column if not exists partner_schedule_locked boolean not null default false;
