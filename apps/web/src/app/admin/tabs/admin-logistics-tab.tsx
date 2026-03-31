"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminData, AdminRoute, LogisticsRoutePreview } from "../admin-types";
import { formatDate, formatPickupRequestLabel, formatRouteStatusLabel } from "../admin-utils";

// ---------------------------------------------------------------------------
// Local helpers (same logic as admin-workspace.tsx top-level helpers)
// ---------------------------------------------------------------------------

function getCycleDisplayLabel(cycle: AdminData["pickupCycles"][number]) {
  const zoneMeta = Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones;
  return `${zoneMeta?.name || "Zone"} | ${formatDate(cycle.pickup_date)}`;
}

function getRouteDisplayLabel(route: AdminRoute | null | undefined) {
  if (!route) return "No route built yet";
  const zoneMeta = Array.isArray(route.service_zones) ? route.service_zones[0] : route.service_zones;
  const pickupCycle = Array.isArray(route.pickup_cycles) ? route.pickup_cycles[0] : route.pickup_cycles;
  return `${zoneMeta?.name || "Zone"} | ${pickupCycle?.pickup_date ? formatDate(pickupCycle.pickup_date) : "No date"}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AdminLogisticsTabProps = {
  data: AdminData;
  /** Callback fired to surface messages to the parent status bar. */
  onMessage: (message: string) => void;
  /** Reload all admin data after a write. */
  loadAll: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminLogisticsTab({ data, onMessage, loadAll }: AdminLogisticsTabProps) {
  const logisticsPreviewAbortRef = useRef<AbortController | null>(null);

  // --- local state ---
  const [selectedZoneCode, setSelectedZoneCode] = useState(data.zones[0]?.code ?? "");
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedLogisticsRouteId, setSelectedLogisticsRouteId] = useState("");
  const [logisticsMessage, setLogisticsMessage] = useState("");
  const [logisticsRoutePreview, setLogisticsRoutePreview] = useState<LogisticsRoutePreview | null>(null);
  const [mapLoadError, setMapLoadError] = useState(false);

  // --- derived data ---
  const driverOptions = useMemo(() => data.drivers ?? [], [data]);
  const routeOptions = useMemo(() => data.routes ?? [], [data]);

  const logisticsCycles = useMemo(() => {
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
    if (!selectedCycleId) {
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
    if (!selectedCycleId) return [];
    const zone = data.zones.find((z) => z.code === selectedZoneCode);
    return data.routes.filter(
      (route) => route.pickup_cycle_id === selectedCycleId && (!zone || route.zone_id === zone.id),
    );
  }, [data, selectedCycleId, selectedZoneCode]);

  const selectedLogisticsRoute = useMemo(() => {
    if (selectedLogisticsRouteId) {
      return routeOptions.find((route) => route.id === selectedLogisticsRouteId) ?? null;
    }
    return selectedCycleRoutes[0] ?? null;
  }, [routeOptions, selectedLogisticsRouteId, selectedCycleRoutes]);

  // Auto-select route when cycle routes change
  useEffect(() => {
    const nextRouteId = selectedCycleRoutes[0]?.id ?? "";
    setSelectedLogisticsRouteId(nextRouteId);
    if (nextRouteId) {
      loadLogisticsRoutePreview(nextRouteId);
    } else {
      setLogisticsRoutePreview(null);
      setMapLoadError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCycleRoutes]);

  // --- handlers ---
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
        onMessage(json.error || "Could not load route preview");
        return;
      }
      setMapLoadError(false);
      setLogisticsRoutePreview(json);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      const nextMessage = error instanceof Error ? error.message : "Could not load route preview";
      setLogisticsMessage(nextMessage);
      onMessage(nextMessage);
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
      return onMessage(json.error || "Could not build route");
    }
    setSelectedLogisticsRouteId(json.routeId);
    setMapLoadError(false);
    const nextMessage = `Route ${json.regenerated ? "refreshed" : "built"} with ${json.stopCount} stops${json.optimized ? " (Google optimized)" : ""}${
        json.missingCoordinates ? `, ${json.missingCoordinates} without coordinates` : ""
      }.`;
    setLogisticsMessage(nextMessage);
    onMessage(nextMessage);
    await loadAll();
  }

  async function assignDriver() {
    const routeId = selectedLogisticsRoute?.id;
    if (!routeId || !selectedDriverId) {
      setLogisticsMessage("Build the route first, then choose a driver.");
      return onMessage("Build the route first, then choose a driver.");
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
      return onMessage(json.error || "Could not assign driver");
    }
    const assignedDriver = driverOptions.find((driver) => driver.id === selectedDriverId);
    const successMessage = `Driver assigned: ${assignedDriver?.employee_id || "Selected driver"} -> ${getRouteDisplayLabel(selectedLogisticsRoute)}.`;
    setLogisticsMessage(successMessage);
    onMessage(successMessage);
    await loadAll();
  }

  // --- render ---
  return (
    <section className="space-y-4">
      <article className="rounded-3xl border border-admin bg-admin-surface p-6">
        <h3 className="text-xl font-bold">Dispatch Workflow</h3>
        <p className="mt-1 text-sm text-admin-muted">
          A pickup cycle is the service day for one zone. A route is the ordered stop list for that cycle. Build or
          refresh the route first, then assign the driver once the stop order looks right.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Step 1</p>
            <p className="mt-2 text-lg font-bold">Select Cycle</p>
            <p className="mt-1 text-sm text-admin-muted">Choose the zone and pickup day you are dispatching.</p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Step 2</p>
            <p className="mt-2 text-lg font-bold">Build Route</p>
            <p className="mt-1 text-sm text-admin-muted">This creates or refreshes the one route for that zone and cycle.</p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Step 3</p>
            <p className="mt-2 text-lg font-bold">Assign Driver</p>
            <p className="mt-1 text-sm text-admin-muted">Assign after the stop list exists so the driver gets a real route.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <select value={selectedZoneCode} onChange={(event) => setSelectedZoneCode(event.target.value)} className="h-10 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm sm:w-auto">
            <option value="">Select pickup area</option>
            {data.zones.map((zone) => (
              <option key={zone.id} value={zone.code}>{zone.name} ({zone.code})</option>
            ))}
          </select>
          <select value={selectedCycleId} onChange={(event) => setSelectedCycleId(event.target.value)} className="h-10 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm sm:w-auto">
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
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Ready Households</p>
            <p className="mt-2 text-2xl font-bold">{selectedCycleRequestSummary.requested}</p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Skipped</p>
            <p className="mt-2 text-2xl font-bold">{selectedCycleRequestSummary.skipped}</p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Exceptions</p>
            <p className="mt-2 text-2xl font-bold">{selectedCycleRequestSummary.exceptions}</p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Existing Route</p>
            <p className="mt-2 text-2xl font-bold">{selectedCycleRoutes.length > 0 ? "Yes" : "No"}</p>
          </div>
        </div>
        {selectedCycleMeta ? (
          <div className="mt-4 rounded-2xl border border-admin bg-admin-panel p-4 text-sm text-admin-muted">
            <p className="font-semibold text-admin">Selected cycle</p>
            <p className="mt-1">
              Pickup date: {formatDate(selectedCycleMeta.pickup_date)} &mdash; {selectedCycleRequestSummary.total} total request record{selectedCycleRequestSummary.total === 1 ? "" : "s"}.
            </p>
            <p className="mt-1">
              Build the route once you are comfortable locking the stop list for dispatch.
            </p>
            <p className="mt-1">
              Current route status: {selectedLogisticsRoute ? formatRouteStatusLabel(selectedLogisticsRoute.status) : "No route built yet"}.
            </p>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Dispatch checklist</p>
            <p className="mt-2 text-sm text-admin-muted">
              Confirm that skipped and exception households are intentional before you rebuild the route.
            </p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">One route rule</p>
            <p className="mt-2 text-sm text-admin-muted">
              Each zone and cycle should have one live route. Rebuild refreshes that route instead of creating duplicates.
            </p>
          </div>
          <div className="rounded-2xl border border-admin bg-admin-panel p-4">
            <p className="text-xs uppercase tracking-wide text-admin-soft">Driver timing</p>
            <p className="mt-2 text-sm text-admin-muted">
              Assign the driver only after stops exist so the driver console opens with a real ordered run sheet.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="min-w-[280px] rounded-lg border border-admin-strong bg-admin-panel px-4 py-2 text-sm text-admin-muted">
            {selectedLogisticsRoute
              ? `Current cycle route: ${getRouteDisplayLabel(selectedLogisticsRoute)} | ${formatRouteStatusLabel(selectedLogisticsRoute.status)} | ${selectedLogisticsRoute.stopCount ?? 0} stops`
              : "Current cycle route: not built yet"}
          </div>
          <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} className="h-10 w-full rounded-lg border border-admin-strong bg-admin-surface-strong px-3 text-sm sm:w-auto">
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
          <div className="mt-3 rounded-xl border border-admin bg-admin-panel px-4 py-3 text-sm text-admin-muted">
            {logisticsMessage}
          </div>
        ) : null}
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
  );
}
