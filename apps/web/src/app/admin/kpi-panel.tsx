"use client";

import { useEffect, useState } from "react";

type KpiData = {
  activeSubscribers: number;
  waitlistCount: number;
  routeCount: number;
  pickupSuccessCount: number;
};

export function KpiPanel() {
  const [data, setData] = useState<KpiData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/kpi/summary")
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) {
          setError(json.error || "Unable to load KPIs");
          return;
        }
        setData(json);
      })
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm" style={{ color: "var(--admin-muted)" }}>Loading KPI summary...</p>;
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <article className="rounded-2xl border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>Active Subscribers</p>
        <p className="mt-1 text-2xl font-bold">{data.activeSubscribers}</p>
      </article>
      <article className="rounded-2xl border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>Waitlist</p>
        <p className="mt-1 text-2xl font-bold">{data.waitlistCount}</p>
      </article>
      <article className="rounded-2xl border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>Routes</p>
        <p className="mt-1 text-2xl font-bold">{data.routeCount}</p>
      </article>
      <article className="rounded-2xl border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>Picked Up Stops</p>
        <p className="mt-1 text-2xl font-bold">{data.pickupSuccessCount}</p>
      </article>
    </section>
  );
}
