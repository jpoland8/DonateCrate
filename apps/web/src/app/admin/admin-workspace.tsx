"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type WorkspaceSection = "overview" | "pickups" | "people" | "zones" | "growth";

type AdminData = {
  users: Array<{ id: string; email: string; role: "customer" | "admin" | "driver" }>;
  waitlist: Array<{ id: string; full_name: string; status: string; postal_code: string }>;
  pickupRequests: Array<{ id: string; status: string; users: { email: string }; pickup_cycles: { pickup_date: string } }>;
  routes: Array<{ id: string; status: string; driver_id: string | null }>;
  drivers: Array<{ id: string; employee_id: string; users: { email: string } }>;
  pickupCycles: Array<{ id: string; pickup_date: string }>;
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

export function AdminWorkspace({ section = "overview" }: { section?: WorkspaceSection }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [message, setMessage] = useState("");

  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedZoneCode, setSelectedZoneCode] = useState("knoxville-37922");

  const [zoneForm, setZoneForm] = useState({
    code: "",
    name: "",
    anchorPostalCode: "",
    radiusMiles: 3,
    minActiveSubscribers: 40,
    signupEnabled: false,
    launchTargetEnabled: true,
  });

  const [createCenterQuery, setCreateCenterQuery] = useState("");
  const [createCenterPredictions, setCreateCenterPredictions] = useState<
    Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>
  >([]);
  const [createCenterSelection, setCreateCenterSelection] = useState<{ placeId: string; formattedAddress: string } | null>(null);

  const [editCenterZoneId, setEditCenterZoneId] = useState("");
  const [editCenterQuery, setEditCenterQuery] = useState("");
  const [editCenterPredictions, setEditCenterPredictions] = useState<
    Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>
  >([]);
  const [editCenterSelection, setEditCenterSelection] = useState<{ placeId: string; formattedAddress: string } | null>(null);

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

    if (zones.error) setMessage(`Pickup areas could not be loaded: ${zones.error}`);

    const zoneRows = zones.zones ?? [];
    setSelectedZoneCode((prev) =>
      zoneRows.length > 0 && !zoneRows.some((zone: { code: string }) => zone.code === prev) ? zoneRows[0].code : prev,
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
    }, 250);
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
    }, 250);
    return () => clearTimeout(timer);
  }, [editCenterQuery]);

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
    setMessage(`Route generated with ${json.stopCount} stops.`);
    await loadAll();
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
      signupEnabled: false,
      launchTargetEnabled: true,
    });
    setCreateCenterQuery("");
    setCreateCenterPredictions([]);
    setCreateCenterSelection(null);
    await loadAll();
  }

  async function updateZoneCenterAddress() {
    if (!editCenterZoneId) return setMessage("Select a pickup area first.");
    if (!editCenterSelection?.placeId) return setMessage("Select a center address from suggestions.");
    await updateZone({ zoneId: editCenterZoneId, centerPlaceId: editCenterSelection.placeId });
    setEditCenterQuery("");
    setEditCenterPredictions([]);
    setEditCenterSelection(null);
  }

  if (!data) return <p className="text-sm text-white/70">Loading management data...</p>;

  return (
    <div className="space-y-6">
      {section === "overview" ? (
        <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
          <h3 className="text-2xl font-bold">Admin Areas</h3>
          <p className="mt-2 text-sm text-white/80">Use sidebar tabs to manage pickups, people, zones, and growth.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <a href="/admin?tab=zones" className="rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10">
              Step 1: Configure Pickup Areas
            </a>
            <a href="/admin?tab=pickups" className="rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10">
              Step 2: Create Monthly Cycles
            </a>
            <a href="/admin?tab=people" className="rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10">
              Step 3: Assign Drivers
            </a>
          </div>
        </section>
      ) : null}

      {section === "people" ? (
        <>
          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Users</h3>
            <div className="mt-3 space-y-2">
              {data.users.slice(0, 20).map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg bg-black/30 p-3">
                  <p className="text-sm">{user.email}</p>
                  <select
                    value={user.role}
                    onChange={(event) => updateUserRole(user.id, event.target.value as "customer" | "admin" | "driver")}
                    className="rounded border border-white/30 bg-black px-2 py-1 text-sm"
                  >
                    <option value="customer">customer</option>
                    <option value="driver">driver</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Subscriptions</h3>
            <div className="mt-3 space-y-2">
              {data.subscriptions.slice(0, 20).map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-lg bg-black/30 p-3">
                  <p className="text-sm">{sub.users?.email}</p>
                  <select
                    value={sub.status}
                    onChange={(event) => updateSubscriptionStatus(sub.id, event.target.value)}
                    className="rounded border border-white/30 bg-black px-2 py-1 text-sm"
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
        </>
      ) : null}

      {section === "pickups" ? (
        <>
          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Pickup Requests</h3>
            <div className="mt-3 space-y-2">
              {data.pickupRequests.slice(0, 14).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-black/30 p-3">
                  <p className="text-sm">{item.users?.email} ({item.pickup_cycles?.pickup_date})</p>
                  <select
                    value={item.status}
                    onChange={(event) => updatePickupStatus(item.id, event.target.value)}
                    className="rounded border border-white/30 bg-black px-2 py-1 text-sm"
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

          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Route Operations</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <select value={selectedZoneCode} onChange={(event) => setSelectedZoneCode(event.target.value)} className="h-10 rounded border border-white/30 bg-black px-3 text-sm">
                <option value="">Select pickup area</option>
                {data.zones.map((zone) => (
                  <option key={zone.id} value={zone.code}>{zone.name} ({zone.code})</option>
                ))}
              </select>
              <select value={selectedCycleId} onChange={(event) => setSelectedCycleId(event.target.value)} className="h-10 rounded border border-white/30 bg-black px-3 text-sm">
                <option value="">Select cycle</option>
                {data.pickupCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>{cycle.pickup_date}</option>
                ))}
              </select>
              <button onClick={generateRoute} className="rounded bg-[var(--dc-orange)] px-3 py-2 text-sm font-semibold">Generate Route</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <select value={selectedRouteId} onChange={(event) => setSelectedRouteId(event.target.value)} className="h-10 rounded border border-white/30 bg-black px-3 text-sm">
                <option value="">Select route</option>
                {routeOptions.map((route) => (
                  <option key={route.id} value={route.id}>{route.id.slice(0, 8)} ({route.status})</option>
                ))}
              </select>
              <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} className="h-10 rounded border border-white/30 bg-black px-3 text-sm">
                <option value="">Select driver</option>
                {driverOptions.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.employee_id} ({driver.users?.email})</option>
                ))}
              </select>
              <button onClick={assignDriver} className="rounded bg-[var(--dc-orange)] px-3 py-2 text-sm font-semibold">Assign Driver</button>
            </div>
          </section>
        </>
      ) : null}

      {section === "zones" ? (
        <>
          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Pickup Areas</h3>
            <p className="mt-2 text-sm text-white/75">
              Define where service runs and whether signups are open in each area.
            </p>
            <div className="mt-4 rounded-xl border border-white/20 bg-black/30 p-4">
              <p className="text-sm font-semibold">How to use this section</p>
              <p className="mt-2 text-xs text-white/70">
                1. Set `Service Radius` to define how far pickups are allowed from the center address.
                2. `Target Active Households` is your growth goal in this area.
                3. Use `Signup Open` to allow or pause new account creation in that area.
              </p>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/60">Current Pickup Areas</p>
            <div className="mt-4 space-y-3">
              {data.zones.length === 0 ? (
                <div className="rounded-lg border border-white/20 bg-black/30 p-4">
                  <p className="text-sm font-semibold">No pickup areas found yet.</p>
                  <p className="mt-1 text-xs text-white/70">Add your first area below and it will appear here.</p>
                </div>
              ) : null}
              {data.zones.map((zone) => (
                <form
                  key={zone.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    updateZone({
                      zoneId: zone.id,
                      radiusMiles: Number(form.get("radiusMiles")),
                      minActiveSubscribers: Number(form.get("minActiveSubscribers")),
                      status: String(form.get("status")) as "pending" | "launching" | "active" | "paused",
                      signupEnabled: form.get("signupEnabled") === "true",
                      launchTargetEnabled: form.get("launchTargetEnabled") === "true",
                    });
                  }}
                  className="rounded-lg bg-black/30 p-3"
                >
                  <p className="text-sm font-semibold">{zone.name} ({zone.code}) | ZIP {zone.anchor_postal_code}</p>
                  <p className="mt-1 text-xs text-white/70">Area center: {zone.center_address ?? "Not set yet"}</p>
                  <p className="mt-2 text-xs text-white/70">
                    Signup: <span className="font-semibold text-white">{zone.signup_enabled ? "Open" : "Paused"}</span> | Launch goal:{" "}
                    <span className="font-semibold text-white">{zone.launch_target_enabled ? "Enabled" : "Ignored"}</span>
                  </p>
                  <input type="hidden" name="signupEnabled" value={zone.signup_enabled ? "true" : "false"} />
                  <input type="hidden" name="launchTargetEnabled" value={zone.launch_target_enabled ? "true" : "false"} />
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <label className="text-[11px] text-white/70">
                      Service Radius (miles)
                      <input name="radiusMiles" type="number" min={0.5} step={0.5} defaultValue={zone.radius_miles} className="mt-1 h-9 w-full rounded border border-white/30 bg-black px-2 text-xs text-white" />
                      <div className="mt-1 flex gap-1">
                        <button type="button" onClick={(event) => {
                          const form = event.currentTarget.closest("form");
                          const input = form?.querySelector<HTMLInputElement>('input[name="radiusMiles"]');
                          if (input) input.value = "2";
                        }} className="rounded border border-white/30 px-2 py-0.5 text-[10px]">2mi</button>
                        <button type="button" onClick={(event) => {
                          const form = event.currentTarget.closest("form");
                          const input = form?.querySelector<HTMLInputElement>('input[name="radiusMiles"]');
                          if (input) input.value = "3";
                        }} className="rounded border border-white/30 px-2 py-0.5 text-[10px]">3mi</button>
                        <button type="button" onClick={(event) => {
                          const form = event.currentTarget.closest("form");
                          const input = form?.querySelector<HTMLInputElement>('input[name="radiusMiles"]');
                          if (input) input.value = "5";
                        }} className="rounded border border-white/30 px-2 py-0.5 text-[10px]">5mi</button>
                      </div>
                    </label>
                    <label className="text-[11px] text-white/70">
                      Target Active Households
                      <input
                        name="minActiveSubscribers"
                        type="number"
                        min={1}
                        defaultValue={zone.min_active_subscribers}
                        disabled={!zone.launch_target_enabled}
                        className="mt-1 h-9 w-full rounded border border-white/30 bg-black px-2 text-xs text-white disabled:opacity-50"
                      />
                      <p className="mt-1 text-[10px] text-white/60">This is the area growth goal before launch target is considered met.</p>
                      <div className="mt-1 flex gap-1">
                        <button type="button" onClick={(event) => {
                          const form = event.currentTarget.closest("form");
                          const input = form?.querySelector<HTMLInputElement>('input[name="minActiveSubscribers"]');
                          if (input) input.value = "25";
                        }} className="rounded border border-white/30 px-2 py-0.5 text-[10px]">25</button>
                        <button type="button" onClick={(event) => {
                          const form = event.currentTarget.closest("form");
                          const input = form?.querySelector<HTMLInputElement>('input[name="minActiveSubscribers"]');
                          if (input) input.value = "40";
                        }} className="rounded border border-white/30 px-2 py-0.5 text-[10px]">40</button>
                        <button type="button" onClick={(event) => {
                          const form = event.currentTarget.closest("form");
                          const input = form?.querySelector<HTMLInputElement>('input[name="minActiveSubscribers"]');
                          if (input) input.value = "60";
                        }} className="rounded border border-white/30 px-2 py-0.5 text-[10px]">60</button>
                      </div>
                    </label>
                    <label className="text-[11px] text-white/70">
                      Area Status
                      <select name="status" defaultValue={zone.status} className="mt-1 h-9 w-full rounded border border-white/30 bg-black px-2 text-xs">
                        <option value="pending">pending</option>
                        <option value="launching">launching</option>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="submit" className="rounded border border-white/30 px-3 py-1 text-xs font-semibold">Save Area Settings</button>
                    <button
                      type="button"
                      onClick={() => updateZone({ zoneId: zone.id, signupEnabled: true })}
                      disabled={zone.signup_enabled}
                      className="rounded border border-green-400/60 px-3 py-1 text-xs font-semibold text-green-300 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Open Signup
                    </button>
                    <button
                      type="button"
                      onClick={() => updateZone({ zoneId: zone.id, signupEnabled: false })}
                      disabled={!zone.signup_enabled}
                      className="rounded border border-yellow-400/60 px-3 py-1 text-xs font-semibold text-yellow-300 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Pause Signup
                    </button>
                    <button
                      type="button"
                      onClick={() => updateZone({ zoneId: zone.id, launchTargetEnabled: true })}
                      disabled={zone.launch_target_enabled}
                      className="rounded border border-blue-300/60 px-3 py-1 text-xs font-semibold text-blue-200 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Use Launch Target
                    </button>
                    <button
                      type="button"
                      onClick={() => updateZone({ zoneId: zone.id, launchTargetEnabled: false })}
                      disabled={!zone.launch_target_enabled}
                      className="rounded border border-white/30 px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Ignore Launch Target
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Update Area Center Address</h3>
            <p className="mt-2 text-sm text-white/75">Search and select an address to set the area center.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select value={editCenterZoneId} onChange={(event) => setEditCenterZoneId(event.target.value)} className="h-10 rounded border border-white/30 bg-black px-3 text-sm">
                <option value="">Select pickup area</option>
                {data.zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>{zone.name} ({zone.code})</option>
                ))}
              </select>
              <input
                value={editCenterQuery}
                onChange={(event) => {
                  setEditCenterQuery(event.target.value);
                  setEditCenterSelection(null);
                  if (event.target.value.trim().length < 3) setEditCenterPredictions([]);
                }}
                placeholder="Search area center address"
                className="h-10 rounded border border-white/30 bg-black px-3 text-sm"
              />
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
                    className="block w-full rounded px-2 py-2 text-left text-sm text-white hover:bg-white/10"
                  >
                    {prediction.mainText}
                    <p className="text-xs text-white/70">{prediction.secondaryText || prediction.description}</p>
                  </button>
                ))}
              </div>
            ) : null}
            {editCenterSelection ? <p className="mt-2 text-xs text-white/70">Selected: {editCenterSelection.formattedAddress}</p> : null}
            <button onClick={updateZoneCenterAddress} className="mt-3 rounded bg-[var(--dc-orange)] px-3 py-2 text-sm font-semibold">Save Center Address</button>
          </section>

          <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Add Pickup Area</h3>
            <p className="mt-2 text-sm text-white/75">Create a service area with simple business controls.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={zoneForm.name} onChange={(event) => setZoneForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Area name" className="h-10 rounded border border-white/30 bg-black px-3 text-sm" />
              <input value={zoneForm.code} onChange={(event) => setZoneForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="Area code" className="h-10 rounded border border-white/30 bg-black px-3 text-sm" />
              <input value={zoneForm.anchorPostalCode} onChange={(event) => setZoneForm((prev) => ({ ...prev, anchorPostalCode: event.target.value }))} placeholder="Anchor ZIP" className="h-10 rounded border border-white/30 bg-black px-3 text-sm" />
              <input type="number" min={0.5} step={0.5} value={zoneForm.radiusMiles} onChange={(event) => setZoneForm((prev) => ({ ...prev, radiusMiles: Number(event.target.value) }))} placeholder="Service radius (miles)" className="h-10 rounded border border-white/30 bg-black px-3 text-sm" />
              <input type="number" min={1} value={zoneForm.minActiveSubscribers} disabled={!zoneForm.launchTargetEnabled} onChange={(event) => setZoneForm((prev) => ({ ...prev, minActiveSubscribers: Number(event.target.value) }))} placeholder="Target active households" className="h-10 rounded border border-white/30 bg-black px-3 text-sm disabled:opacity-50" />
              <input
                value={createCenterQuery}
                onChange={(event) => {
                  setCreateCenterQuery(event.target.value);
                  setCreateCenterSelection(null);
                  if (event.target.value.trim().length < 3) setCreateCenterPredictions([]);
                }}
                placeholder="Area center address"
                className="h-10 rounded border border-white/30 bg-black px-3 text-sm"
              />
              <label className="flex h-10 items-center gap-2 rounded border border-white/30 px-3 text-sm">
                <input type="checkbox" checked={zoneForm.signupEnabled} onChange={(event) => setZoneForm((prev) => ({ ...prev, signupEnabled: event.target.checked }))} />
                Signup Open
              </label>
              <label className="flex h-10 items-center gap-2 rounded border border-white/30 px-3 text-sm">
                <input type="checkbox" checked={zoneForm.launchTargetEnabled} onChange={(event) => setZoneForm((prev) => ({ ...prev, launchTargetEnabled: event.target.checked }))} />
                Use Launch Target
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setZoneForm((prev) => ({ ...prev, radiusMiles: 2 }))} className="rounded border border-white/30 px-2 py-1 text-xs">Radius 2mi</button>
              <button type="button" onClick={() => setZoneForm((prev) => ({ ...prev, radiusMiles: 3 }))} className="rounded border border-white/30 px-2 py-1 text-xs">Radius 3mi</button>
              <button type="button" onClick={() => setZoneForm((prev) => ({ ...prev, radiusMiles: 5 }))} className="rounded border border-white/30 px-2 py-1 text-xs">Radius 5mi</button>
              <button type="button" onClick={() => setZoneForm((prev) => ({ ...prev, minActiveSubscribers: 25 }))} className="rounded border border-white/30 px-2 py-1 text-xs">Target 25</button>
              <button type="button" onClick={() => setZoneForm((prev) => ({ ...prev, minActiveSubscribers: 40 }))} className="rounded border border-white/30 px-2 py-1 text-xs">Target 40</button>
              <button type="button" onClick={() => setZoneForm((prev) => ({ ...prev, minActiveSubscribers: 60 }))} className="rounded border border-white/30 px-2 py-1 text-xs">Target 60</button>
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
                    className="block w-full rounded px-2 py-2 text-left text-sm text-white hover:bg-white/10"
                  >
                    {prediction.mainText}
                    <p className="text-xs text-white/70">{prediction.secondaryText || prediction.description}</p>
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-white/70">
              {createCenterSelection ? `Selected center: ${createCenterSelection.formattedAddress}` : "Pick a center address from suggestions so radius coverage is accurate."}
            </p>
            <button onClick={createZone} className="mt-4 rounded bg-[var(--dc-orange)] px-3 py-2 text-sm font-semibold">Create Area</button>
          </section>
        </>
      ) : null}

      {section === "growth" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Waitlist</h3>
            <div className="mt-3 space-y-2">
              {data.waitlist.slice(0, 14).map((entry) => (
                <div key={entry.id} className="rounded-lg bg-black/30 p-3 text-sm">
                  {entry.full_name} ({entry.postal_code}) - {entry.status}
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <h3 className="text-xl font-bold">Affiliate Referrals</h3>
            <div className="mt-3 space-y-2">
              {data.referrals.slice(0, 14).map((referral) => (
                <div key={referral.id} className="rounded-lg bg-black/30 p-3 text-sm">
                  {referral.referrer_email ?? "Unknown"} {"->"} {referral.referred_email ?? "Pending user"} ({referral.referral_code}) - {referral.status}
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {message ? <p className="text-sm text-white/80">{message}</p> : null}
    </div>
  );
}
