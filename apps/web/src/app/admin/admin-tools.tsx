"use client";

import { useEffect, useState } from "react";

export function AdminTools() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 10));
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().slice(0, 10));
  const [cutoff, setCutoff] = useState(new Date().toISOString());
  const [zoneCode, setZoneCode] = useState("knoxville-37922");
  const [zoneOptions, setZoneOptions] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "success">("idle");

  useEffect(() => {
    fetch("/api/admin/zones")
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) return;
        const zones = json.zones ?? [];
        setZoneOptions(zones);
        if (zones.length > 0) setZoneCode(zones[0].code);
      })
      .catch(() => {
        setZoneOptions([]);
      });
  }, []);

  async function createCycle() {
    setStatus("saving");
    setMessage("");
    const response = await fetch("/api/admin/pickup-cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zoneCode,
        cycleMonth: month,
        pickupDate,
        requestCutoffAt: cutoff,
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(json.error || "Failed to create cycle");
      return;
    }
    setStatus("success");
    setMessage("Pickup cycle created.");
  }

  return (
    <section className="rounded-[var(--radius-xl)] border p-6" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-strong)" }}>
      <h2 className="text-2xl font-bold">Admin Tools</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>
        Create monthly pickup cycles. Active subscribers are automatically marked as pickup requested by default.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>Zone</label>
          <select
            value={zoneCode}
            onChange={(event) => setZoneCode(event.target.value)}
            className="dc-input-admin w-full"
          >
            {zoneOptions.map((zone) => (
              <option key={zone.id} value={zone.code}>
                {zone.name} ({zone.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>Cycle Month</label>
          <input
            type="date"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="dc-input-admin w-full"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>Pickup Date</label>
          <input
            type="date"
            value={pickupDate}
            onChange={(event) => setPickupDate(event.target.value)}
            className="dc-input-admin w-full"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>Response Cutoff</label>
          <input
            type="datetime-local"
            value={cutoff.slice(0, 16)}
            onChange={(event) => setCutoff(new Date(event.target.value).toISOString())}
            className="dc-input-admin w-full"
          />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={createCycle}
          disabled={status === "saving"}
          className="dc-btn-primary"
        >
          {status === "saving" ? "Creating..." : "Create Pickup Cycle"}
        </button>
        {message ? (
          <p className={`text-sm font-medium ${status === "error" ? "text-red-400" : "text-emerald-400"}`}>
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
