"use client";

import { useEffect, useMemo, useState } from "react";

type PickupHousehold = {
  pickupRequestId: string;
  stopId: string | null;
  stopOrder: number | null;
  memberName: string;
  email: string;
  addressLine: string;
  status: string;
  requestNote: string | null;
};

type PartnerRoute = {
  id: string;
  pickupCycleId: string;
  status: string;
  partnerId: string | null;
  driverId: string | null;
  googleMapsUrl?: string | null;
  zoneName: string;
  pickupDate: string | null;
  pickupWindowLabel: string | null;
  stops: Array<{
    id: string;
    pickupRequestId: string;
    stopOrder: number;
    stopStatus: string;
    memberName: string;
    email: string;
    addressLine: string;
    requestStatus: string | null;
    requestNote: string | null;
  }>;
};

type PartnerCycle = {
  id: string;
  zoneId: string;
  zoneName: string;
  partnerId: string | null;
  pickupDate: string;
  requestCutoffAt: string;
  pickupWindowLabel: string | null;
  overrideAllowed: boolean;
  recurringPickupDay: number | null;
};

type PickupZone = {
  id: string;
  name: string;
  code: string;
  overrideAllowed: boolean;
  recurringPickupDay: number | null;
  defaultPickupWindowLabel: string | null;
};

type DriverOption = {
  id: string;
  userId: string;
  partnerId: string;
  name: string;
  email: string;
  driverLabel: string;
  role: "partner_coordinator" | "partner_driver";
};

function localDateTimeValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatRecurringDay(day: number | null) {
  if (day === null) return "No repeating day set";
  const suffix = day % 10 === 1 && day % 100 !== 11 ? "st" : day % 10 === 2 && day % 100 !== 12 ? "nd" : day % 10 === 3 && day % 100 !== 13 ? "rd" : "th";
  return `Repeats on the ${day}${suffix} of each month`;
}

function isResolvedStatus(status: string) {
  return ["picked_up", "no_access", "not_ready", "rescheduled", "missed"].includes(status);
}

function humanStatus(status: string) {
  if (status === "picked_up") return "Picked up";
  if (status === "missed" || status === "no_access") return "Could not be retrieved";
  if (status === "requested") return "Needs action";
  return status.replaceAll("_", " ");
}

