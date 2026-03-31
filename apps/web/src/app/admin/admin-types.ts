/**
 * Shared admin type definitions.
 *
 * These types describe the data shapes returned by admin API endpoints
 * and consumed by admin workspace tab components.
 */

import type { GlobalAppRole } from "@/lib/access";

export type WorkspaceSection = "overview" | "pickups" | "logistics" | "people" | "network" | "billing" | "growth" | "communication";
export type NetworkSubtab = "zones" | "partners";
export type PeopleSubtab = "customers" | "staff";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: GlobalAppRole;
  created_at: string;
  primary_address: {
    address_line1: string;
    city: string;
    state: string;
    postal_code: string;
  } | null;
  zones: Array<{
    id: string;
    code: string;
    name: string;
    membershipStatus: string;
  }>;
};

export type AdminPickupRequest = {
  id: string;
  status: string;
  updated_at?: string;
  user_id?: string;
  pickup_cycle_id?: string;
  users: { email: string; full_name?: string | null };
  pickup_cycles: { pickup_date: string };
};

export type AdminRoute = {
  id: string;
  status: string;
  driver_id: string | null;
  pickup_cycle_id?: string;
  zone_id?: string;
  created_at?: string;
  stopCount?: number;
  drivers?: { employee_id?: string | null } | null;
  service_zones?: { code?: string | null; name?: string | null } | Array<{ code?: string | null; name?: string | null }> | null;
  pickup_cycles?: { pickup_date?: string | null } | Array<{ pickup_date?: string | null }> | null;
};

export type AdminNotificationEvent = {
  id: string;
  user_id: string | null;
  channel: string;
  event_type: string;
  status: string;
  provider_message_id: string | null;
  attempt_count: number | null;
  last_attempt_at: string | null;
  last_error: string | null;
  correlation_id: string | null;
  created_at: string;
};

export type AdminDriver = {
  id: string;
  employee_id: string;
  users: { email: string };
};

export type AdminPickupCycle = {
  id: string;
  zone_id: string;
  cycle_month: string;
  pickup_date: string;
  request_cutoff_at: string;
  pickup_window_label?: string | null;
  service_zones?: { code: string; name: string } | Array<{ code: string; name: string }> | null;
};

export type AdminSubscription = {
  id: string;
  status: string;
  updatedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  latestInvoiceStatus: string | null;
  paymentMethodSummary: string | null;
  paymentMethod: {
    type: string | null;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
    funding: string | null;
    country: string | null;
  } | null;
  latestInvoice: {
    status: string | null;
    amountDueCents: number | null;
    amountPaidCents: number | null;
    currency: string | null;
    hostedInvoiceUrl: string | null;
  } | null;
  plan: {
    name: string | null;
    amountCents: number | null;
    currency: string;
    stripePriceId?: string | null;
  };
  user: {
    email: string;
    fullName: string | null;
    phone: string | null;
  };
};

export type AdminReferral = {
  id: string;
  referral_code: string;
  status: string;
  referrer_email: string | null;
  referred_email: string | null;
};

export type AdminPartner = {
  id: string;
  code: string;
  name: string;
  legal_name: string | null;
  support_email: string | null;
  support_phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  about_paragraph: string | null;
  active: boolean;
  receipt_mode: "partner_issued" | "platform_on_behalf" | "manual";
  payout_model: "inventory_only" | "revenue_share" | "hybrid";
  platform_share_bps: number;
  partner_share_bps: number;
  notes: string | null;
  branding: {
    display_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    website_url: string | null;
    receipt_footer: string | null;
  } | null;
  members: Array<{
    id: string;
    user_id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    role: string;
    active: boolean;
  }>;
  zones: Array<{ id: string; name: string; code: string; operation_model: string }>;
};

export type AdminZone = {
  id: string;
  code: string;
  name: string;
  anchor_postal_code: string;
  radius_miles: number;
  min_active_subscribers: number;
  status: "pending" | "launching" | "active" | "paused";
  center_address: string | null;
  signup_enabled: boolean;
  demo_only: boolean;
  operation_model: "donatecrate_operated" | "partner_operated";
  partner_id: string | null;
  partner_pickup_date_override_allowed: boolean;
  recurring_pickup_day: number | null;
  default_cutoff_days_before: number;
  default_pickup_window_label: string | null;
  partner_notes: string | null;
  partner: { id: string; name: string; code: string } | null;
};

export type AdminWaitlistEntry = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  postal_code: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  has_account: boolean | null;
};

export type AdminData = {
  users: AdminUser[];
  waitlist: AdminWaitlistEntry[];
  pickupRequests: AdminPickupRequest[];
  routes: AdminRoute[];
  notificationEvents?: AdminNotificationEvent[];
  drivers: AdminDriver[];
  pickupCycles: AdminPickupCycle[];
  subscriptions: AdminSubscription[];
  referrals: AdminReferral[];
  partners: AdminPartner[];
  zones: AdminZone[];
};

export type ZoneMember = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  primary_address: {
    address_line1: string;
    city: string;
    state: string;
    postal_code: string;
  } | null;
};

export type CommunicationChannelHealth = {
  configured: boolean;
  ready: boolean;
  status: "verified" | "not_configured" | "error";
  detail: string;
  fromNumber?: string | null;
  messagingServiceSid?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  host?: string | null;
};

export type LogisticsRoutePreview = {
  route?: { id: string; status: string };
  googleMapsUrl?: string | null;
  stops?: Array<{
    id: string;
    stopOrder: number;
    stopStatus: string;
    requestStatus: string | null;
    requestNote?: string | null;
    email: string | null;
    fullName: string | null;
    address: {
      addressLine1: string;
      city: string;
      state: string;
      postalCode: string;
      lat: number | null;
      lng: number | null;
    } | null;
  }>;
};
