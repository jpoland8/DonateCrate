/**
 * Centralised status labels, enums, and helpers.
 *
 * Every place that needs a human-readable label for a pickup, route-stop,
 * subscription, or notification status should import from here so the
 * language stays consistent across admin, partner, and customer UIs.
 *
 * API routes should use the `*_VALUES` arrays for Zod enum validation
 * instead of hardcoding status strings.
 */

// ---------------------------------------------------------------------------
// Pickup request statuses
// ---------------------------------------------------------------------------

/** All valid pickup request status values. Use in Zod schemas: z.enum(PICKUP_STATUS_VALUES) */
export const PICKUP_STATUS_VALUES = [
  "requested",
  "skipped",
  "confirmed",
  "picked_up",
  "completed",
  "missed",
  "not_ready",
] as const;

export type PickupStatus = (typeof PICKUP_STATUS_VALUES)[number];

export const PICKUP_STATUS_LABELS: Record<string, string> = {
  requested: "Ready for pickup",
  skipped: "Skipped this month",
  confirmed: "Confirmed for route",
  picked_up: "Pickup completed",
  completed: "Pickup completed",
  missed: "Pickup missed",
  not_ready: "Marked not ready",
};

export function formatPickupStatus(status: string | null | undefined): string {
  if (!status) return "Included by default";
  return PICKUP_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

// ---------------------------------------------------------------------------
// Route stop statuses
// ---------------------------------------------------------------------------

/** All valid route stop status values. Use in Zod schemas: z.enum(STOP_STATUS_VALUES) */
export const STOP_STATUS_VALUES = [
  "scheduled",
  "in_progress",
  "picked_up",
  "no_access",
  "not_ready",
  "rescheduled",
] as const;

export type StopStatus = (typeof STOP_STATUS_VALUES)[number];

export const STOP_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  picked_up: "Picked up",
  no_access: "No access",
  not_ready: "Not ready",
  rescheduled: "Rescheduled",
};

export function formatStopStatus(status: string | null | undefined): string {
  if (!status) return "Pending";
  return STOP_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

// ---------------------------------------------------------------------------
// Route statuses
// ---------------------------------------------------------------------------

/** All valid route status values. */
export const ROUTE_STATUS_VALUES = [
  "draft",
  "assigned",
  "in_progress",
  "completed",
  "canceled",
] as const;

export type RouteStatus = (typeof ROUTE_STATUS_VALUES)[number];

export const ROUTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  canceled: "Canceled",
};

export function formatRouteStatus(status: string | null | undefined): string {
  if (!status) return "Draft";
  return ROUTE_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

// ---------------------------------------------------------------------------
// Subscription statuses
// ---------------------------------------------------------------------------

/** All valid subscription status values. */
export const SUBSCRIPTION_STATUS_VALUES = [
  "active",
  "paused",
  "canceled",
  "past_due",
  "trialing",
  "not_started",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  canceled: "Canceled",
  past_due: "Past due",
  trialing: "Trial",
  not_started: "Not started",
};

export function formatSubscriptionStatus(status: string | null | undefined): string {
  if (!status) return "Not started";
  return SUBSCRIPTION_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

// ---------------------------------------------------------------------------
// Notification statuses
// ---------------------------------------------------------------------------

/** All valid notification delivery status values. */
export const NOTIFICATION_STATUS_VALUES = [
  "queued",
  "sent",
  "delivered",
  "failed",
  "skipped",
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUS_VALUES)[number];

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  skipped: "Skipped",
};

export function formatNotificationDeliveryStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return NOTIFICATION_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

// ---------------------------------------------------------------------------
// Referral statuses
// ---------------------------------------------------------------------------

/** All valid referral status values. */
export const REFERRAL_STATUS_VALUES = [
  "pending",
  "qualified",
  "credited",
  "expired",
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUS_VALUES)[number];

export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  pending: "Signed up",
  qualified: "Subscribed",
  credited: "Credited",
  expired: "Expired",
};

export function formatReferralStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return REFERRAL_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}
