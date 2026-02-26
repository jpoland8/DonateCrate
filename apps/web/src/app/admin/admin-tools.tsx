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
    <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
      <h2 className="text-2xl font-bold">Admin Tools</h2>
      <p className="mt-2 text-white/80">
        Create monthly pickup cycles. Active subscribers are automatically marked as pickup requested by default.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <select
          value={zoneCode}
          onChange={(event) => setZoneCode(event.target.value)}
          className="h-11 rounded-lg border border-white/25 bg-black/40 px-3 text-white"
        >
          {zoneOptions.map((zone) => (
            <option key={zone.id} value={zone.code}>
              {zone.name} ({zone.code})
            </option>
          ))}
        </select>
        <input
          type="date"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="h-11 rounded-lg border border-white/25 bg-black/40 px-3 text-white"
        />
        <input
          type="date"
          value={pickupDate}
          onChange={(event) => setPickupDate(event.target.value)}
          className="h-11 rounded-lg border border-white/25 bg-black/40 px-3 text-white"
        />
        <input
          type="datetime-local"
          value={cutoff.slice(0, 16)}
          onChange={(event) => setCutoff(new Date(event.target.value).toISOString())}
          className="h-11 rounded-lg border border-white/25 bg-black/40 px-3 text-white"
        />
      </div>
      <button
        onClick={createCycle}
        disabled={status === "saving"}
        className="mt-4 rounded-xl bg-[var(--dc-orange)] px-4 py-2 font-semibold text-white disabled:opacity-70"
      >
        {status === "saving" ? "Creating..." : "Create Pickup Cycle"}
      </button>
      {message ? (
        <p className={`mt-3 text-sm ${status === "error" ? "text-red-300" : "text-green-300"}`}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
