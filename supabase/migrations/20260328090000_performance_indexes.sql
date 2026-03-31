-- ==========================================================================
-- Performance indexes for common query patterns
--
-- These indexes target the highest-frequency query patterns identified
-- across admin, partner, and customer API endpoints.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Pickup requests: Most queried table in the app
-- --------------------------------------------------------------------------

-- Admin/partner list by cycle + status (used in route building, request summary)
CREATE INDEX IF NOT EXISTS idx_pickup_requests_cycle_status
  ON public.pickup_requests (pickup_cycle_id, status);

-- Customer lookup: find my request for a given cycle
CREATE INDEX IF NOT EXISTS idx_pickup_requests_user_cycle
  ON public.pickup_requests (user_id, pickup_cycle_id);

-- Admin overview: recent requests ordered by update time
CREATE INDEX IF NOT EXISTS idx_pickup_requests_updated_at
  ON public.pickup_requests (updated_at DESC);

-- --------------------------------------------------------------------------
-- Pickup cycles: Queried on every customer/partner dashboard load
-- --------------------------------------------------------------------------

-- Next cycle lookup: zone + future date (most common pattern)
CREATE INDEX IF NOT EXISTS idx_pickup_cycles_zone_date
  ON public.pickup_cycles (zone_id, pickup_date);

-- --------------------------------------------------------------------------
-- Routes: Queried during dispatch and logistics
-- --------------------------------------------------------------------------

-- Find routes for a zone + cycle combo
CREATE INDEX IF NOT EXISTS idx_routes_zone_cycle
  ON public.routes (zone_id, pickup_cycle_id);

-- Driver's active routes
CREATE INDEX IF NOT EXISTS idx_routes_driver_status
  ON public.routes (driver_id, status)
  WHERE driver_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- Pickup stops: Queried when loading route previews
-- --------------------------------------------------------------------------

-- Load stops for a route in order
CREATE INDEX IF NOT EXISTS idx_pickup_stops_route_order
  ON public.pickup_stops (route_id, stop_order);

-- --------------------------------------------------------------------------
-- Zone memberships: Queried on every authenticated page load
-- --------------------------------------------------------------------------

-- User's zone memberships (customer dashboard, partner access check)
CREATE INDEX IF NOT EXISTS idx_zone_memberships_user
  ON public.zone_memberships (user_id);

-- --------------------------------------------------------------------------
-- Addresses: Queried in admin user list and customer profile
-- --------------------------------------------------------------------------

-- User's addresses (joined in admin users endpoint)
CREATE INDEX IF NOT EXISTS idx_addresses_user
  ON public.addresses (user_id);

-- --------------------------------------------------------------------------
-- Subscriptions: Queried in billing and customer dashboard
-- --------------------------------------------------------------------------

-- User's subscription status
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions (user_id, status);

-- Admin list: ordered by update time
CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_at
  ON public.subscriptions (updated_at DESC);

-- --------------------------------------------------------------------------
-- Referrals: Queried on customer referral page
-- --------------------------------------------------------------------------

-- Referrer's referral history
CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON public.referrals (referrer_user_id);

-- --------------------------------------------------------------------------
-- Credits ledger: Queried for referral stats
-- --------------------------------------------------------------------------

-- User's credits by source
CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_source
  ON public.credits_ledger (user_id, source);

-- --------------------------------------------------------------------------
-- Notification events: Queried in admin comms tab and cron processing
-- --------------------------------------------------------------------------

-- Cron queue processing: find queued events to send
CREATE INDEX IF NOT EXISTS idx_notification_events_status_created
  ON public.notification_events (status, created_at)
  WHERE status IN ('queued', 'failed');

-- User's notification history
CREATE INDEX IF NOT EXISTS idx_notification_events_user
  ON public.notification_events (user_id)
  WHERE user_id IS NOT NULL;

-- Deduplication: check if reminder already sent for cycle + cadence
CREATE INDEX IF NOT EXISTS idx_notification_events_dedup
  ON public.notification_events (event_type, status)
  WHERE event_type LIKE 'pickup_reminder_%';

-- --------------------------------------------------------------------------
-- Waitlist entries: Queried in admin growth tab
-- --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_status
  ON public.waitlist_entries (status);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_postal
  ON public.waitlist_entries (postal_code);