export function PartnerOperationsPanel({
  routes,
  cycles,
  pickupLists,
  zones,
  canManageSchedule,
  currentUserRole,
  currentDriverId,
  driverOptions,
}: {
  routes: PartnerRoute[];
  cycles: PartnerCycle[];
  pickupLists: Array<{ cycleId: string; households: PickupHousehold[] }>;
  zones: PickupZone[];
  canManageSchedule: boolean;
  currentUserRole: string;
  currentDriverId: string | null;
  driverOptions: DriverOption[];
}) {
  const isRouteBoundDriver = currentUserRole === "partner_driver";
  const [routeState, setRouteState] = useState(routes);
  const [cycleState, setCycleState] = useState(cycles);
  const [pickupState, setPickupState] = useState(() =>
    Object.fromEntries(pickupLists.map((pickup) => [pickup.cycleId, pickup.households])),
  );
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(
    isRouteBoundDriver
      ? routes.find((route) => route.driverId === currentDriverId)?.pickupCycleId ?? null
      : cycles[0]?.id ?? null,
  );
  const [workingItemId, setWorkingItemId] = useState<string | null>(null);
  const [workingCycleId, setWorkingCycleId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [scheduleModes, setScheduleModes] = useState<Record<string, "months" | "forever">>(
    Object.fromEntries(cycles.map((cycle) => [cycle.zoneId, "months"])),
  );
  const [emptyZoneId, setEmptyZoneId] = useState(zones.find((zone) => zone.overrideAllowed)?.id ?? zones[0]?.id ?? "");
  const [emptyPickupWindowLabel, setEmptyPickupWindowLabel] = useState(
    zones.find((zone) => zone.id === (zones.find((zone) => zone.overrideAllowed)?.id ?? zones[0]?.id ?? ""))?.defaultPickupWindowLabel ?? "",
  );
  const [selectedDriverByCycleId, setSelectedDriverByCycleId] = useState<Record<string, string>>({});
  const [routePreviewLoadingId, setRoutePreviewLoadingId] = useState<string | null>(null);

  const visibleRoutes = useMemo(
    () => (isRouteBoundDriver ? routeState.filter((route) => route.driverId === currentDriverId) : routeState),
    [currentDriverId, isRouteBoundDriver, routeState],
  );
  const visibleCycleIds = useMemo(() => new Set(visibleRoutes.map((route) => route.pickupCycleId)), [visibleRoutes]);
  const visibleCycles = useMemo(
    () => (isRouteBoundDriver ? cycleState.filter((cycle) => visibleCycleIds.has(cycle.id)) : cycleState).slice(0, 6),
    [cycleState, isRouteBoundDriver, visibleCycleIds],
  );
  const effectiveSelectedCycleId =
    selectedCycleId && visibleCycles.some((cycle) => cycle.id === selectedCycleId) ? selectedCycleId : (visibleCycles[0]?.id ?? null);
  const selectedCycle = cycleState.find((cycle) => cycle.id === effectiveSelectedCycleId) ?? null;
  const selectedRoute = visibleRoutes.find((route) => route.pickupCycleId === effectiveSelectedCycleId) ?? null;
  const selectedHouseholds = isRouteBoundDriver
    ? (selectedRoute?.stops ?? []).map((stop) => ({
        pickupRequestId: stop.pickupRequestId,
        stopId: stop.id,
        stopOrder: stop.stopOrder,
        memberName: stop.memberName,
        email: stop.email,
        addressLine: stop.addressLine,
        status: stop.stopStatus,
        requestNote: stop.requestNote,
      }))
    : (effectiveSelectedCycleId ? pickupState[effectiveSelectedCycleId] ?? [] : []);
  const activeHouseholds = selectedHouseholds.filter((household) => !isResolvedStatus(household.status));
  const resolvedHouseholds = selectedHouseholds.filter((household) => isResolvedStatus(household.status));
  const selectedDriverOptions = driverOptions.filter((driver) => driver.partnerId === selectedCycle?.partnerId);
  const assignedDriver =
    selectedRoute?.driverId ? selectedDriverOptions.find((driver) => driver.id === selectedRoute.driverId) ?? null : null;

  async function refreshRoutePreview(routeId: string, cycleId: string) {
    setRoutePreviewLoadingId(routeId);
    try {
      const response = await fetch(`/api/partner/routes/preview?routeId=${routeId}`);
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not load route preview");
        return;
      }

      setRouteState((prev) =>
        prev.map((route) =>
          route.id !== routeId
            ? route
            : {
                ...route,
                status: json.route?.status ?? route.status,
                driverId: json.route?.driver_id ?? route.driverId,
                googleMapsUrl: json.googleMapsUrl ?? null,
                stops: (json.stops ?? []).map((stop: {
                  id: string;
                  pickupRequestId: string;
                  stopOrder: number;
                  stopStatus: string;
                  requestStatus: string | null;
                  requestNote: string | null;
                  email: string | null;
                  fullName: string | null;
                  address: { addressLine1: string; city: string; state: string; postalCode: string } | null;
                }) => ({
                  id: stop.id,
                  pickupRequestId: stop.pickupRequestId,
                  stopOrder: stop.stopOrder,
                  stopStatus: stop.stopStatus,
                  requestStatus: stop.requestStatus,
                  requestNote: stop.requestNote,
                  email: stop.email ?? "No email on file",
                  memberName: stop.fullName || stop.email || "Unknown member",
                  addressLine: stop.address
                    ? `${stop.address.addressLine1}, ${stop.address.city}, ${stop.address.state} ${stop.address.postalCode}`
                    : "Address unavailable",
                })),
              },
        ),
      );

      setPickupState((prev) => ({
        ...prev,
        [cycleId]: (json.stops ?? []).map((stop: {
          pickupRequestId: string;
          id: string;
          stopOrder: number;
          stopStatus: string;
          requestNote: string | null;
          email: string | null;
          fullName: string | null;
          address: { addressLine1: string; city: string; state: string; postalCode: string } | null;
        }) => ({
          pickupRequestId: stop.pickupRequestId,
          stopId: stop.id,
          stopOrder: stop.stopOrder,
          memberName: stop.fullName || stop.email || "Unknown member",
          email: stop.email ?? "No email on file",
          addressLine: stop.address
            ? `${stop.address.addressLine1}, ${stop.address.city}, ${stop.address.state} ${stop.address.postalCode}`
            : "Address unavailable",
          status: stop.stopStatus,
          requestNote: stop.requestNote ?? null,
        })),
      }));
    } finally {
      setRoutePreviewLoadingId(null);
    }
  }

  useEffect(() => {
    if (selectedRoute?.id && selectedRoute.stops.length === 0) {
      void refreshRoutePreview(selectedRoute.id, selectedRoute.pickupCycleId);
    }
  }, [selectedRoute?.id, selectedRoute?.pickupCycleId, selectedRoute?.stops.length]);

  async function updateHousehold(household: PickupHousehold, status: "picked_up" | "missed" | "requested") {
    setWorkingItemId(household.stopId ?? household.pickupRequestId);
    setMessage("");
    try {
      if (household.stopId) {
        const response = await fetch(`/api/driver/stops/${household.stopId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status:
              status === "picked_up"
                ? "picked_up"
                : status === "missed"
                  ? "no_access"
                  : "scheduled",
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage(json.error || "Could not update pickup");
          return;
        }
        setRouteState((prev) =>
          prev.map((route) => ({
            ...route,
            status: route.pickupCycleId === effectiveSelectedCycleId ? json.routeStatus ?? route.status : route.status,
            stops: route.stops.map((stop) =>
              stop.id === household.stopId
                ? {
                    ...stop,
                    stopStatus: status === "picked_up" ? "picked_up" : status === "missed" ? "no_access" : "scheduled",
                    requestStatus: status === "picked_up" ? "picked_up" : status === "missed" ? "missed" : "requested",
                    requestNote: status === "missed" ? "Driver marked stop as no access" : null,
                  }
                : stop,
            ),
          })),
        );
        if (json.allResolved && json.routeStatus !== "completed") {
          setMessage("All stops are marked. Finish the route when the driver is done for the day.");
        }
      } else {
        const response = await fetch("/api/partner/pickup-requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: household.pickupRequestId, status }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage(json.error || "Could not update pickup");
          return;
        }
      }

      setPickupState((prev) => ({
        ...prev,
        [effectiveSelectedCycleId ?? ""]: (prev[effectiveSelectedCycleId ?? ""] ?? []).map((item) =>
          item.pickupRequestId === household.pickupRequestId
            ? {
                ...item,
                status,
                requestNote: status === "missed" ? "Could not be retrieved" : null,
              }
            : item,
        ),
      }));
      if (!(household.stopId && status !== "requested")) {
        setMessage(status === "requested" ? "Pickup was unmarked." : "Pickup outcome saved.");
      }
    } finally {
      setWorkingItemId(null);
    }
  }

  async function finishRoute(routeId: string) {
    setWorkingCycleId(routeId);
    setMessage("");
    try {
      const response = await fetch("/api/partner/routes/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not finish route");
        return;
      }
      setRouteState((prev) =>
        prev.map((route) => (route.id === routeId ? { ...route, status: json.routeStatus ?? "completed" } : route)),
      );
      setMessage("Route finished.");
    } finally {
      setWorkingCycleId(null);
    }
  }

  async function updateCycle(cycleId: string, formData: FormData) {
    setWorkingCycleId(cycleId);
    setMessage("");
    try {
      const response = await fetch("/api/partner/pickup-cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_cycle",
          cycleId,
          pickupDate: String(formData.get("pickupDate") || ""),
          requestCutoffAt: new Date(String(formData.get("requestCutoffAt") || "")).toISOString(),
          pickupWindowLabel: String(formData.get("pickupWindowLabel") || ""),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not update pickup");
        return;
      }
      setCycleState((prev) =>
        prev.map((cycle) =>
          cycle.id === cycleId
            ? {
                ...cycle,
                pickupDate: json.pickupCycle?.pickup_date ?? cycle.pickupDate,
                requestCutoffAt: json.pickupCycle?.request_cutoff_at ?? cycle.requestCutoffAt,
                pickupWindowLabel: json.pickupCycle?.pickup_window_label ?? cycle.pickupWindowLabel,
              }
            : cycle,
        ),
      );
      setRouteState((prev) =>
        prev.map((route) =>
          route.pickupCycleId === cycleId
            ? {
                ...route,
                pickupDate: json.pickupCycle?.pickup_date ?? route.pickupDate,
                pickupWindowLabel: json.pickupCycle?.pickup_window_label ?? route.pickupWindowLabel,
              }
            : route,
        ),
      );
      setMessage("Pickup updated.");
    } finally {
      setWorkingCycleId(null);
    }
  }

  async function saveRecurringSchedule(zoneId: string, formData: FormData) {
    setWorkingCycleId(zoneId);
    setMessage("");
    try {
      const response = await fetch("/api/partner/pickup-cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_recurring_schedule",
          zoneId,
          startPickupDate: String(formData.get("startPickupDate") || ""),
          horizonMode: String(formData.get("horizonMode") || "months"),
          months: formData.get("horizonMode") === "forever" ? undefined : Number(formData.get("months") || 6),
          weekendPolicy: String(formData.get("weekendPolicy") || "none"),
          pickupWindowLabel: String(formData.get("pickupWindowLabel") || ""),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not save recurring schedule");
        return;
      }

      const zoneName = zones.find((zone) => zone.id === zoneId)?.name ?? "Zone";
      const createdCycles = (json.pickupCycles ?? []).map((cycle: { id: string; zone_id: string; pickup_date: string; request_cutoff_at: string; pickup_window_label: string | null }) => ({
        id: cycle.id,
        zoneId: cycle.zone_id,
        zoneName,
        pickupDate: cycle.pickup_date,
        requestCutoffAt: cycle.request_cutoff_at,
        pickupWindowLabel: cycle.pickup_window_label,
        overrideAllowed: true,
        recurringPickupDay: json.schedule?.recurringPickupDay ?? null,
      }));

      setCycleState((prev) => {
        const preserved = prev.filter((cycle) => cycle.zoneId !== zoneId);
        const next = [...preserved, ...createdCycles].sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
        if (!effectiveSelectedCycleId && next[0]) setSelectedCycleId(next[0].id);
        return next;
      });
      setPickupState((prev) => {
        const next = { ...prev };
        for (const cycle of createdCycles) {
          next[cycle.id] = next[cycle.id] ?? [];
        }
        return next;
      });
      setMessage("Recurring schedule updated.");
    } finally {
      setWorkingCycleId(null);
    }
  }

  async function deleteCycle(cycleId: string) {
    if (!window.confirm("Delete this pickup day? This removes the selected day from the schedule.")) {
      return;
    }

    setWorkingCycleId(cycleId);
    setMessage("");
    try {
      const response = await fetch("/api/partner/pickup-cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_cycle",
          cycleId,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not delete pickup");
        return;
      }
      setCycleState((prev) => {
        const nextCycles = prev.filter((cycle) => cycle.id !== cycleId);
        setSelectedCycleId((current) => (current === cycleId ? nextCycles[0]?.id ?? null : current));
        return nextCycles;
      });
      setRouteState((prev) => prev.filter((route) => route.pickupCycleId !== cycleId));
      setPickupState((prev) => {
        const next = { ...prev };
        delete next[cycleId];
        return next;
      });
      setMessage("Pickup deleted.");
    } finally {
      setWorkingCycleId(null);
    }
  }

  async function buildRoute(cycleId: string) {
    setWorkingCycleId(cycleId);
    setMessage("");
    try {
      const response = await fetch("/api/partner/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupCycleId: cycleId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not build route");
        return;
      }
      const existing = routeState.find((route) => route.id === json.routeId);
      if (!existing && selectedCycle) {
        setRouteState((prev) => [
          ...prev,
          {
            id: json.routeId,
            pickupCycleId: cycleId,
            status: "draft",
            partnerId: selectedCycle.partnerId,
            driverId: null,
            googleMapsUrl: null,
            zoneName: selectedCycle.zoneName,
            pickupDate: selectedCycle.pickupDate,
            pickupWindowLabel: selectedCycle.pickupWindowLabel,
            stops: [],
          },
        ]);
      }
      await refreshRoutePreview(json.routeId, cycleId);
      setMessage(`Route ${json.regenerated ? "refreshed" : "built"} with ${json.stopCount} stops${json.optimized ? " (optimized)" : ""}.`);
    } finally {
      setWorkingCycleId(null);
    }
  }

  async function assignDriver(routeId: string, cycleId: string) {
    const driverId = selectedDriverByCycleId[cycleId];
    if (!driverId) {
      setMessage("Choose a driver first.");
      return;
    }

    setWorkingCycleId(routeId);
    setMessage("");
    try {
      const response = await fetch("/api/partner/routes/assign-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId, driverId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not assign driver");
        return;
      }
      setRouteState((prev) =>
        prev.map((route) => (route.id === routeId ? { ...route, driverId, status: "assigned" } : route)),
      );
      setMessage("Driver assigned.");
    } finally {
      setWorkingCycleId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-[1.85rem] border border-black/10 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Upcoming Pickups</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">Open the right pickup day</h2>
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
            {isRouteBoundDriver
              ? "Only pickup days with a route assigned to you are shown here. Pick one to see your stops and mark outcomes."
              : "Only the next few pickup days are shown here. Pick one to see the households on that day and make changes."}
          </p>
          <div className="mt-4 space-y-2">
            {visibleCycles.map((cycle) => {
              const households = isRouteBoundDriver
                ? visibleRoutes.find((route) => route.pickupCycleId === cycle.id)?.stops.map((stop) => ({
                    status: stop.stopStatus,
                  })) ?? []
                : (pickupState[cycle.id] ?? []);
              const openCount = households.filter((household) => !isResolvedStatus(household.status)).length;
              return (
                <button
                  key={cycle.id}
                  type="button"
                  onClick={() => setSelectedCycleId(cycle.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left ${
                    effectiveSelectedCycleId === cycle.id
                      ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/12"
                      : "border-black/10 bg-[var(--dc-gray-100)]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--dc-gray-900)]">{cycle.zoneName}</p>
                  <p className="mt-1 text-xs text-[var(--dc-gray-700)]">{formatDate(cycle.pickupDate)}</p>
                    <p className="mt-1 text-xs text-[var(--dc-gray-700)]">{openCount} household{openCount === 1 ? "" : "s"} still need action</p>
                  </button>
                );
              })}
          </div>
          {visibleCycles.length > 6 ? (
            <p className="mt-3 text-xs text-[var(--dc-gray-700)]">Only the next six pickup days are shown here to keep the view simple.</p>
          ) : null}
          {visibleCycles.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-black/15 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
              {isRouteBoundDriver ? "No pickup days are assigned to you yet." : "No pickup days are scheduled yet."}
            </p>
          ) : null}
        </aside>

        {selectedCycle ? (
          <div className="space-y-4">
            <article className="rounded-[1.85rem] border border-black/10 bg-white/90 p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-[1.55rem] border border-black/10 bg-[var(--dc-gray-100)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-gray-700)]">Selected pickup</p>
                  <h3 className="mt-2 text-xl font-bold text-[var(--dc-gray-900)]">{selectedCycle.zoneName}</h3>
                  <div className="mt-4 space-y-3 text-sm text-[var(--dc-gray-700)]">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--dc-gray-700)]">Pickup date</p>
                      <p className="mt-1 text-lg font-semibold text-[var(--dc-gray-900)]">{formatDate(selectedCycle.pickupDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--dc-gray-700)]">Pickup window</p>
                      <p className="mt-1 font-semibold text-[var(--dc-gray-900)]">{selectedCycle.pickupWindowLabel || "Window not set"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--dc-gray-700)]">Response deadline</p>
                      <p className="mt-1 font-semibold text-[var(--dc-gray-900)]">{formatDateTime(selectedCycle.requestCutoffAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--dc-gray-700)]">Donors on this pickup</p>
                      <p className="mt-1 font-semibold text-[var(--dc-gray-900)]">{selectedHouseholds.length}</p>
                    </div>
                    {isRouteBoundDriver ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--dc-gray-700)]">Viewing</p>
                        <p className="mt-1 font-semibold text-[var(--dc-gray-900)]">Only your assigned route</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                    <p className="font-semibold text-[var(--dc-gray-900)]">What to do</p>
                    <p className="mt-1">
                      {isRouteBoundDriver
                        ? "Work through your assigned stops and mark each outcome once you attempt the pickup."
                        : "Review the households on this pickup day and mark each outcome once the team has attempted the pickup."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg font-bold text-[var(--dc-gray-900)]">Households needing action</h4>
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[var(--dc-gray-800)]">
                        {activeHouseholds.length} open
                      </span>
                    </div>
                    <p className="text-sm text-[var(--dc-gray-700)]">
                      {selectedHouseholds.length} donor{selectedHouseholds.length === 1 ? "" : "s"} {isRouteBoundDriver ? "are on your route for this pickup day." : "are attached to this pickup day."}
                    </p>
                    {activeHouseholds.map((household) => (
                      <div key={household.pickupRequestId} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                        <p className="text-sm font-semibold text-[var(--dc-gray-900)]">
                          {household.stopOrder ? `Stop ${household.stopOrder}: ` : ""}{household.memberName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--dc-gray-700)]">{household.email}</p>
                        <p className="mt-2 text-sm text-[var(--dc-gray-800)]">{household.addressLine}</p>
                        {household.requestNote ? <p className="mt-2 text-xs text-[var(--dc-gray-700)]">Customer note: {household.requestNote}</p> : null}
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            disabled={workingItemId === (household.stopId ?? household.pickupRequestId)}
                            onClick={() => updateHousehold(household, "picked_up")}
                            className="dc-btn-secondary w-full sm:w-auto"
                          >
                            Picked Up
                          </button>
                          <button
                            type="button"
                            disabled={workingItemId === (household.stopId ?? household.pickupRequestId)}
                            onClick={() => updateHousehold(household, "missed")}
                            className="dc-btn-secondary w-full sm:w-auto"
                          >
                            Could Not Be Retrieved
                          </button>
                        </div>
                      </div>
                    ))}
                    {activeHouseholds.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-black/15 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                        Everything on this pickup day has already been marked.
                      </p>
                    ) : null}
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg font-bold text-[var(--dc-gray-900)]">Already marked</h4>
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[var(--dc-gray-800)]">
                        {resolvedHouseholds.length} completed
                      </span>
                    </div>
                    {resolvedHouseholds.map((household) => (
                      <div key={household.pickupRequestId} className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--dc-gray-900)]">
                              {household.stopOrder ? `Stop ${household.stopOrder}: ` : ""}{household.memberName}
                            </p>
                            <p className="mt-1 text-xs text-[var(--dc-gray-700)]">{household.email}</p>
                            <p className="mt-1 text-xs text-[var(--dc-gray-700)]">{household.addressLine}</p>
                          </div>
                          <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[var(--dc-gray-900)]">
                            {humanStatus(household.status)}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            disabled={workingItemId === (household.stopId ?? household.pickupRequestId)}
                            onClick={() => updateHousehold(household, "picked_up")}
                            className="dc-btn-secondary w-full sm:w-auto"
                          >
                            Mark Picked Up
                          </button>
                          <button
                            type="button"
                            disabled={workingItemId === (household.stopId ?? household.pickupRequestId)}
                            onClick={() => updateHousehold(household, "missed")}
                            className="dc-btn-secondary w-full sm:w-auto"
                          >
                            Mark Could Not Be Retrieved
                          </button>
                          <button
                            type="button"
                            disabled={workingItemId === (household.stopId ?? household.pickupRequestId)}
                            onClick={() => updateHousehold(household, "requested")}
                            className="dc-btn-secondary w-full sm:w-auto"
                          >
                            Unmark
                          </button>
                        </div>
                      </div>
                    ))}
                    {resolvedHouseholds.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-black/15 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                        No households have been marked yet on this pickup day.
                      </p>
                    ) : null}
                  </section>

                  {selectedRoute ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                        Route status: <span className="font-semibold text-[var(--dc-gray-900)]">{selectedRoute.status.replaceAll("_", " ")}</span>
                      </div>
                      <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                        Assigned driver: <span className="font-semibold text-[var(--dc-gray-900)]">{assignedDriver ? `${assignedDriver.name} (${assignedDriver.driverLabel})` : "Not assigned"}</span>
                      </div>
                      <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                        Ordered stops: <span className="font-semibold text-[var(--dc-gray-900)]">{selectedRoute.stops.length}</span>
                      </div>
                    </div>
                  ) : null}
                  {selectedRoute ? (
                    <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--dc-gray-900)]">Finish route</p>
                          <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
                            Mark the route complete once every stop has been serviced for this pickup day.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={workingCycleId === selectedRoute.id || activeHouseholds.length > 0 || selectedRoute.status === "completed"}
                          onClick={() => finishRoute(selectedRoute.id)}
                          className="dc-btn-secondary w-full sm:w-auto"
                        >
                          {selectedRoute.status === "completed"
                            ? "Route Finished"
                            : workingCycleId === selectedRoute.id
                              ? "Finishing..."
                              : "Finish Route"}
                        </button>
                      </div>
                      {activeHouseholds.length > 0 ? (
                        <p className="mt-3 text-xs text-[var(--dc-gray-700)]">
                          Finish Route becomes available after every donor on this pickup day has been marked.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {!isRouteBoundDriver && canManageSchedule ? (
                    <section className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 text-sm text-[var(--dc-gray-700)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dc-orange)]">Route Management</p>
                      <h4 className="mt-2 text-lg font-bold text-[var(--dc-gray-900)]">
                        {selectedRoute ? "Dispatch this pickup day" : "Create the route for this pickup day"}
                      </h4>
                      <p className="mt-1">
                        {selectedRoute
                          ? "Refresh the stop order if needed, then assign one coordinator or driver to run this pickup."
                          : "Build the route first so this pickup day becomes a driver-ready stop list."}
                      </p>
                      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap">
                        <button
                          type="button"
                          disabled={workingCycleId === selectedCycle.id}
                          onClick={() => buildRoute(selectedCycle.id)}
                          className="dc-btn-primary w-full sm:w-auto"
                        >
                          {workingCycleId === selectedCycle.id ? "Working..." : selectedRoute ? "Build or Refresh Route" : "Build Route"}
                        </button>
                        {selectedRoute ? (
                          <>
                            <select
                              value={selectedDriverByCycleId[selectedCycle.id] ?? selectedRoute.driverId ?? ""}
                              onChange={(event) =>
                                setSelectedDriverByCycleId((prev) => ({
                                  ...prev,
                                  [selectedCycle.id]: event.target.value,
                                }))
                              }
                              className="dc-input w-full sm:w-auto"
                            >
                              <option value="">Select route driver</option>
                              {selectedDriverOptions.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                  {driver.driverLabel} · {driver.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={workingCycleId === selectedRoute.id || selectedDriverOptions.length === 0}
                              onClick={() => assignDriver(selectedRoute.id, selectedCycle.id)}
                              className="dc-btn-primary w-full sm:w-auto"
                            >
                              {workingCycleId === selectedRoute.id ? "Assigning..." : "Assign Driver"}
                            </button>
                          </>
                        ) : null}
                      </div>
                      <div className="mt-3 text-xs text-[var(--dc-gray-700)]">
                        {selectedDriverOptions.length > 0
                          ? "Only active Coordinators and Drivers from this organization can be assigned."
                          : "No active driver-capable team members are available yet. Add or update a Coordinator or Driver from Team first."}
                      </div>
                      {selectedRoute ? (
                        <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-orange)]">Route Preview</p>
                              <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
                                Review the ordered stop list before the driver heads out.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => refreshRoutePreview(selectedRoute.id, selectedCycle.id)}
                                disabled={routePreviewLoadingId === selectedRoute.id}
                                className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold text-[var(--dc-gray-900)] disabled:opacity-60"
                              >
                                {routePreviewLoadingId === selectedRoute.id ? "Refreshing..." : "Refresh Preview"}
                              </button>
                              {selectedRoute.googleMapsUrl ? (
                                <a
                                  href={selectedRoute.googleMapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold text-[var(--dc-gray-900)]"
                                >
                                  Open in Google Maps
                                </a>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            {selectedRoute.stops.map((stop) => (
                              <div key={stop.id} className="rounded-xl border border-black/10 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                                <p className="font-semibold text-[var(--dc-gray-900)]">Stop {stop.stopOrder}: {stop.memberName}</p>
                                <p className="mt-1">{stop.addressLine}</p>
                              </div>
                            ))}
                            {selectedRoute.stops.length === 0 ? (
                              <p className="rounded-xl border border-dashed border-black/15 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                                No stops are on this route yet.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              </div>
            </article>

            {!isRouteBoundDriver ? (
            <form
              key={`pickup-${selectedCycle.id}`}
              onSubmit={(event) => {
                event.preventDefault();
                updateCycle(selectedCycle.id, new FormData(event.currentTarget));
              }}
              className="rounded-[1.85rem] border border-black/10 bg-white/90 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Edit This Pickup Day</p>
                  <h3 className="mt-2 text-xl font-bold text-[var(--dc-gray-900)]">{selectedCycle.zoneName}</h3>
                  <p className="mt-1 text-sm text-[var(--dc-gray-700)]">Change just this date without changing the recurring pattern for the whole service area.</p>
                </div>
                <button
                  type="button"
                  disabled={workingCycleId === selectedCycle.id}
                  onClick={() => deleteCycle(selectedCycle.id)}
                  className="dc-btn-secondary"
                >
                  {workingCycleId === selectedCycle.id ? "Deleting..." : "Delete Pickup Day"}
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="text-xs text-[var(--dc-gray-700)]">
                  Pickup date
                  <input name="pickupDate" type="date" defaultValue={selectedCycle.pickupDate} disabled={!selectedCycle.overrideAllowed} className="dc-input mt-1 w-full disabled:opacity-50" />
                </label>
                <label className="text-xs text-[var(--dc-gray-700)]">
                  Response deadline
                  <input name="requestCutoffAt" type="datetime-local" defaultValue={localDateTimeValue(selectedCycle.requestCutoffAt)} disabled={!selectedCycle.overrideAllowed} className="dc-input mt-1 w-full disabled:opacity-50" />
                </label>
                <label className="text-xs text-[var(--dc-gray-700)]">
                  Pickup window
                  <input name="pickupWindowLabel" type="text" defaultValue={selectedCycle.pickupWindowLabel ?? ""} disabled={!selectedCycle.overrideAllowed} placeholder="8am - 12pm" className="dc-input mt-1 w-full disabled:opacity-50" />
                </label>
              </div>
              {selectedCycle.overrideAllowed && canManageSchedule ? (
                <button type="submit" disabled={workingCycleId === selectedCycle.id} className="dc-btn-primary mt-4">
                  {workingCycleId === selectedCycle.id ? "Saving..." : "Save This Pickup Day"}
                </button>
              ) : (
                <p className="mt-4 text-sm text-[var(--dc-gray-700)]">
                  {canManageSchedule ? "DonateCrate controls scheduling for this service area." : "Only Organization Admins and Coordinators can change pickup schedules."}
                </p>
              )}
            </form>
            ) : null}

            {!isRouteBoundDriver ? (
            <form
              key={`schedule-${selectedCycle.zoneId}`}
              onSubmit={(event) => {
                event.preventDefault();
                saveRecurringSchedule(selectedCycle.zoneId, new FormData(event.currentTarget));
              }}
              className="rounded-[1.85rem] border border-black/10 bg-white/90 p-5 shadow-sm"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Recurring Schedule</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--dc-gray-900)]">Set the repeating pickup day</h3>
                <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
                  This updates future pickup days for the whole service area. Current repeating day: {formatRecurringDay(selectedCycle.recurringPickupDay)}.
                </p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-[var(--dc-gray-700)]">
                  First pickup in the series
                  <input name="startPickupDate" type="date" defaultValue={selectedCycle.pickupDate} disabled={!selectedCycle.overrideAllowed} className="dc-input mt-1 w-full disabled:opacity-50" />
                </label>
                <label className="text-xs text-[var(--dc-gray-700)]">
                  Schedule length
                  <select
                    name="horizonMode"
                    value={scheduleModes[selectedCycle.zoneId] ?? "months"}
                    onChange={(event) =>
                      setScheduleModes((prev) => ({
                        ...prev,
                        [selectedCycle.zoneId]: event.target.value as "months" | "forever",
                      }))
                    }
                    disabled={!selectedCycle.overrideAllowed}
                    className="dc-input mt-1 w-full disabled:opacity-50"
                  >
                    <option value="months">Choose how many months</option>
                    <option value="forever">Forever</option>
                  </select>
                </label>
                {scheduleModes[selectedCycle.zoneId] === "months" ? (
                  <label className="text-xs text-[var(--dc-gray-700)]">
                    Months to schedule
                    <input name="months" type="number" min={1} max={24} defaultValue={6} disabled={!selectedCycle.overrideAllowed} className="dc-input mt-1 w-full disabled:opacity-50" />
                  </label>
                ) : (
                  <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                    Future pickup days will continue to be created until someone changes the recurring schedule.
                  </div>
                )}
                <label className="text-xs text-[var(--dc-gray-700)]">
                  Weekend handling
                  <select name="weekendPolicy" defaultValue="next_business_day" disabled={!selectedCycle.overrideAllowed} className="dc-input mt-1 w-full disabled:opacity-50">
                    <option value="none">Keep the same calendar day</option>
                    <option value="next_business_day">Move Saturday or Sunday to the next business day</option>
                  </select>
                </label>
                <label className="text-xs text-[var(--dc-gray-700)] md:col-span-2">
                  Default pickup window
                  <input name="pickupWindowLabel" type="text" defaultValue={selectedCycle.pickupWindowLabel ?? ""} disabled={!selectedCycle.overrideAllowed} placeholder="9am - 1pm" className="dc-input mt-1 w-full disabled:opacity-50" />
                </label>
              </div>
              {selectedCycle.overrideAllowed && canManageSchedule ? (
                <button type="submit" disabled={workingCycleId === selectedCycle.zoneId} className="dc-btn-primary mt-4">
                  {workingCycleId === selectedCycle.zoneId ? "Saving..." : "Save Recurring Schedule"}
                </button>
              ) : (
                <p className="mt-4 text-sm text-[var(--dc-gray-700)]">
                  {canManageSchedule ? "DonateCrate controls recurring scheduling for this service area." : "Only Organization Admins and Coordinators can change recurring schedules."}
                </p>
              )}
            </form>
            ) : null}
          </div>
        ) : (
          <article className="rounded-[1.85rem] border border-black/10 bg-white/90 p-5 shadow-sm">
            {isRouteBoundDriver ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">No Route Assigned</p>
                <h3 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">Your next route is not ready yet</h3>
                <p className="mt-2 max-w-2xl text-sm text-[var(--dc-gray-700)]">
                  You will see pickup days here once a coordinator or admin assigns a route to you.
                </p>
              </>
            ) : canManageSchedule ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Start Here</p>
                <h3 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">Create the first pickup day</h3>
                <p className="mt-2 max-w-2xl text-sm text-[var(--dc-gray-700)]">
                  There are no pickup days scheduled yet. Choose a service area and create the first recurring pickup schedule here.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Start Here</p>
                <h3 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">No pickup days are scheduled yet</h3>
                <p className="mt-2 max-w-2xl text-sm text-[var(--dc-gray-700)]">
                  An organization admin or coordinator needs to create the first recurring pickup schedule.
                </p>
              </>
            )}
            {!isRouteBoundDriver && canManageSchedule ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!emptyZoneId) {
                    setMessage("Choose a service area first.");
                    return;
                  }
                  saveRecurringSchedule(emptyZoneId, new FormData(event.currentTarget));
                }}
                className="mt-5 grid gap-3 md:grid-cols-2"
              >
                <label className="text-xs text-[var(--dc-gray-700)]">
                  Service area
                  <select
                    value={emptyZoneId}
                    onChange={(event) => {
                      const nextZoneId = event.target.value;
                      setEmptyZoneId(nextZoneId);
                      setEmptyPickupWindowLabel(zones.find((zone) => zone.id === nextZoneId)?.defaultPickupWindowLabel ?? "");
                    }}
                    className="dc-input mt-1 w-full"
                  >
                    {zones.filter((zone) => zone.overrideAllowed).map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-[var(--dc-gray-700)]">
                  First pickup in the series
                  <input name="startPickupDate" type="date" className="dc-input mt-1 w-full" />
                </label>
                <label className="text-xs text-[var(--dc-gray-700)]">
                  Schedule length
                  <select
                    name="horizonMode"
                    value={scheduleModes[emptyZoneId] ?? "months"}
                    onChange={(event) =>
                      setScheduleModes((prev) => ({
                        ...prev,
                        [emptyZoneId]: event.target.value as "months" | "forever",
                      }))
                    }
                    className="dc-input mt-1 w-full"
                  >
                    <option value="months">Choose how many months</option>
                    <option value="forever">Forever</option>
                  </select>
                </label>
                {scheduleModes[emptyZoneId] === "months" ? (
                  <label className="text-xs text-[var(--dc-gray-700)]">
                    Months to schedule
                    <input name="months" type="number" min={1} max={24} defaultValue={6} className="dc-input mt-1 w-full" />
                  </label>
                ) : (
                  <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                    Future pickup days will continue until someone changes the recurring schedule.
                  </div>
                )}
                <label className="text-xs text-[var(--dc-gray-700)]">
                  Weekend handling
                  <select name="weekendPolicy" defaultValue="next_business_day" className="dc-input mt-1 w-full">
                    <option value="none">Keep the same calendar day</option>
                    <option value="next_business_day">Move Saturday or Sunday to the next business day</option>
                  </select>
                </label>
                <label className="text-xs text-[var(--dc-gray-700)] md:col-span-2">
                  Default pickup window
                  <input
                    name="pickupWindowLabel"
                    type="text"
                    value={emptyPickupWindowLabel}
                    onChange={(event) => setEmptyPickupWindowLabel(event.target.value)}
                    placeholder="9am - 1pm"
                    className="dc-input mt-1 w-full"
                  />
                </label>
                <button type="submit" disabled={workingCycleId === emptyZoneId} className="dc-btn-primary">
                  {workingCycleId === emptyZoneId ? "Saving..." : "Create Pickup Schedule"}
                </button>
              </form>
            ) : !isRouteBoundDriver ? (
              <p className="mt-5 rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                Only Organization Admins and Coordinators can create the first pickup schedule.
              </p>
            ) : null}
          </article>
        )}
      </section>

      {message ? <p className="rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-sm text-[var(--dc-gray-800)] shadow-sm">{message}</p> : null}
    </div>
  );
}
