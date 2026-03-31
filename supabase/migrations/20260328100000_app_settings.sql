-- Lightweight key-value settings table for admin-configurable values
create table if not exists app_settings (
  key   text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed default reminder templates
insert into app_settings (key, value) values
  ('reminder_templates', '{
    "sms_72h": "DonateCrate reminder: your pickup is coming up on {{pickup_date}}. Start filling your bag now so it is ready for route day.",
    "sms_24h": "DonateCrate reminder: your pickup is tomorrow, {{pickup_date}}. Place your bag out before route time.",
    "sms_day_of": "DonateCrate reminder: pickup day is here. Place your DonateCrate bag out for collection today, {{pickup_date}}.",
    "email_subject_72h": "Your DonateCrate pickup is coming up",
    "email_subject_24h": "Your DonateCrate pickup is tomorrow",
    "email_subject_day_of": "Pickup day is here",
    "email_intro_72h": "Your next monthly pickup is getting close.",
    "email_intro_24h": "Your bag should be ready by tomorrow.",
    "email_intro_day_of": "Today is pickup day for your DonateCrate bag.",
    "email_body_72h": "We are scheduled to stop by on {{pickup_date}}. Keep your orange bag ready and place it out before route time.",
    "email_body_24h": "We are scheduled to stop by tomorrow, {{pickup_date}}. Make sure your orange bag is packed and placed out before route time.",
    "email_body_day_of": "Today is the day! Place your orange bag out for collection. We will be by on {{pickup_date}}."
  }'::jsonb)
on conflict (key) do nothing;

-- RLS: only service_role can read/write (admin client uses service_role key)
alter table app_settings enable row level security;
