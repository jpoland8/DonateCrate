"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatNotificationEventType, formatNotificationStatus } from "@/lib/notification-labels";

type WorkspaceSection = "overview" | "pickups" | "logistics" | "people" | "zones" | "billing" | "growth" | "communication";

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: "customer" | "admin" | "driver";
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
    launch_target_enabled: boolean;
  }>;
};

type ZoneMember = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: "customer" | "admin" | "driver";
  primary_address: {
    address_line1: string;
    city: string;
    state: string;
    postal_code: string;
  } | null;
};

function localDateISO(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function localDateTimeISO(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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

function getBillingStatusTone(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-400/35 bg-emerald-400/12 text-emerald-100";
    case "trialing":
      return "border-sky-400/35 bg-sky-400/12 text-sky-100";
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
      return `Customer is in trial. Stripe should start charging at the end of the current period on ${formatDate(subscription.currentPeriodEnd)}.`;
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

export function AdminWorkspace({ section = "overview" }: { section?: WorkspaceSection }) {
  const singleCycleMonthRef = useRef<HTMLInputElement | null>(null);
  const singlePickupDateRef = useRef<HTMLInputElement | null>(null);
  const recurringStartPickupDateRef = useRef<HTMLInputElement | null>(null);
  const logisticsPreviewAbortRef = useRef<AbortController | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [message, setMessage] = useState("");
  const [logisticsMessage, setLogisticsMessage] = useState("");
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<
    "all" | "trialing" | "active" | "past_due" | "paused" | "canceled"
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
  const [roleFilter, setRoleFilter] = useState<"all" | "customer" | "admin" | "driver">("all");
  const [userZoneFilter, setUserZoneFilter] = useState<string>("all");
  const [zoneMembers, setZoneMembers] = useState<ZoneMember[]>([]);
  const [zoneMemberSearch, setZoneMemberSearch] = useState("");
  const [zoneMemberRole, setZoneMemberRole] = useState<"all" | "customer" | "admin" | "driver">("all");
  const [zoneMemberPage, setZoneMemberPage] = useState(1);
  const [zoneMemberPagination, setZoneMemberPagination] = useState({ page: 1, pageSize: 8, total: 0, totalPages: 1 });

  const [zoneForm, setZoneForm] = useState({
    code: "",
    name: "",
    anchorPostalCode: "",
    radiusMiles: 3,
    minActiveSubscribers: 40,
    signupEnabled: true,
    launchTargetEnabled: true,
  });

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
  const [smsZoneEligibleUsers, setSmsZoneEligibleUsers] = useState<
    Array<{ id: string; fullName: string; email: string; role: string; phone: string }>
  >([]);
  const [smsZonePreviewLoading, setSmsZonePreviewLoading] = useState(false);
  const [notificationActionLoading, setNotificationActionLoading] = useState(false);
  const [notificationSelection, setNotificationSelection] = useState<string[]>([]);
  const [mapLoadError, setMapLoadError] = useState(false);

  const loadAll = useCallback(async () => {
    const [usersRes, waitlistRes, requestsRes, routesRes, driversRes, cyclesRes, subsRes, refsRes, zonesRes, notificationRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/waitlist"),
      fetch("/api/admin/pickup-requests"),
      fetch("/api/admin/routes"),
      fetch("/api/admin/drivers"),
      fetch("/api/admin/pickup-cycles"),
      fetch("/api/admin/subscriptions"),
      fetch("/api/admin/referrals"),
      fetch("/api/admin/zones"),
      fetch("/api/admin/notifications"),
    ]);

    const [users, waitlist, pickupRequests, routes, drivers, pickupCycles, subscriptions, referrals, zones, notifications] = await Promise.all([
      usersRes.json(),
      waitlistRes.json(),
      requestsRes.json(),
      routesRes.json(),
      driversRes.json(),
      cyclesRes.json(),
      subsRes.json(),
      refsRes.json(),
      zonesRes.json(),
      notificationRes.json(),
    ]);

    const zoneRows = zones.zones ?? [];
    if (zones.error) setMessage(`Pickup areas could not be loaded: ${zones.error}`);

    setSelectedZoneCode((prev) =>
      zoneRows.length > 0 && !zoneRows.some((zone: { code: string }) => zone.code === prev) ? zoneRows[0].code : prev,
    );
    setSelectedZoneId((prev) =>
      zoneRows.length > 0 && !zoneRows.some((zone: { id: string }) => zone.id === prev) ? zoneRows[0].id : prev,
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
      zones: zoneRows,
    });
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const driverOptions = useMemo(() => data?.drivers ?? [], [data]);
  const routeOptions = useMemo(() => data?.routes ?? [], [data]);
  const selectedZone = useMemo(() => data?.zones.find((zone) => zone.id === selectedZoneId) ?? null, [data, selectedZoneId]);
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

  async function updateUserRole(userId: string, role: "customer" | "admin" | "driver") {
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
    minActiveSubscribers?: number;
    centerPlaceId?: string;
    launchTargetEnabled?: boolean;
  }) {
    const response = await fetch("/api/admin/zones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Could not update pickup area");
    setMessage("Pickup area updated.");
    await loadAll();
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
      launchTargetEnabled: true,
    });
    setCreateCenterQuery("");
    setCreateCenterPredictions([]);
    setCreateCenterSelection(null);
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
      setMessage(`Retried ${sendJson.attempted ?? 0} notifications. Sent: ${sendJson.sent ?? 0}, failed: ${sendJson.failed ?? 0}.`);
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
      setMessage(`Processed ${json.attempted ?? 0} queued notifications. Sent: ${json.sent ?? 0}, failed: ${json.failed ?? 0}.`);
      await loadAll();
    } finally {
      setNotificationActionLoading(false);
    }
  }

  if (!data) return <p className="text-sm text-white/75">Loading admin workspace...</p>;

  return (
    <div className="space-y-6">
      {section === "overview" ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Users</p>
            <p className="mt-2 text-4xl font-bold">{data.users.length}</p>
            <p className="mt-2 text-sm text-white/70">All accounts across customers, drivers, and admins.</p>
          </article>
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Open Requests</p>
            <p className="mt-2 text-4xl font-bold">
              {data.pickupRequests.filter((request) => request.status === "requested" || request.status === "confirmed").length}
            </p>
            <p className="mt-2 text-sm text-white/70">Operational stops likely to be on next dispatch run.</p>
          </article>
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Active Zones</p>
            <p className="mt-2 text-4xl font-bold">{data.zones.filter((zone) => zone.status === "active").length}</p>
            <p className="mt-2 text-sm text-white/70">Service areas currently open for delivery operations.</p>
          </article>
        </section>
      ) : null}

      {section === "people" ? (
        <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">User Directory</p>
              <p className="text-xs text-white/65">Search by name, email, or ZIP. Filter by role and zone.</p>
            </div>
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search users"
              className="h-10 w-full rounded-xl border border-white/25 bg-black px-3 text-sm sm:min-w-[220px] sm:w-auto"
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as "all" | "customer" | "admin" | "driver")}
              className="h-10 w-full rounded-xl border border-white/25 bg-black px-3 text-sm sm:w-auto"
            >
              <option value="all">All roles</option>
              <option value="customer">Customer</option>
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
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
            {filteredUsers.map((user) => (
              <article key={user.id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{user.full_name || "No name set"}</p>
                    <p className="text-xs text-white/70">{user.email}</p>
                  </div>
                  <select
                    value={user.role}
                    onChange={(event) => updateUserRole(user.id, event.target.value as "customer" | "admin" | "driver")}
                    className="h-9 rounded-lg border border-white/30 bg-black px-3 text-xs"
                  >
                    <option value="customer">customer</option>
                    <option value="driver">driver</option>
                    <option value="admin">admin</option>
                  </select>
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
                    Zones:{" "}
                    {user.zones.length > 0
                      ? user.zones.map((zone) => `${zone.name} (${zone.membershipStatus})`).join(" | ")
                      : "Unassigned"}
                  </p>
                </div>
              </article>
            ))}
            {filteredUsers.length === 0 ? <p className="text-sm text-white/65">No users match the current filters.</p> : null}
          </div>

          <section className="mt-6 rounded-2xl border border-white/10 bg-black/35 p-4">
            <p className="text-sm font-semibold">People vs. Billing</p>
            <p className="mt-2 text-sm text-white/70">
              Use this tab for roles, contact details, and zone placement. Use the Billing tab for cancellations,
              renewals, payment status, and Stripe-backed subscription actions.
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
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Active or Trialing</p>
              <p className="mt-3 text-3xl font-bold">
                {data.subscriptions.filter((subscription) => ["active", "trialing"].includes(subscription.status)).length}
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
                      event.target.value as "all" | "trialing" | "active" | "past_due" | "paused" | "canceled",
                    )
                  }
                  className="h-11 rounded-xl border px-3 text-sm"
                  style={{ borderColor: "var(--admin-border-strong)", background: "var(--admin-panel)" }}
                >
                  <option value="all">All statuses</option>
                  <option value="trialing">Trialing</option>
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

      {section === "zones" ? (
        <section className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <aside className="rounded-3xl border border-white/15 bg-white/5 p-4">
            <p className="text-sm font-semibold">Pickup Zones</p>
            <p className="mt-1 text-xs text-white/65">Select a zone to manage it individually.</p>
            <div className="mt-3 space-y-2">
              {data.zones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => {
                    setSelectedZoneId(zone.id);
                    setScheduleForm((prev) => ({ ...prev, zoneCode: zone.code }));
                    setZoneMemberPage(1);
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    selectedZoneId === zone.id
                      ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                      : "border-white/20 bg-black/30 hover:bg-white/10"
                  }`}
                >
                  <p className="font-semibold">{zone.name}</p>
                  <p className="text-xs text-white/65">ZIP {zone.anchor_postal_code} | {zone.status}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-4">
            {selectedZone ? (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    updateZone({
                      zoneId: selectedZone.id,
                      radiusMiles: Number(form.get("radiusMiles")),
                      minActiveSubscribers: Number(form.get("minActiveSubscribers")),
                      status: String(form.get("status")) as "pending" | "launching" | "active" | "paused",
                    });
                  }}
                  className="rounded-3xl border border-white/15 bg-white/5 p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">{selectedZone.name}</h3>
                      <p className="text-xs text-white/65">{selectedZone.code} | ZIP {selectedZone.anchor_postal_code}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateZone({ zoneId: selectedZone.id, signupEnabled: true })}
                        disabled={selectedZone.signup_enabled}
                        className="rounded-lg border border-green-400/60 px-3 py-2 text-xs font-semibold text-green-300 disabled:opacity-40"
                      >
                        Open Signup
                      </button>
                      <button
                        type="button"
                        onClick={() => updateZone({ zoneId: selectedZone.id, signupEnabled: false })}
                        disabled={!selectedZone.signup_enabled}
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
                        defaultValue={selectedZone.radius_miles}
                        className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3"
                      />
                    </label>
                    <label className="text-xs text-white/70">
                      Target Active Households
                      <input
                        name="minActiveSubscribers"
                        type="number"
                        min={1}
                        defaultValue={selectedZone.min_active_subscribers}
                        disabled={!selectedZone.launch_target_enabled}
                        className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3 disabled:opacity-40"
                      />
                    </label>
                    <label className="text-xs text-white/70">
                      Area Status
                      <select name="status" defaultValue={selectedZone.status} className="mt-1 h-10 w-full rounded-lg border border-white/30 bg-black px-3">
                        <option value="pending">pending</option>
                        <option value="launching">launching</option>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                      </select>
                    </label>
                  </div>

                  <p className="mt-3 text-xs text-white/65">Area center: {selectedZone.center_address || "Not set"}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="submit" className="rounded-lg border border-white/35 px-4 py-2 text-sm font-semibold">Save Zone Settings</button>
                    <button
                      type="button"
                      onClick={() => updateZone({ zoneId: selectedZone.id, launchTargetEnabled: !selectedZone.launch_target_enabled })}
                      className="rounded-lg border border-blue-300/60 px-4 py-2 text-sm font-semibold text-blue-200"
                    >
                      {selectedZone.launch_target_enabled ? "Ignore Launch Target" : "Use Launch Target"}
                    </button>
                  </div>
                </form>

                <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
                  <h4 className="text-lg font-bold">Users In This Zone</h4>
                  <p className="mt-1 text-xs text-white/65">Customers and drivers currently mapped to this service area.</p>
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
                        setZoneMemberRole(event.target.value as "all" | "customer" | "admin" | "driver");
                        setZoneMemberPage(1);
                      }}
                      className="h-10 rounded-lg border border-white/25 bg-black px-3 text-sm"
                    >
                      <option value="all">All roles</option>
                      <option value="customer">Customer</option>
                      <option value="driver">Driver</option>
                      <option value="admin">Admin</option>
                    </select>
                    <p className="text-xs text-white/70 md:self-center">
                      {zoneMemberPagination.total} total members
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {zoneMembers.map((user) => (
                      <div key={user.id} className="rounded-xl border border-white/10 bg-black/35 p-3">
                        <p className="text-sm font-semibold">{user.full_name || user.email}</p>
                        <p className="text-xs text-white/70">{user.email} | {user.role}</p>
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
                  <h4 className="text-lg font-bold">Update Zone Center Address</h4>
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

            <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
              <h4 className="text-lg font-bold">Add New Zone</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input value={zoneForm.name} onChange={(event) => setZoneForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Zone name" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                <input value={zoneForm.code} onChange={(event) => setZoneForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="Zone code" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                <input value={zoneForm.anchorPostalCode} onChange={(event) => setZoneForm((prev) => ({ ...prev, anchorPostalCode: event.target.value }))} placeholder="Anchor ZIP" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                <input type="number" min={0.5} step={0.5} value={zoneForm.radiusMiles} onChange={(event) => setZoneForm((prev) => ({ ...prev, radiusMiles: Number(event.target.value) }))} placeholder="Service radius (miles)" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                <input type="number" min={1} value={zoneForm.minActiveSubscribers} onChange={(event) => setZoneForm((prev) => ({ ...prev, minActiveSubscribers: Number(event.target.value) }))} placeholder="Target active households" className="h-10 rounded-lg border border-white/30 bg-black px-3 text-sm" />
                <input
                  value={createCenterQuery}
                  onChange={(event) => {
                    setCreateCenterQuery(event.target.value);
                    setCreateCenterSelection(null);
                    if (event.target.value.trim().length < 3) setCreateCenterPredictions([]);
                  }}
                  placeholder="Zone center address"
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
                  <input type="checkbox" checked={zoneForm.launchTargetEnabled} onChange={(event) => setZoneForm((prev) => ({ ...prev, launchTargetEnabled: event.target.checked }))} />
                  Use launch target
                </label>
                <button onClick={createZone} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">Create Zone</button>
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {section === "pickups" ? (
        <>
          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Pickup Schedule Builder</h3>
            <p className="mt-1 text-sm text-white/70">Choose one-time scheduling or recurring monthly rules per zone.</p>

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
                            <p className="mt-1">Pickup: {new Date(cycle.pickup_date).toLocaleDateString()}</p>
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
            <h3 className="text-xl font-bold">Pickup Requests</h3>
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
                  Pickup date: {new Date(selectedCycleMeta.pickup_date).toLocaleDateString()} | Response cutoff:{" "}
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
              />
            ) : (
              <p className="mt-2 text-sm text-white/65">Select a cycle and build the route to preview stops and map output.</p>
            )}
            {mapLoadError ? (
              <p className="mt-3 text-sm text-amber-200">
                The map image could not load in the panel, but the ordered stop list below is still available.
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
              Queue cycle reminders for SMS-eligible households, then process queued events or retry failed deliveries.
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
                <p className="text-xs uppercase tracking-wide text-white/60">Failed</p>
                <p className="mt-2 text-2xl font-bold">{failedNotificationEvents.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">Selected for Retry</p>
                <p className="mt-2 text-2xl font-bold">{notificationSelection.length}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {notificationEvents.slice(0, 40).map((event) => (
                <label key={event.id} className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-black/35 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={notificationSelection.includes(event.id)}
                    disabled={event.status !== "failed"}
                    onChange={(inputEvent) => {
                      setNotificationSelection((prev) =>
                        inputEvent.target.checked ? [...prev, event.id] : prev.filter((id) => id !== event.id),
                      );
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {formatNotificationEventType(event.event_type)} | {event.channel} | {formatNotificationStatus(event.status)}
                    </p>
                    <p className="mt-1 text-xs text-white/70">
                      Attempts: {event.attempt_count ?? 0} | Last attempt:{" "}
                      {event.last_attempt_at ? new Date(event.last_attempt_at).toLocaleString() : "Not attempted"}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      Correlation: {event.correlation_id ?? "n/a"} | Logged {new Date(event.created_at).toLocaleString()}
                    </p>
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
