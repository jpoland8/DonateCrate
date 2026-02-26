"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const activeTab = searchParams.get("tab") || "overview";
  const navItems = [
    { href: "/admin?tab=overview", tab: "overview", label: "Overview", short: "Ovr" },
    { href: "/admin?tab=pickups", tab: "pickups", label: "Pickups", short: "Pup" },
    { href: "/admin?tab=people", tab: "people", label: "People", short: "Ppl" },
    { href: "/admin?tab=zones", tab: "zones", label: "Zones", short: "Zns" },
    { href: "/admin?tab=growth", tab: "growth", label: "Growth", short: "Grw" },
  ];

  return (
    <div className="min-h-screen bg-[var(--dc-black)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
        <aside
          className={`sticky top-0 h-screen border-r border-white/15 bg-black/60 transition-all duration-200 ${
            collapsed ? "w-[84px]" : "w-[300px]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/15 px-4 py-4">
            <div className={collapsed ? "hidden" : "block"}>
              <p className="text-sm font-semibold text-white/70">DonateCrate</p>
              <p className="font-bold">Admin Console</p>
            </div>
            <button
              onClick={() => setCollapsed((prev) => !prev)}
              className="rounded-md border border-white/30 px-2 py-1 text-xs font-semibold hover:bg-white/10"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? ">>" : "<<"}
            </button>
          </div>

          <nav className="space-y-2 px-3 py-4">
            {navItems.map((item) => {
              const isActive = pathname === "/admin" && activeTab === item.tab;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-[var(--dc-orange)] text-white"
                      : "border border-white/20 text-white/90 hover:bg-white/10"
                  }`}
                >
                  {collapsed ? item.short : item.label}
                </Link>
              );
            })}
            <Link
              href="/app"
              className="mt-2 block rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              {collapsed ? "Cust" : "Customer View"}
            </Link>
          </nav>

          {!collapsed ? (
            <div className="px-3">
              <details className="rounded-lg border border-white/15 bg-white/5 p-3" open>
                <summary className="cursor-pointer text-sm font-semibold">How this portal works</summary>
                <ul className="mt-2 space-y-2 text-xs text-white/75">
                  <li>1. Monitor KPIs and zone health at the top of Operations.</li>
                  <li>2. Manage users, subscriptions, routes, and pickup cycles.</li>
                  <li>3. Assign drivers and update request statuses as operations progress.</li>
                </ul>
              </details>
            </div>
          ) : null}

          <div className="mt-4 px-3">
            <SignOutButton tone="dark" />
          </div>
        </aside>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
