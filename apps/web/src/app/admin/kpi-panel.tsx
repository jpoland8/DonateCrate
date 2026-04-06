"use client";

import { useEffect, useState } from "react";

type KpiData = {
  activeSubscribers: number;
  waitlistCount: number;
  routeCount: number;
  pickupSuccessCount: number;
};

function KpiIcon({ kind }: { kind: "subscribers" | "waitlist" | "routes" | "pickups" }) {
  const base = "h-5 w-5";
  switch (kind) {
    case "subscribers":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeWidth="2" />
          <circle cx="9" cy="7" r="4" strokeWidth="2" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" />
        </svg>
      );
    case "waitlist":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "routes":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M3 6h13v9H3zM16 9h3l2 2v4h-5" strokeWidth="2" />
          <circle cx="7" cy="18" r="2" strokeWidth="2" />
          <circle cx="18" cy="18" r="2" strokeWidth="2" />
        </svg>
      );
    case "pickups":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M9 11l3 3 8-8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeWidth="2" />
        </svg>
      );
  }
}

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
    return (
      <div className="dc-toast dc-toast-error">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dc-stat-admin">
            <div className="dc-skeleton h-3 w-24 mb-3" />
            <div className="dc-skeleton h-7 w-16" />
          </div>
        ))}
      </section>
    );
  }

  const kpis = [
    { label: "Active Subscribers", value: data.activeSubscribers, icon: "subscribers" as const, accent: "#10b981", href: "/admin?tab=people" },
    { label: "Waitlist", value: data.waitlistCount, icon: "waitlist" as const, accent: "#f59e0b", href: "/admin?tab=growth" },
    { label: "Routes", value: data.routeCount, icon: "routes" as const, accent: "#6366f1", href: "/admin?tab=logistics" },
    { label: "Picked Up Stops", value: data.pickupSuccessCount, icon: "pickups" as const, accent: "#ff6a00", href: "/admin?tab=pickups" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 dc-stagger">
      {kpis.map((kpi) => (
        <a key={kpi.label} href={kpi.href} className="dc-stat-admin block transition-opacity hover:opacity-80" style={{ borderLeftWidth: "3px", borderLeftColor: kpi.accent }}>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--admin-muted)" }}>{kpi.label}</p>
            <span className="rounded-lg p-1.5" style={{ background: "var(--admin-surface-strong)" }}>
              <KpiIcon kind={kpi.icon} />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold">{kpi.value}</p>
        </a>
      ))}
    </section>
  );
}
