"use client";

import { isDemoOnlyZone } from "@/lib/zone-flags";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobalAppRole } from "@/lib/access";
import { Spinner } from "@/components/ui/spinner";
import { getNotificationRetryState } from "@/lib/notification-health";
import { formatNotificationChannel, formatNotificationEventType, formatNotificationStatus } from "@/lib/notification-labels";

import type {
  WorkspaceSection,
  NetworkSubtab,
  PeopleSubtab,
  AdminData,
  AdminUser,
  ZoneMember,
  CommunicationChannelHealth,
  LogisticsRoutePreview,
} from "./admin-types";
import {
  localDateISO,
  localDateTimeISO,
  isValidDate,
  formatCurrency,
  formatDateTime,
  formatDate,
  formatCardExpiry,
  formatStatusLabel,
  formatRouteStatusLabel,
  formatPartnerTeamRole,
  formatRoleLabel,
  formatZoneStatusLabel,
  formatPickupRequestLabel,
} from "./admin-utils";
import { useAdminData } from "./use-admin-data";
import { PickupWindowPicker } from "@/components/ui/pickup-window-picker";
import { WaitlistMap } from "./waitlist-map";

// Types are now imported from ./admin-types

// Utilities and formatting functions are now imported from ./admin-utils

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
      return "admin-badge-green";
    case "trialing":
      return "admin-badge-slate";
    case "past_due":
      return "admin-badge-amber";
    case "paused":
      return "admin-badge-indigo";
    case "canceled":
      return "admin-badge-red";
    default:
      return "border-admin bg-admin-surface-strong text-admin";
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
  const { data: adminData, setData: setAdminData, loading: adminLoading, loadAll, refreshSlices } = useAdminData(section);
  const data: AdminData | null = adminData.zones.length > 0 || adminData.users.length > 0 ? adminData : null;
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
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const [cycleEditForm, setCycleEditForm] = useState<{ pickupDate: string; pickupWindowLabel: string } | null>(null);
  const [cycleEditSaving, setCycleEditSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(() => {
    const now = new Date();
    return {
      zoneCode: "knoxville-37922",
      pickupDate: localDateISO(now),
      startPickupDate: localDateISO(now),
      pickupWindowLabel: "",
      horizonMode: "months" as "months" | "forever",
      months: 6,
      weekendPolicy: "next_business_day" as "none" | "next_business_day",
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

  // Scheduled reminders state
  const [scheduledReminders, setScheduledReminders] = useState<
    Array<{ id: string; status: string; channel: string; metadata: Record<string, unknown>; created_at: string }>
  >([]);
  const [scheduledRemindersLoading, setScheduledRemindersLoading] = useState(false);
  const [scheduleReminderForm, setScheduleReminderForm] = useState({
    message: "",
    targetType: "all" as "zone" | "all",
    zoneId: "",
    scheduledFor: "",
    includeStaff: false,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [commSubtab, setCommSubtab] = useState<"scheduled" | "send-now" | "history" | "test-email">("scheduled");
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ sent: number; failed: number; results: Array<{ eventType: string; status: string; error?: string }> } | null>(null);
  const [reminderTemplates, setReminderTemplates] = useState<Record<string, string | boolean> | null>(null);
  const [reminderTemplatesLoading, setReminderTemplatesLoading] = useState(false);
  const [reminderTemplatesSaving, setReminderTemplatesSaving] = useState(false);
  const [reminderTemplatesOpen, setReminderTemplatesOpen] = useState(false);

  // Data loading is now handled by useAdminData hook (lazy per-tab loading).
  // The `loadAll` and `refreshSlices` functions are available for mutations.

  // Sync selected zone/partner when data loads
  useEffect(() => {
    const zoneRows = adminData.zones;
    const partnerRows = adminData.partners;
    if (zoneRows.length > 0) {
      setSelectedZoneCode((prev) =>
        !zoneRows.some((zone) => zone.code === prev) ? zoneRows[0].code : prev,
      );
      setSelectedZoneId((prev) =>
        !zoneRows.some((zone) => zone.id === prev) ? zoneRows[0].id : prev,
      );
    }
    if (partnerRows.length > 0) {
      setSelectedPartnerId((prev) =>
        !partnerRows.some((partner) => partner.id === prev) ? partnerRows[0].id : prev,
      );
    }
  }, [adminData.zones, adminData.partners]);

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
        setAdminData((prev) => ({
          ...prev,
          subscriptions: prev.subscriptions.map((subscription) =>
            subscription.id === json.subscription.id ? json.subscription : subscription,
          ),
        }));
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

  async function saveCycleEdit() {
    if (!editingCycleId || !cycleEditForm) return;
    setCycleEditSaving(true);
    const response = await fetch(`/api/admin/pickup-cycles/${editingCycleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupDate: cycleEditForm.pickupDate,
        pickupWindowLabel: cycleEditForm.pickupWindowLabel || null,
      }),
    });
    const json = await response.json().catch(() => ({}));
    setCycleEditSaving(false);
    if (!response.ok) {
      setMessage(json.error || "Failed to save cycle");
      return;
    }
    // Update local data
    setAdminData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pickupCycles: prev.pickupCycles.map((c) =>
          c.id === editingCycleId
            ? { ...c, pickup_date: cycleEditForm.pickupDate, pickup_window_label: cycleEditForm.pickupWindowLabel || null }
            : c,
        ),
      };
    });
    setEditingCycleId(null);
    setCycleEditForm(null);
    setMessage("Pickup cycle updated.");
  }

  async function createPickupCycle() {
    // Derive cycle month automatically from pickup date (first of that month)
    const cycleMonth = scheduleForm.pickupDate.slice(0, 7) + "-01";
    const payload =
      pickupMode === "single"
        ? {
            mode: "single",
            zoneCode: scheduleForm.zoneCode,
            applyToAllActiveZones,
            cycleMonth,
            pickupDate: scheduleForm.pickupDate,
            pickupWindowLabel: scheduleForm.pickupWindowLabel || undefined,
          }
        : {
            mode: "recurring",
            zoneCode: scheduleForm.zoneCode,
            applyToAllActiveZones,
            startPickupDate: scheduleForm.startPickupDate,
            horizonMode: scheduleForm.horizonMode,
            months: Number(scheduleForm.months),
            weekendPolicy: scheduleForm.weekendPolicy,
            pickupWindowLabel: scheduleForm.pickupWindowLabel || undefined,
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

  // Load reminder templates when the editor is opened
  useEffect(() => {
    if (!reminderTemplatesOpen || reminderTemplates) return;
    const controller = new AbortController();
    const load = async () => {
      setReminderTemplatesLoading(true);
      try {
        const response = await fetch("/api/admin/reminder-templates", { signal: controller.signal });
        const json = await response.json().catch(() => ({}));
        if (response.ok) setReminderTemplates(json.templates ?? {});
      } catch { /* abort */ }
      finally { setReminderTemplatesLoading(false); }
    };
    load();
    return () => controller.abort();
  }, [reminderTemplatesOpen, reminderTemplates]);

  async function saveReminderTemplates() {
    if (!reminderTemplates) return;
    setReminderTemplatesSaving(true);
    try {
      const response = await fetch("/api/admin/reminder-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: reminderTemplates }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(json.error || "Could not save templates.");
      setMessage("Reminder templates saved. Changes take effect on the next cron run.");
      setReminderTemplates(json.templates ?? reminderTemplates);
    } catch {
      setMessage("Could not reach server.");
    } finally {
      setReminderTemplatesSaving(false);
    }
  }

  // Load scheduled reminders when communication tab is active
  useEffect(() => {
    if (section !== "communication") return;
    const controller = new AbortController();
    const loadScheduledReminders = async () => {
      setScheduledRemindersLoading(true);
      try {
        const response = await fetch("/api/admin/scheduled-reminders?limit=50", { signal: controller.signal });
        const json = await response.json().catch(() => ({}));
        if (response.ok) setScheduledReminders(json.reminders ?? []);
      } catch {
        // abort or network error
      } finally {
        setScheduledRemindersLoading(false);
      }
    };
    loadScheduledReminders();
    return () => controller.abort();
  }, [section]);

  async function createScheduledReminder() {
    const { message, targetType, zoneId, scheduledFor, includeStaff } = scheduleReminderForm;
    if (!message.trim()) return setMessage("Enter a message for the reminder.");
    if (!scheduledFor) return setMessage("Pick a date and time for the reminder.");
    if (new Date(scheduledFor) <= new Date()) return setMessage("Scheduled time must be in the future.");
    if (targetType === "zone" && !zoneId) return setMessage("Select a zone.");

    setScheduleSaving(true);
    try {
      const response = await fetch("/api/admin/scheduled-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          targetType,
          zoneId: targetType === "zone" ? zoneId : undefined,
          scheduledFor: new Date(scheduledFor).toISOString(),
          includeStaff,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(json.error || "Could not schedule reminder.");
      setMessage(`Reminder scheduled for ${new Date(scheduledFor).toLocaleString()}.`);
      setScheduleReminderForm({ message: "", targetType: "all", zoneId: "", scheduledFor: "", includeStaff: false });
      // Refresh list
      const refreshResponse = await fetch("/api/admin/scheduled-reminders?limit=50");
      const refreshJson = await refreshResponse.json().catch(() => ({}));
      if (refreshResponse.ok) setScheduledReminders(refreshJson.reminders ?? []);
    } catch {
      setMessage("Could not reach scheduling service.");
    } finally {
      setScheduleSaving(false);
    }
  }

  async function cancelScheduledReminder(id: string) {
    const confirmed = window.confirm("Cancel this scheduled reminder?");
    if (!confirmed) return;
    try {
      const response = await fetch("/api/admin/scheduled-reminders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(json.error || "Could not cancel reminder.");
      setMessage("Scheduled reminder canceled.");
      setScheduledReminders((prev) => prev.map((r) => (r.id === id ? { ...r, status: "canceled" } : r)));
    } catch {
      setMessage("Could not reach scheduling service.");
    }
  }

  if (!data) return <p className="text-sm text-admin-muted">Loading admin workspace...</p>;

  return (
    <div className="space-y-6">
      {section === "overview" ? (
        <section className="space-y-4">
          <article className="rounded-3xl border border-admin bg-admin-surface p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Operational Snapshot</p>
            <h2 className="mt-2 text-2xl font-bold">What needs attention first</h2>
            <p className="mt-2 max-w-3xl text-sm text-admin-muted">
              Treat this page as the top of the day board: confirm cycle volume, clear delivery failures, then move into dispatch once the stop list is stable.
            </p>
          </article>
          <section className="grid gap-4 xl:grid-cols-3">
            <article className="rounded-3xl border border-admin bg-admin-surface p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-admin-soft">Ready Routes</p>
              <p className="mt-2 text-4xl font-bold">{opsOverview.readyRoutes}</p>
              <p className="mt-2 text-sm text-admin-muted">Routes already assigned or in progress.</p>
            </article>
            <article className="rounded-3xl border border-admin bg-admin-surface p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-admin-soft">Draft Routes</p>
              <p className="mt-2 text-4xl font-bold">{opsOverview.draftRoutes}</p>
              <p className="mt-2 text-sm text-admin-muted">Cycles with a route built but not yet staffed.</p>
            </article>
            <article className="rounded-3xl border border-admin bg-admin-surface p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-admin-soft">Cycle Exceptions</p>
              <p className="mt-2 text-4xl font-bold">{opsOverview.cycleExceptions}</p>
              <p className="mt-2 text-sm text-admin-muted">Households marked not ready or missed and likely needing follow-up.</p>
            </article>
          </section>
          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-3xl border border-admin bg-admin-surface p-6">
              <h3 className="text-lg font-bold">Recommended workflow</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">1. Calendar</p>
                  <p className="mt-2 text-sm text-admin-muted">Check Pickup Calendar for the next service day and request volume.</p>
                </div>
                <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">2. Dispatch</p>
                  <p className="mt-2 text-sm text-admin-muted">Build one route per zone and cycle, then assign the driver.</p>
                </div>
                <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">3. Support</p>
                  <p className="mt-2 text-sm text-admin-muted">Use Messages and Billing to clear failures before they snowball.</p>
                </div>
              </div>
            </article>
            <article className="rounded-3xl border border-admin bg-admin-surface p-6">
              <h3 className="text-lg font-bold">Attention queue</h3>
              <div className="mt-4 space-y-3 text-sm text-admin-muted">
                <p><span className="font-semibold text-admin">{opsOverview.activeZones}</span> active zones currently open.</p>
                <p><span className="font-semibold text-admin">{opsOverview.attentionSubscriptions}</span> subscriber accounts need billing review.</p>
                <p><span className="font-semibold text-admin">{failedNotificationEvents.length}</span> message failures are in the log.</p>
                <p><span className="font-semibold text-admin">{opsOverview.openWaitlist}</span> waitlist records still need conversion planning.</p>
              </div>
            </article>
          </section>
        </section>
      ) : null}

      {section === "people" ? (
        <section className="rounded-3xl border border-admin bg-admin-surface p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <a
              href="/admin?tab=people&sub=customers"
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                peopleSubtab === "customers"
                  ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                  : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
              }`}
            >
              Customers
            </a>
            <a
              href="/admin?tab=people&sub=staff"
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                peopleSubtab === "staff"
                  ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                  : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
              }`}
            >
              Staff
            </a>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{peopleSubtab === "customers" ? "Donor Directory" : "Team Directory"}</p>
              <p className="text-xs text-admin-soft">
                {peopleSubtab === "customers"
                  ? "Search donor accounts by name, email, or ZIP and check where they are assigned."
                  : "Review DonateCrate staff and organization team roles without donor records mixed in."}
              </p>
            </div>
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search users"
              className="dc-input-admin w-full sm:min-w-[220px] sm:w-auto"
            />
            {peopleSubtab === "staff" ? (
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as "all" | GlobalAppRole)}
                className="dc-input-admin w-full sm:w-auto"
              >
                <option value="all">All team roles</option>
                <option value="customer">Donor accounts</option>
                <option value="driver">Driver</option>
                <option value="admin">DonateCrate Admin</option>
              </select>
            ) : (
              <div className="h-10 rounded-xl border border-admin bg-admin-panel px-3 text-sm flex items-center text-admin-soft">
                Showing donor accounts
              </div>
            )}
            <select
              value={userZoneFilter}
              onChange={(event) => setUserZoneFilter(event.target.value)}
              className="dc-input-admin w-full sm:w-auto"
            >
              <option value="all">All zones</option>
              {data.zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-2">
            {(peopleSubtab === "customers" ? filteredCustomerUsers : filteredStaffUsers).map((user) => (
              <article key={user.id} className="rounded-2xl border border-admin bg-admin-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{user.full_name || "No name set"}</p>
                    <p className="text-xs text-admin-muted">{user.email}</p>
                  </div>
                  {peopleSubtab === "staff" ? (
                    <select
                      value={user.role}
                      onChange={(event) => updateUserRole(user.id, event.target.value as GlobalAppRole)}
                      className="dc-input-admin !h-9 text-xs"
                    >
                      <option value="customer">Donor</option>
                      <option value="driver">Driver</option>
                      <option value="admin">DonateCrate Admin</option>
                    </select>
                  ) : (
                    <span className="rounded-full border border-admin px-3 py-1 text-xs font-semibold text-admin-muted">Donor</span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-admin-muted md:grid-cols-3">
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
              <p className="text-sm text-admin-soft">No users match the current filters.</p>
            ) : null}
          </div>

          <section className="mt-6 rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-sm font-semibold">{peopleSubtab === "customers" ? "Donors And Billing" : "Team And Network"}</p>
            <p className="mt-2 text-sm text-admin-muted">
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
            <article className="dc-stat-admin">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Active Subscribers</p>
              <p className="mt-3 text-3xl font-bold">
                {data.subscriptions.filter((subscription) => subscription.status === "active").length}
              </p>
            </article>
            <article className="dc-stat-admin">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Ending This Period</p>
              <p className="mt-3 text-3xl font-bold">
                {data.subscriptions.filter((subscription) => subscription.cancelAtPeriodEnd).length}
              </p>
            </article>
            <article className="dc-stat-admin">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Needs Attention</p>
              <p className="mt-3 text-3xl font-bold">
                {data.subscriptions.filter((subscription) => ["past_due", "canceled"].includes(subscription.status)).length}
              </p>
            </article>
            <article className="dc-stat-admin">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Saved Card on File</p>
              <p className="mt-3 text-3xl font-bold">
                {data.subscriptions.filter((subscription) => subscription.paymentMethod?.type === "card").length}
              </p>
            </article>
          </div>

          <article className="dc-stat-admin !p-4">
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
                  className="dc-input-admin min-w-0"
                />
                <select
                  value={subscriptionStatusFilter}
                  onChange={(event) =>
                    setSubscriptionStatusFilter(
                      event.target.value as "all" | "active" | "past_due" | "paused" | "canceled",
                    )
                  }
                  className="dc-input-admin"
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
                                <p className="text-xs uppercase tracking-[0.25em] text-admin-muted">Payment method preview</p>
                                <p className="mt-2 text-2xl font-bold capitalize">
                                  {subscription.paymentMethod?.brand || subscription.paymentMethod?.type || "Unavailable"}
                                </p>
                              </div>
                              <span className="rounded-full border border-admin-strong bg-admin-surface-strong px-3 py-1 text-xs font-semibold text-admin-muted">
                                {subscription.paymentMethod?.funding || "stored"}
                              </span>
                            </div>
                            <p className="mt-12 font-mono text-2xl tracking-[0.28em] text-admin">
                              •••• •••• •••• {subscription.paymentMethod?.last4 || "----"}
                            </p>
                            <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-admin-soft">Card expires</p>
                                <p className="mt-1 font-semibold">{formatCardExpiry(subscription.paymentMethod?.expMonth ?? null, subscription.paymentMethod?.expYear ?? null)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-admin-soft">Country</p>
                                <p className="mt-1 font-semibold">{subscription.paymentMethod?.country || "Unknown"}</p>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-admin-soft">Charge amount</p>
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
                                  className="rounded-full border px-3 py-2 text-xs font-semibold hover:bg-admin-surface-strong"
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
                                className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-admin-surface-strong disabled:cursor-not-allowed disabled:opacity-60"
                                style={{ borderColor: "var(--admin-border-strong)", background: "var(--admin-panel)" }}
                              >
                                {actionBusy && subscriptionActionState?.action === "sync" ? <><Spinner size="sm" color="current" /> Refreshing...</> : "Refresh from Stripe"}
                              </button>
                              <button
                                type="button"
                                onClick={() => runSubscriptionAction(subscription.id, "schedule_cancel")}
                                disabled={actionBusy || !canScheduleCancel}
                                className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 admin-badge-amber"
                              >
                                {actionBusy && subscriptionActionState?.action === "schedule_cancel" ? <><Spinner size="sm" color="current" /> Scheduling...</> : subscription.cancelAtPeriodEnd ? "Cancellation scheduled" : "End after current period"}
                              </button>
                              <button
                                type="button"
                                onClick={() => runSubscriptionAction(subscription.id, "resume")}
                                disabled={actionBusy || !canResume}
                                className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 admin-badge-green"
                              >
                                {actionBusy && subscriptionActionState?.action === "resume" ? <><Spinner size="sm" color="current" /> Resuming...</> : isEnded ? "Restart subscription" : "Restore auto-renew"}
                              </button>
                              <button
                                type="button"
                                onClick={() => runSubscriptionAction(subscription.id, "cancel_now")}
                                disabled={actionBusy || isEnded || !subscription.stripeSubscriptionId}
                                className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 admin-badge-red"
                              >
                                {actionBusy && subscriptionActionState?.action === "cancel_now" ? <><Spinner size="sm" color="current" /> Canceling...</> : "Cancel immediately"}
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
                className="dc-stat-admin border-dashed !p-8 text-sm"
                style={{ color: "var(--admin-soft-text)" }}
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
            <div className="rounded-3xl border border-admin bg-admin-surface p-4">
              <p className="text-sm font-semibold">Network Workspace</p>
              <p className="mt-1 text-xs text-admin-soft">Separate service area operations from nonprofit account management.</p>
              <div className="mt-3 space-y-2">
                <a
                  href="/admin?tab=network&sub=zones"
                  className={`block rounded-xl border px-3 py-2 text-sm font-semibold ${
                    networkSubtab === "zones"
                      ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                      : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
                  }`}
                >
                  Zones
                </a>
                <a
                  href="/admin?tab=network&sub=partners"
                  className={`block rounded-xl border px-3 py-2 text-sm font-semibold ${
                    networkSubtab === "partners"
                      ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                      : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
                  }`}
                >
                  Partners
                </a>
              </div>
            </div>

            {networkSubtab === "zones" ? (
              <div className="rounded-3xl border border-admin bg-admin-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Service Areas</p>
                    <p className="mt-1 text-xs text-admin-soft">Select a service area to review settings, coverage, and scheduling.</p>
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
                          : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
                      }`}
                    >
                      <p className="font-semibold">{zone.name}</p>
                      <p className="text-xs text-admin-soft">ZIP {zone.anchor_postal_code} | {formatZoneStatusLabel(zone.status)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-admin bg-admin-surface p-4">
                <p className="text-sm font-semibold">Organizations</p>
                <p className="mt-1 text-xs text-admin-soft">Select an organization to manage branding, contact details, and team access.</p>
                <div className="mt-3 space-y-2">
                  {partnerOptions.map((partner) => (
                    <button
                      key={partner.id}
                      type="button"
                      onClick={() => setSelectedPartnerId(partner.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        selectedPartnerId === partner.id
                          ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
                          : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
                      }`}
                    >
                      <p className="font-semibold">{partner.name}</p>
                      <p className="text-xs text-admin-soft">{partner.code} | {partner.active ? "Active" : "Inactive"}</p>
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
                  className="rounded-3xl border border-admin bg-admin-surface p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">{selectedZone!.name}</h3>
                      <p className="text-xs text-admin-soft">{selectedZone!.code} | ZIP {selectedZone!.anchor_postal_code}</p>
                    </div>
                    {isDemoOnlyZone(selectedZone!) ? (
                      <div className="rounded-full border px-3 py-1 text-xs font-semibold admin-badge-amber">
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
                    <label className="text-xs text-admin-muted">
                      Service Radius (miles)
                      <input
                        name="radiusMiles"
                        type="number"
                        min={0.5}
                        step={0.5}
                        defaultValue={selectedZone!.radius_miles}
                        className="dc-input-admin mt-1 w-full"
                      />
                    </label>
                    <label className="text-xs text-admin-muted">
                      Active households
                      <input
                        name="minActiveSubscribers"
                        type="number"
                        min={1}
                        defaultValue={selectedZone!.min_active_subscribers}
                        className="dc-input-admin mt-1 w-full"
                      />
                    </label>
                    <label className="text-xs text-admin-muted">
                      Service area status
                      <select name="status" defaultValue={selectedZone!.status} className="dc-input-admin mt-1 w-full">
                        <option value="pending">Planning</option>
                        <option value="launching">Opening Soon</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-admin-muted">
                      Service lead
                      <select name="operationModel" defaultValue={selectedZone!.operation_model} className="dc-input-admin mt-1 w-full">
                        <option value="donatecrate_operated">DonateCrate managed</option>
                        <option value="partner_operated">Organization managed</option>
                      </select>
                    </label>
                    <label className="text-xs text-admin-muted">
                      Organization
                      <select name="partnerId" defaultValue={selectedZone!.partner_id ?? ""} className="dc-input-admin mt-1 w-full">
                        <option value="">No organization assigned</option>
                        {partnerOptions.map((partner) => (
                          <option key={partner.id} value={partner.id}>{partner.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-admin-muted md:col-span-2">
                      <input name="partnerPickupDateOverrideAllowed" type="checkbox" defaultChecked={selectedZone!.partner_pickup_date_override_allowed} />
                      Let the organization manage pickup dates for this service area
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-admin-muted md:col-span-2">
                      <input name="demoOnly" type="checkbox" defaultChecked={selectedZone!.demo_only} />
                      Demo only: keep this service area available for staff demos but block public signup
                    </label>
                    <label className="text-xs text-admin-muted">
                      Recurring pickup day
                      <input
                        name="recurringPickupDay"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={selectedZone!.recurring_pickup_day ?? ""}
                        className="dc-input-admin mt-1 w-full"
                      />
                    </label>
                    <label className="text-xs text-admin-muted md:col-span-2">
                      Pickup window
                      <input
                        name="defaultPickupWindowLabel"
                        type="text"
                        defaultValue={selectedZone!.default_pickup_window_label ?? ""}
                        className="dc-input-admin mt-1 w-full"
                      />
                    </label>
                    <label className="text-xs text-admin-muted md:col-span-2">
                      Team notes
                      <textarea
                        name="partnerNotes"
                        defaultValue={selectedZone!.partner_notes ?? ""}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2"
                        placeholder="Notes for staff handling this service area"
                      />
                    </label>
                  </div>

                  <p className="mt-3 text-xs text-admin-soft">Area center: {selectedZone!.center_address || "Not set"}</p>
                  {selectedZone!.demo_only ? (
                    <p className="mt-1 text-xs text-amber-700">Public signup is blocked for this demo service area, even if signup is turned on.</p>
                  ) : null}
                  <p className="mt-1 text-xs text-admin-soft">
                    Service lead: {selectedZone!.operation_model === "partner_operated"
                      ? selectedZone!.partner?.name || "No organization assigned"
                      : "DonateCrate team"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="submit" disabled={zoneSaving} className="inline-flex items-center gap-2 rounded-lg border border-admin-strong px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                      {zoneSaving ? <><Spinner size="sm" color="current" /> Saving...</> : "Save Zone Settings"}
                    </button>
                  </div>
                </form>

                <section className="rounded-3xl border border-admin bg-admin-surface p-6">
                  <h4 className="text-lg font-bold">People In This Service Area</h4>
                  <p className="mt-1 text-xs text-admin-soft">Donors and team members currently connected to this coverage area.</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <input
                      value={zoneMemberSearch}
                      onChange={(event) => {
                        setZoneMemberSearch(event.target.value);
                        setZoneMemberPage(1);
                      }}
                      placeholder="Search members"
                      className="dc-input-admin"
                    />
                    <select
                      value={zoneMemberRole}
                      onChange={(event) => {
                        setZoneMemberRole(event.target.value as "all" | "customer" | "admin" | "driver" | "partner_admin" | "partner_coordinator" | "partner_driver");
                        setZoneMemberPage(1);
                      }}
                      className="dc-input-admin"
                    >
                      <option value="all">All people</option>
                      <option value="customer">Donor</option>
                      <option value="driver">Driver</option>
                      <option value="admin">DonateCrate Admin</option>
                      <option value="partner_admin">Organization Admin</option>
                      <option value="partner_coordinator">Coordinator</option>
                      <option value="partner_driver">Driver</option>
                    </select>
                    <p className="text-xs text-admin-muted md:self-center">
                      {zoneMemberPagination.total} total members
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {zoneMembers.map((user) => (
                      <div key={user.id} className="rounded-xl border border-admin bg-admin-panel p-3">
                        <p className="text-sm font-semibold">{user.full_name || user.email}</p>
                        <p className="text-xs text-admin-muted">{user.email} | {formatRoleLabel(user.role)}</p>
                        <p className="mt-1 text-xs text-admin-soft">{user.primary_address ? `${user.primary_address.address_line1}, ${user.primary_address.city}` : "Address not set"}</p>
                      </div>
                    ))}
                    {zoneMembers.length === 0 ? <p className="text-sm text-admin-soft">No active members found for this zone.</p> : null}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoneMemberPage((prev) => Math.max(1, prev - 1))}
                      disabled={zoneMemberPagination.page <= 1}
                      className="rounded border border-admin-strong px-2 py-1 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="text-admin-muted">Page {zoneMemberPagination.page} of {zoneMemberPagination.totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setZoneMemberPage((prev) => Math.min(zoneMemberPagination.totalPages, prev + 1))}
                      disabled={zoneMemberPagination.page >= zoneMemberPagination.totalPages}
                      className="rounded border border-admin-strong px-2 py-1 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </section>

                <section className="rounded-3xl border border-admin bg-admin-surface p-6">
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
                      className="dc-input-admin"
                    />
                    <button onClick={updateZoneCenterAddress} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">Save Center Address</button>
                  </div>
                  {editCenterPredictions.length > 0 ? (
                    <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-admin-strong bg-admin-panel p-2">
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
                          className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-admin-surface-strong"
                        >
                          {prediction.mainText}
                          <p className="text-xs text-admin-muted">{prediction.secondaryText || prediction.description}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {editCenterSelection ? <p className="mt-2 text-xs text-admin-muted">Selected: {editCenterSelection.formattedAddress}</p> : null}
                </section>
                  </>
                ) : null}

                {networkSubtab === "partners" ? (
                <section className="rounded-3xl border border-admin bg-admin-surface p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold">Organizations</h4>
                      <p className="mt-1 text-xs text-admin-soft">Create organization records, manage team access, and connect each organization to the right service areas.</p>
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
                        className="h-10 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm sm:w-auto"
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
                        <article className="rounded-2xl border border-admin bg-admin-panel p-4 text-sm text-admin-muted">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-admin">{selectedPartner.name}</p>
                              <p className="mt-1 text-xs text-admin-soft">{selectedPartner.code} | Receipts sent by DonateCrate on behalf of this nonprofit</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedPartner.active ? "admin-badge-green" : "admin-badge-red"}`}>
                              {selectedPartner.active ? "Active partner" : "Inactive partner"}
                              
                            </span>
                          </div>
                          <p className="mt-3 text-xs text-admin-muted">
                            Support: {selectedPartner.support_email || "No email"} {selectedPartner.support_phone ? `| ${selectedPartner.support_phone}` : ""}
                          </p>
                          <p className="mt-2 text-xs text-admin-muted">
                            Receipts send from giving@donatecrate.com and use this nonprofit&apos;s branding.
                          </p>
                          <p className="mt-2 text-xs text-admin-muted">
                            Service areas: {selectedPartner.zones.length > 0 ? selectedPartner.zones.map((zone) => zone.name).join(" | ") : "None yet"}
                          </p>
                        </article>
                        <article className="rounded-2xl border border-admin bg-admin-panel p-4">
                          <p className="text-sm font-semibold">Add team member</p>
                          <p className="mt-1 text-xs text-admin-soft">Use any email address. If the person is new to DonateCrate, we will create the account and send a branded setup email for this organization.</p>
                          <div className="mt-3 grid gap-2">
                            <input
                              value={partnerMemberEmail}
                              onChange={(event) => setPartnerMemberEmail(event.target.value)}
                              placeholder="Work email address"
                              className="dc-input-admin"
                            />
                            <select
                              value={partnerMemberRole}
                              onChange={(event) => setPartnerMemberRole(event.target.value as "partner_admin" | "partner_coordinator" | "partner_driver")}
                              className="dc-input-admin"
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
                          <article className="rounded-2xl border border-admin bg-admin-panel p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-admin">Organization account</p>
                                <p className="mt-1 text-xs text-admin-soft">Update the organization&apos;s contact details, profile information, and donor-facing branding here.</p>
                              </div>
                              <label className="inline-flex items-center gap-2 text-xs text-admin-muted">
                                <input
                                  type="checkbox"
                                  checked={selectedPartnerForm.active}
                                  onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, active: event.target.checked } : prev))}
                                />
                                Active
                              </label>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <input value={selectedPartnerForm.name} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))} placeholder="Organization name" className="dc-input-admin" />
                              <input value={selectedPartner.code} disabled className="dc-input-admin opacity-70" />
                              <input value={selectedPartnerForm.legalName} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, legalName: event.target.value } : prev))} placeholder="Legal name" className="dc-input-admin" />
                              <input value={selectedPartnerForm.supportEmail} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, supportEmail: event.target.value } : prev))} placeholder="Support email" className="dc-input-admin" />
                              <input value={selectedPartnerForm.supportPhone} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, supportPhone: event.target.value } : prev))} placeholder="Support phone" className="dc-input-admin" />
                              <input value={selectedPartnerForm.websiteUrl} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, websiteUrl: event.target.value } : prev))} placeholder="Website URL" className="dc-input-admin" />
                              <input value={selectedPartnerForm.addressLine1} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, addressLine1: event.target.value } : prev))} placeholder="Mailing address" className="dc-input-admin md:col-span-2" />
                              <input value={selectedPartnerForm.city} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, city: event.target.value } : prev))} placeholder="City" className="dc-input-admin" />
                              <div className="grid gap-3 sm:grid-cols-2">
                                <input value={selectedPartnerForm.state} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, state: event.target.value } : prev))} placeholder="State" className="dc-input-admin" />
                                <input value={selectedPartnerForm.postalCode} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, postalCode: event.target.value } : prev))} placeholder="ZIP code" className="dc-input-admin" />
                              </div>
                              <div className="rounded-xl border border-admin bg-admin-panel px-3 py-3 text-xs text-admin-muted md:col-span-2">
                                Receipt delivery is handled by DonateCrate on behalf of this nonprofit. Payout settings stay internal for now and are not edited here.
                              </div>
                              <textarea value={selectedPartnerForm.aboutParagraph} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, aboutParagraph: event.target.value } : prev))} rows={4} placeholder="About paragraph" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
                              <textarea value={selectedPartnerForm.notes} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))} rows={3} placeholder="Team notes" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
                            </div>
                          </article>

                          <article className="rounded-2xl border border-admin bg-admin-panel p-4">
                            <p className="text-sm font-semibold text-admin">Receipt branding</p>
                            <p className="mt-1 text-xs text-admin-soft">This branding is used in donation receipt emails while delivery still comes from `giving@donatecrate.com`.</p>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <input value={selectedPartnerForm.displayName} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))} placeholder="Receipt display name" className="dc-input-admin" />
                              <div className="rounded-xl border border-admin bg-admin-panel p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-admin-soft">Logo preview</p>
                                <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-admin bg-admin-surface p-3">
                                  {selectedPartnerForm.logoUrl ? (
                                    <div
                                      className="h-full w-full bg-contain bg-center bg-no-repeat"
                                      style={{ backgroundImage: `url(${selectedPartnerForm.logoUrl})` }}
                                    />
                                  ) : (
                                    <p className="text-xs text-admin-soft">No logo uploaded yet.</p>
                                  )}
                                </div>
                              </div>
                              <input value={selectedPartnerForm.primaryColor} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, primaryColor: event.target.value } : prev))} placeholder="Primary color (#hex)" className="dc-input-admin" />
                              <input value={selectedPartnerForm.secondaryColor} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, secondaryColor: event.target.value } : prev))} placeholder="Secondary color (#hex)" className="dc-input-admin" />
                              <input value={selectedPartnerForm.accentColor} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, accentColor: event.target.value } : prev))} placeholder="Accent color (#hex)" className="dc-input-admin" />
                              <div className="rounded-xl border border-admin bg-admin-panel px-3 py-3 text-xs text-admin-muted">
                                Sender: {selectedPartnerForm.displayName || selectedPartnerForm.name || selectedPartner.name} &lt;giving@donatecrate.com&gt;
                              </div>
                              <textarea value={selectedPartnerForm.receiptFooter} onChange={(event) => setSelectedPartnerForm((prev) => (prev ? { ...prev, receiptFooter: event.target.value } : prev))} rows={4} placeholder="Receipt footer" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                              <button onClick={updatePartnerAccount} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">
                                Save Partner Settings
                              </button>
                              <p className="text-xs text-admin-soft">Receipt sending is fixed to DonateCrate on behalf of the nonprofit.</p>
                            </div>
                          </article>
                        </div>
                      ) : null}

                      <article className="rounded-2xl border border-admin bg-admin-panel p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-admin">Organization team</p>
                            <p className="mt-1 text-xs text-admin-soft">Manage organization admins, coordinators, and drivers without leaving the DonateCrate admin panel.</p>
                          </div>
                          <p className="text-xs text-admin-soft">{selectedPartner.members.length} members</p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {selectedPartner.members.map((member) => (
                            <div key={member.id} className="rounded-xl border border-admin bg-admin-panel p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-admin">{member.full_name || member.email}</p>
                                  <p className="mt-1 text-xs text-admin-muted">{member.email}{member.phone ? ` | ${member.phone}` : ""}</p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${member.active ? "admin-badge-green" : "admin-badge-slate"}`}>
                                  {member.active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <select
                                  value={member.role}
                                  onChange={(event) => updatePartnerMember(member.id, { role: event.target.value as "partner_admin" | "partner_coordinator" | "partner_driver" })}
                                  className="h-9 rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm"
                                >
                                  <option value="partner_admin">Organization Admin</option>
                                  <option value="partner_coordinator">Coordinator</option>
                                  <option value="partner_driver">Driver</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => updatePartnerMember(member.id, { active: !member.active })}
                                  className="rounded-lg border border-admin-strong px-3 py-2 text-xs font-semibold"
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
                                <p className="text-xs text-admin-soft">{formatPartnerTeamRole(member.role)}</p>
                              </div>
                            </div>
                          ))}
                          {selectedPartner.members.length === 0 ? <p className="text-sm text-admin-soft">No team members added yet.</p> : null}
                        </div>
                      </article>
                    </div>
                  ) : null}
                </section>
                ) : null}
              </>
            ) : null}

            {networkSubtab === "zones" ? showCreateZoneForm ? (
              <section className="rounded-3xl border border-admin bg-admin-surface p-6">
                <h4 className="text-lg font-bold">Add New Service Area</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input value={zoneForm.name} onChange={(event) => setZoneForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Service area name" className="dc-input-admin" />
                  <input value={zoneForm.code} onChange={(event) => setZoneForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="Internal area code" className="dc-input-admin" />
                  <input value={zoneForm.anchorPostalCode} onChange={(event) => setZoneForm((prev) => ({ ...prev, anchorPostalCode: event.target.value }))} placeholder="Anchor ZIP" className="dc-input-admin" />
                  <input type="number" min={0.5} step={0.5} value={zoneForm.radiusMiles} onChange={(event) => setZoneForm((prev) => ({ ...prev, radiusMiles: Number(event.target.value) }))} placeholder="Service radius (miles)" className="dc-input-admin" />
                  <input type="number" min={1} value={zoneForm.minActiveSubscribers} onChange={(event) => setZoneForm((prev) => ({ ...prev, minActiveSubscribers: Number(event.target.value) }))} placeholder="Active household goal" className="dc-input-admin" />
                  <input
                    value={createCenterQuery}
                    onChange={(event) => {
                      setCreateCenterQuery(event.target.value);
                      setCreateCenterSelection(null);
                      if (event.target.value.trim().length < 3) setCreateCenterPredictions([]);
                    }}
                    placeholder="Service area center address"
                    className="dc-input-admin"
                  />
                </div>
                {createCenterPredictions.length > 0 ? (
                  <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-admin-strong bg-admin-panel p-2">
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
                        className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-admin-surface-strong"
                      >
                        {prediction.mainText}
                        <p className="text-xs text-admin-muted">{prediction.secondaryText || prediction.description}</p>
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
                    className="rounded-lg border border-admin-strong px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            ) : null : showCreatePartnerForm ? (
              <section className="rounded-3xl border border-admin bg-admin-surface p-6">
                <h4 className="text-lg font-bold">Add Nonprofit Partner</h4>
                <p className="mt-1 text-xs text-admin-soft">This creates the organization record and the nonprofit can brand receipts while delivery still comes from giving@donatecrate.com.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input value={partnerForm.name} onChange={(event) => setPartnerForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Partner name" className="dc-input-admin" />
                  <input value={partnerForm.code} onChange={(event) => setPartnerForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="Partner code" className="dc-input-admin" />
                  <input value={partnerForm.legalName} onChange={(event) => setPartnerForm((prev) => ({ ...prev, legalName: event.target.value }))} placeholder="Legal name" className="dc-input-admin" />
                  <input value={partnerForm.supportEmail} onChange={(event) => setPartnerForm((prev) => ({ ...prev, supportEmail: event.target.value }))} placeholder="Support email" className="dc-input-admin" />
                  <input value={partnerForm.supportPhone} onChange={(event) => setPartnerForm((prev) => ({ ...prev, supportPhone: event.target.value }))} placeholder="Support phone" className="dc-input-admin" />
                  <input value={partnerForm.displayName} onChange={(event) => setPartnerForm((prev) => ({ ...prev, displayName: event.target.value }))} placeholder="Receipt display name" className="dc-input-admin" />
                  <div className="rounded-xl border border-admin bg-admin-panel px-3 py-3 text-xs text-admin-muted md:col-span-2">
                    Receipt emails are always sent by DonateCrate on behalf of the nonprofit. Payout and revenue-share settings are handled internally and are not configured here yet.
                  </div>
                  <input value={partnerForm.primaryColor} onChange={(event) => setPartnerForm((prev) => ({ ...prev, primaryColor: event.target.value }))} placeholder="Primary color (#hex)" className="dc-input-admin" />
                  <input value={partnerForm.accentColor} onChange={(event) => setPartnerForm((prev) => ({ ...prev, accentColor: event.target.value }))} placeholder="Accent color (#hex)" className="dc-input-admin" />
                  <div className="rounded-xl border border-admin bg-admin-panel p-3 md:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-admin-soft">Logo preview</p>
                    <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-admin bg-admin-surface p-3">
                      {partnerForm.logoUrl ? (
                        <div
                          className="h-full w-full bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: `url(${partnerForm.logoUrl})` }}
                        />
                      ) : (
                        <p className="text-xs text-admin-soft">No logo added yet. Logos are managed after the partner is created.</p>
                      )}
                    </div>
                  </div>
                  <input value={partnerForm.websiteUrl} onChange={(event) => setPartnerForm((prev) => ({ ...prev, websiteUrl: event.target.value }))} placeholder="Website URL" className="h-10 rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm md:col-span-2" />
                  <textarea value={partnerForm.notes} onChange={(event) => setPartnerForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Internal notes" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
                  <textarea value={partnerForm.receiptFooter} onChange={(event) => setPartnerForm((prev) => ({ ...prev, receiptFooter: event.target.value }))} rows={3} placeholder="Receipt footer" className="rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-sm md:col-span-2" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button onClick={createPartner} className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">Create Partner</button>
                  <button
                    type="button"
                    onClick={() => setShowCreatePartnerForm(false)}
                    className="rounded-lg border border-admin-strong px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <p className="text-xs text-admin-soft">DonateCrate will send receipts on behalf of this nonprofit using the branding set here.</p>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      ) : null}

      {section === "pickups" ? (
        <>
          <section className="rounded-3xl border border-admin bg-admin-surface p-6">
            <h3 className="text-xl font-bold">Pickup Calendar Builder</h3>
            <p className="mt-1 text-sm text-admin-muted">
              A pickup cycle is the actual service day for one zone. Build one cycle at a time, or generate the monthly calendar in advance.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPickupMode("single")}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${pickupMode === "single" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20" : "border-admin-strong"}`}
              >
                One-time cycle
              </button>
              <button
                type="button"
                onClick={() => setPickupMode("recurring")}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${pickupMode === "recurring" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20" : "border-admin-strong"}`}
              >
                Recurring monthly
              </button>
            </div>

            {/* Zone selector */}
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr]">
              <label className="text-xs text-admin-muted">
                Zone
                <select
                  value={scheduleForm.zoneCode}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, zoneCode: event.target.value }))}
                  className="dc-input-admin mt-1 w-full"
                >
                  {data.zones.map((zone) => (
                    <option key={zone.id} value={zone.code}>{zone.name}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 self-end rounded-lg border border-admin-strong bg-admin-panel px-3 text-xs text-admin-muted">
                <input
                  type="checkbox"
                  checked={applyToAllActiveZones}
                  onChange={(event) => setApplyToAllActiveZones(event.target.checked)}
                />
                All active zones
              </label>
              <p className="self-end pb-2 text-xs text-admin-soft">
                {applyToAllActiveZones
                  ? "Every active zone will get a cycle."
                  : "Selected zone only."}
              </p>
            </div>

            {/* Mode-specific fields */}
            {pickupMode === "single" ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-admin-muted">
                  Pickup date
                  <input
                    type="date"
                    value={scheduleForm.pickupDate}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, pickupDate: event.target.value }))}
                    className="dc-input-admin mt-1 w-full"
                  />
                  <span className="mt-1 block text-[11px] text-admin-soft">
                    Cycle month is derived automatically ({scheduleForm.pickupDate ? new Date(scheduleForm.pickupDate + "T12:00:00").toLocaleString("en-US", { month: "long", year: "numeric" }) : "—"}).
                  </span>
                </label>
                <PickupWindowPicker
                  label="Pickup window (optional)"
                  value={scheduleForm.pickupWindowLabel}
                  onChange={(val) => setScheduleForm((prev) => ({ ...prev, pickupWindowLabel: val }))}
                  hint="Shown to customers in their portal, emails, and SMS reminders."
                  variant="admin"
                />
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs text-admin-muted">Scheduling horizon</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleForm((prev) => ({ ...prev, horizonMode: "months" }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${scheduleForm.horizonMode === "months" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20 text-admin" : "border-admin-strong text-admin-muted"}`}
                    >
                      Fixed window
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleForm((prev) => ({ ...prev, horizonMode: "forever" }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${scheduleForm.horizonMode === "forever" ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/20 text-admin" : "border-admin-strong text-admin-muted"}`}
                    >
                      Rolling (60 months)
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-xs text-admin-muted">
                    First pickup date
                    <input
                      type="date"
                      value={scheduleForm.startPickupDate}
                      onChange={(event) => setScheduleForm((prev) => ({ ...prev, startPickupDate: event.target.value }))}
                      className="dc-input-admin mt-1 w-full"
                    />
                    <span className="mt-1 block text-[11px] text-admin-soft">Day-of-month repeats each cycle.</span>
                  </label>
                  {scheduleForm.horizonMode === "months" ? (
                    <label className="text-xs text-admin-muted">
                      Months ahead
                      <input type="number" min={1} max={60} value={scheduleForm.months} onChange={(event) => setScheduleForm((prev) => ({ ...prev, months: Number(event.target.value) }))} className="dc-input-admin mt-1 w-full" />
                    </label>
                  ) : (
                    <div className="rounded-lg border border-admin-strong bg-admin-panel p-3 text-xs text-admin-soft">
                      Generates 60 months ahead. Re-run anytime to extend or update.
                    </div>
                  )}
                  <label className="text-xs text-admin-muted">
                    Weekend behavior
                    <select value={scheduleForm.weekendPolicy} onChange={(event) => setScheduleForm((prev) => ({ ...prev, weekendPolicy: event.target.value as "none" | "next_business_day" }))} className="dc-input-admin mt-1 w-full">
                      <option value="none">Keep exact date</option>
                      <option value="next_business_day">Move to next business day</option>
                    </select>
                  </label>
                </div>
                <PickupWindowPicker
                  label="Pickup window (optional)"
                  value={scheduleForm.pickupWindowLabel}
                  onChange={(val) => setScheduleForm((prev) => ({ ...prev, pickupWindowLabel: val }))}
                  hint="Shown to customers in their portal, emails, and SMS. Applied to every cycle in this series."
                  variant="admin"
                />
              </div>
            )}

            <button onClick={createPickupCycle} className="mt-4 rounded-xl bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold">
              {pickupMode === "single" ? "Save Pickup Cycle" : "Generate Recurring Cycles"}
            </button>

            <div className="mt-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Pickup Calendar Timeline</p>
                <select
                  value={timelineZoneFilter}
                  onChange={(event) => setTimelineZoneFilter(event.target.value)}
                  className="h-9 rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-xs"
                >
                  <option value="all">All zones</option>
                  {data.zones.map((zone) => (
                    <option key={zone.id} value={zone.code}>{zone.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                {timelineByMonth.map((group) => (
                  <article key={group.month} className="rounded-2xl border border-admin bg-admin-panel p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-admin-muted">{group.month}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {group.cycles.map((cycle) => {
                        const zoneMeta = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
                        const isEditing = editingCycleId === cycle.id;
                        if (isEditing && cycleEditForm) {
                          return (
                            <div key={cycle.id} className="rounded-xl border border-[var(--dc-orange)]/50 bg-admin-surface p-3 text-xs ring-2 ring-[var(--dc-orange)]/20">
                              <p className="mb-2 font-semibold text-admin">{zoneMeta?.name || cycle.zone_id}</p>
                              <label className="block text-admin-soft">
                                Pickup date
                                <input
                                  type="date"
                                  value={cycleEditForm.pickupDate}
                                  onChange={(e) => setCycleEditForm((prev) => prev ? { ...prev, pickupDate: e.target.value } : prev)}
                                  className="dc-input-admin mt-1 w-full"
                                />
                              </label>
                              <div className="mt-2">
                                <PickupWindowPicker
                                  label="Pickup window"
                                  value={cycleEditForm.pickupWindowLabel}
                                  onChange={(val) => setCycleEditForm((prev) => prev ? { ...prev, pickupWindowLabel: val } : prev)}
                                  variant="admin"
                                />
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={saveCycleEdit}
                                  disabled={cycleEditSaving}
                                  className="flex items-center gap-1.5 rounded-lg bg-[var(--dc-orange)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                                >
                                  {cycleEditSaving ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingCycleId(null); setCycleEditForm(null); }}
                                  className="rounded-lg border border-admin-strong px-3 py-1.5 text-xs font-semibold text-admin-muted cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <button
                            key={cycle.id}
                            type="button"
                            onClick={() => {
                              setEditingCycleId(cycle.id);
                              setCycleEditForm({
                                pickupDate: cycle.pickup_date,
                                pickupWindowLabel: (cycle as Record<string, unknown>).pickup_window_label as string ?? "",
                              });
                            }}
                            className="rounded-lg border border-admin bg-admin-panel p-3 text-left text-xs cursor-pointer hover:border-[var(--dc-orange)]/40 hover:bg-admin-surface transition-colors"
                          >
                            <p className="font-semibold">{zoneMeta?.name || cycle.zone_id}</p>
                            <p className="mt-1 text-admin-muted">{formatDate(cycle.pickup_date)}</p>
                            {(cycle as Record<string, unknown>).pickup_window_label
                              ? <p className="mt-0.5 text-admin-soft">{String((cycle as Record<string, unknown>).pickup_window_label)}</p>
                              : <p className="mt-0.5 text-admin-soft/50 italic">No window set — click to edit</p>
                            }
                          </button>
                        );
                      })}
                    </div>
                  </article>
                ))}
                {timelineByMonth.length === 0 ? <p className="text-xs text-admin-soft">No pickup cycles found for this filter.</p> : null}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-admin bg-admin-surface p-6">
            <h3 className="text-xl font-bold">Member Responses</h3>
            <p className="mt-1 text-sm text-admin-muted">
              Review the most recent household responses for published cycles and correct any exception state before dispatch is built.
            </p>
            <div className="mt-3 space-y-2">
                {data.pickupRequests.slice(0, 20).map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-admin bg-admin-panel p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm break-all">
                    {(item.users?.full_name || item.users?.email) ?? "Unknown member"} ({item.pickup_cycles?.pickup_date})
                  </p>
                  <select
                    value={item.status}
                    onChange={(event) => updatePickupStatus(item.id, event.target.value)}
                    className="h-9 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-2 text-xs sm:w-auto"
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
          <article className="rounded-3xl border border-admin bg-admin-surface p-6">
            <h3 className="text-xl font-bold">Dispatch</h3>
            {/* Step 1 — Zone + Cycle selection */}
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-admin-soft mb-1">Zone</label>
                <select
                  value={selectedZoneCode}
                  onChange={(e) => { setSelectedZoneCode(e.target.value); setSelectedCycleId(""); }}
                  className="h-10 rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm cursor-pointer"
                >
                  <option value="">All zones</option>
                  {data.zones.map((zone) => (
                    <option key={zone.id} value={zone.code}>{zone.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-admin-soft mb-1">Pickup cycle</label>
                <select
                  value={selectedCycleId}
                  onChange={(e) => setSelectedCycleId(e.target.value)}
                  className="h-10 rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm cursor-pointer"
                >
                  <option value="">{logisticsCycles.length === 0 ? "No cycles scheduled" : "Select a cycle"}</option>
                  {logisticsCycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>{getCycleDisplayLabel(cycle)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Empty state */}
            {logisticsCycles.length === 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-admin bg-admin-panel px-5 py-6 text-center">
                <p className="font-semibold text-admin-muted">No pickup cycles scheduled yet</p>
                <p className="mt-1 text-sm text-admin-soft">Go to the <a href="/admin?section=pickups" className="underline text-orange-300">Pickups tab</a> to schedule a cycle first.</p>
              </div>
            )}

            {/* Cycle selected — stats + build */}
            {selectedCycleMeta && (
              <>
                <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4">
                  <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                    <p className="text-xs uppercase tracking-wide text-admin-soft">Ready</p>
                    <p className="mt-1 text-2xl font-bold">{selectedCycleRequestSummary.requested}</p>
                    <p className="text-xs text-admin-soft mt-0.5">households</p>
                  </div>
                  <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                    <p className="text-xs uppercase tracking-wide text-admin-soft">Skipped</p>
                    <p className="mt-1 text-2xl font-bold">{selectedCycleRequestSummary.skipped}</p>
                    <p className="text-xs text-admin-soft mt-0.5">this cycle</p>
                  </div>
                  <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                    <p className="text-xs uppercase tracking-wide text-admin-soft">Pickup date</p>
                    <p className="mt-1 text-lg font-bold leading-tight">{formatDate(selectedCycleMeta.pickup_date)}</p>
                  </div>
                  <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                    <p className="text-xs uppercase tracking-wide text-admin-soft">Route</p>
                    <p className="mt-1 text-lg font-bold leading-tight">
                      {selectedLogisticsRoute ? formatRouteStatusLabel(selectedLogisticsRoute.status) : "Not built"}
                    </p>
                  </div>
                </div>

                {/* Build route */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={generateRoute}
                    className="cursor-pointer rounded-xl bg-[var(--dc-orange)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,106,0,0.25)] hover:shadow-[0_6px_20px_rgba(255,106,0,0.35)] transition-all"
                  >
                    {selectedLogisticsRoute ? "Rebuild Route" : "Build Route"}
                  </button>
                  {selectedLogisticsRoute && (
                    <span className="text-xs text-admin-soft">
                      {selectedLogisticsRoute.stopCount ?? 0} stops · {getRouteDisplayLabel(selectedLogisticsRoute)}
                    </span>
                  )}
                </div>

                {/* Assign driver — only show once route exists */}
                {selectedLogisticsRoute && (
                  <div className="mt-4 border-t border-admin pt-4 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-admin-soft mb-1">Assign Driver</label>
                      <select
                        value={selectedDriverId}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="h-10 rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm cursor-pointer"
                      >
                        <option value="">{driverOptions.length === 0 ? "No drivers set up" : "Select driver"}</option>
                        {driverOptions.map((driver) => (
                          <option key={driver.id} value={driver.id}>{driver.employee_id} ({driver.users?.email})</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={assignDriver}
                      disabled={!selectedDriverId}
                      className="cursor-pointer h-10 rounded-xl bg-[var(--dc-orange)] px-5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Assign Driver
                    </button>
                  </div>
                )}
              </>
            )}

            {logisticsMessage && (
              <div className="mt-3 rounded-xl border border-admin bg-admin-panel px-4 py-3 text-sm text-admin-muted">
                {logisticsMessage}
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-admin bg-admin-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-bold">Route Preview</h4>
              {logisticsRoutePreview?.googleMapsUrl ? (
                <a
                  href={logisticsRoutePreview.googleMapsUrl}
                  target="_blank"
                  className="rounded border border-admin-strong px-3 py-1 text-xs"
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
                className="mt-3 w-full rounded-xl border border-admin bg-admin-panel"
                onError={() => setMapLoadError(true)}
                onLoad={() => setMapLoadError(false)}
              />
            ) : (
              <p className="mt-2 text-sm text-admin-soft">Select a cycle and build the route to preview stops and map output.</p>
            )}
            {mapLoadError ? (
              <p className="mt-3 text-sm text-amber-700">
                The in-panel map preview could not load, but the ordered stop list below and the Google Maps handoff are still available.
              </p>
            ) : null}

            <div className="mt-4 space-y-2">
              {selectedLogisticsRoute ? (
                <div className="rounded-xl border border-admin bg-admin-panel p-3 text-sm text-admin-muted">
                  <p className="font-semibold text-admin">
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
                <div key={stop.id} className="rounded-xl border border-admin bg-admin-panel p-3 text-sm">
                  <p className="font-semibold">Stop {stop.stopOrder}: {stop.fullName || stop.email || "Unknown subscriber"}</p>
                  <p className="text-xs text-admin-muted">
                    {stop.address
                      ? `${stop.address.addressLine1}, ${stop.address.city}, ${stop.address.state} ${stop.address.postalCode}`
                      : "Address unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-admin-muted">
                    Request: {formatPickupRequestLabel(stop.requestStatus ?? "unknown")} | Stop status:{" "}
                    {formatRouteStatusLabel(stop.stopStatus)}
                  </p>
                  {stop.requestNote ? <p className="mt-1 text-xs text-amber-700">Ops note: {stop.requestNote}</p> : null}
                </div>
              ))}
              {selectedLogisticsRoute?.id && (logisticsRoutePreview?.stops ?? []).length === 0 ? (
                <p className="text-sm text-admin-soft">No stops found for this route.</p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {section === "growth" ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-admin bg-admin-surface p-6 xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-bold">Waitlist</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-admin bg-admin-panel px-3 py-1">
                  {data.waitlist.length} total
                </span>
                <span className="rounded-full border border-admin bg-admin-panel px-3 py-1">
                  {data.waitlist.filter((e) => (e as Record<string,unknown>).has_account).length} with accounts
                </span>
                <span className="rounded-full border border-admin bg-admin-panel px-3 py-1">
                  {data.waitlist.filter((e) => e.status === "pending").length} pending
                </span>
                <span className="rounded-full border border-admin bg-admin-panel px-3 py-1">
                  {data.waitlist.filter((e) => e.status === "converted").length} converted
                </span>
              </div>
            </div>

            {/* Map — client-side Leaflet via CDN */}
            {data.waitlist.length > 0 && (
              <WaitlistMap entries={data.waitlist} />
            )}
            {data.waitlist.length === 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-admin bg-admin-panel px-5 py-8 text-center text-admin-soft text-sm">
                No waitlist entries yet
              </div>
            )}

            {/* Entry table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-admin text-left text-xs uppercase tracking-wide text-admin-soft">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Location</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin">
                  {data.waitlist.slice(0, 50).map((entry) => (
                    <tr key={entry.id} className="hover:bg-admin-panel/50">
                      <td className="py-2 pr-4 font-medium">{entry.full_name}</td>
                      <td className="py-2 pr-4 text-admin-muted">{entry.email}</td>
                      <td className="py-2 pr-4 text-admin-muted">{entry.city ? `${entry.city}, ` : ""}{entry.state} {entry.postal_code}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${entry.status === "converted" ? "bg-emerald-900/30 text-emerald-300" : "bg-amber-900/30 text-amber-300"}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-2 text-admin-soft text-xs">
                        {(entry as Record<string,unknown>).has_account ? "✓" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="rounded-3xl border border-admin bg-admin-surface p-6">
            <h3 className="text-xl font-bold">Affiliate Referrals</h3>
            <div className="mt-3 space-y-2">
              {data.referrals.slice(0, 30).map((referral) => (
                <div key={referral.id} className="rounded-lg border border-admin bg-admin-panel p-3 text-sm">
                  {referral.referrer_email ?? "Unknown"} {"->"} {referral.referred_email ?? "Pending user"} ({referral.referral_code}) - {referral.status}
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {section === "communication" ? (
        <section className="space-y-6">
          {/* Channel health strip */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className={`flex items-center gap-4 rounded-2xl border p-4 ${getNotificationStateTone(communicationHealth.sms?.ready ? "healthy" : communicationHealth.sms?.configured ? "attention" : "blocked")}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--admin-icon-inactive)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" strokeWidth="2" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Twilio SMS</p>
                  <span className="rounded-full border border-admin px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-admin-muted">
                    {communicationHealth.sms?.ready ? "Ready" : "Setup needed"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-admin-muted truncate">
                  {communicationHealth.sms?.fromNumber || communicationHealth.sms?.messagingServiceSid || "Not configured"} · {smsNotificationEvents.length} events
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-4 rounded-2xl border p-4 ${getNotificationStateTone(communicationHealth.email?.ready ? "healthy" : communicationHealth.email?.configured ? "attention" : "blocked")}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--admin-icon-inactive)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" strokeWidth="2" /><path d="m22 6-10 7L2 6" strokeWidth="2" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Resend Email</p>
                  <span className="rounded-full border border-admin px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-admin-muted">
                    {communicationHealth.email?.ready ? "Ready" : "Setup needed"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-admin-muted truncate">
                  {communicationHealth.email?.fromEmail || "Not configured"} · {emailNotificationEvents.length} events
                </p>
              </div>
            </div>
          </div>

          {/* Auto-reminders info strip + template editor */}
          <div className="rounded-2xl border border-admin bg-admin-panel">
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden><path d="M12 8v4l3 3" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="12" r="9" strokeWidth="2" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Automatic pickup reminders</p>
                <p className="text-xs text-admin-muted">72-hour and 24-hour email + SMS reminders are sent automatically via cron. Partner zones get co-branded emails.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-admin px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-admin-muted">Queued: {queuedNotificationEvents.length}</span>
                <span className="rounded-full border border-admin px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-admin-muted">Failed: {failedNotificationEvents.length}</span>
                <button
                  type="button"
                  onClick={() => setReminderTemplatesOpen((prev) => !prev)}
                  className="cursor-pointer rounded-lg border border-admin-strong px-3 py-1 text-xs font-semibold text-admin-muted transition-colors hover:bg-admin-surface-strong"
                >
                  {reminderTemplatesOpen ? "Close Editor" : "Edit Templates"}
                </button>
              </div>
            </div>

            {/* Template editor (expandable) */}
            {reminderTemplatesOpen ? (
              <div className="border-t border-admin px-4 pb-4 pt-4">
                {reminderTemplatesLoading ? (
                  <p className="text-sm text-admin-soft">Loading templates...</p>
                ) : reminderTemplates ? (
                  <div className="space-y-6">
                    <p className="text-xs text-admin-muted">
                      Use <code className="rounded bg-admin-surface-strong px-1 py-0.5 text-[11px] font-mono">{"{{pickup_date}}"}</code> as a placeholder for the pickup date. Changes apply to the next cron cycle.
                    </p>

                    {/* SMS templates */}
                    <div>
                      <h4 className="text-sm font-semibold">SMS Templates</h4>
                      <div className="mt-3 grid gap-4 lg:grid-cols-3">
                        {(
                          [
                            { key: "sms_72h", enabledKey: "enabled_sms_72h", label: "72 hours before" },
                            { key: "sms_24h", enabledKey: "enabled_sms_24h", label: "24 hours before" },
                            { key: "sms_day_of", enabledKey: "enabled_sms_day_of", label: "Day of pickup" },
                          ] as const
                        ).map((item) => {
                          const isEnabled = reminderTemplates[item.enabledKey] !== false && reminderTemplates[item.enabledKey] !== "false";
                          return (
                            <div key={item.key} className={`rounded-xl border p-3 transition-opacity ${isEnabled ? "border-admin bg-admin-surface" : "border-admin bg-admin-panel opacity-50"}`}>
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-admin-soft">{item.label}</label>
                                <button
                                  type="button"
                                  onClick={() => setReminderTemplates((prev) => prev ? { ...prev, [item.enabledKey]: !isEnabled } : prev)}
                                  className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors ${isEnabled ? "bg-emerald-500" : "bg-gray-500"}`}
                                  role="switch"
                                  aria-checked={isEnabled}
                                  aria-label={`${isEnabled ? "Disable" : "Enable"} ${item.label} SMS`}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                                </button>
                              </div>
                              <textarea
                                value={String(reminderTemplates[item.key] ?? "")}
                                onChange={(e) => setReminderTemplates((prev) => prev ? { ...prev, [item.key]: e.target.value } : prev)}
                                rows={4}
                                maxLength={600}
                                disabled={!isEnabled}
                                className="mt-2 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                              />
                              <p className="mt-0.5 text-[10px] text-admin-soft">{String(reminderTemplates[item.key] ?? "").length}/600</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Email templates */}
                    <div>
                      <h4 className="text-sm font-semibold">Email Templates</h4>
                      <div className="mt-3 space-y-4">
                        {(
                          [
                            { cadence: "72h", enabledKey: "enabled_email_72h", label: "72 hours before" },
                            { cadence: "24h", enabledKey: "enabled_email_24h", label: "24 hours before" },
                            { cadence: "day_of", enabledKey: "enabled_email_day_of", label: "Day of pickup" },
                          ] as const
                        ).map((item) => {
                          const isEnabled = reminderTemplates[item.enabledKey] !== false && reminderTemplates[item.enabledKey] !== "false";
                          return (
                            <div key={item.cadence} className={`rounded-xl border p-4 transition-opacity ${isEnabled ? "border-admin bg-admin-surface" : "border-admin bg-admin-panel opacity-50"}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-admin-soft">{item.label}</p>
                                <button
                                  type="button"
                                  onClick={() => setReminderTemplates((prev) => prev ? { ...prev, [item.enabledKey]: !isEnabled } : prev)}
                                  className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors ${isEnabled ? "bg-emerald-500" : "bg-gray-500"}`}
                                  role="switch"
                                  aria-checked={isEnabled}
                                  aria-label={`${isEnabled ? "Disable" : "Enable"} ${item.label} email`}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                                </button>
                              </div>
                              <div className={`mt-2 grid gap-3 lg:grid-cols-3 ${!isEnabled ? "pointer-events-none opacity-40" : ""}`}>
                                <div>
                                  <label className="text-[10px] font-semibold uppercase tracking-wide text-admin-soft">Subject line</label>
                                  <input
                                    value={String(reminderTemplates[`email_subject_${item.cadence}`] ?? "")}
                                    onChange={(e) => setReminderTemplates((prev) => prev ? { ...prev, [`email_subject_${item.cadence}`]: e.target.value } : prev)}
                                    maxLength={200}
                                    disabled={!isEnabled}
                                    className="mt-1 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-xs disabled:cursor-not-allowed"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold uppercase tracking-wide text-admin-soft">Intro line</label>
                                  <input
                                    value={String(reminderTemplates[`email_intro_${item.cadence}`] ?? "")}
                                    onChange={(e) => setReminderTemplates((prev) => prev ? { ...prev, [`email_intro_${item.cadence}`]: e.target.value } : prev)}
                                    maxLength={300}
                                    disabled={!isEnabled}
                                    className="mt-1 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-xs disabled:cursor-not-allowed"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold uppercase tracking-wide text-admin-soft">Body paragraph</label>
                                  <textarea
                                    value={String(reminderTemplates[`email_body_${item.cadence}`] ?? "")}
                                    onChange={(e) => setReminderTemplates((prev) => prev ? { ...prev, [`email_body_${item.cadence}`]: e.target.value } : prev)}
                                    rows={2}
                                    maxLength={500}
                                    disabled={!isEnabled}
                                  className="mt-1 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 py-2 text-xs disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={saveReminderTemplates}
                        disabled={reminderTemplatesSaving}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--dc-orange)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,106,0,0.25)] transition-all hover:shadow-[0_6px_20px_rgba(255,106,0,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {reminderTemplatesSaving ? <><Spinner size="sm" color="white" /> Saving...</> : "Save Templates"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReminderTemplates(null); setReminderTemplatesOpen(false); }}
                        className="cursor-pointer rounded-xl border border-admin-strong px-5 py-2 text-sm font-semibold text-admin-muted transition-colors hover:bg-admin-surface-strong"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-admin-soft">Could not load templates.</p>
                )}
              </div>
            ) : null}
          </div>

          {/* Subtab switcher */}
          <div className="flex gap-1 rounded-xl border border-admin bg-admin-panel p-1">
            {(
              [
                { id: "scheduled" as const, label: "Schedule Reminder" },
                { id: "send-now" as const, label: "Send Now" },
                { id: "history" as const, label: "Event Log" },
                { id: "test-email" as const, label: "Send Test Emails" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCommSubtab(tab.id)}
                className={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                  commSubtab === tab.id
                    ? "bg-[var(--dc-orange)] text-white shadow-[0_2px_8px_rgba(255,106,0,0.25)]"
                    : "text-admin-muted hover:bg-admin-surface-strong"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── SCHEDULE REMINDER ── */}
          {commSubtab === "scheduled" ? (
            <article className="rounded-3xl border border-admin bg-admin-surface p-6">
              <h3 className="text-xl font-bold">Schedule a Text Reminder</h3>
              <p className="mt-1 text-sm text-admin-muted">
                Write your message, choose an audience, and pick when it goes out. The system sends it automatically at the scheduled time.
              </p>
              {smsConfigError ? (
                <div className="mt-4 rounded-xl border admin-badge-amber px-4 py-3 text-sm text-admin-muted">
                  SMS is not ready: {smsConfigError}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                {/* Message */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-admin-soft">Message</label>
                  <textarea
                    value={scheduleReminderForm.message}
                    onChange={(e) => setScheduleReminderForm((prev) => ({ ...prev, message: e.target.value }))}
                    rows={4}
                    maxLength={600}
                    placeholder="e.g. Reminder: your DonateCrate pickup is this Saturday. Have your bag ready by 9am!"
                    className="mt-1.5 w-full rounded-xl border border-admin-strong bg-admin-surface-strong px-4 py-3 text-sm"
                  />
                  <p className="mt-1 text-xs text-admin-soft">{scheduleReminderForm.message.length}/600</p>
                </div>

                {/* Audience + time row */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-admin-soft">Audience</label>
                    <select
                      value={scheduleReminderForm.targetType}
                      onChange={(e) => setScheduleReminderForm((prev) => ({ ...prev, targetType: e.target.value as "zone" | "all" }))}
                      className="dc-input-admin mt-1.5 w-full"
                    >
                      <option value="all">All active subscribers</option>
                      <option value="zone">Single zone</option>
                    </select>
                  </div>
                  {scheduleReminderForm.targetType === "zone" ? (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-admin-soft">Zone</label>
                      <select
                        value={scheduleReminderForm.zoneId}
                        onChange={(e) => setScheduleReminderForm((prev) => ({ ...prev, zoneId: e.target.value }))}
                        className="dc-input-admin mt-1.5 w-full"
                      >
                        <option value="">Select zone</option>
                        {data.zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>{zone.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-admin-soft">Send at</label>
                    <input
                      type="datetime-local"
                      value={scheduleReminderForm.scheduledFor}
                      onChange={(e) => setScheduleReminderForm((prev) => ({ ...prev, scheduledFor: e.target.value }))}
                      className="dc-input-admin mt-1.5 w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {scheduleReminderForm.targetType === "all" ? (
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-admin-muted">
                      <input
                        type="checkbox"
                        checked={scheduleReminderForm.includeStaff}
                        onChange={(e) => setScheduleReminderForm((prev) => ({ ...prev, includeStaff: e.target.checked }))}
                      />
                      Also include admin and driver accounts
                    </label>
                  ) : null}
                  <button
                    type="button"
                    onClick={createScheduledReminder}
                    disabled={scheduleSaving || !!smsConfigError}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--dc-orange)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,106,0,0.25)] transition-all hover:shadow-[0_6px_20px_rgba(255,106,0,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {scheduleSaving ? <><Spinner size="sm" color="white" /> Scheduling...</> : "Schedule Reminder"}
                  </button>
                </div>

                {/* ── Live previews ── */}
                {scheduleReminderForm.message.trim().length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* SMS preview */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-soft">SMS Preview</p>
                      <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                        <div className="mx-auto max-w-[280px]">
                          {/* Phone frame */}
                          <div className="rounded-2xl border border-admin-strong bg-[#1a1a2e] p-3" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                            <div className="mb-2 flex items-center justify-center gap-1.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              <p className="text-[10px] font-semibold text-gray-400">DonateCrate</p>
                            </div>
                            <div className="rounded-xl bg-[#2a2a40] px-3 py-2.5">
                              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-200">
                                {scheduleReminderForm.message}
                              </p>
                            </div>
                            <p className="mt-1.5 text-right text-[10px] text-gray-500">
                              {scheduleReminderForm.scheduledFor
                                ? new Date(scheduleReminderForm.scheduledFor).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                                : "Not scheduled yet"}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-center text-[10px] text-admin-soft">
                          {scheduleReminderForm.message.length} characters · {Math.ceil(scheduleReminderForm.message.length / 160)} SMS segment{Math.ceil(scheduleReminderForm.message.length / 160) !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    {/* Email preview */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-soft">Auto Email Preview (72h reminder)</p>
                      <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                        <div className="overflow-hidden rounded-xl border border-admin-strong bg-[#f3efe8]">
                          {/* Email header */}
                          <div className="border-b border-gray-200 bg-gradient-to-b from-[#fffaf5] to-white px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="rounded-lg bg-[#182033] px-2.5 py-1.5">
                                  <p className="text-[10px] font-bold text-white">DonateCrate</p>
                                </div>
                              </div>
                              <span className="rounded-full bg-[#fff1e6] px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#b14b00]">Pickup Reminder</span>
                            </div>
                            <p className="mt-2 text-sm font-bold text-[#121926]">Your DonateCrate pickup is coming up</p>
                            <p className="mt-1 text-[11px] text-[#4f5a68]">Your next monthly pickup is getting close.</p>
                          </div>
                          {/* Email body */}
                          <div className="px-4 py-3">
                            <div className="mb-2 rounded-lg bg-[#fff7f1] border border-[#f3ded0] px-3 py-2">
                              <p className="text-[8px] font-bold uppercase tracking-widest text-[#9a7657]">Scheduled Pickup</p>
                              <p className="text-[11px] font-bold text-[#181f30]">
                                {scheduleReminderForm.scheduledFor
                                  ? new Date(scheduleReminderForm.scheduledFor).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                                  : "Date TBD"}
                              </p>
                            </div>
                            <p className="text-[11px] leading-relaxed text-[#4a5565]">
                              Hi there, we are scheduled to stop by soon. Keep your orange bag ready and place it out before route time.
                            </p>
                            <div className="mt-2">
                              <span className="inline-block rounded-full bg-[#ff6a00] px-3 py-1 text-[10px] font-bold text-white">Open my account</span>
                            </div>
                            <p className="mt-2 text-[9px] text-[#677381]">You are receiving this because reminder email is enabled on your DonateCrate account.</p>
                          </div>
                        </div>
                        <p className="mt-3 text-center text-[10px] text-admin-soft">
                          Emails send automatically 72h + 24h before each pickup cycle
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Upcoming / recent scheduled reminders */}
              <div className="mt-8">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-admin-soft">Scheduled Reminders</h4>
                {scheduledRemindersLoading ? (
                  <p className="mt-3 text-sm text-admin-soft">Loading...</p>
                ) : scheduledReminders.length === 0 ? (
                  <p className="mt-3 text-sm text-admin-soft">No scheduled reminders yet. Create one above.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {scheduledReminders.map((reminder) => {
                      const meta = reminder.metadata as Record<string, unknown>;
                      const scheduledAt = typeof meta.scheduled_for === "string" ? new Date(meta.scheduled_for) : null;
                      const msg = typeof meta.message === "string" ? meta.message : "";
                      const target = typeof meta.targetType === "string" ? meta.targetType : "all";
                      const isPending = reminder.status === "scheduled";
                      const isSent = reminder.status === "sent";
                      const isCanceled = reminder.status === "canceled";
                      const sentCount = typeof meta.sent_count === "number" ? meta.sent_count : null;
                      const failedCount = typeof meta.failed_count === "number" ? meta.failed_count : null;

                      return (
                        <div
                          key={reminder.id}
                          className={`flex items-start gap-4 rounded-xl border p-4 ${
                            isPending
                              ? "border-[var(--dc-orange)]/30 bg-[var(--dc-orange)]/5"
                              : isCanceled
                                ? "border-admin bg-admin-panel opacity-50"
                                : "border-admin bg-admin-panel"
                          }`}
                        >
                          {/* Status indicator */}
                          <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                            isPending ? "bg-[var(--dc-orange)] animate-pulse" : isSent ? "bg-emerald-400" : "bg-gray-400"
                          }`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug">{msg.length > 120 ? `${msg.slice(0, 120)}...` : msg}</p>
                            <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-admin-muted">
                              {scheduledAt ? (
                                <span>{isPending ? "Sends" : "Sent"} {scheduledAt.toLocaleString()}</span>
                              ) : null}
                              <span>· {target === "zone" ? "Zone" : "All subscribers"}</span>
                              {isSent && sentCount !== null ? (
                                <span>· {sentCount} sent{failedCount ? `, ${failedCount} failed` : ""}</span>
                              ) : null}
                              {isCanceled ? <span className="font-semibold text-admin-soft">Canceled</span> : null}
                            </div>
                          </div>
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => cancelScheduledReminder(reminder.id)}
                              className="cursor-pointer shrink-0 rounded-lg border border-admin-strong px-3 py-1.5 text-xs font-semibold text-admin-muted transition-colors hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          ) : null}

          {/* ── SEND NOW ── */}
          {commSubtab === "send-now" ? (
            <article className="rounded-3xl border border-admin bg-admin-surface p-6">
              <h3 className="text-xl font-bold">Send SMS Now</h3>
              <p className="mt-1 text-sm text-admin-muted">
                Instantly send a text to individual users, a zone, or all subscribers.
              </p>
              {smsConfigError ? (
                <div className="mt-4 rounded-xl border admin-badge-amber px-4 py-3 text-sm text-admin-muted">
                  SMS is not ready: {smsConfigError}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-admin-soft">Audience</label>
                    <select
                      value={smsTarget}
                      onChange={(e) => setSmsTarget(e.target.value as "individual" | "zone" | "all")}
                      className="dc-input-admin mt-1.5 w-full"
                    >
                      <option value="individual">Individual users</option>
                      <option value="zone">Single zone</option>
                      <option value="all">All subscribers</option>
                    </select>
                  </div>
                  {smsTarget === "zone" ? (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-admin-soft">Zone</label>
                      <select
                        value={smsZoneId}
                        onChange={(e) => setSmsZoneId(e.target.value)}
                        className="dc-input-admin mt-1.5 w-full"
                      >
                        <option value="">Select zone</option>
                        {data.zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>{zone.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {smsTarget === "all" ? (
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-admin-muted md:mt-6">
                      <input type="checkbox" checked={smsIncludeStaff} onChange={(e) => setSmsIncludeStaff(e.target.checked)} />
                      Include admin + drivers
                    </label>
                  ) : null}
                  <div className="flex items-end">
                    <div className="rounded-lg border border-admin bg-admin-panel px-3 py-2 text-xs text-admin-muted">
                      {smsRecipientEstimate} eligible recipients
                    </div>
                  </div>
                </div>

                {smsTarget === "individual" ? (
                  <div className="space-y-2">
                    <input
                      value={smsSearch}
                      onChange={(e) => setSmsSearch(e.target.value)}
                      placeholder="Search by name, email, or phone"
                      className="h-10 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm"
                    />
                    <div className="max-h-48 overflow-auto rounded-xl border border-admin bg-admin-panel p-2">
                      {smsUsersWithPhones.slice(0, 80).map((user) => (
                        <label key={user.id} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-admin-surface-strong">
                          <span className="pr-2 truncate">
                            {user.full_name || user.email}
                            <span className="ml-2 text-xs text-admin-muted">{user.phone}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={smsUserIds.includes(user.id)}
                            onChange={(e) => setSmsUserIds((prev) => e.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id))}
                          />
                        </label>
                      ))}
                      {smsUsersWithPhones.length === 0 ? <p className="px-2 py-3 text-sm text-admin-soft">No matches.</p> : null}
                    </div>
                  </div>
                ) : null}

                {smsTarget === "zone" && smsZoneId ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-admin-soft">Recipients</p>
                    <div className="mt-1.5 max-h-40 overflow-auto rounded-xl border border-admin bg-admin-panel p-2">
                      {smsZonePreviewLoading ? (
                        <p className="px-2 py-3 text-sm text-admin-soft">Loading...</p>
                      ) : smsZoneEligibleUsers.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-admin-soft">No eligible users.</p>
                      ) : (
                        smsZoneEligibleUsers.map((user) => (
                          <div key={user.id} className="rounded-lg px-2 py-1.5 text-sm">
                            {user.fullName || user.email} <span className="text-xs text-admin-muted">{user.phone}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-admin-soft">Message</label>
                  <textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    rows={4}
                    maxLength={600}
                    placeholder="Write your message..."
                    className="mt-1.5 w-full rounded-xl border border-admin-strong bg-admin-surface-strong px-4 py-3 text-sm"
                  />
                  <p className="mt-1 text-xs text-admin-soft">{smsMessage.length}/600</p>
                </div>

                <button
                  type="button"
                  onClick={sendSmsCampaign}
                  disabled={smsSending || !!smsConfigError}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--dc-orange)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,106,0,0.25)] transition-all hover:shadow-[0_6px_20px_rgba(255,106,0,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {smsSending ? <><Spinner size="sm" color="white" /> Sending...</> : "Send Now"}
                </button>
              </div>
            </article>
          ) : null}

          {/* ── EVENT LOG ── */}
          {commSubtab === "history" ? (
            <article className="rounded-3xl border border-admin bg-admin-surface p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold">Event Log</h3>
                  <p className="mt-1 text-sm text-admin-muted">Recent notification events across all channels.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={processQueuedNotifications}
                    disabled={notificationActionLoading}
                    className="cursor-pointer rounded-lg border border-admin-strong px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-admin-surface-strong disabled:opacity-50"
                  >
                    Process Queue
                  </button>
                  <button
                    type="button"
                    onClick={retrySelectedNotifications}
                    disabled={notificationActionLoading || notificationSelection.length === 0}
                    className="cursor-pointer rounded-lg border border-admin-strong px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-admin-surface-strong disabled:opacity-50"
                  >
                    Retry Selected ({notificationSelection.length})
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-admin bg-admin-panel p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-admin-soft">Queued</p>
                  <p className="mt-1 text-xl font-bold">{queuedNotificationEvents.length}</p>
                </div>
                <div className="rounded-2xl border border-admin bg-admin-panel p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-admin-soft">Retryable</p>
                  <p className="mt-1 text-xl font-bold">{failedNotificationEvents.filter((e) => getNotificationRetryState(e).canRetry).length}</p>
                </div>
                <div className="rounded-2xl border border-admin bg-admin-panel p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-admin-soft">Blocked</p>
                  <p className="mt-1 text-xl font-bold">{blockedNotificationEvents.length}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {notificationEvents.slice(0, 40).map((event) => (
                  <label key={event.id} className="flex cursor-pointer gap-3 rounded-xl border border-admin bg-admin-panel p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={notificationSelection.includes(event.id)}
                      disabled={!getNotificationRetryState(event).canRetry || event.status === "sent" || event.status === "delivered"}
                      onChange={(e) => {
                        setNotificationSelection((prev) =>
                          e.target.checked ? [...prev, event.id] : prev.filter((id) => id !== event.id),
                        );
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {formatNotificationEventType(event.event_type)} · {formatNotificationChannel(event.channel)} · {formatNotificationStatus(event.status)}
                        </p>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getNotificationStateTone(getNotificationRetryState(event).severity)}`}>
                          {getNotificationRetryState(event).label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-admin-muted">
                        Attempts: {event.attempt_count ?? 0} · {event.last_attempt_at ? new Date(event.last_attempt_at).toLocaleString() : "Not attempted"} · {new Date(event.created_at).toLocaleString()}
                      </p>
                      {event.last_error ? <p className="mt-1 text-xs text-amber-600">{event.last_error}</p> : null}
                    </div>
                  </label>
                ))}
                {notificationEvents.length === 0 ? (
                  <p className="text-sm text-admin-soft">No notification events logged yet.</p>
                ) : null}
              </div>
            </article>
          ) : null}

          {/* ── TEST EMAILS ── */}
          {commSubtab === "test-email" ? (
            <article className="rounded-3xl border border-admin bg-admin-surface p-6">
              <h3 className="text-xl font-bold">Send Test Emails</h3>
              <p className="mt-1 text-sm text-admin-muted">
                Send one of every transactional email to a recipient address to preview how they look in an inbox.
              </p>
              <div className="mt-5 space-y-4">
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="jake@example.com"
                    className="h-10 flex-1 rounded-xl border border-admin-strong bg-admin-surface-strong px-4 text-sm"
                  />
                  <button
                    type="button"
                    disabled={testEmailSending || !testEmailAddress.includes("@")}
                    onClick={async () => {
                      setTestEmailSending(true);
                      setTestEmailResult(null);
                      try {
                        const res = await fetch("/api/admin/communications/email-samples", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: testEmailAddress, fullName: "Test Recipient" }),
                        });
                        const json = await res.json().catch(() => ({}));
                        setTestEmailResult(json);
                      } catch {
                        setTestEmailResult(null);
                      } finally {
                        setTestEmailSending(false);
                      }
                    }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--dc-orange)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,106,0,0.25)] transition-all hover:shadow-[0_6px_20px_rgba(255,106,0,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testEmailSending ? <><Spinner size="sm" color="white" /> Sending...</> : "Send All Samples"}
                  </button>
                </div>
                <p className="text-xs text-admin-soft">
                  Sends 11 emails: welcome (active zone), welcome (waitlisted), magic link, password reset, plan active, payment failed, subscription canceled, pickup reminder 72h/24h/day-of, and missed pickup.
                </p>
                {testEmailResult ? (
                  <div className="rounded-2xl border border-admin bg-admin-panel p-4">
                    <p className="text-sm font-semibold">
                      {testEmailResult.sent} sent · {testEmailResult.failed} failed
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {testEmailResult.results?.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${r.status === "sent" ? "bg-emerald-400" : "bg-red-400"}`} />
                          <span className="font-mono text-admin-soft">{r.eventType}</span>
                          {r.error ? <span className="text-red-400">{r.error}</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {message ? <p className="rounded-lg border border-admin bg-admin-surface px-4 py-3 text-sm text-admin-muted">{message}</p> : null}
    </div>
  );
}
