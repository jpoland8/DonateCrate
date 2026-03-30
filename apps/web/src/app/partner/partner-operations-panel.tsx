"use client";

import { useEffect, useMemo, useState } from "react";
import { PickupWindowPicker } from "@/components/ui/pickup-window-picker";

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
  if (status === "not_ready") return "Bag not set out";
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
  const [editCycleWindowLabel, setEditCycleWindowLabel] = useState("");
  const [selectedDriverByCycleId, setSelectedDriverByCycleId] = useState<Record<string, string>>({});
  const [routePreviewLoadingId, setRoutePreviewLoadingId] = useState<string | null>(null);
  const [correctionOpenId, setCorrectionOpenId] = useState<string | null>(null);

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
  // Sync edit window label when selected cycle changes
  useEffect(() => {
    setEditCycleWindowLabel(selectedCycle?.pickupWindowLabel ?? "");
  }, [selectedCycle?.id]);
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

  async function updateHousehold(household: PickupHousehold, status: "picked_up" | "missed" | "not_ready" | "requested") {
    // Capture these synchronously before any awaits to avoid stale closure issues
    const cycleId = effectiveSelectedCycleId;
    const prevStatus = household.status;
    const prevNote = household.requestNote;

    const stopStatusForRoute =
      status === "picked_up" ? "picked_up"
      : status === "missed" ? "no_access"
      : status === "not_ready" ? "not_ready"
      : "scheduled";

    setWorkingItemId(household.stopId ?? household.pickupRequestId);
    setMessage("");

    // Optimistic update — move the stop immediately so the UI responds on tap
    setPickupState((prev) => ({
      ...prev,
      [cycleId ?? ""]: (prev[cycleId ?? ""] ?? []).map((item) =>
        item.pickupRequestId === household.pickupRequestId
          ? { ...item, status, requestNote: status === "missed" ? "Could not be retrieved" : null }
          : item,
      ),
    }));
    setRouteState((prev) =>
      prev.map((route) => ({
        ...route,
        stops: route.stops.map((stop) =>
          stop.id === household.stopId
            ? {
                ...stop,
                stopStatus: stopStatusForRoute,
                requestStatus:
                  status === "picked_up" ? "picked_up"
                  : status === "missed" ? "missed"
                  : status === "not_ready" ? "not_ready"
                  : "requested",
                requestNote:
                  status === "missed" ? "Driver marked stop as no access"
                  : status === "not_ready" ? "Driver marked bag not set out"
                  : null,
              }
            : stop,
        ),
      })),
    );

    try {
      if (household.stopId) {
        const apiStatus =
          status === "picked_up" ? "picked_up"
          : status === "missed" ? "no_access"
          : status === "not_ready" ? "not_ready"
          : "scheduled";
        const response = await fetch(`/api/driver/stops/${household.stopId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: apiStatus }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          // Revert optimistic updates on failure
          setPickupState((prev) => ({
            ...prev,
            [cycleId ?? ""]: (prev[cycleId ?? ""] ?? []).map((item) =>
              item.pickupRequestId === household.pickupRequestId
                ? { ...item, status: prevStatus, requestNote: prevNote }
                : item,
            ),
          }));
          setRouteState((prev) =>
            prev.map((route) => ({
              ...route,
              stops: route.stops.map((stop) =>
                stop.id === household.stopId
                  ? { ...stop, stopStatus: prevStatus, requestStatus: prevStatus, requestNote: prevNote }
                  : stop,
              ),
            })),
          );
          setCorrectionOpenId(null);
          setMessage(json.error || "Could not update pickup");
          return;
        }
        // Update route status from server response
        setRouteState((prev) =>
          prev.map((route) => ({
            ...route,
            status: route.pickupCycleId === cycleId ? json.routeStatus ?? route.status : route.status,
            stops: route.stops.map((stop) =>
              stop.id === household.stopId ? { ...stop, stopStatus: stopStatusForRoute } : stop,
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
          // Revert optimistic update on failure
          setPickupState((prev) => ({
            ...prev,
            [cycleId ?? ""]: (prev[cycleId ?? ""] ?? []).map((item) =>
              item.pickupRequestId === household.pickupRequestId
                ? { ...item, status: prevStatus, requestNote: prevNote }
                : item,
            ),
          }));
          setCorrectionOpenId(null);
          setMessage(json.error || "Could not update pickup");
          return;
        }
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
      const createdCycles = (json.pickupCycles ?? []).map((cycle: { id: string; zone_id: string; pickup_date: string; pickup_window_label: string | null }) => ({
        id: cycle.id,
        zoneId: cycle.zone_id,
        zoneName,
        pickupDate: cycle.pickup_date,
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
                  {/* Progress bar */}
                  {selectedHouseholds.length > 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--dc-gray-900)]">
                            {resolvedHouseholds.length} of {selectedHouseholds.length} stops marked
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--dc-gray-600)]">
                            {activeHouseholds.length === 0
                              ? "All stops complete — tap Finish Route below."
                              : `${activeHouseholds.length} remaining`}
                          </p>
                        </div>
                        <span className={`text-2xl font-bold tabular-nums ${activeHouseholds.length === 0 ? "text-emerald-600" : "text-[var(--dc-gray-800)]"}`}>
                          {Math.round((resolvedHouseholds.length / selectedHouseholds.length) * 100)}%
                        </span>
                      </div>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--dc-gray-100)]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${activeHouseholds.length === 0 ? "bg-emerald-500" : "bg-[var(--dc-orange)]"}`}
                          style={{ width: `${(resolvedHouseholds.length / selectedHouseholds.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Needs action */}
                  {activeHouseholds.length > 0 ? (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--dc-orange)]" aria-hidden />
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--dc-gray-600)]">
                          Needs action · {activeHouseholds.length}
                        </h4>
                      </div>
                      {activeHouseholds.map((household) => {
                        const isWorking = workingItemId === (household.stopId ?? household.pickupRequestId);
                        return (
                          <div key={household.pickupRequestId} className="overflow-hidden rounded-2xl border-2 border-[var(--dc-orange)]/25 bg-white shadow-sm">
                            <div className="flex items-start gap-3 border-b border-black/[0.06] px-4 py-3.5">
                              {household.stopOrder ? (
                                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--dc-orange)] text-xs font-bold text-white">
                                  {household.stopOrder}
                                </span>
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold leading-tight text-[var(--dc-gray-900)]">{household.memberName}</p>
                                <p className="mt-0.5 text-sm text-[var(--dc-gray-600)]">{household.addressLine}</p>
                                {household.requestNote ? (
                                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
                                    Note: {household.requestNote}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="space-y-2 p-3">
                              <button
                                type="button"
                                disabled={isWorking}
                                onClick={() => updateHousehold(household, "picked_up")}
                                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-4 text-base font-bold text-white shadow-sm transition-all active:scale-[0.98] hover:bg-emerald-600 disabled:opacity-50"
                              >
                                {isWorking ? (
                                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                  </svg>
                                )}
                                Picked Up
                              </button>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={isWorking}
                                  onClick={() => updateHousehold(household, "not_ready")}
                                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-3.5 text-sm font-semibold text-amber-900 transition-all active:scale-[0.98] hover:bg-amber-100 disabled:opacity-50"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                  </svg>
                                  Bag Not Set Out
                                </button>
                                <button
                                  type="button"
                                  disabled={isWorking}
                                  onClick={() => updateHousehold(household, "missed")}
                                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-3.5 text-sm font-semibold text-red-900 transition-all active:scale-[0.98] hover:bg-red-100 disabled:opacity-50"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                  </svg>
                                  Can&apos;t Retrieve
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  ) : null}

                  {/* Already marked */}
                  {resolvedHouseholds.length > 0 ? (
                    <section className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--dc-gray-600)]">
                          Marked · {resolvedHouseholds.length}
                        </h4>
                      </div>
                      <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/10 bg-white">
                        {resolvedHouseholds.map((household) => {
                          const itemId = household.stopId ?? household.pickupRequestId;
                          const isWorking = workingItemId === itemId;
                          const isOpen = correctionOpenId === itemId;
                          const statusCfg =
                            household.status === "picked_up"
                              ? { dot: "bg-emerald-500", label: "Picked up", cls: "text-emerald-700" }
                              : household.status === "not_ready"
                                ? { dot: "bg-amber-500", label: "Bag not set out", cls: "text-amber-700" }
                                : { dot: "bg-red-500", label: "Could not retrieve", cls: "text-red-700" };
                          return (
                            <div key={household.pickupRequestId}>
                              <div className="flex items-center gap-3 px-4 py-3.5">
                                {household.stopOrder ? (
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--dc-gray-200)] text-xs font-bold text-[var(--dc-gray-700)]">
                                    {household.stopOrder}
                                  </span>
                                ) : (
                                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusCfg.dot}`} aria-hidden />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-[var(--dc-gray-900)]">{household.memberName}</p>
                                  <p className={`text-xs font-medium ${statusCfg.cls}`}>{statusCfg.label}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setCorrectionOpenId((prev) => (prev === itemId ? null : itemId))}
                                  className="shrink-0 cursor-pointer rounded-lg border border-black/10 bg-[var(--dc-gray-50)] px-3 py-1.5 text-xs font-semibold text-[var(--dc-gray-700)] transition-colors hover:bg-[var(--dc-gray-100)]"
                                >
                                  {isOpen ? "Close" : "Change"}
                                </button>
                              </div>
                              {isOpen ? (
                                <div className="space-y-2 border-t border-black/[0.06] bg-[var(--dc-gray-50)] p-3">
                                  <button
                                    type="button"
                                    disabled={isWorking}
                                    onClick={() => { void updateHousehold(household, "picked_up"); setCorrectionOpenId(null); }}
                                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-600 disabled:opacity-50"
                                  >
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                                    Picked Up
                                  </button>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      disabled={isWorking}
                                      onClick={() => { void updateHousehold(household, "not_ready"); setCorrectionOpenId(null); }}
                                      className="flex cursor-pointer items-center justify-center gap-1 rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 transition-all hover:bg-amber-100 disabled:opacity-50"
                                    >
                                      Bag Not Set Out
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isWorking}
                                      onClick={() => { void updateHousehold(household, "missed"); setCorrectionOpenId(null); }}
                                      className="flex cursor-pointer items-center justify-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-900 transition-all hover:bg-red-100 disabled:opacity-50"
                                    >
                                      Can&apos;t Retrieve
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isWorking}
                                    onClick={() => { void updateHousehold(household, "requested"); setCorrectionOpenId(null); }}
                                    className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold text-[var(--dc-gray-700)] transition-colors hover:bg-[var(--dc-gray-50)] disabled:opacity-50"
                                  >
                                    Move back to Needs Action
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {selectedHouseholds.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-black/15 bg-[var(--dc-gray-100)] px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                      No donors are attached to this pickup day yet.
                    </p>
                  ) : null}

                  {/* Finish Route */}
                  {selectedRoute ? (
                    <div className={`rounded-2xl border-2 p-4 transition-all ${
                      selectedRoute.status === "completed"
                        ? "border-emerald-200 bg-emerald-50"
                        : activeHouseholds.length === 0
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-black/10 bg-[var(--dc-gray-50)]"
                    }`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-[var(--dc-gray-900)]">
                            {selectedRoute.status === "completed" ? "✓ Route complete" : "Finish route"}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--dc-gray-700)]">
                            {selectedRoute.status === "completed"
                              ? `All ${resolvedHouseholds.length} stops finalized.`
                              : activeHouseholds.length > 0
                                ? `${activeHouseholds.length} stop${activeHouseholds.length !== 1 ? "s" : ""} still need${activeHouseholds.length === 1 ? "s" : ""} to be marked first.`
                                : "All stops marked — ready to close out the route."}
                          </p>
                          {assignedDriver ? (
                            <p className="mt-1 text-xs text-[var(--dc-gray-600)]">Driver: {assignedDriver.name}</p>
                          ) : null}
                        </div>
                        {selectedRoute.status !== "completed" ? (
                          <button
                            type="button"
                            disabled={workingCycleId === selectedRoute.id || activeHouseholds.length > 0}
                            onClick={() => finishRoute(selectedRoute.id)}
                            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                          >
                            {workingCycleId === selectedRoute.id ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                              </svg>
                            )}
                            {workingCycleId === selectedRoute.id ? "Finishing..." : "Finish Route"}
                          </button>
                        ) : null}
                      </div>
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
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-[var(--dc-gray-700)]">
                  Pickup date
                  <input name="pickupDate" type="date" defaultValue={selectedCycle.pickupDate} disabled={!selectedCycle.overrideAllowed} className="dc-input mt-1 w-full disabled:opacity-50" />
                </label>
                <PickupWindowPicker
                  label="Pickup window"
                  name="pickupWindowLabel"
                  value={editCycleWindowLabel}
                  onChange={setEditCycleWindowLabel}
                  disabled={!selectedCycle.overrideAllowed}
                  variant="partner"
                />
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
                <div className="md:col-span-2">
                  <PickupWindowPicker
                    label="Default pickup window"
                    name="pickupWindowLabel"
                    value={editCycleWindowLabel}
                    onChange={setEditCycleWindowLabel}
                    disabled={!selectedCycle.overrideAllowed}
                    variant="partner"
                  />
                </div>
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
                <div className="md:col-span-2">
                  <PickupWindowPicker
                    label="Default pickup window"
                    name="pickupWindowLabel"
                    value={emptyPickupWindowLabel}
                    onChange={setEmptyPickupWindowLabel}
                    variant="partner"
                  />
                </div>
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
