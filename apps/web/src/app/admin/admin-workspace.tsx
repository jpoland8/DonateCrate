"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type WorkspaceSection = "overview" | "pickups" | "logistics" | "people" | "zones" | "growth";

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
  pickupRequests: Array<{ id: string; status: string; users: { email: string }; pickup_cycles: { pickup_date: string } }>;
  routes: Array<{ id: string; status: string; driver_id: string | null }>;
  drivers: Array<{ id: string; employee_id: string; users: { email: string } }>;
  pickupCycles: Array<{
    id: string;
    zone_id: string;
    cycle_month: string;
    pickup_date: string;
    request_cutoff_at: string;
    service_zones?: { code: string; name: string } | Array<{ code: string; name: string }> | null;
  }>;
  subscriptions: Array<{ id: string; status: string; users: { email: string } }>;
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

export function AdminWorkspace({ section = "overview" }: { section?: WorkspaceSection }) {
  const singleCycleMonthRef = useRef<HTMLInputElement | null>(null);
  const singlePickupDateRef = useRef<HTMLInputElement | null>(null);
  const recurringStartPickupDateRef = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [message, setMessage] = useState("");

  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedZoneCode, setSelectedZoneCode] = useState("knoxville-37922");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedLogisticsRouteId, setSelectedLogisticsRouteId] = useState("");
  const [logisticsRoutePreview, setLogisticsRoutePreview] = useState<{
    route?: { id: string; status: string };
    stops?: Array<{
      id: string;
      stopOrder: number;
      stopStatus: string;
      requestStatus: string | null;
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

  const loadAll = useCallback(async () => {
    const [usersRes, waitlistRes, requestsRes, routesRes, driversRes, cyclesRes, subsRes, refsRes, zonesRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/waitlist"),
      fetch("/api/admin/pickup-requests"),
      fetch("/api/admin/routes"),
      fetch("/api/admin/drivers"),
      fetch("/api/admin/pickup-cycles"),
      fetch("/api/admin/subscriptions"),
      fetch("/api/admin/referrals"),
      fetch("/api/admin/zones"),
    ]);

    const [users, waitlist, pickupRequests, routes, drivers, pickupCycles, subscriptions, referrals, zones] = await Promise.all([
      usersRes.json(),
      waitlistRes.json(),
      requestsRes.json(),
      routesRes.json(),
      driversRes.json(),
      cyclesRes.json(),
      subsRes.json(),
      refsRes.json(),
      zonesRes.json(),
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
      drivers: drivers.drivers ?? [],
      pickupCycles: pickupCycles.pickupCycles ?? [],
      subscriptions: subscriptions.subscriptions ?? [],
      referrals: referrals.referrals ?? [],
      zones: zoneRows,
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  const selectedZone = useMemo(() => data?.zones.find((zone) => zone.id === selectedZoneId) ?? null, [data, selectedZoneId]);
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

  const driverOptions = useMemo(() => data?.drivers ?? [], [data]);
  const routeOptions = useMemo(() => data?.routes ?? [], [data]);

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

  async function updateSubscriptionStatus(subscriptionId: string, status: string) {
    const response = await fetch("/api/admin/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId, status }),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Could not update subscription");
    setMessage("Subscription updated.");
    await loadAll();
  }

  async function generateRoute() {
    if (!selectedCycleId) return setMessage("Select a pickup cycle first.");
    const response = await fetch("/api/admin/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickupCycleId: selectedCycleId, zoneCode: selectedZoneCode }),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Could not generate route");
    setMessage(
      `Route generated with ${json.stopCount} stops${json.optimized ? " (Google optimized)" : ""}${
        json.missingCoordinates ? `, ${json.missingCoordinates} without coordinates` : ""
      }.`,
    );
    await loadAll();
  }

  async function loadLogisticsRoutePreview(routeId: string) {
    if (!routeId) return setLogisticsRoutePreview(null);
    const response = await fetch(`/api/admin/routes/preview?routeId=${routeId}`);
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error || "Could not load route preview");
      return;
    }
    setLogisticsRoutePreview(json);
  }

  async function assignDriver() {
    if (!selectedRouteId || !selectedDriverId) return setMessage("Select route and driver.");
    const response = await fetch("/api/admin/routes/assign-driver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeId: selectedRouteId, driverId: selectedDriverId }),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Could not assign driver");
    setMessage("Driver assigned.");
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
            <p className="text-sm font-semibold">Subscription Health</p>
            <div className="mt-3 space-y-2">
              {data.subscriptions.slice(0, 40).map((sub) => (
                <div key={sub.id} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm break-all">{sub.users?.email}</p>
                  <select
                    value={sub.status}
                    onChange={(event) => updateSubscriptionStatus(sub.id, event.target.value)}
                    className="h-9 w-full rounded-lg border border-white/30 bg-black px-3 text-xs sm:w-auto"
                  >
                    <option value="trialing">trialing</option>
                    <option value="active">active</option>
                    <option value="past_due">past_due</option>
                    <option value="paused">paused</option>
                    <option value="canceled">canceled</option>
                  </select>
                </div>
              ))}
            </div>
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
                  <p className="text-sm break-all">{item.users?.email} ({item.pickup_cycles?.pickup_date})</p>
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
            <h3 className="text-xl font-bold">Route Generation & Dispatch</h3>
            <p className="mt-1 text-sm text-white/70">
              Routes are generated from active pickup requests and subscriber addresses in the selected zone.
              Google route optimization is used when coordinates are available.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <select value={selectedZoneCode} onChange={(event) => setSelectedZoneCode(event.target.value)} className="h-10 w-full rounded-lg border border-white/30 bg-black px-3 text-sm sm:w-auto">
                <option value="">Select pickup area</option>
                {data.zones.map((zone) => (
                  <option key={zone.id} value={zone.code}>{zone.name} ({zone.code})</option>
                ))}
              </select>
              <select value={selectedCycleId} onChange={(event) => setSelectedCycleId(event.target.value)} className="h-10 w-full rounded-lg border border-white/30 bg-black px-3 text-sm sm:w-auto">
                <option value="">Select cycle</option>
                {data.pickupCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>{cycle.pickup_date}</option>
                ))}
              </select>
              <button onClick={generateRoute} className="w-full rounded-lg bg-[var(--dc-orange)] px-3 py-2 text-sm font-semibold sm:w-auto">Generate Optimized Route</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                value={selectedRouteId}
                onChange={(event) => {
                  const next = event.target.value;
                  setSelectedRouteId(next);
                  setSelectedLogisticsRouteId(next);
                  loadLogisticsRoutePreview(next);
                }}
                className="h-10 w-full rounded-lg border border-white/30 bg-black px-3 text-sm sm:w-auto"
              >
                <option value="">Select route</option>
                {routeOptions.map((route) => (
                  <option key={route.id} value={route.id}>{route.id.slice(0, 8)} ({route.status})</option>
                ))}
              </select>
              <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} className="h-10 w-full rounded-lg border border-white/30 bg-black px-3 text-sm sm:w-auto">
                <option value="">Select driver</option>
                {driverOptions.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.employee_id} ({driver.users?.email})</option>
                ))}
              </select>
              <button onClick={assignDriver} className="w-full rounded-lg bg-[var(--dc-orange)] px-3 py-2 text-sm font-semibold sm:w-auto">Assign Driver</button>
            </div>
          </article>

          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-bold">Pickup Map & Route Pins</h4>
              {selectedLogisticsRouteId ? (
                <a
                  href={`/api/admin/logistics/static-map?routeId=${selectedLogisticsRouteId}`}
                  target="_blank"
                  className="rounded border border-white/25 px-3 py-1 text-xs"
                  rel="noreferrer"
                >
                  Open full map
                </a>
              ) : null}
            </div>
            {selectedLogisticsRouteId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/admin/logistics/static-map?routeId=${selectedLogisticsRouteId}`}
                alt="Pickup route map"
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/40"
              />
            ) : (
              <p className="mt-2 text-sm text-white/65">Select a route above to render pickup pins on the map.</p>
            )}

            <div className="mt-4 space-y-2">
              {(logisticsRoutePreview?.stops ?? []).map((stop) => (
                <div key={stop.id} className="rounded-xl border border-white/10 bg-black/35 p-3 text-sm">
                  <p className="font-semibold">Stop {stop.stopOrder}: {stop.fullName || stop.email || "Unknown subscriber"}</p>
                  <p className="text-xs text-white/70">
                    {stop.address
                      ? `${stop.address.addressLine1}, ${stop.address.city}, ${stop.address.state} ${stop.address.postalCode}`
                      : "Address unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-white/70">Request: {stop.requestStatus ?? "unknown"} | Stop status: {stop.stopStatus}</p>
                </div>
              ))}
              {selectedLogisticsRouteId && (logisticsRoutePreview?.stops ?? []).length === 0 ? (
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

      {message ? <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">{message}</p> : null}
    </div>
  );
}
