-- Unconditionally ensure the primary Knoxville zone is fully active for signups.
-- This is a safety migration to correct any state drift regardless of cause.
update public.service_zones
set status        = 'active',
    signup_enabled = true,
    updated_at     = now()
where code = 'knoxville-37922';
