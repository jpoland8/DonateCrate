"use client";

import { useState } from "react";

type DriverStop = {
  id: string;
  stopOrder: number;
  stopStatus: string;
  memberName: string;
  email: string;
  addressLine: string;
  requestNote: string | null;
};

function formatStopStatus(status: string) {
  return status.replaceAll("_", " ");
}

export function DriverStopActions({
  routeId,
  initialRouteStatus,
  stops,
}: {
  routeId: string;
  initialRouteStatus: string;
  stops: DriverStop[];
}) {
  const [items, setItems] = useState(stops);
  const [routeStatus, setRouteStatus] = useState(initialRouteStatus);
  const [workingStopId, setWorkingStopId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function updateStop(stopId: string, status: "picked_up" | "not_ready" | "no_access" | "rescheduled") {
    setWorkingStopId(stopId);
    setMessage("");
    try {
      const response = await fetch(`/api/driver/stops/${stopId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not update stop");
        return;
      }

      setItems((prev) =>
        prev.map((item) => (item.id === stopId ? { ...item, stopStatus: json.stop?.status ?? status } : item)),
      );
      setRouteStatus(json.routeStatus ?? routeStatus);
      setMessage("Stop updated.");
    } catch {
      setMessage("Could not update stop right now.");
    } finally {
      setWorkingStopId(null);
    }
  }

  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Assigned Stops</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>
            Route {routeId.slice(0, 8)} is currently {formatStopStatus(routeStatus)}.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((stop) => (
          <article
            key={stop.id}
            className="rounded-2xl border p-4"
            style={{ borderColor: "var(--admin-border)", background: "var(--admin-elevated)" }}
          >
            <p className="text-sm font-semibold">
              Stop {stop.stopOrder}: {stop.memberName}
            </p>
            <p className="mt-1 text-xs break-all" style={{ color: "var(--admin-muted)" }}>
              {stop.email}
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>
              {stop.addressLine}
            </p>
            <p className="mt-2 text-xs uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>
              Current status: {formatStopStatus(stop.stopStatus)}
            </p>
            {stop.requestNote ? (
              <p className="mt-1 text-xs text-amber-300">Ops note: {stop.requestNote}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={workingStopId === stop.id}
                onClick={() => updateStop(stop.id, "picked_up")}
                className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                Picked Up
              </button>
              <button
                type="button"
                disabled={workingStopId === stop.id}
                onClick={() => updateStop(stop.id, "not_ready")}
                className="rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-60"
              >
                Not Ready
              </button>
              <button
                type="button"
                disabled={workingStopId === stop.id}
                onClick={() => updateStop(stop.id, "no_access")}
                className="rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                No Access
              </button>
              <button
                type="button"
                disabled={workingStopId === stop.id}
                onClick={() => updateStop(stop.id, "rescheduled")}
                className="rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-60"
                style={{ borderColor: "var(--admin-border-strong)" }}
              >
                Rescheduled
              </button>
            </div>
          </article>
        ))}
        {items.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--admin-muted)" }}>
            No stops assigned on this route yet.
          </p>
        ) : null}
      </div>
      {message ? (
        <p className="mt-3 text-sm" style={{ color: "var(--admin-muted)" }}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
