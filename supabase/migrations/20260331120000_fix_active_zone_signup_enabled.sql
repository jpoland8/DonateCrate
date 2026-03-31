-- Ensure all active zones have signup_enabled = true.
-- Active zones should accept signups by default; this corrects any state where
-- a zone was set to status='active' without also setting signup_enabled=true.
update public.service_zones
set signup_enabled = true,
    updated_at     = now()
where status = 'active'
  and signup_enabled = false
  and (demo_only = false or demo_only is null);
