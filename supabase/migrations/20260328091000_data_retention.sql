-- ==========================================================================
-- Data retention policies
--
-- Creates a function and optional cron trigger to clean up old
-- transactional data that is no longer needed for operations.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Function: Clean up old notification events
-- Keeps last 90 days of sent/delivered events, 365 days of failed events.
-- Queued events are never pruned (they still need processing).
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prune_old_notification_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH pruned AS (
    DELETE FROM public.notification_events
    WHERE (
      -- Sent/delivered: keep 90 days
      (status IN ('sent', 'delivered') AND created_at < NOW() - INTERVAL '90 days')
      OR
      -- Skipped: keep 60 days
      (status = 'skipped' AND created_at < NOW() - INTERVAL '60 days')
      OR
      -- Failed: keep 365 days (for audit)
      (status = 'failed' AND created_at < NOW() - INTERVAL '365 days')
    )
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM pruned;

  RETURN deleted_count;
END;
$$;

-- --------------------------------------------------------------------------
-- Function: Clean up old webhook events
-- Stripe webhook events older than 90 days that are fully processed.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prune_old_webhook_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH pruned AS (
    DELETE FROM public.stripe_webhook_events
    WHERE processing_state = 'processed'
      AND created_at < NOW() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM pruned;

  RETURN deleted_count;
END;
$$;

-- --------------------------------------------------------------------------
-- Comments for documentation
-- --------------------------------------------------------------------------

COMMENT ON FUNCTION public.prune_old_notification_events IS
  'Deletes old notification events based on status-specific retention windows. '
  'Sent/delivered: 90 days. Skipped: 60 days. Failed: 365 days. Queued: never pruned.';

COMMENT ON FUNCTION public.prune_old_webhook_events IS
  'Deletes fully processed Stripe webhook events older than 90 days.';
