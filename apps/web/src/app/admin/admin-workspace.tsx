"use client";

import { isDemoOnlyZone } from "@/lib/zone-flags";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobalAppRole } from "@/lib/access";
import { getNotificationRetryState } from "@/lib/notification-health";
import { formatNotificationChannel, formatNotificationEventType, formatNotificationStatus } from "@/lib/notification-labels";

type WorkspaceSection = "overview" | "pickups" | "logistics" | "people" | "network" | "billing" | "growth" | "communication";
type NetworkSubtab = "zones" | "partners";
type PeopleSubtab = "customers" | "staff";

type AdminUser = {
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

type AdminData = {
  users: AdminUser[];
  waitlist: Array<{ id: string; full_name: string; status: string; postal_code: string }>;
  pickupRequests: Array<{
    id: string;
    status: string;
    updated_at?: string;
    user_id?: string;
    pickup_cycle_id?: string;
    users: { email: string; full_name?: string | null };
    pickup_cycles: { pickup_date: string };
  }>;
  routes: Array<{
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
  }>;
  notificationEvents?: Array<{
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
  }>;
  drivers: Array<{ id: string; employee_id: string; users: { email: string } }>;
  pickupCycles: Array<{
    id: string;
    zone_id: string;
    cycle_month: string;
    pickup_date: string;
    request_cutoff_at: string;
    service_zones?: { code: string; name: string } | Array<{ code: string; name: string }> | null;
  }>;
  subscriptions: Array<{
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
  }>;
  referrals: Array<{ id: string; referral_code: string; status: string; referrer_email: string | null; referred_email: string | null }>;
  partners: Array<{
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
  }>;
  zones: Array<{
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
  }>;
};

type ZoneMember = {
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

type CommunicationChannelHealth = {
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

function localDateISO(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function localDateTimeISO(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

function formatCurrency(amountCents: number | null, currency = "usd") {
  if (amountCents == null) return "Plan not linked";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (!isValidDate(parsed)) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!isValidDate(parsed)) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatCardExpiry(month: number | null, year: number | null) {
  if (!month || !year) return "Not available";
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function formatRouteStatusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Draft route";
    case "assigned":
      return "Driver assigned";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    default:
      return formatStatusLabel(status);
  }
}

function formatPartnerTeamRole(role: string) {
  switch (role) {
    case "partner_admin":
      return "Organization Admin";
    case "partner_coordinator":
      return "Coordinator";
    case "partner_driver":
      return "Driver";
    default:
      return formatStatusLabel(role);
  }
}

function formatRoleLabel(role: string) {
  switch (role) {
    case "customer":
      return "Donor";
    case "admin":
      return "DonateCrate Admin";
    case "driver":
      return "Driver";
    case "partner_admin":
    case "partner_coordinator":
    case "partner_driver":
      return formatPartnerTeamRole(role);
    default:
      return formatStatusLabel(role);
  }
}

function formatZoneStatusLabel(status: "pending" | "launching" | "active" | "paused") {
  switch (status) {
    case "pending":
      return "Planning";
    case "launching":
      return "Opening Soon";
    case "active":
      return "Active";
    case "paused":
      return "Paused";
  }
}

function formatPickupRequestLabel(status: string) {
  switch (status) {
    case "requested":
      return "Ready for pickup";
    case "skipped":
      return "Skipped this month";
    case "confirmed":
      return "Confirmed by ops";
    case "picked_up":
      return "Collected";
    case "not_ready":
      return "Not ready";
    case "missed":
      return "Missed";
    default:
      return formatStatusLabel(status);
  }
}

function getCycleDisplayLabel(cycle: AdminData["pickupCycles"][number]) {
  const zoneMeta = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
  return `${zoneMeta?.name || "Zone"} | ${formatDate(cycle.pickup_date)}`;
}

function getRouteDisplayLabel(route: AdminData["routes"][number] | null | undefined) {
  if (!route) return "No route built yet";
  const zoneMeta = Array.isArray(route.service_zones) ? route.service_zones[0] : route.service_zones;
  const pickupCycle = Array.isArray(route.pickup_cycles) ? route.pickup_cycles[0] : route.pickup_cycles;
  return `${zoneMeta?.name || "Zone"} | ${pickupCycle?.pickup_date ? formatDate(pickupCycle.pickup_date) : "No date"}`;
}

function getNotificationStateTone(severity: "healthy" | "attention" | "blocked") {
  switch (severity) {
    case "healthy":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-50";
    case "blocked":
      return "border-red-400/25 bg-red-400/10 text-red-50";
    default:
      return "border-amber-400/25 bg-amber-400/10 text-amber-50";
  }
}

function getBillingStatusTone(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-400/35 bg-emerald-400/12 text-emerald-100";
    case "trialing":
      return "border-slate-400/35 bg-slate-400/12 text-slate-100";
    case "past_due":
      return "border-amber-400/35 bg-amber-400/12 text-amber-100";
    case "paused":
      return "border-indigo-400/35 bg-indigo-400/12 text-indigo-100";
    case "canceled":
      return "border-red-400/35 bg-red-400/12 text-red-100";
    default:
      return "border-white/15 bg-white/10 text-white";
  }
}

function getBillingStatusExplanation(subscription: AdminData["subscriptions"][number]) {
  if (subscription.cancelAtPeriodEnd) {
    return `Cancellation is scheduled. Access continues until ${formatDate(subscription.currentPeriodEnd)}.`;
  }

  switch (subscription.status) {
    case "active":
      return "Account is in good standing and should renew automatically on the next billing date.";
    case "trialing":
      return "Customer began checkout but billing has not fully activated yet. Ask them to complete payment before pickup access is restored.";
    case "past_due":
      return "Stripe could not collect the latest invoice. Payment details and invoice status need review.";
    case "paused":
      return "Collection is paused in Stripe. Billing will not continue until the subscription is resumed.";
    case "canceled":
      return subscription.canceledAt
        ? `Subscription was canceled on ${formatDateTime(subscription.canceledAt)}.`
        : "Subscription is canceled and no further renewals will occur.";
    default:
      return "Subscription state is available but should be refreshed from Stripe for confirmation.";
  }
}

function getPaymentPreviewLabel(subscription: AdminData["subscriptions"][number]) {
  if (!subscription.paymentMethod) return "Payment method unavailable";
  if (subscription.paymentMethod.type !== "card") {
    return subscription.paymentMethod.type || "Stored payment method";
  }
  return `${subscription.paymentMethod.brand || "card"} ending in ${subscription.paymentMethod.last4 || "----"}`;
}

function getPartnerSettingsDraft(partner: AdminData["partners"][number]) {
  return {
    partnerId: partner.id,
    name: partner.name,
    legalName: partner.legal_name ?? "",
    supportEmail: partner.support_email ?? "",
    supportPhone: partner.support_phone ?? "",
    addressLine1: partner.address_line1 ?? "",
    city: partner.city ?? "",
    state: partner.state ?? "",
    postalCode: partner.postal_code ?? "",
    aboutParagraph: partner.about_paragraph ?? "",
    active: partner.active,
    receiptMode: partner.receipt_mode,
    payoutModel: partner.payout_model,
    platformShareBps: partner.platform_share_bps,
    partnerShareBps: partner.partner_share_bps,
    notes: partner.notes ?? "",
    displayName: partner.branding?.display_name ?? "",
    primaryColor: partner.branding?.primary_color ?? "",
    secondaryColor: partner.branding?.secondary_color ?? "",
    accentColor: partner.branding?.accent_color ?? "",
    logoUrl: partner.branding?.logo_url ?? "",
    websiteUrl: partner.branding?.website_url ?? "",
    receiptFooter: partner.branding?.receipt_footer ?? "",
  };
}

export function AdminWorkspace({
  section = "overview",
  networkSubtab = "zones",
  peopleSubtab = "customers",
}: {
  section?: WorkspaceSection;
  networkSubtab?: NetworkSubtab;
  peopleSubtab?: PeopleSubtab;
}) {
  const singleCycleMonthRef = useRef<HTMLInputElement | null>(null);
  const singlePickupDateRef = useRef<HTMLInputElement | null>(null);
  const recurringStartPickupDateRef = useRef<HTMLInputElement | null>(null);
  const logisticsPreviewAbortRef = useRef<AbortController | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [message, setMessage] = useState("");
  const [logisticsMessage, setLogisticsMessage] = useState("");
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<
    "all" | "active" | "past_due" | "paused" | "canceled"
  >("all");
  const [subscriptionActionState, setSubscriptionActionState] = useState<{ id: string; action: string } | null>(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState("");

  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedZoneCode, setSelectedZoneCode] = useState("knoxville-37922");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedLogisticsRouteId, setSelectedLogisticsRouteId] = useState("");
  const [logisticsRoutePreview, setLogisticsRoutePreview] = useState<{
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
  } | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | GlobalAppRole>("all");
  const [userZoneFilter, setUserZoneFilter] = useState<string>("all");
  const [zoneMembers, setZoneMembers] = useState<ZoneMember[]>([]);
  const [zoneMemberSearch, setZoneMemberSearch] = useState("");
  const [zoneMemberRole, setZoneMemberRole] = useState<"all" | "customer" | "admin" | "driver" | "partner_admin" | "partner_coordinator" | "partner_driver">("all");
  const [zoneMemberPage, setZoneMemberPage] = useState(1);
  const [zoneMemberPagination, setZoneMemberPagination] = useState({ page: 1, pageSize: 8, total: 0, totalPages: 1 });
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [showCreatePartnerForm, setShowCreatePartnerForm] = useState(false);
  const [showCreateZoneForm, setShowCreateZoneForm] = useState(false);
  const [zoneSaving, setZoneSaving] = useState(false);

  const [zoneForm, setZoneForm] = useState({
    code: "",
    name: "",
    anchorPostalCode: "",
    radiusMiles: 3,
    minActiveSubscribers: 40,
    signupEnabled: true,
    demoOnly: false,
  });
  const [partnerForm, setPartnerForm] = useState({
    code: "",
    name: "",
    legalName: "",
    supportEmail: "",
    supportPhone: "",
    receiptMode: "partner_issued" as "partner_issued" | "platform_on_behalf" | "manual",
    payoutModel: "inventory_only" as "inventory_only" | "revenue_share" | "hybrid",
    platformShareBps: 10000,
    partnerShareBps: 0,
    notes: "",
    displayName: "",
    primaryColor: "",
    secondaryColor: "",
    accentColor: "",
    logoUrl: "",
    websiteUrl: "",
    receiptFooter: "",
  });
  const [partnerMemberEmail, setPartnerMemberEmail] = useState("");
  const [partnerMemberRole, setPartnerMemberRole] = useState<"partner_admin" | "partner_coordinator" | "partner_driver">("partner_admin");
  const [selectedPartnerForm, setSelectedPartnerForm] = useState<ReturnType<typeof getPartnerSettingsDraft> | null>(null);

  const [createCenterQuery, setCreateCenterQuery] = useState("");
  const [createCenterPredictions, setCreateCenterPredictions] = useState<
    Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>
  >([]);
  const [createCenterSelection, setCreateCenterSelection] = useState<{ placeId: string; formattedAddress: string } | null>(null);

  const [editCenterQuery, setEditCenterQuery] = useState("");
  const [editCenterPredictions, setEditCenterPredictions] = useState<
    Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>
  >([]);
  const [editCenterSelection, setEditCenterSelection] = useState<{ placeId: string; formattedAddress: string } | null>(null);

  const [pickupMode, setPickupMode] = useState<"single" | "recurring">("single");
  const [applyToAllActiveZones, setApplyToAllActiveZones] = useState(false);
  const [timelineZoneFilter, setTimelineZoneFilter] = useState("all");
  const [scheduleForm, setScheduleForm] = useState(() => {
    const now = new Date();
    const cutoffSeed = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      zoneCode: "knoxville-37922",
      cycleMonth: localDateISO(now),
    pickupDate: localDateISO(now),
    requestCutoffAt: localDateTimeISO(cutoffSeed),
    startPickupDate: localDateISO(now),
    horizonMode: "months" as "months" | "forever",
    months: 6,
    weekendPolicy: "next_business_day" as "none" | "next_business_day",
    cutoffDaysBefore: 7,
  };
  });
  const [smsTarget, setSmsTarget] = useState<"individual" | "zone" | "all">("individual");
  const [smsUserIds, setSmsUserIds] = useState<string[]>([]);
  const [smsZoneId, setSmsZoneId] = useState("");
  const [smsIncludeStaff, setSmsIncludeStaff] = useState(false);
  const [smsSearch, setSmsSearch] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsConfigError, setSmsConfigError] = useState<string | null>(null);
  const [communicationHealth, setCommunicationHealth] = useState<{
    sms: CommunicationChannelHealth | null;
    email: CommunicationChannelHealth | null;
  }>({ sms: null, email: null });
  const [smsZoneEligibleUsers, setSmsZoneEligibleUsers] = useState<
    Array<{ id: string; fullName: string; email: string; role: string; phone: string }>
  >([]);
  const [smsZonePreviewLoading, setSmsZonePreviewLoading] = useState(false);
  const [notificationActionLoading, setNotificationActionLoading] = useState(false);
  const [notificationSelection, setNotificationSelection] = useState<string[]>([]);
  const [mapLoadError, setMapLoadError] = useState(false);

  const loadAll = useCallback(async () => {
    const [usersRes, waitlistRes, requestsRes, routesRes, driversRes, cyclesRes, subsRes, refsRes, zonesRes, partnersRes, notificationRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/waitlist"),
      fetch("/api/admin/pickup-requests"),
      fetch("/api/admin/routes"),
      fetch("/api/admin/drivers"),
      fetch("/api/admin/pickup-cycles"),
      fetch("/api/admin/subscriptions"),
      fetch("/api/admin/referrals"),
      fetch("/api/admin/zones"),
      fetch("/api/admin/partners"),
      fetch("/api/admin/notifications"),
    ]);

    const [users, waitlist, pickupRequests, routes, drivers, pickupCycles, subscriptions, referrals, zones, partners, notifications] = await Promise.all([
      usersRes.json(),
      waitlistRes.json(),
      requestsRes.json(),
      routesRes.json(),
      driversRes.json(),
      cyclesRes.json(),
      subsRes.json(),
      refsRes.json(),
      zonesRes.json(),
      partnersRes.json(),
      notificationRes.json(),
    ]);

    const zoneRows = zones.zones ?? [];
    const partnerRows = partners.partners ?? [];
    if (zones.error) setMessage(`Pickup areas could not be loaded: ${zones.error}`);

    setSelectedZoneCode((prev) =>
      zoneRows.length > 0 && !zoneRows.some((zone: { code: string }) => zone.code === prev) ? zoneRows[0].code : prev,
    );
    setSelectedZoneId((prev) =>
      zoneRows.length > 0 && !zoneRows.some((zone: { id: string }) => zone.id === prev) ? zoneRows[0].id : prev,
    );
    setSelectedPartnerId((prev) =>
      partnerRows.length > 0 && !partnerRows.some((partner: { id: string }) => partner.id === prev) ? partnerRows[0].id : prev,
    );

    setData({
      users: users.users ?? [],
      waitlist: waitlist.waitlist ?? [],
      pickupRequests: pickupRequests.pickupRequests ?? [],
      routes: routes.routes ?? [],
      notificationEvents: notifications.notificationEvents ?? [],
      drivers: drivers.drivers ?? [],
      pickupCycles: pickupCycles.pickupCycles ?? [],
      subscriptions: subscriptions.subscriptions ?? [],
      referrals: referrals.referrals ?? [],
      partners: partnerRows,
      zones: zoneRows,
    });
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const driverOptions = useMemo(() => data?.drivers ?? [], [data]);
  const routeOptions = useMemo(() => data?.routes ?? [], [data]);
  const partnerOptions = useMemo(() => data?.partners ?? [], [data]);
  const selectedZone = useMemo(() => data?.zones.find((zone) => zone.id === selectedZoneId) ?? null, [data, selectedZoneId]);
  const selectedPartner = useMemo(() => data?.partners.find((partner) => partner.id === selectedPartnerId) ?? null, [data, selectedPartnerId]);
  useEffect(() => {
    setSelectedPartnerForm(selectedPartner ? getPartnerSettingsDraft(selectedPartner) : null);
  }, [selectedPartner]);
  useEffect(() => {
    if (!selectedZone) return;
    setSelectedZoneCode(selectedZone.code);
  }, [selectedZone]);
  const logisticsCycles = useMemo(() => {
    if (!data) return [];
    return data.pickupCycles.filter((cycle) => {
      if (!selectedZoneCode) return true;
      const zoneMeta = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
      return zoneMeta?.code === selectedZoneCode;
    });
  }, [data, selectedZoneCode]);
  const selectedCycleMeta = useMemo(
    () => logisticsCycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [logisticsCycles, selectedCycleId],
  );
  const selectedCycleRequestSummary = useMemo(() => {
    if (!data || !selectedCycleId) {
      return { requested: 0, skipped: 0, exceptions: 0, total: 0 };
    }
    const matching = data.pickupRequests.filter((request) => request.pickup_cycle_id === selectedCycleId);
    return {
      requested: matching.filter((request) => ["requested", "confirmed"].includes(request.status)).length,
      skipped: matching.filter((request) => request.status === "skipped").length,
      exceptions: matching.filter((request) => ["not_ready", "missed"].includes(request.status)).length,
      total: matching.length,
    };
  }, [data, selectedCycleId]);
  const selectedCycleRoutes = useMemo(() => {
    if (!data || !selectedCycleId) return [];
    const selectedZone = data.zones.find((zone) => zone.code === selectedZoneCode);
    return data.routes.filter(
      (route) => route.pickup_cycle_id === selectedCycleId && (!selectedZone || route.zone_id === selectedZone.id),
    );
  }, [data, selectedCycleId, selectedZoneCode]);
  const selectedLogisticsRoute = useMemo(() => {
    if (selectedLogisticsRouteId) {
      return routeOptions.find((route) => route.id === selectedLogisticsRouteId) ?? null;
    }
    return selectedCycleRoutes[0] ?? null;
  }, [routeOptions, selectedLogisticsRouteId, selectedCycleRoutes]);
  useEffect(() => {
    const nextRouteId = selectedCycleRoutes[0]?.id ?? "";
    setSelectedLogisticsRouteId(nextRouteId);
    if (nextRouteId) {
      loadLogisticsRoutePreview(nextRouteId);
    } else {
      setLogisticsRoutePreview(null);
      setMapLoadError(false);
    }
  }, [selectedCycleRoutes]);
  const timelineRows = useMemo(() => {
    if (!data) return [];
    return data.pickupCycles.filter((cycle) => {
      const zoneMeta = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
      if (timelineZoneFilter === "all") return true;
      return zoneMeta?.code === timelineZoneFilter;
    });
  }, [data, timelineZoneFilter]);
  const timelineByMonth = useMemo(() => {
    const groups = new Map<string, typeof timelineRows>();
    for (const cycle of timelineRows) {
      const monthKey = cycle.pickup_date.slice(0, 7);
      const existing = groups.get(monthKey) ?? [];
      existing.push(cycle);
      groups.set(monthKey, existing);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cycles]) => ({ month, cycles }));
  }, [timelineRows]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = userSearch.trim().toLowerCase();
    return data.users.filter((user) => {
      const matchesQuery =
        q.length === 0 ||
        user.email.toLowerCase().includes(q) ||
        (user.full_name || "").toLowerCase().includes(q) ||
        (user.primary_address?.postal_code || "").includes(q);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesZone = userZoneFilter === "all" || user.zones.some((zone) => zone.id === userZoneFilter);
      return matchesQuery && matchesRole && matchesZone;
    });
  }, [data, roleFilter, userSearch, userZoneFilter]);
  const filteredCustomerUsers = useMemo(
    () =>
      (data?.users ?? []).filter((user) => {
        const q = userSearch.trim().toLowerCase();
        const matchesQuery =
          q.length === 0 ||
          user.email.toLowerCase().includes(q) ||
          (user.full_name || "").toLowerCase().includes(q) ||
          (user.primary_address?.postal_code || "").includes(q);
        const matchesZone = userZoneFilter === "all" || user.zones.some((zone) => zone.id === userZoneFilter);
        return user.role === "customer" && matchesQuery && matchesZone;
      }),
    [data, userSearch, userZoneFilter],
  );
  const filteredStaffUsers = useMemo(
    () => filteredUsers.filter((user) => user.role !== "customer"),
    [filteredUsers],
  );

  const filteredSubscriptions = useMemo(() => {
    if (!data) return [];
    const query = subscriptionSearch.trim().toLowerCase();
    return data.subscriptions.filter((subscription) => {
      const matchesQuery =
        query.length === 0 ||
        subscription.user.email.toLowerCase().includes(query) ||
        (subscription.user.fullName || "").toLowerCase().includes(query) ||
        (subscription.stripeSubscriptionId || "").toLowerCase().includes(query) ||
        (subscription.stripeCustomerId || "").toLowerCase().includes(query);
      const matchesStatus = subscriptionStatusFilter === "all" || subscription.status === subscriptionStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [data, subscriptionSearch, subscriptionStatusFilter]);
  const selectedSubscription = useMemo(
    () => filteredSubscriptions.find((subscription) => subscription.id === selectedSubscriptionId) ?? null,
    [filteredSubscriptions, selectedSubscriptionId],
  );

  const smsUsersWithPhones = useMemo(() => {
    if (!data) return [];
    const query = smsSearch.trim().toLowerCase();
    return data.users.filter((user) => {
      if (!user.phone) return false;
      if (query.length === 0) return true;
      return (
        user.email.toLowerCase().includes(query) ||
        (user.full_name || "").toLowerCase().includes(query) ||
        user.phone.toLowerCase().includes(query)
      );
    });
  }, [data, smsSearch]);

  const smsRecipientEstimate = useMemo(() => {
    if (!data) return 0;
    if (smsTarget === "individual") {
      return data.users.filter((u) => smsUserIds.includes(u.id) && Boolean(u.phone)).length;
    }
    if (smsTarget === "zone") {
      return smsZoneEligibleUsers.length;
    }
    return data.users.filter((u) => Boolean(u.phone) && (smsIncludeStaff ? true : u.role === "customer")).length;
  }, [data, smsIncludeStaff, smsTarget, smsUserIds, smsZoneEligibleUsers.length]);
  const notificationEvents = useMemo(() => data?.notificationEvents ?? [], [data]);
  const failedNotificationEvents = useMemo(
    () => notificationEvents.filter((item) => item.status === "failed"),
    [notificationEvents],
  );
  const queuedNotificationEvents = useMemo(
    () => notificationEvents.filter((item) => item.status === "queued"),
    [notificationEvents],
  );
  const blockedNotificationEvents = useMemo(
    () => notificationEvents.filter((item) => getNotificationRetryState(item).severity === "blocked"),
    [notificationEvents],
  );
  const emailNotificationEvents = useMemo(
    () => notificationEvents.filter((item) => item.channel === "email"),
    [notificationEvents],
  );
  const smsNotificationEvents = useMemo(
    () => notificationEvents.filter((item) => item.channel === "sms"),
    [notificationEvents],
  );
  const opsOverview = useMemo(() => {
    if (!data) {
      return {
        readyRoutes: 0,
        draftRoutes: 0,
        activeZones: 0,
        attentionSubscriptions: 0,
        openWaitlist: 0,
        cycleExceptions: 0,
      };
    }

    return {
      readyRoutes: data.routes.filter((route) => route.status === "assigned" || route.status === "in_progress").length,
      draftRoutes: data.routes.filter((route) => route.status === "draft").length,
      activeZones: data.zones.filter((zone) => zone.status === "active").length,
      attentionSubscriptions: data.subscriptions.filter((subscription) => ["past_due", "canceled"].includes(subscription.status)).length,
      openWaitlist: data.waitlist.filter((entry) => entry.status !== "converted").length,
      cycleExceptions: data.pickupRequests.filter((request) => ["not_ready", "missed"].includes(request.status)).length,
    };
  }, [data]);

  async function fetchPredictions(query: string) {
    const response = await fetch("/api/places/autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Address search failed");
    return json.predictions ?? [];
  }

  async function fetchPlaceDetails(placeId: string) {
    const response = await fetch("/api/places/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Could not resolve address");
    return json as { placeId: string; formattedAddress: string };
  }

  useEffect(() => {
    const q = createCenterQuery.trim();
    if (q.length < 3) return;
    const timer = setTimeout(async () => {
      try {
        setCreateCenterPredictions(await fetchPredictions(q));
      } catch {
        setCreateCenterPredictions([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [createCenterQuery]);

  useEffect(() => {
    const q = editCenterQuery.trim();
    if (q.length < 3) return;
    const timer = setTimeout(async () => {
      try {
        setEditCenterPredictions(await fetchPredictions(q));
      } catch {
        setEditCenterPredictions([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [editCenterQuery]);

  useEffect(() => {
    if (!selectedZone) return;
    const controller = new AbortController();
    const loadMembers = async () => {
      const params = new URLSearchParams({
        page: String(zoneMemberPage),
        pageSize: String(zoneMemberPagination.pageSize),
        role: zoneMemberRole,
      });
      if (zoneMemberSearch.trim().length > 0) params.set("search", zoneMemberSearch.trim());
      const response = await fetch(`/api/admin/zones/${selectedZone.id}/members?${params.toString()}`, { signal: controller.signal });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not load zone members");
        setZoneMembers([]);
        return;
      }
      setZoneMembers(json.members ?? []);
      if (json.pagination) setZoneMemberPagination(json.pagination);
    };
    loadMembers();
    return () => controller.abort();
  }, [selectedZone, zoneMemberPage, zoneMemberPagination.pageSize, zoneMemberRole, zoneMemberSearch]);

  useEffect(() => {
    if (filteredSubscriptions.length === 0 || selectedSubscriptionId.length === 0) {
      setSelectedSubscriptionId("");
      return;
    }
    if (!filteredSubscriptions.some((subscription) => subscription.id === selectedSubscriptionId)) {
      setSelectedSubscriptionId(filteredSubscriptions[0].id);
    }
  }, [filteredSubscriptions, selectedSubscriptionId]);

  useEffect(() => {
    const controller = new AbortController();
    const loadSmsConfig = async () => {
      const response = await fetch("/api/admin/communications/sms?targetType=all", {
        signal: controller.signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSmsConfigError(typeof json.error === "string" ? json.error : null);
        return;
      }
      setSmsConfigError(typeof json.twilioConfigError === "string" ? json.twilioConfigError : null);
    };
    loadSmsConfig();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadCommunicationHealth = async () => {
      const response = await fetch("/api/admin/communications/status", {
        signal: controller.signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCommunicationHealth({ sms: null, email: null });
        return;
      }
      setCommunicationHealth({
        sms: json.channels?.sms ?? null,
        email: json.channels?.email ?? null,
      });
      if (typeof json.channels?.sms?.detail === "string" && json.channels?.sms?.status === "not_configured") {
        setSmsConfigError(json.channels.sms.detail);
      }
    };
    loadCommunicationHealth();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (smsTarget !== "zone" || !smsZoneId) {
      setSmsZoneEligibleUsers([]);
      return;
    }
    const controller = new AbortController();
    const loadZoneEligible = async () => {
      setSmsZonePreviewLoading(true);
      const response = await fetch(`/api/admin/communications/sms?targetType=zone&zoneId=${smsZoneId}`, {
        signal: controller.signal,
      });
      const json = await response.json().catch(() => ({}));
      setSmsZonePreviewLoading(false);
      if (!response.ok) {
        setSmsZoneEligibleUsers([]);
        setSmsConfigError(typeof json.error === "string" ? json.error : null);
        setMessage(json.error || "Could not load zone SMS recipients");
        return;
      }
      setSmsConfigError(typeof json.twilioConfigError === "string" ? json.twilioConfigError : null);
      setSmsZoneEligibleUsers(json.eligibleUsers ?? []);
    };
    loadZoneEligible();
    return () => controller.abort();
  }, [smsTarget, smsZoneId]);

  async function updateUserRole(userId: string, role: GlobalAppRole) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Could not update role");
    setMessage("User role updated.");
    await loadAll();
  }

  async function updatePickupStatus(requestId: string, status: string) {
    const response = await fetch("/api/admin/pickup-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, status }),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Could not update pickup request");
    setMessage("Pickup request updated.");
    await loadAll();
  }

  async function runSubscriptionAction(
    subscriptionId: string,
    action: "sync" | "schedule_cancel" | "resume" | "cancel_now",
  ) {
    if (action === "cancel_now") {
      const confirmed = window.confirm(
        "Cancel this subscription immediately in Stripe? This stops billing now and can impact customer access.",
      );
      if (!confirmed) return;
    }
    setSubscriptionActionState({ id: subscriptionId, action });
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, action }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(json.error || "Could not update Stripe subscription");

      if (json.subscription) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                subscriptions: prev.subscriptions.map((subscription) =>
                  subscription.id === json.subscription.id ? json.subscription : subscription,
                ),
              }
            : prev,
        );
      }

      const successMessage =
        action === "sync"
          ? "Billing record refreshed from Stripe."
          : action === "schedule_cancel"
            ? "Subscription will end at the close of the current billing period."
            : action === "resume"
              ? json.restarted
                ? "A new Stripe subscription was created and billing has been restarted."
                : "Auto-renewal has been restored."
              : "Subscription canceled immediately.";

      setMessage(successMessage);
      await loadAll();
    } catch {
      setMessage("Could not reach Stripe billing service.");
    } finally {
      setSubscriptionActionState(null);
    }
  }

  async function generateRoute() {
    if (!selectedCycleId) return setLogisticsMessage("Select a pickup cycle first.");
    setLogisticsMessage("");
    const response = await fetch("/api/admin/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickupCycleId: selectedCycleId, zoneCode: selectedZoneCode }),
    });
    const json = await response.json();
    if (!response.ok) {
      setLogisticsMessage(json.error || "Could not build route");
      return setMessage(json.error || "Could not build route");
    }
    setSelectedLogisticsRouteId(json.routeId);
    setMapLoadError(false);
    const nextMessage = `Route ${json.regenerated ? "refreshed" : "built"} with ${json.stopCount} stops${json.optimized ? " (Google optimized)" : ""}${
        json.missingCoordinates ? `, ${json.missingCoordinates} without coordinates` : ""
      }.`;
    setLogisticsMessage(nextMessage);
    setMessage(nextMessage);
    await loadAll();
  }

  async function loadLogisticsRoutePreview(routeId: string) {
    if (!routeId) {
      setLogisticsRoutePreview(null);
      setMapLoadError(false);
      return;
    }
    logisticsPreviewAbortRef.current?.abort();
    const controller = new AbortController();
    logisticsPreviewAbortRef.current = controller;
    try {
      const response = await fetch(`/api/admin/routes/preview?routeId=${routeId}`, { signal: controller.signal });
      const json = await response.json();
      if (!response.ok) {
        setLogisticsMessage(json.error || "Could not load route preview");
        setMessage(json.error || "Could not load route preview");
        return;
      }
      setMapLoadError(false);
      setLogisticsRoutePreview(json);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      const nextMessage = error instanceof Error ? error.message : "Could not load route preview";
      setLogisticsMessage(nextMessage);
      setMessage(nextMessage);
    }
  }

  async function assignDriver() {
    const routeId = selectedLogisticsRoute?.id;
    if (!routeId || !selectedDriverId) {
      setLogisticsMessage("Build the route first, then choose a driver.");
      return setMessage("Build the route first, then choose a driver.");
    }
    setLogisticsMessage("");
    const response = await fetch("/api/admin/routes/assign-driver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeId, driverId: selectedDriverId }),
    });
    const json = await response.json();
    if (!response.ok) {
      setLogisticsMessage(json.error || "Could not assign driver");
      return setMessage(json.error || "Could not assign driver");
    }
    const assignedDriver = driverOptions.find((driver) => driver.id === selectedDriverId);
    const successMessage = `Driver assigned: ${assignedDriver?.employee_id || "Selected driver"} -> ${getRouteDisplayLabel(selectedLogisticsRoute)}.`;
    setLogisticsMessage(successMessage);
    setMessage(successMessage);
    await loadAll();
  }

  async function updateZone(payload: {
    zoneId: string;
    radiusMiles?: number;
    status?: "pending" | "launching" | "active" | "paused";
    signupEnabled?: boolean;
    demoOnly?: boolean;
    minActiveSubscribers?: number;
    centerPlaceId?: string;
    operationModel?: "donatecrate_operated" | "partner_operated";
    partnerId?: string | null;
    partnerPickupDateOverrideAllowed?: boolean;
    recurringPickupDay?: number | null;
    defaultCutoffDaysBefore?: number;
    defaultPickupWindowLabel?: string;
    partnerNotes?: string;
  }) {
    setZoneSaving(true);
    setMessage("Saving pickup area changes...");
    try {
      const response = await fetch("/api/admin/zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) return setMessage(json.error || "Could not update pickup area");
      setMessage("Pickup area updated.");
      await loadAll();
    } finally {
      setZoneSaving(false);
    }
  }

  async function createZone() {
    if (!createCenterSelection?.placeId) return setMessage("Select an area center address from suggestions.");
    const response = await fetch("/api/admin/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...zoneForm,
        centerPlaceId: createCenterSelection.placeId,
      }),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Could not create zone");
    setMessage("Pickup area created.");
    setZoneForm({
      code: "",
      name: "",
      anchorPostalCode: "",
      radiusMiles: 3,
      minActiveSubscribers: 40,
      signupEnabled: true,
      demoOnly: false,
    });
    setCreateCenterQuery("");
    setCreateCenterPredictions([]);
    setCreateCenterSelection(null);
    if (json.zone?.id) setSelectedZoneId(json.zone.id);
    if (json.zone?.code) setSelectedZoneCode(json.zone.code);
    setShowCreateZoneForm(false);
    await loadAll();
  }

  async function createPartner() {
    const response = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: partnerForm.code,
        name: partnerForm.name,
        legalName: partnerForm.legalName,
        supportEmail: partnerForm.supportEmail,
        supportPhone: partnerForm.supportPhone,
        receiptMode: "platform_on_behalf",
        payoutModel: "inventory_only",
        platformShareBps: 10000,
        partnerShareBps: 0,
        notes: partnerForm.notes,
        branding: {
          displayName: partnerForm.displayName,
          primaryColor: partnerForm.primaryColor,
          secondaryColor: partnerForm.secondaryColor,
          accentColor: partnerForm.accentColor,
          logoUrl: partnerForm.logoUrl,
          websiteUrl: partnerForm.websiteUrl,
          receiptFooter: partnerForm.receiptFooter,
        },
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(json.error || "Could not create nonprofit partner");
    setMessage("Nonprofit partner created.");
    setPartnerForm({
      code: "",
      name: "",
      legalName: "",
      supportEmail: "",
      supportPhone: "",
      receiptMode: "platform_on_behalf",
      payoutModel: "inventory_only",
      platformShareBps: 10000,
      partnerShareBps: 0,
      notes: "",
      displayName: "",
      primaryColor: "",
      secondaryColor: "",
      accentColor: "",
      logoUrl: "",
      websiteUrl: "",
      receiptFooter: "",
    });
    if (json.partnerId) setSelectedPartnerId(json.partnerId);
    setShowCreatePartnerForm(false);
    await loadAll();
  }

  async function addPartnerMember() {
    if (!selectedPartnerId) return setMessage("Select a nonprofit partner first.");
    if (!partnerMemberEmail.trim()) return setMessage("Enter a team member email first.");
    const response = await fetch(`/api/admin/partners/${selectedPartnerId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: partnerMemberEmail, role: partnerMemberRole }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(json.error || "Could not add partner team member");
    setPartnerMemberEmail("");
    setMessage(
      json.warning
        ? `Partner team member added. Setup email could not be sent: ${json.warning}`
        : json.invited
          ? "Partner team member added and setup email sent."
          : "Partner team member added.",
    );
    await loadAll();
  }

  async function updatePartnerAccount() {
    if (!selectedPartnerForm) return setMessage("Select a nonprofit partner first.");
    const response = await fetch("/api/admin/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId: selectedPartnerForm.partnerId,
        name: selectedPartnerForm.name,
        legalName: selectedPartnerForm.legalName,
        supportEmail: selectedPartnerForm.supportEmail,
        supportPhone: selectedPartnerForm.supportPhone,
        addressLine1: selectedPartnerForm.addressLine1,
        city: selectedPartnerForm.city,
        state: selectedPartnerForm.state,
        postalCode: selectedPartnerForm.postalCode,
        aboutParagraph: selectedPartnerForm.aboutParagraph,
        active: selectedPartnerForm.active,
        receiptMode: "platform_on_behalf",
        payoutModel: "inventory_only",
        platformShareBps: 10000,
        partnerShareBps: 0,
        notes: selectedPartnerForm.notes,
        branding: {
          displayName: selectedPartnerForm.displayName,
          primaryColor: selectedPartnerForm.primaryColor,
          secondaryColor: selectedPartnerForm.secondaryColor,
          accentColor: selectedPartnerForm.accentColor,
          logoUrl: selectedPartnerForm.logoUrl,
          websiteUrl: selectedPartnerForm.websiteUrl,
          receiptFooter: selectedPartnerForm.receiptFooter,
        },
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(json.error || "Could not update nonprofit partner");
    setMessage("Nonprofit partner updated.");
    await loadAll();
  }

  async function updatePartnerMember(memberId: string, payload: { role?: "partner_admin" | "partner_coordinator" | "partner_driver"; active?: boolean }) {
    if (!selectedPartnerId) return setMessage("Select a nonprofit partner first.");
    const response = await fetch(`/api/admin/partners/${selectedPartnerId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId: memberId, ...payload }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(json.error || "Could not update partner team member");
    setMessage("Partner team member updated.");
    await loadAll();
  }

  async function deletePartnerMember(memberId: string, memberLabel: string) {
    if (!selectedPartnerId) return setMessage("Select a nonprofit partner first.");
    const confirmed = window.confirm(`Delete ${memberLabel} from this organization? This removes their access instead of only marking them inactive.`);
    if (!confirmed) return;

    const response = await fetch(`/api/admin/partners/${selectedPartnerId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId: memberId }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(json.error || "Could not delete partner team member");
    setMessage("Partner team member deleted.");
    await loadAll();
  }

  async function updateZoneCenterAddress() {
    if (!selectedZone) return setMessage("Select a pickup area first.");
    if (!editCenterSelection?.placeId) return setMessage("Select an area center address from suggestions.");
    await updateZone({ zoneId: selectedZone.id, centerPlaceId: editCenterSelection.placeId });
    setEditCenterQuery("");
    setEditCenterPredictions([]);
    setEditCenterSelection(null);
  }

  async function createPickupCycle() {
    const payload =
      pickupMode === "single"
        ? {
            mode: "single",
            zoneCode: scheduleForm.zoneCode,
            applyToAllActiveZones,
            cycleMonth: scheduleForm.cycleMonth,
            pickupDate: scheduleForm.pickupDate,
            requestCutoffAt: new Date(scheduleForm.requestCutoffAt).toISOString(),
          }
        : {
            mode: "recurring",
            zoneCode: scheduleForm.zoneCode,
            applyToAllActiveZones,
            startPickupDate: scheduleForm.startPickupDate,
            horizonMode: scheduleForm.horizonMode,
            months: Number(scheduleForm.months),
            weekendPolicy: scheduleForm.weekendPolicy,
            cutoffDaysBefore: Number(scheduleForm.cutoffDaysBefore),
          };

    const response = await fetch("/api/admin/pickup-cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Could not create pickup cycle(s)");
    setMessage(
      pickupMode === "single"
        ? `Pickup cycle saved (${json.appliedZoneCount ?? 1} zone${(json.appliedZoneCount ?? 1) > 1 ? "s" : ""}).`
        : `Recurring schedule created (${json.createdCount ?? 0} cycles across ${json.appliedZoneCount ?? 1} zone${(json.appliedZoneCount ?? 1) > 1 ? "s" : ""}, horizon ${json.horizonMonthsApplied ?? scheduleForm.months} months).`,
    );
    await loadAll();
  }

  async function sendSmsCampaign() {
    if (smsMessage.trim().length === 0) {
      setMessage("Enter an SMS message first.");
      return;
    }
    if (smsTarget === "individual" && smsUserIds.length === 0) {
      setMessage("Choose at least one individual recipient.");
      return;
    }
    if (smsTarget === "zone" && !smsZoneId) {
      setMessage("Choose a zone for zone broadcast.");
      return;
    }

    setSmsSending(true);
    try {
      const response = await fetch("/api/admin/communications/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: smsTarget,
          userIds: smsTarget === "individual" ? smsUserIds : undefined,
          zoneId: smsTarget === "zone" ? smsZoneId : undefined,
          includeStaff: smsTarget === "all" ? smsIncludeStaff : undefined,
          message: smsMessage.trim(),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "SMS send failed.");
        return;
      }

      const failedSummary =
        Array.isArray(json.failedRecipients) && json.failedRecipients.length > 0
          ? ` First failure: ${json.failedRecipients[0].error}.`
          : "";
      setMessage(`SMS campaign complete. Attempted ${json.attempted}, sent ${json.sent}, failed ${json.failed}.${failedSummary}`);
      if (smsTarget === "individual") setSmsUserIds([]);
      setSmsMessage("");
    } catch {
      setMessage("Could not reach SMS service.");
    } finally {
      setSmsSending(false);
    }
  }

  async function queueCycleReminders(cadence: "72h" | "24h" | "day_of") {
    if (!selectedCycleId) return setMessage("Select a pickup cycle in Logistics or Pickups first.");
    setNotificationActionLoading(true);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue_cycle_reminders", pickupCycleId: selectedCycleId, cadence }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(json.error || "Could not queue reminders");
      setMessage(`Queued ${json.queued ?? 0} ${cadence} reminder notifications.`);
      await loadAll();
    } finally {
      setNotificationActionLoading(false);
    }
  }

  async function retrySelectedNotifications() {
    if (notificationSelection.length === 0) return setMessage("Select at least one failed notification.");
    setNotificationActionLoading(true);
    try {
      const queueResponse = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_events", eventIds: notificationSelection }),
      });
      const queueJson = await queueResponse.json().catch(() => ({}));
      if (!queueResponse.ok) return setMessage(queueJson.error || "Could not queue retries");

      const sendResponse = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: notificationSelection }),
      });
      const sendJson = await sendResponse.json().catch(() => ({}));
      if (!sendResponse.ok) return setMessage(sendJson.error || "Could not process notifications");

      setNotificationSelection([]);
      setMessage(
        `Retried ${sendJson.attempted ?? 0} notifications. Sent: ${sendJson.sent ?? 0}, failed: ${sendJson.failed ?? 0}, skipped: ${sendJson.skipped ?? 0}${queueJson.blocked ? `, blocked from retry: ${queueJson.blocked}` : ""}.`,
      );
      await loadAll();
    } finally {
      setNotificationActionLoading(false);
    }
  }

  async function processQueuedNotifications() {
    setNotificationActionLoading(true);
    try {
      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 25 }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(json.error || "Could not process queued notifications");
      setMessage(
        `Processed ${json.attempted ?? 0} queued notifications. Sent: ${json.sent ?? 0}, failed: ${json.failed ?? 0}, skipped: ${json.skipped ?? 0}.`,
      );
      await loadAll();
    } finally {
      setNotificationActionLoading(false);
    }
  }

  if (!data) return <p className="text-sm text-white/75">Loading admin workspace...</p>;

  return (
    <div className="space-y-6">
      {section === "overview" ? (
        <section className="space-y-4">
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Operational Snapshot</p>
            <h2 className="mt-2 text-2xl font-bold">What needs attention first</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              Treat this page as the top of the day board: confirm cycle volume, clear delivery failures, then move into dispatch once the stop list is stable.
            </p>
          </article>
          <section className="grid gap-4 xl:grid-cols-3">
            <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Ready Routes</p>
              <p className="mt-2 text-4xl font-bold">{opsOverview.readyRoutes}</p>
              <p className="mt-2 text-sm text-white/70">Routes already assigned or in progress.</p>
            </article>
            <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Draft Routes</p>
              <p className="mt-2 text-4xl font-bold">{opsOverview.draftRoutes}</p>
              <p className="mt-2 text-sm text-white/70">Cycles with a route built but not yet staffed.</p>
            </article>
            <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Cycle Exceptions</p>
              <p className="mt-2 text-4xl font-bold">{opsOverview.cycleExceptions}</p>
              <p className="mt-2 text-sm text-white/70">Households marked not ready or missed and likely needing follow-up.</p>
            </article>
          </section>
          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
              <h3 className="text-lg font-bold">Recommended workflow</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">1. Calendar</p>
                  <p className="mt-2 text-sm text-white/80">Check Pickup Calendar for the next service day and request volume.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">2. Dispatch</p>
                  <p className="mt-2 text-sm text-white/80">Build one route per zone and cycle, then assign the driver.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">3. Support</p>
                  <p className="mt-2 text-sm text-white/80">Use Messages and Billing to clear failures before they snowball.</p>
                </div>
              </div>
            </article>
            <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
              <h3 className="text-lg font-bold">Attention queue</h3>
              <div className="mt-4 space-y-3 text-sm text-white/75">
                <p><span className="font-semibold text-white">{opsOverview.activeZones}</span> active zones currently open.</p>
                <p><span className="font-semibold text-white">{opsOverview.attentionSubscriptions}</span> subscriber accounts need billing review.</p>
                <p><span className="font-semibold text-white">{failedNotificationEvents.length}</span> message failures are in the log.</p>
                <p><span className="font-semibold text-white">{opsOverview.openWaitlist}</span> waitlist records still need conversion planning.</p>
              </div>
            </article>
          </section>
        </section>
      ) : null}

      {section === "people" ? (
        <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <a
              href="/admin?tab=people&sub=customers"
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                peopleSubtab === "customers"
                  ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                  : "border-white/20 bg-black/30 hover:bg-white/10"
              }`}
            >
              Customers
            </a>
            <a
              href="/admin?tab=people&sub=staff"
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                peopleSubtab === "staff"
                  ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                  : "border-white/20 bg-black/30 hover:bg-white/10"
              }`}
            >
              Staff
            </a>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{peopleSubtab === "customers" ? "Donor Directory" : "Team Directory"}</p>
              <p className="text-xs text-white/65">
                {peopleSubtab === "customers"
                  ? "Search donor accounts by name, email, or ZIP and check where they are assigned."
                  : "Review DonateCrate staff and organization team roles without donor records mixed in."}
              </p>
            </div>
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search users"
              className="h-10 w-full rounded-xl border border-white/25 bg-black px-3 text-sm sm:min-w-[220px] sm:w-auto"
            />
            {peopleSubtab === "staff" ? (
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as "all" | GlobalAppRole)}
                className="h-10 w-full rounded-xl border border-white/25 bg-black px-3 text-sm sm:w-auto"
              >
                <option value="all">All team roles</option>
                <option value="customer">Donor accounts</option>
                <option value="driver">Driver</option>
                <option value="admin">DonateCrate Admin</option>
              </select>
            ) : (
              <div className="h-10 rounded-xl border border-white/15 bg-black/30 px-3 text-sm flex items-center text-white/60">
                Showing donor accounts
              </div>
            )}
            <select
              value={userZoneFilter}
              onChange={(event) => setUserZoneFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-white/25 bg-black px-3 text-sm sm:w-auto"
            >
              <option value="all">All zones</option>
              {data.zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-2">
            {(peopleSubtab === "customers" ? filteredCustomerUsers : filteredStaffUsers).map((user) => (
              <article key={user.id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{user.full_name || "No name set"}</p>
                    <p className="text-xs text-white/70">{user.email}</p>
                  </div>
                  {peopleSubtab === "staff" ? (
                    <select
                      value={user.role}
                      onChange={(event) => updateUserRole(user.id, event.target.value as GlobalAppRole)}
                      className="h-9 rounded-lg border border-white/30 bg-black px-3 text-xs"
                    >
                      <option value="customer">Donor</option>
                      <option value="driver">Driver</option>
                      <option value="admin">DonateCrate Admin</option>
                    </select>
                  ) : (
                    <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/75">Donor</span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-white/70 md:grid-cols-3">
                  <p>Phone: {user.phone || "Not set"}</p>
                  <p>
                    Address:{" "}
                    {user.primary_address
                      ? `${user.primary_address.address_line1}, ${user.primary_address.city}, ${user.primary_address.state} ${user.primary_address.postal_code}`
                      : "Not set"}
                  </p>
                  <p>
                    Service areas:{" "}
                    {user.zones.length > 0
                      ? user.zones.map((zone) => `${zone.name} (${zone.membershipStatus})`).join(" | ")
                      : "Unassigned"}
                  </p>
                </div>
              </article>
            ))}
            {(peopleSubtab === "customers" ? filteredCustomerUsers : filteredStaffUsers).length === 0 ? (
              <p className="text-sm text-white/65">No users match the current filters.</p>
            ) : null}
          </div>

          <section className="mt-6 rounded-2xl border border-white/10 bg-black/35 p-4">
            <p className="text-sm font-semibold">{peopleSubtab === "customers" ? "Donors And Billing" : "Team And Network"}</p>
            <p className="mt-2 text-sm text-white/70">
              {peopleSubtab === "customers"
                ? "Use this view for donor contact details and service area placement. Use Billing for cancellations, renewals, payment status, and Stripe-backed subscription actions."
                : "Use this view for DonateCrate and organization team roles. Use Network for service area ownership and organization account management."}
            </p>
          </section>
        </section>
      ) : null}

      {section === "billing" ? (
        <section className="space-y-4">
          <article
            className="rounded-3xl border p-6"
            style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Billing Control</p>
            <h2 className="mt-2 text-2xl font-bold">Manage Stripe subscriptions without leaving DonateCrate</h2>
            <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--admin-muted)" }}>
              Keep the roster readable in one line. Expand only the subscriber you need to inspect, then manage Stripe
              actions, invoice state, and payment-method preview inline.
            </p>
          </article>

          <div className="grid gap-4 lg:grid-cols-4">
            <article className="rounded-3xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Active Subscribers</p>
              <p className="mt-3 text-3xl font-bold">
                {data.subscriptions.filter((subscription) => subscription.status === "active").length}
              </p>
            </article>
            <article className="rounded-3xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Ending This Period</p>
              <p className="mt-3 text-3xl font-bold">
                {data.subscriptions.filter((subscription) => subscription.cancelAtPeriodEnd).length}
              </p>
            </article>
            <article className="rounded-3xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Needs Attention</p>
              <p className="mt-3 text-3xl font-bold">
                {data.subscriptions.filter((subscription) => ["past_due", "canceled"].includes(subscription.status)).length}
              </p>
            </article>
            <article className="rounded-3xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Saved Card on File</p>
              <p className="mt-3 text-3xl font-bold">
                {data.subscriptions.filter((subscription) => subscription.paymentMethod?.type === "card").length}
              </p>
            </article>
          </div>

          <article className="rounded-3xl border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold">Subscriber billing roster</p>
                <p className="mt-1 text-xs" style={{ color: "var(--admin-soft-text)" }}>
                  Search by subscriber, Stripe customer ID, or Stripe subscription ID. Click any row to expand the full billing detail.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={subscriptionSearch}
                  onChange={(event) => setSubscriptionSearch(event.target.value)}
                  placeholder="Search billing records"
                  className="h-11 min-w-0 rounded-xl border px-3 text-sm"
                  style={{ borderColor: "var(--admin-border-strong)", background: "var(--admin-panel)" }}
                />
                <select
                  value={subscriptionStatusFilter}
                  onChange={(event) =>
                    setSubscriptionStatusFilter(
                      event.target.value as "all" | "active" | "past_due" | "paused" | "canceled",
                    )
                  }
                  className="h-11 rounded-xl border px-3 text-sm"
                  style={{ borderColor: "var(--admin-border-strong)", background: "var(--admin-panel)" }}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past due</option>
                  <option value="paused">Paused</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
            </div>
          </article>

          <section className="space-y-3">
            {filteredSubscriptions.map((subscription) => {
              const isOpen = selectedSubscription?.id === subscription.id;
              const actionBusy = subscriptionActionState?.id === subscription.id;
              const isEnded = subscription.status === "canceled";
              const canScheduleCancel = !isEnded && !subscription.cancelAtPeriodEnd && !!subscription.stripeSubscriptionId;
              const canResume =
                (subscription.cancelAtPeriodEnd && !!subscription.stripeSubscriptionId) ||
                (isEnded && !!subscription.stripeCustomerId && !!subscription.plan.stripePriceId);

              return (
                <article
                  key={subscription.id}
                  className="overflow-hidden rounded-3xl border transition"
                  style={{
                    borderColor: isOpen ? "var(--dc-orange)" : "var(--admin-border)",
                    background: isOpen
                      ? "linear-gradient(160deg, rgba(255,106,0,0.1), var(--admin-surface-strong))"
                      : "var(--admin-surface)",
                    boxShadow: isOpen ? "0 18px 45px rgba(0,0,0,0.12)" : "none",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSubscriptionId(isOpen ? "" : subscription.id)}
                    className="w-full px-4 py-4 text-left"
                  >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_120px_170px_170px_220px_32px] xl:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{subscription.user.fullName || subscription.user.email}</p>
                        <p className="truncate text-xs" style={{ color: "var(--admin-soft-text)" }}>{subscription.user.email}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--admin-soft-text)" }}>Status</p>
                        <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${getBillingStatusTone(subscription.status)}`}>
                          {formatStatusLabel(subscription.status)}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--admin-soft-text)" }}>Plan</p>
                        <p className="mt-1 text-sm font-medium">{formatCurrency(subscription.plan.amountCents, subscription.plan.currency)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--admin-soft-text)" }}>Renews / ends</p>
                        <p className="mt-1 text-sm font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--admin-soft-text)" }}>Payment preview</p>
                        <p className="mt-1 truncate text-sm font-medium">{getPaymentPreviewLabel(subscription)}</p>
                      </div>
                      <div className="text-right text-lg font-semibold" style={{ color: "var(--admin-soft-text)" }}>
                        {isOpen ? "−" : "+"}
                      </div>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t px-4 pb-4 pt-4" style={{ borderColor: "var(--admin-border)" }}>
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                        <div className="space-y-4">
                          <article className="rounded-[28px] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-strong)" }}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Subscription Overview</p>
                                <h3 className="mt-2 text-2xl font-bold">{subscription.user.fullName || subscription.user.email}</h3>
                                <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>{subscription.user.phone || "Phone not on file"}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${getBillingStatusTone(subscription.status)}`}>
                                  {formatStatusLabel(subscription.status)}
                                </span>
                                <span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-muted)" }}>
                                  {subscription.cancelAtPeriodEnd ? "Cancellation scheduled" : "Recurring billing on"}
                                </span>
                              </div>
                            </div>
                            <p className="mt-4 text-sm leading-6" style={{ color: "var(--admin-muted)" }}>
                              {getBillingStatusExplanation(subscription)}
                            </p>
                          </article>

                          <article className="rounded-[28px] border p-5" style={{ borderColor: "var(--admin-border)", background: "linear-gradient(135deg,#ff6a00 0%, #d45a07 38%, #f4ede7 100%)", color: "#ffffff" }}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-white/70">Payment method preview</p>
                                <p className="mt-2 text-2xl font-bold capitalize">
                                  {subscription.paymentMethod?.brand || subscription.paymentMethod?.type || "Unavailable"}
                                </p>
                              </div>
                              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                                {subscription.paymentMethod?.funding || "stored"}
                              </span>
                            </div>
                            <p className="mt-12 font-mono text-2xl tracking-[0.28em] text-white/95">
                              •••• •••• •••• {subscription.paymentMethod?.last4 || "----"}
                            </p>
                            <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Card expires</p>
                                <p className="mt-1 font-semibold">{formatCardExpiry(subscription.paymentMethod?.expMonth ?? null, subscription.paymentMethod?.expYear ?? null)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Country</p>
                                <p className="mt-1 font-semibold">{subscription.paymentMethod?.country || "Unknown"}</p>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Charge amount</p>
                                <p className="mt-1 font-semibold">{formatCurrency(subscription.plan.amountCents, subscription.plan.currency)}</p>
                              </div>
                            </div>
                          </article>
                        </div>

                        <div className="space-y-4">
                          <article className="rounded-[28px] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-strong)" }}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">Timeline and invoice</p>
                                <p className="mt-1 text-xs" style={{ color: "var(--admin-soft-text)" }}>Renewal timing, latest invoice status, and Stripe record links.</p>
                              </div>
                              {subscription.latestInvoice?.hostedInvoiceUrl ? (
                                <a
                                  href={subscription.latestInvoice.hostedInvoiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border px-3 py-2 text-xs font-semibold hover:bg-white/10"
                                  style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-text)" }}
                                >
                                  Open invoice
                                </a>
                              ) : null}
                            </div>
                            <div className="mt-4 space-y-3">
                              {[
                                ["Period started", formatDate(subscription.currentPeriodStart)],
                                ["Next renewal / access end", formatDate(subscription.currentPeriodEnd)],
                                ["Latest invoice status", subscription.latestInvoiceStatus || "Unavailable"],
                                ["Last Stripe sync", formatDateTime(subscription.updatedAt)],
                                [
                                  "Invoice amount due",
                                  subscription.latestInvoice
                                    ? formatCurrency(subscription.latestInvoice.amountDueCents, subscription.latestInvoice.currency || subscription.plan.currency)
                                    : "Not available",
                                ],
                                [
                                  "Invoice amount paid",
                                  subscription.latestInvoice
                                    ? formatCurrency(subscription.latestInvoice.amountPaidCents, subscription.latestInvoice.currency || subscription.plan.currency)
                                    : "Not available",
                                ],
                              ].map(([label, value]) => (
                                <div
                                  key={label}
                                  className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm"
                                  style={{ borderColor: "var(--admin-border)", background: "var(--admin-panel)" }}
                                >
                                  <span style={{ color: "var(--admin-muted)" }}>{label}</span>
                                  <span className="font-semibold" style={{ color: "var(--admin-text)" }}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </article>

                          <article className="rounded-[28px] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-strong)" }}>
                            <p className="text-sm font-semibold">Stripe controls</p>
                            <p className="mt-1 text-xs" style={{ color: "var(--admin-soft-text)" }}>
                              Refresh the Stripe record, schedule end-of-term cancellation, restore auto-renew, or cancel immediately.
                            </p>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => runSubscriptionAction(subscription.id, "sync")}
                                disabled={actionBusy}
                                className="rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                style={{ borderColor: "var(--admin-border-strong)", background: "var(--admin-panel)" }}
                              >
                                {actionBusy && subscriptionActionState?.action === "sync" ? "Refreshing..." : "Refresh from Stripe"}
                              </button>
                              <button
                                type="button"
                                onClick={() => runSubscriptionAction(subscription.id, "schedule_cancel")}
                                disabled={actionBusy || !canScheduleCancel}
                                className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {subscription.cancelAtPeriodEnd ? "Cancellation scheduled" : "End after current period"}
                              </button>
                              <button
                                type="button"
                                onClick={() => runSubscriptionAction(subscription.id, "resume")}
                                disabled={actionBusy || !canResume}
                                className="rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isEnded ? "Restart subscription" : "Restore auto-renew"}
                              </button>
                              <button
                                type="button"
                                onClick={() => runSubscriptionAction(subscription.id, "cancel_now")}
                                disabled={actionBusy || isEnded || !subscription.stripeSubscriptionId}
                                className="rounded-xl border border-red-400/35 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-100 hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {actionBusy && subscriptionActionState?.action === "cancel_now" ? "Canceling..." : "Cancel immediately"}
                              </button>
                            </div>
                            <div className="mt-4 grid gap-3 text-xs" style={{ color: "var(--admin-soft-text)" }}>
                              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-panel)" }}>
                                Stripe customer: <span className="font-mono" style={{ color: "var(--admin-text)" }}>{subscription.stripeCustomerId || "Not linked"}</span>
                              </div>
                              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-panel)" }}>
                                Stripe subscription: <span className="font-mono" style={{ color: "var(--admin-text)" }}>{subscription.stripeSubscriptionId || "Not linked"}</span>
                              </div>
                            </div>
                          </article>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {filteredSubscriptions.length === 0 ? (
              <article
                className="rounded-3xl border border-dashed p-8 text-sm"
                style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-soft-text)" }}
              >
                No billing records match the current search or status filters.
              </article>
            ) : null}
          </section>
        </section>
      ) : null}

      {section === "network" ? (
        <section className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/15 bg-white/5 p-4">
              <p className="text-sm font-semibold">Network Workspace</p>
              <p className="mt-1 text-xs text-white/65">Separate service area operations from nonprofit account management.</p>
              <div className="mt-3 space-y-2">
                <a
                  href="/admin?tab=network&sub=zones"
                  className={`block rounded-xl border px-3 py-2 text-sm font-semibold ${
                    networkSubtab === "zones"
                      ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                      : "border-white/20 bg-black/30 hover:bg-white/10"
                  }`}
                >
                  Zones
                </a>
                <a
                  href="/admin?tab=network&sub=partners"
                  className={`block rounded-xl border px-3 py-2 text-sm font-semibold ${
                    networkSubtab === "partners"
                      ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                      : "border-white/20 bg-black/30 hover:bg-white/10"
                  }`}
                >
                  Partners
                </a>
              </div>
            </div>

            {networkSubtab === "zones" ? (
              <div className="rounded-3xl border border-white/15 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Service Areas</p>
                    <p className="mt-1 text-xs text-white/65">Select a service area to review settings, coverage, and scheduling.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateZoneForm((prev) => !prev);
                      if (!showCreateZoneForm) setSelectedZoneId("");
                    }}
                    className="rounded-lg border border-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-[var(--dc-orange)]"
                  >
                    {showCreateZoneForm ? "Close New Service Area Form" : "Add New Service Area"}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {data.zones.map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => {
                        setSelectedZoneId(zone.id);
                        setSelectedZoneCode(zone.code);
                        setScheduleForm((prev) => ({ ...prev, zoneCode: zone.code }));
                        setZoneMemberPage(1);
                        setShowCreateZoneForm(false);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        selectedZoneId === zone.id
                          ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                          : "border-white/20 bg-black/30 hover:bg-white/10"
                      }`}
                    >
                      <p className="font-semibold">{zone.name}</p>
                      <p className="text-xs text-white/65">ZIP {zone.anchor_postal_code} | {formatZoneStatusLabel(zone.status)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/15 bg-white/5 p-4">
                <p className="text-sm font-semibold">Organizations</p>
                <p className="mt-1 text-xs text-white/65">Select an organization to manage branding, contact details, and team access.</p>
                <div className="mt-3 space-y-2">
                  {partnerOptions.map((partner) => (
                    <button
                      key={partner.id}
                      type="button"
                      onClick={() => setSelectedPartnerId(partner.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        selectedPartnerId === partner.id
                          ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                          : "border-white/20 bg-black/30 hover:bg-white/10"
                      }`}
                    >
                      <p className="font-semibold">{partner.name}</p>
                      <p className="text-xs text-white/65">{partner.code} | {partner.active ? "Active" : "Inactive"}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className="space-y-4">
            {(networkSubtab === "zones" && selectedZone) || networkSubtab === "partners" ? (
              <>
                {networkSubtab === "zones" ? (
                  <>
                <form
                  key={selectedZone!.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    updateZone({
                      zoneId: selectedZone!.id,
                      radiusMiles: Number(form.get("radiusMiles")),
                      minActiveSubscribers: Number(form.get("minActiveSubscribers")),
                      status: String(form.get("status")) as "pending" | "launching" | "active" | "paused",
                      demoOnly: form.get("demoOnly") === "on",
                      operationModel: String(form.get("operationModel")) as "donatecrate_operated" | "partner_operated",
                      partnerId: String(form.get("partnerId") || "") || null,
                      partnerPickupDateOverrideAllowed: form.get("partnerPickupDateOverrideAllowed") === "on",
                      recurringPickupDay: String(form.get("recurringPickupDay") || "").trim()
                        ? Number(form.get("recurringPickupDay"))
                        : null,
                      defaultCutoffDaysBefore: Number(form.get("defaultCutoffDaysBefore") || 7),
                      defaultPickupWindowLabel: String(form.get("defaultPickupWindowLabel") || ""),
                      partnerNotes: String(form.get("partnerNotes") || ""),
                    });
                  }}
                  className="rounded-3xl border border-white/15 bg-white/5 p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">{selectedZone!.name}</h3>
                      <p className="text-xs text-white/65">{selectedZone!.code} | ZIP {selectedZone!.anchor_postal_code}</p>
                    </div>
                    {isDemoOnlyZone(selectedZone!) ? (
                      <div className="rounded-full border border-amber-300/50 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                        Demo only
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateZone({ zoneId: selectedZone!.id, signupEnabled: true })}
                        disabled={selectedZone!.signup_enabled}
                        className="rounded-lg border border-green-400/60 px-3 py-2 text-xs font-semibold text-green-300 disabled:opacity-40"
                      >
                        Open Signup
                      </button>
                      <button
                        type="button"
                        onClick={() => updateZone({ zoneId: selectedZone!.id, signupEnabled: false })}
                        disabled={!selectedZone!.signup_enabled}
                        className="rounded-lg border border-yellow-400/60 px-3 py-2 text-xs font-semibold text-yellow-300 disabled:opacity-40"
                      >
                        Pause Signup
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="text-xs text-white/70">
                      Service Radius (miles)
                      <input
                        name="radiusMiles"
                        type="number"
                        min={0.5}
                        step={0.5}
                        defaultValue={selectedZone!.radius_miles}
                        className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3"
                      />
                    </label>
                    <label className="text-xs text-white/70">
                      Active households
                      <input
                        name="minActiveSubscribers"
                        type="number"
                        min={1}
                        defaultValue={selectedZone!.min_active_subscribers}
                        className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3"
                      />
                    </label>
                    <label className="text-xs text-white/70">
                      Service area status
                      <select name="status" defaultValue={selectedZone!.status} className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3">
                        <option value="pending">Planning</option>
                        <option value="launching">Opening Soon</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-white/70">
                      Service lead
                      <select name="operationModel" defaultValue={selectedZone!.operation_model} className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3">
                        <option value="donatecrate_operated">DonateCrate managed</option>
                        <option value="partner_operated">Organization managed</option>
                      </select>
                    </label>
                    <label className="text-xs text-white/70">
                      Organization
                      <select name="partnerId" defaultValue={selectedZone!.partner_id ?? ""} className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3">
                        <option value="">No organization assigned</option>
                        {partnerOptions.map((partner) => (
                          <option key={partner.id} value={partner.id}>{partner.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-white/80 md:col-span-2">
                      <input name="partnerPickupDateOverrideAllowed" type="checkbox" defaultChecked={selectedZone!.partner_pickup_date_override_allowed} />
                      Let the organization manage pickup dates for this service area
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-white/80 md:col-span-2">
                      <input name="demoOnly" type="checkbox" defaultChecked={selectedZone!.demo_only} />
                      Demo only: keep this service area available for staff demos but block public signup
                    </label>
                    <label className="text-xs text-white/70">
                      Recurring pickup day
                      <input
                        name="recurringPickupDay"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={selectedZone!.recurring_pickup_day ?? ""}
                        className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3"
                      />
                    </label>
                    <label className="text-xs text-white/70">
                      Booking cutoff
                      <input
                        name="defaultCutoffDaysBefore"
                        type="number"
                        min={0}
                        max={30}
                        defaultValue={selectedZone!.default_cutoff_days_before}
                        className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3"
                      />
                      <span className="mt-1 block text-[11px] text-white/55">How many days before pickup changes close.</span>
                    </label>
                    <label className="text-xs text-white/70 md:col-span-2">
                      Pickup window
                      <input
                        name="defaultPickupWindowLabel"
                        type="text"
                        defaultValue={selectedZone!.default_pickup_window_label ?? ""}
                        className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3"
                      />
                    </label>
                    <label className="text-xs text-white/70 md:col-span-2">
                      Team notes
                      <textarea
                        name="partnerNotes"
                        defaultValue={selectedZone!.partner_notes ?? ""}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-white/30 bg-black px-3 py-2"
                        placeholder="Notes for staff handling this service area"
                      />
                    </label>
                  </div>

                  <p className="mt-3 text-xs text-white/65">Area center: {selectedZone!.center_address || "Not set"}</p>
                  {selectedZone!.demo_only ? (
                    <p className="mt-1 text-xs text-amber-200">Public signup is blocked for this demo service area, even if signup is turned on.</p>
                  ) : null}
                  <p className="mt-1 text-xs text-white/65">
                    Service lead: {selectedZone!.operation_model === "partner_operated"
                      ? selectedZone!.partner?.name || "No organization assigned"
                      : "DonateCrate team"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="submit" disabled={zoneSaving} className="rounded-lg border border-white/35 px-4 py-2 text-sm font-semibold disabled:opacity-60">
                      {zoneSaving ? "Saving..." : "Save Zone Settings"}
                    </button>
                  </div>
                </form>

                <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
                  <h4 className="text-lg font-bold">People In This Service Area</h4>
                  <p className="mt-1 text-xs text-white/65">Donors and team members currently connected to this coverage area.</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <input
                      value={zoneMemberSearch}
                      onChange={(event) => {
                        setZoneMemberSearch(event.target.value);
                        setZoneMemberPage(1);
                      }}
                      placeholder="Search members"
                      className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm"
                    />
                    <select
                      value={zoneMemberRole}
                      onChange={(event) => {
                        setZoneMemberRole(event.target.value as "all" | "customer" | "admin" | "driver" | "partner_admin" | "partner_coordinator" | "partner_driver");
                        setZoneMemberPage(1);
                      }}
                      className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm"
                    >
                      <option value="all">All people</option>
                      <option value="customer">Donor</option>
                      <option value="driver">Driver</option>
                      <option value="admin">DonateCrate Admin</option>
                      <option value="partner_admin">Organization Admin</option>
                      <option value="partner_coordinator">Coordinator</option>
                      <option value="partner_driver">Driver</option>
                    </select>
                    <p className="text-xs text-white/70 md:self-center">
                      {zoneMemberPagination.total} total members
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {zoneMembers.map((user) => (
                      <div key={user.id} className="rounded-xl border border-white/10 bg-black/35 p-3">
                        <p className="text-sm font-semibold">{user.full_name || user.email}</p>
                        <p className="text-xs text-white/70">{user.email} | {formatRoleLabel(user.role)}</p>
                        <p className="mt-1 text-xs text-white/65">{user.primary_address ? `${user.primary_address.address_line1}, ${user.primary_address.city}` : "Address not set"}</p>
                      </div>
                    ))}
                    {zoneMembers.length === 0 ? <p className="text-sm text-white/65">No active members found for this zone.</p> : null}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoneMemberPage((prev) => Math.max(1, prev - 1))}
                      disabled={zoneMemberPagination.page <= 1}
                      className="rounded border border-white/25 px-2 py-1 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="text-white/70">Page {zoneMemberPagination.page} of {zoneMemberPagination.totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setZoneMemberPage((prev) => Math.min(zoneMemberPagination.totalPages, prev + 1))}
                      disabled={zoneMemberPagination.page >= zoneMemberPagination.totalPages}
                      className="rounded border border-white/25 px-2 py-1 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
                  <h4 className="text-lg font-bold">Update Service Area Center</h4>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                      value={editCenterQuery}
                      onChange={(event) => {
                        setEditCenterQuery(event.target.value);
                        setEditCenterSelection(null);
                        if (event.target.value.trim().length < 3) setEditCenterPredictions([]);
                      }}
                      placeholder="Search zone center address"
                      className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm"
                    />
                    <button onClick={updateZoneCenterAddress} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">Save Center Address</button>
                  </div>
                  {editCenterPredictions.length > 0 ? (
                    <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-white/20 bg-black/40 p-2">
                      {editCenterPredictions.map((prediction) => (
                        <button
                          key={prediction.placeId}
                          type="button"
                          onClick={async () => {
                            const details = await fetchPlaceDetails(prediction.placeId);
                            setEditCenterSelection({ placeId: prediction.placeId, formattedAddress: details.formattedAddress });
                            setEditCenterQuery(details.formattedAddress);
                            setEditCenterPredictions([]);
                          }}
                          className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-white/10"
                        >
                          {prediction.mainText}
                          <p className="text-xs text-white/70">{prediction.secondaryText || prediction.description}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {editCenterSelection ? <p className="mt-2 text-xs text-white/70">Selected: {editCenterSelection.formattedAddress}</p> : null}
                </section>
                  </>
                ) : null}

                {networkSubtab === "partners" ? (
                <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold">Organizations</h4>
                      <p className="mt-1 text-xs text-white/65">Create organization records, manage team access, and connect each organization to the right service areas.</p>
                    </div>
                    <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreatePartnerForm((prev) => !prev);
                          if (!showCreatePartnerForm) setSelectedPartnerId("");
                        }}
                        className="rounded-lg border border-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-[var(--dc-orange)]"
                      >
                        {showCreatePartnerForm ? "Close New Partner Form" : "Add New Partner"}
                      </button>
                      <select
                        value={selectedPartnerId}
                        onChange={(event) => {
                          setSelectedPartnerId(event.target.value);
                          setShowCreatePartnerForm(false);
                        }}
                        className="h-10 w-full rounded-lg border border-white/30 bg-black px-3 text-sm sm:w-auto"
                      >
                        <option value="">Select organization</option>
                        {partnerOptions.map((partner) => (
                          <option key={partner.id} value={partner.id}>{partner.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedPartner ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                        <article className="rounded-2xl border border-white/10 bg-black/35 p-4 text-sm text-white/80">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{selectedPartner.name}</p>
                              <p className="mt-1 text-xs text-white/65">{selectedPartner.code} | Receipts sent by DonateCrate on behalf of this nonprofit</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedPartner.active ? "bg-emerald-500/15 text-emerald-100" : "bg-red-500/15 text-red-100"}`}>
                              {selectedPartner.active ? "Active partner" : "Inactive partner"}
                              
                            </span>
                          </div>
                          <p className="mt-3 text-xs text-white/70">
                            Support: {selectedPartner.support_email || "No email"} {selectedPartner.support_phone ? `| ${selectedPartner.support_phone}` : ""}
                          </p>
                          <p className="mt-2 text-xs text-white/70">
                            Receipts send from giving@donatecrate.com and use this nonprofit&apos;s branding.
                          </p>
                          <p className="mt-2 text-xs text-white/70">
                            Service areas: {selectedPartner.zones.length > 0 ? selectedPartner.zones.map((zone) => zone.name).join(" | ") : "None yet"}
                          </p>
                        </article>
                        <article className="rounded-2xl border border-white/10 bg-black/35 p-4">
                          <p className="text-sm font-semibold">Add team member</p>
                          <p className="mt-1 text-xs text-white/65">Use any email address. If the person is new to DonateCrate, we will create the account and send a branded setup email for this organization.</p>
                          <div className="mt-3 grid gap-2">
                            <input
                              value={partnerMemberEmail}
                              onChange={(event) => setPartnerMemberEmail(event.target.value)}
                              placeholder="Work email address"
                              className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm"
                            />
                            <select
                              value={partnerMemberRole}
                              onChange={(event) => setPartnerMemberRole(event.target.value as "partner_admin" | "partner_coordinator" | "partner_driver")}
                              className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm"
                            >
                              <option value="partner_admin">Organization Admin</option>
                              <option value="partner_coordinator">Coordinator</option>
                              <option value="partner_driver">Driver</option>
                            </select>
                            <button onClick={addPartnerMember} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">
                              Add Team Member
                            </button>
                          </div>
                        </article>
                      </div>

                      {selectedPartnerForm ? (
                        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                          <article className="rounded-2xl border border-white/10 bg-black/35 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">Organization account</p>
                                <p className="mt-1 text-xs text-white/65">Update the organization&apos;s contact details, profile information, and donor-facing branding here.</p>
                              </div>
                              <label className="inline-flex items-center gap-2 text-xs text-white/80">
                                <input
                                  type="checkbox"
                                  checked={selectedPartnerForm.active}
                                  onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, active: event.target.checked } : prev))}
                                />
                                Active
                              </label>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <input value={selectedPartnerForm.name} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))} placeholder="Organization name" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <input value={selectedPartner.code} disabled className="h-10 rounded-lg border border-white/15 bg-black/50 px-3 text-sm opacity-70" />
                              <input value={selectedPartnerForm.legalName} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, legalName: event.target.value } : prev))} placeholder="Legal name" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <input value={selectedPartnerForm.supportEmail} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, supportEmail: event.target.value } : prev))} placeholder="Support email" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <input value={selectedPartnerForm.supportPhone} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, supportPhone: event.target.value } : prev))} placeholder="Support phone" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <input value={selectedPartnerForm.websiteUrl} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, websiteUrl: event.target.value } : prev))} placeholder="Website URL" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <input value={selectedPartnerForm.addressLine1} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, addressLine1: event.target.value } : prev))} placeholder="Mailing address" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm md:col-span-2" />
                              <input value={selectedPartnerForm.city} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, city: event.target.value } : prev))} placeholder="City" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <div className="grid gap-3 sm:grid-cols-2">
                                <input value={selectedPartnerForm.state} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, state: event.target.value } : prev))} placeholder="State" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                                <input value={selectedPartnerForm.postalCode} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, postalCode: event.target.value } : prev))} placeholder="ZIP code" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              </div>
                              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/70 md:col-span-2">
                                Receipt delivery is handled by DonateCrate on behalf of this nonprofit. Payout settings stay internal for now and are not edited here.
                              </div>
                              <textarea value={selectedPartnerForm.aboutParagraph} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, aboutParagraph: event.target.value } : prev))} rows={4} placeholder="About paragraph" className="rounded-lg border border-white/25 bg-black px-3 py-2 text-sm md:col-span-2" />
                              <textarea value={selectedPartnerForm.notes} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))} rows={3} placeholder="Team notes" className="rounded-lg border border-white/25 bg-black px-3 py-2 text-sm md:col-span-2" />
                            </div>
                          </article>

                          <article className="rounded-2xl border border-white/10 bg-black/35 p-4">
                            <p className="text-sm font-semibold text-white">Receipt branding</p>
                            <p className="mt-1 text-xs text-white/65">This branding is used in donation receipt emails while delivery still comes from `giving@donatecrate.com`.</p>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <input value={selectedPartnerForm.displayName} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))} placeholder="Receipt display name" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Logo preview</p>
                                <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/5 p-3">
                                  {selectedPartnerForm.logoUrl ? (
                                    <div
                                      className="h-full w-full bg-contain bg-center bg-no-repeat"
                                      style={{ backgroundImage: `url(${selectedPartnerForm.logoUrl})` }}
                                    />
                                  ) : (
                                    <p className="text-xs text-white/50">No logo uploaded yet.</p>
                                  )}
                                </div>
                              </div>
                              <input value={selectedPartnerForm.primaryColor} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, primaryColor: event.target.value } : prev))} placeholder="Primary color (#hex)" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <input value={selectedPartnerForm.secondaryColor} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, secondaryColor: event.target.value } : prev))} placeholder="Secondary color (#hex)" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <input value={selectedPartnerForm.accentColor} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, accentColor: event.target.value } : prev))} placeholder="Accent color (#hex)" className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm" />
                              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/70">
                                Sender: {selectedPartnerForm.displayName || selectedPartnerForm.name || selectedPartner.name} &lt;giving@donatecrate.com&gt;
                              </div>
                              <textarea value={selectedPartnerForm.receiptFooter} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, receiptFooter: event.target.value } : prev))} rows={4} placeholder="Receipt footer" className="rounded-lg border border-white/25 bg-black px-3 py-2 text-sm md:col-span-2" />
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                              <button onClick={updatePartnerAccount} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">
                                Save Partner Settings
                              </button>
                              <p className="text-xs text-white/65">Receipt sending is fixed to DonateCrate on behalf of the nonprofit.</p>
                            </div>
                          </article>
                        </div>
                      ) : null}

                      <article className="rounded-2xl border border-white/10 bg-black/35 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Organization team</p>
                            <p className="mt-1 text-xs text-white/65">Manage organization admins, coordinators, and drivers without leaving the DonateCrate admin panel.</p>
                          </div>
                          <p className="text-xs text-white/65">{selectedPartner.members.length} members</p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {selectedPartner.members.map((member) => (
                            <div key={member.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{member.full_name || member.email}</p>
                                  <p className="mt-1 text-xs text-white/70">{member.email}{member.phone ? ` | ${member.phone}` : ""}</p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${member.active ? "bg-emerald-500/15 text-emerald-100" : "bg-slate-500/15 text-slate-200"}`}>
                                  {member.active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <select
                                  value={member.role}
                                  onChange={(event) => updatePartnerMember(member.id, { role: event.target.value as "partner_admin" | "partner_coordinator" | "partner_driver" })}
                                  className="h-9 rounded-lg border border-white/25 bg-black px-3 text-sm"
                                >
                                  <option value="partner_admin">Organization Admin</option>
                                  <option value="partner_coordinator">Coordinator</option>
                                  <option value="partner_driver">Driver</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => updatePartnerMember(member.id, { active: !member.active })}
                                  className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold"
                                >
                                  {member.active ? "Deactivate" : "Reactivate"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deletePartnerMember(member.id, member.full_name || member.email)}
                                  className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100"
                                >
                                  Delete
                                </button>
                                <p className="text-xs text-white/60">{formatPartnerTeamRole(member.role)}</p>
                              </div>
                            </div>
                          ))}
                          {selectedPartner.members.length === 0 ? <p className="text-sm text-white/65">No team members added yet.</p> : null}
                        </div>
                      </article>
                    </div>
                  ) : null}
                </section>
                ) : null}
              </>
            ) : null}

            {networkSubtab === "zones" ? showCreateZoneForm ? (
              <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
                <h4 className="text-lg font-bold">Add New Service Area</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input value={zoneForm.name} onChange={(event) => setZoneForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Service area name" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input value={zoneForm.code} onChange={(event) => setZoneForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="Internal area code" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input value={zoneForm.anchorPostalCode} onChange={(event) => setZoneForm((prev) => ({ ...prev, anchorPostalCode: event.target.value }))} placeholder="Anchor ZIP" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input type="number" min={0.5} step={0.5} value={zoneForm.radiusMiles} onChange={(event) => setZoneForm((prev) => ({ ...prev, radiusMiles: Number(event.target.value) }))} placeholder="Service radius (miles)" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input type="number" min={1} value={zoneForm.minActiveSubscribers} onChange={(event) => setZoneForm((prev) => ({ ...prev, minActiveSubscribers: Number(event.target.value) }))} placeholder="Active household goal" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input
                    value={createCenterQuery}
                    onChange={(event) => {
                      setCreateCenterQuery(event.target.value);
                      setCreateCenterSelection(null);
                      if (event.target.value.trim().length < 3) setCreateCenterPredictions([]);
                    }}
                    placeholder="Service area center address"
                    className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm"
                  />
                </div>
                {createCenterPredictions.length > 0 ? (
                  <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-white/20 bg-black/40 p-2">
                    {createCenterPredictions.map((prediction) => (
                      <button
                        key={prediction.placeId}
                        type="button"
                        onClick={async () => {
                          const details = await fetchPlaceDetails(prediction.placeId);
                          setCreateCenterSelection({ placeId: prediction.placeId, formattedAddress: details.formattedAddress });
                          setCreateCenterQuery(details.formattedAddress);
                          setCreateCenterPredictions([]);
                        }}
                        className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-white/10"
                      >
                        {prediction.mainText}
                        <p className="text-xs text-white/70">{prediction.secondaryText || prediction.description}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={zoneForm.signupEnabled} onChange={(event) => setZoneForm((prev) => ({ ...prev, signupEnabled: event.target.checked }))} />
                    Signup enabled
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={zoneForm.demoOnly} onChange={(event) => setZoneForm((prev) => ({ ...prev, demoOnly: event.target.checked }))} />
                    Demo only
                  </label>
                  <button onClick={createZone} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">Create Service Area</button>
                  <button
                    type="button"
                    onClick={() => setShowCreateZoneForm(false)}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            ) : null : showCreatePartnerForm ? (
              <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
                <h4 className="text-lg font-bold">Add Nonprofit Partner</h4>
                <p className="mt-1 text-xs text-white/65">This creates the organization record and the nonprofit can brand receipts while delivery still comes from giving@donatecrate.com.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input value={partnerForm.name} onChange={(event) => setPartnerForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Partner name" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input value={partnerForm.code} onChange={(event) => setPartnerForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="Partner code" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input value={partnerForm.legalName} onChange={(event) => setPartnerForm((prev) => ({ ...prev, legalName: event.target.value }))} placeholder="Legal name" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input value={partnerForm.supportEmail} onChange={(event) => setPartnerForm((prev) => ({ ...prev, supportEmail: event.target.value }))} placeholder="Support email" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input value={partnerForm.supportPhone} onChange={(event) => setPartnerForm((prev) => ({ ...prev, supportPhone: event.target.value }))} placeholder="Support phone" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input value={partnerForm.displayName} onChange={(event) => setPartnerForm((prev) => ({ ...prev, displayName: event.target.value }))} placeholder="Receipt display name" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/70 md:col-span-2">
                    Receipt emails are always sent by DonateCrate on behalf of the nonprofit. Payout and revenue-share settings are handled internally and are not configured here yet.
                  </div>
                  <input value={partnerForm.primaryColor} onChange={(event) => setPartnerForm((prev) => ({ ...prev, primaryColor: event.target.value }))} placeholder="Primary color (#hex)" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <input value={partnerForm.accentColor} onChange={(event) => setPartnerForm((prev) => ({ ...prev, accentColor: event.target.value }))} placeholder="Accent color (#hex)" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 md:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Logo preview</p>
                    <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/5 p-3">
                      {partnerForm.logoUrl ? (
                        <div
                          className="h-full w-full bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: `url(${partnerForm.logoUrl})` }}
                        />
                      ) : (
                        <p className="text-xs text-white/50">No logo added yet. Logos are managed after the partner is created.</p>
                      )}
                    </div>
                  </div>
                  <input value={partnerForm.websiteUrl} onChange={(event) => setPartnerForm((prev) => ({ ...prev, websiteUrl: event.target.value }))} placeholder="Website URL" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm md:col-span-2" />
                  <textarea value={partnerForm.notes} onChange={(event) => setPartnerForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Internal notes" className="rounded-lg border border-white/30 bg-black px-3 py-2 text-sm md:col-span-2" />
                  <textarea value={partnerForm.receiptFooter} onChange={(event) => setPartnerForm((prev) => ({ ...prev, receiptFooter: event.target.value }))} rows={3} placeholder="Receipt footer" className="rounded-lg border border-white/30 bg-black px-3 py-2 text-sm md:col-span-2" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button onClick={createPartner} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">Create Partner</button>
                  <button
                    type="button"
                    onClick={() => setShowCreatePartnerForm(false)}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <p className="text-xs text-white/65">DonateCrate will send receipts on behalf of this nonprofit using the branding set here.</p>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      ) : null}

      {section === "pickups" ? (
        <>
          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Pickup Calendar Builder</h3>
            <p className="mt-1 text-sm text-white/70">
              A pickup cycle is the actual service day for one zone. Build one cycle at a time, or generate the monthly calendar in advance.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPickupMode("single")}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${pickupMode === "single" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20" : "border-white/25"}`}
              >
                One-time cycle
              </button>
              <button
                type="button"
                onClick={() => setPickupMode("recurring")}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${pickupMode === "recurring" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20" : "border-white/25"}`}
              >
                Recurring monthly
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-xs text-white/70">
                Zone
                <select
                  value={scheduleForm.zoneCode}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, zoneCode: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3"
                >
                  {data.zones.map((zone) => (
                    <option key={zone.id} value={zone.code}>{zone.name}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/25 bg-black/30 px-3 text-xs text-white/85 md:mt-6">
                <input
                  type="checkbox"
                  checked={applyToAllActiveZones}
                  onChange={(event) => setApplyToAllActiveZones(event.target.checked)}
                />
                Apply to all active zones
              </label>
              <p className="text-xs text-white/65 md:mt-6">
                {applyToAllActiveZones
                  ? "Scheduler will generate cycles for every active zone."
                  : "Scheduler applies to the selected zone only."}
              </p>

              {pickupMode === "single" ? (
                <>
                  <label className="text-xs text-white/70">
                    Cycle month
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                      <input
                        ref={singleCycleMonthRef}
                        type="date"
                        value={scheduleForm.cycleMonth}
                        onChange={(event) => setScheduleForm((prev) => ({ ...prev, cycleMonth: event.target.value }))}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-white/30 bg-black px-3"
                      />
                      <button
                        type="button"
                        onClick={() => singleCycleMonthRef.current?.showPicker?.()}
                        className="rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold sm:py-0"
                      >
                        Calendar
                      </button>
                    </div>
                  </label>
                  <label className="text-xs text-white/70">
                    Pickup date
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                      <input
                        ref={singlePickupDateRef}
                        type="date"
                        value={scheduleForm.pickupDate}
                        onChange={(event) => setScheduleForm((prev) => ({ ...prev, pickupDate: event.target.value }))}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-white/30 bg-black px-3"
                      />
                      <button
                        type="button"
                        onClick={() => singlePickupDateRef.current?.showPicker?.()}
                        className="rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold sm:py-0"
                      >
                        Calendar
                      </button>
                    </div>
                  </label>
                  <label className="text-xs text-white/70 md:col-span-2">
                    Request cutoff (date/time)
                    <input type="datetime-local" value={scheduleForm.requestCutoffAt} onChange={(event) => setScheduleForm((prev) => ({ ...prev, requestCutoffAt: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3" />
                  </label>
                </>
              ) : (
                <>
                  <div className="md:col-span-3">
                    <p className="text-xs text-white/70">Scheduling horizon</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setScheduleForm((prev) => ({ ...prev, horizonMode: "months" }))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${scheduleForm.horizonMode === "months" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20" : "border-white/25"}`}
                      >
                        Number of months
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleForm((prev) => ({ ...prev, horizonMode: "forever" }))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${scheduleForm.horizonMode === "forever" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20" : "border-white/25"}`}
                      >
                        Forever (rolling)
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-white/60">
                      Forever creates a long-range rolling schedule (currently 60 months) so ops can run without constant manual setup.
                    </p>
                  </div>
                  <label className="text-xs text-white/70">
                    Next pickup date
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                      <input
                        ref={recurringStartPickupDateRef}
                        type="date"
                        value={scheduleForm.startPickupDate}
                        onChange={(event) => setScheduleForm((prev) => ({ ...prev, startPickupDate: event.target.value }))}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-white/30 bg-black px-3"
                      />
                      <button
                        type="button"
                        onClick={() => recurringStartPickupDateRef.current?.showPicker?.()}
                        className="rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold sm:py-0"
                      >
                        Calendar
                      </button>
                    </div>
                  </label>
                  {scheduleForm.horizonMode === "months" ? (
                    <label className="text-xs text-white/70">
                      Number of months
                      <input type="number" min={1} max={60} value={scheduleForm.months} onChange={(event) => setScheduleForm((prev) => ({ ...prev, months: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3" />
                    </label>
                  ) : (
                    <div className="rounded-lg border border-white/20 bg-black/30 p-3 text-xs text-white/70 md:self-end">
                      Horizon: rolling (60 months generated)
                    </div>
                  )}
                  <label className="text-xs text-white/70">
                    Weekend behavior
                    <select value={scheduleForm.weekendPolicy} onChange={(event) => setScheduleForm((prev) => ({ ...prev, weekendPolicy: event.target.value as "none" | "next_business_day" }))} className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3">
                      <option value="none">Keep exact date</option>
                      <option value="next_business_day">Move to next business day</option>
                    </select>
                  </label>
                  <label className="text-xs text-white/70">
                    Cutoff days before pickup
                    <input type="number" min={0} max={30} value={scheduleForm.cutoffDaysBefore} onChange={(event) => setScheduleForm((prev) => ({ ...prev, cutoffDaysBefore: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3" />
                  </label>
                </>
              )}
            </div>

            <button onClick={createPickupCycle} className="mt-4 rounded-xl bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">
              {pickupMode === "single" ? "Save Pickup Cycle" : "Generate Recurring Cycles"}
            </button>

            <div className="mt-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Pickup Calendar Timeline</p>
                <select
                  value={timelineZoneFilter}
                  onChange={(event) => setTimelineZoneFilter(event.target.value)}
                  className="h-9 rounded-lg border border-white/25 bg-black px-3 text-xs"
                >
                  <option value="all">All zones</option>
                  {data.zones.map((zone) => (
                    <option key={zone.id} value={zone.code}>{zone.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                {timelineByMonth.map((group) => (
                  <article key={group.month} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{group.month}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {group.cycles.map((cycle) => {
                        const zoneMeta = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
                        return (
                          <div key={cycle.id} className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs">
                            <p className="font-semibold">{zoneMeta?.name || cycle.zone_id}</p>
                            <p className="mt-1">Pickup: {formatDate(cycle.pickup_date)}</p>
                            <p className="text-white/70">Cutoff: {new Date(cycle.request_cutoff_at).toLocaleString()}</p>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
                {timelineByMonth.length === 0 ? <p className="text-xs text-white/65">No pickup cycles found for this filter.</p> : null}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Member Responses</h3>
            <p className="mt-1 text-sm text-white/70">
              Review the most recent household responses for published cycles and correct any exception state before dispatch is built.
            </p>
            <div className="mt-3 space-y-2">
                {data.pickupRequests.slice(0, 20).map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm break-all">
                    {(item.users?.full_name || item.users?.email) ?? "Unknown member"} ({item.pickup_cycles?.pickup_date})
                  </p>
                  <select
                    value={item.status}
                    onChange={(event) => updatePickupStatus(item.id, event.target.value)}
                    className="h-9 w-full rounded-lg border border-white/30 bg-black px-2 text-xs sm:w-auto"
                  >
                    <option value="requested">requested</option>
                    <option value="skipped">skipped</option>
                    <option value="confirmed">confirmed</option>
                    <option value="picked_up">picked_up</option>
                    <option value="not_ready">not_ready</option>
                    <option value="missed">missed</option>
                  </select>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {section === "logistics" ? (
        <section className="space-y-4">
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Dispatch Workflow</h3>
            <p className="mt-1 text-sm text-white/70">
              A pickup cycle is the service day for one zone. A route is the ordered stop list for that cycle. Build or
              refresh the route first, then assign the driver once the stop order looks right.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Step 1</p>
                <p className="mt-2 text-lg font-bold">Select Cycle</p>
                <p className="mt-1 text-sm text-white/70">Choose the zone and pickup day you are dispatching.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Step 2</p>
                <p className="mt-2 text-lg font-bold">Build Route</p>
                <p className="mt-1 text-sm text-white/70">This creates or refreshes the one route for that zone and cycle.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Step 3</p>
                <p className="mt-2 text-lg font-bold">Assign Driver</p>
                <p className="mt-1 text-sm text-white/70">Assign after the stop list exists so the driver gets a real route.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <select value={selectedZoneCode} onChange={(event) => setSelectedZoneCode(event.target.value)} className="h-10 w-full rounded-lg border border-white/30 bg-black px-3 text-sm sm:w-auto">
                <option value="">Select pickup area</option>
                {data.zones.map((zone) => (
                  <option key={zone.id} value={zone.code}>{zone.name} ({zone.code})</option>
                ))}
              </select>
              <select value={selectedCycleId} onChange={(event) => setSelectedCycleId(event.target.value)} className="h-10 w-full rounded-lg border border-white/30 bg-black px-3 text-sm sm:w-auto">
                <option value="">Select cycle</option>
                {logisticsCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {getCycleDisplayLabel(cycle)}
                  </option>
                ))}
              </select>
              <button onClick={generateRoute} className="w-full rounded-lg bg-[var(--dc-orange)] px-3 py-2 text-sm font-semibold sm:w-auto">
                Build or Refresh Route
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Ready Households</p>
                <p className="mt-2 text-2xl font-bold">{selectedCycleRequestSummary.requested}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Skipped</p>
                <p className="mt-2 text-2xl font-bold">{selectedCycleRequestSummary.skipped}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Exceptions</p>
                <p className="mt-2 text-2xl font-bold">{selectedCycleRequestSummary.exceptions}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Existing Route</p>
                <p className="mt-2 text-2xl font-bold">{selectedCycleRoutes.length > 0 ? "Yes" : "No"}</p>
              </div>
            </div>
            {selectedCycleMeta ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
                <p className="font-semibold text-white">Selected cycle</p>
                <p className="mt-1">
                  Pickup date: {formatDate(selectedCycleMeta.pickup_date)} | Response cutoff:{" "}
                  {new Date(selectedCycleMeta.request_cutoff_at).toLocaleString()}
                </p>
                <p className="mt-1">
                  Total request records: {selectedCycleRequestSummary.total}. The recommended flow is to build the route after
                  the cutoff or once ops is comfortable locking the stop list for dispatch.
                </p>
                <p className="mt-1">
                  Current route status: {selectedLogisticsRoute ? formatRouteStatusLabel(selectedLogisticsRoute.status) : "No route built yet"}.
                </p>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Dispatch checklist</p>
                <p className="mt-2 text-sm text-white/80">
                  Confirm that skipped and exception households are intentional before you rebuild the route.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">One route rule</p>
                <p className="mt-2 text-sm text-white/80">
                  Each zone and cycle should have one live route. Rebuild refreshes that route instead of creating duplicates.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Driver timing</p>
                <p className="mt-2 text-sm text-white/80">
                  Assign the driver only after stops exist so the driver console opens with a real ordered run sheet.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="min-w-[280px] rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-sm text-white/75">
                {selectedLogisticsRoute
                  ? `Current cycle route: ${getRouteDisplayLabel(selectedLogisticsRoute)} | ${formatRouteStatusLabel(selectedLogisticsRoute.status)} | ${selectedLogisticsRoute.stopCount ?? 0} stops`
                  : "Current cycle route: not built yet"}
              </div>
              <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} className="h-10 w-full rounded-lg border border-white/30 bg-black px-3 text-sm sm:w-auto">
                <option value="">Select driver</option>
                {driverOptions.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.employee_id} ({driver.users?.email})</option>
                ))}
              </select>
              <button
                onClick={assignDriver}
                disabled={!selectedLogisticsRoute}
                className="w-full rounded-lg bg-[var(--dc-orange)] px-3 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto"
              >
                Assign Driver
              </button>
            </div>
            {logisticsMessage ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
                {logisticsMessage}
              </div>
            ) : null}
          </article>

          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-bold">Route Preview</h4>
              {logisticsRoutePreview?.googleMapsUrl ? (
                <a
                  href={logisticsRoutePreview.googleMapsUrl}
                  target="_blank"
                  className="rounded border border-white/25 px-3 py-1 text-xs"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              ) : null}
            </div>
            {selectedLogisticsRoute?.id ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/admin/logistics/static-map?routeId=${selectedLogisticsRoute.id}`}
                alt="Pickup route map"
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/40"
                onError={() => setMapLoadError(true)}
                onLoad={() => setMapLoadError(false)}
              />
            ) : (
              <p className="mt-2 text-sm text-white/65">Select a cycle and build the route to preview stops and map output.</p>
            )}
            {mapLoadError ? (
              <p className="mt-3 text-sm text-amber-200">
                The in-panel map preview could not load, but the ordered stop list below and the Google Maps handoff are still available.
              </p>
            ) : null}

            <div className="mt-4 space-y-2">
              {selectedLogisticsRoute ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/75">
                  <p className="font-semibold text-white">
                    {getRouteDisplayLabel(selectedLogisticsRoute)} | {formatRouteStatusLabel(selectedLogisticsRoute.status)} | {selectedLogisticsRoute.stopCount ?? 0} stops
                  </p>
                  <p className="mt-1">
                    Pickup date:{" "}
                    {Array.isArray(selectedLogisticsRoute.pickup_cycles)
                      ? (selectedLogisticsRoute.pickup_cycles[0]?.pickup_date ?? "TBD")
                      : (selectedLogisticsRoute.pickup_cycles?.pickup_date ?? "TBD")}
                  </p>
                  <p className="mt-1">
                    Driver: {selectedLogisticsRoute.drivers?.employee_id ?? "Unassigned"}
                  </p>
                  <p className="mt-1">
                    Purpose: this route is the single ordered run sheet for the selected cycle and zone.
                  </p>
                </div>
              ) : null}
              {(logisticsRoutePreview?.stops ?? []).map((stop) => (
                <div key={stop.id} className="rounded-xl border border-white/10 bg-black/35 p-3 text-sm">
                  <p className="font-semibold">Stop {stop.stopOrder}: {stop.fullName || stop.email || "Unknown subscriber"}</p>
                  <p className="text-xs text-white/70">
                    {stop.address
                      ? `${stop.address.addressLine1}, ${stop.address.city}, ${stop.address.state} ${stop.address.postalCode}`
                      : "Address unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-white/70">
                    Request: {formatPickupRequestLabel(stop.requestStatus ?? "unknown")} | Stop status:{" "}
                    {formatRouteStatusLabel(stop.stopStatus)}
                  </p>
                  {stop.requestNote ? <p className="mt-1 text-xs text-amber-200">Ops note: {stop.requestNote}</p> : null}
                </div>
              ))}
              {selectedLogisticsRoute?.id && (logisticsRoutePreview?.stops ?? []).length === 0 ? (
                <p className="text-sm text-white/65">No stops found for this route.</p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {section === "growth" ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Waitlist Pipeline</h3>
            <div className="mt-3 space-y-2">
              {data.waitlist.slice(0, 30).map((entry) => (
                <div key={entry.id} className="rounded-lg border border-white/10 bg-black/35 p-3 text-sm">
                  {entry.full_name} ({entry.postal_code}) - {entry.status}
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Affiliate Referrals</h3>
            <div className="mt-3 space-y-2">
              {data.referrals.slice(0, 30).map((referral) => (
                <div key={referral.id} className="rounded-lg border border-white/10 bg-black/35 p-3 text-sm">
                  {referral.referrer_email ?? "Unknown"} {"->"} {referral.referred_email ?? "Pending user"} ({referral.referral_code}) - {referral.status}
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {section === "communication" ? (
        <section className="space-y-6">
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Messaging Control</p>
            <h3 className="mt-2 text-2xl font-bold">Keep reminders, billing alerts, and delivery issues in one place</h3>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              Customers should get simple, dependable updates. Use this tab to confirm both delivery channels are healthy, queue pickup reminders, and separate retryable failures from events that need account cleanup first.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Queued</p>
                <p className="mt-2 text-2xl font-bold">{queuedNotificationEvents.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Retryable failures</p>
                <p className="mt-2 text-2xl font-bold">
                  {failedNotificationEvents.filter((event) => getNotificationRetryState(event).canRetry).length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Blocked failures</p>
                <p className="mt-2 text-2xl font-bold">{blockedNotificationEvents.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Selected for retry</p>
                <p className="mt-2 text-2xl font-bold">{notificationSelection.length}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className={`rounded-2xl border p-4 ${getNotificationStateTone(communicationHealth.sms?.ready ? "healthy" : communicationHealth.sms?.configured ? "attention" : "blocked")}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/65">Text delivery</p>
                    <h4 className="mt-2 text-lg font-semibold text-white">Twilio</h4>
                  </div>
                  <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                    {communicationHealth.sms?.ready ? "Verified" : communicationHealth.sms?.configured ? "Needs attention" : "Setup needed"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-white/80">
                  {communicationHealth.sms?.detail || "SMS channel status will appear here once loaded."}
                </p>
                <p className="mt-3 text-xs text-white/60">
                  Sender: {communicationHealth.sms?.fromNumber || communicationHealth.sms?.messagingServiceSid || "Not configured"}
                </p>
                <p className="mt-2 text-xs text-white/60">{smsNotificationEvents.length} text events logged recently.</p>
              </div>
              <div className={`rounded-2xl border p-4 ${getNotificationStateTone(communicationHealth.email?.ready ? "healthy" : communicationHealth.email?.configured ? "attention" : "blocked")}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/65">Email delivery</p>
                    <h4 className="mt-2 text-lg font-semibold text-white">Resend</h4>
                  </div>
                  <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                    {communicationHealth.email?.ready ? "Verified" : communicationHealth.email?.configured ? "Needs attention" : "Setup needed"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-white/80">
                  {communicationHealth.email?.detail || "Email channel status will appear here once loaded."}
                </p>
                <p className="mt-3 text-xs text-white/60">
                  From: {communicationHealth.email?.fromEmail || "Not configured"}
                </p>
                <p className="mt-2 text-xs text-white/60">
                  Provider: {communicationHealth.email?.host || "Not configured"} • {emailNotificationEvents.length} email events logged recently.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">SMS Campaigns</h3>
            <p className="mt-1 text-sm text-white/70">
              Send one-off SMS updates to individual users, active users in a zone, or your full audience.
            </p>
            {smsConfigError ? (
              <div className="mt-4 rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                SMS is not ready in this environment: {smsConfigError}.
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-xs text-white/70">
                Target Type
                <select
                  value={smsTarget}
                  onChange={(event) => setSmsTarget(event.target.value as "individual" | "zone" | "all")}
                  className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3"
                >
                  <option value="individual">Individual users</option>
                  <option value="zone">Single zone group</option>
                  <option value="all">All audience</option>
                </select>
              </label>
              {smsTarget === "zone" ? (
                <label className="text-xs text-white/70">
                  Zone
                  <select
                    value={smsZoneId}
                    onChange={(event) => setSmsZoneId(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3"
                  >
                    <option value="">Select zone</option>
                    {data.zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {smsTarget === "all" ? (
                <label className="inline-flex items-center gap-2 text-xs text-white/80 md:mt-6">
                  <input
                    type="checkbox"
                    checked={smsIncludeStaff}
                    onChange={(event) => setSmsIncludeStaff(event.target.checked)}
                  />
                  Include admin + driver accounts
                </label>
              ) : null}
              <div className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-xs text-white/80 md:mt-6">
                Eligible recipients: {smsRecipientEstimate}
              </div>
            </div>

            {smsTarget === "individual" ? (
              <div className="mt-4 space-y-3">
                <input
                  value={smsSearch}
                  onChange={(event) => setSmsSearch(event.target.value)}
                  placeholder="Search users by name, email, or phone"
                  className="h-10 w-full rounded-lg border border-white/30 bg-black px-3 text-sm"
                />
                <div className="max-h-56 overflow-auto rounded-xl border border-white/15 bg-black/35 p-2">
                  {smsUsersWithPhones.slice(0, 120).map((user) => (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-white/10"
                    >
                      <span className="pr-2">
                        {user.full_name || user.email}
                        <span className="ml-2 text-xs text-white/70">{user.phone}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={smsUserIds.includes(user.id)}
                        onChange={(event) => {
                          setSmsUserIds((prev) =>
                            event.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id),
                          );
                        }}
                      />
                    </label>
                  ))}
                  {smsUsersWithPhones.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-white/65">No users with phone numbers match this search.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {smsTarget === "zone" ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Active eligible users in zone</p>
                <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-white/15 bg-black/35 p-2">
                  {smsZonePreviewLoading ? (
                    <p className="px-2 py-3 text-sm text-white/65">Loading zone recipients...</p>
                  ) : smsZoneEligibleUsers.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-white/65">No active subscribed + SMS opted-in users found.</p>
                  ) : (
                    smsZoneEligibleUsers.map((user) => (
                      <div key={user.id} className="rounded-lg px-2 py-2 text-sm hover:bg-white/10">
                        <span>{user.fullName || user.email}</span>
                        <span className="ml-2 text-xs text-white/70">{user.phone}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <label className="text-xs text-white/70">
                SMS Message
                <textarea
                  value={smsMessage}
                  onChange={(event) => setSmsMessage(event.target.value)}
                  rows={5}
                  maxLength={600}
                  placeholder="Write your operational update or reminder"
                  className="mt-1 w-full rounded-xl border border-white/30 bg-black px-3 py-3 text-sm"
                />
              </label>
              <p className="mt-1 text-xs text-white/60">{smsMessage.length}/600 characters</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={sendSmsCampaign}
                disabled={smsSending || !!smsConfigError}
                className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {smsSending ? "Sending..." : "Send SMS Campaign"}
              </button>
            </div>
          </article>

          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Reminder Queue</h3>
            <p className="mt-1 text-sm text-white/70">
              Queue cycle reminders for opted-in households. If email is connected, pickup reminders will queue for both text and email.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => queueCycleReminders("72h")}
                disabled={notificationActionLoading}
                className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Queue 72h Reminder
              </button>
              <button
                type="button"
                onClick={() => queueCycleReminders("24h")}
                disabled={notificationActionLoading}
                className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Queue 24h Reminder
              </button>
              <button
                type="button"
                onClick={() => queueCycleReminders("day_of")}
                disabled={notificationActionLoading}
                className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Queue Day-of Reminder
              </button>
              <button
                type="button"
                onClick={processQueuedNotifications}
                disabled={notificationActionLoading}
                className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Process Queued Events
              </button>
              <button
                type="button"
                onClick={retrySelectedNotifications}
                disabled={notificationActionLoading || notificationSelection.length === 0}
                className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Retry Selected Failures
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Queued</p>
                <p className="mt-2 text-2xl font-bold">{queuedNotificationEvents.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Retryable Failures</p>
                <p className="mt-2 text-2xl font-bold">
                  {failedNotificationEvents.filter((event) => getNotificationRetryState(event).canRetry).length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Needs Manual Fix</p>
                <p className="mt-2 text-2xl font-bold">{blockedNotificationEvents.length}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
              Failures with too many attempts are blocked from retry until the underlying problem is fixed, such as a missing phone number or provider configuration issue.
            </div>
            <div className="mt-4 space-y-2">
              {notificationEvents.slice(0, 40).map((event) => (
                <label key={event.id} className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-black/35 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={notificationSelection.includes(event.id)}
                    disabled={!getNotificationRetryState(event).canRetry || event.status === "sent" || event.status === "delivered"}
                    onChange={(inputEvent) => {
                      setNotificationSelection((prev) =>
                        inputEvent.target.checked ? [...prev, event.id] : prev.filter((id) => id !== event.id),
                      );
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {formatNotificationEventType(event.event_type)} | {formatNotificationChannel(event.channel)} | {formatNotificationStatus(event.status)}
                      </p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getNotificationStateTone(getNotificationRetryState(event).severity)}`}>
                        {getNotificationRetryState(event).label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/70">
                      Attempts: {event.attempt_count ?? 0} | Last attempt:{" "}
                      {event.last_attempt_at ? new Date(event.last_attempt_at).toLocaleString() : "Not attempted"}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      Correlation: {event.correlation_id ?? "n/a"} | Logged {new Date(event.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-white/70">{getNotificationRetryState(event).detail}</p>
                    {event.last_error ? <p className="mt-1 text-xs text-amber-200">Error: {event.last_error}</p> : null}
                  </div>
                </label>
              ))}
              {notificationEvents.length === 0 ? (
                <p className="text-sm text-white/65">No notification events logged yet.</p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {message ? <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">{message}</p> : null}
    </div>
  );
}
