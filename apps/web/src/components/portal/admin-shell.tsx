"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

function NavIcon({
  kind,
}: {
  kind: "overview" | "pickups" | "logistics" | "people" | "zones" | "growth" | "communication" | "billing" | "customer";
}) {
  const base = "h-4 w-4";
  switch (kind) {
    case "overview":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <rect x="3" y="3" width="8" height="8" rx="1.5" strokeWidth="2" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" strokeWidth="2" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" strokeWidth="2" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" strokeWidth="2" />
        </svg>
      );
    case "pickups":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <rect x="3" y="4" width="18" height="17" rx="2" strokeWidth="2" />
          <path d="M8 2v4M16 2v4M3 9h18" strokeWidth="2" />
        </svg>
      );
    case "logistics":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M3 6h13v9H3zM16 9h3l2 2v4h-5" strokeWidth="2" />
          <circle cx="7" cy="18" r="2" strokeWidth="2" />
          <circle cx="18" cy="18" r="2" strokeWidth="2" />
        </svg>
      );
    case "people":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeWidth="2" />
          <circle cx="9" cy="7" r="4" strokeWidth="2" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" />
        </svg>
      );
    case "zones":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M12 22s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.5" strokeWidth="2" />
        </svg>
      );
    case "growth":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M4 19V5M10 19V9M16 19V12M22 19v-4" strokeWidth="2" />
        </svg>
      );
    case "communication":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" strokeWidth="2" />
        </svg>
      );
    case "billing":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <rect x="2.5" y="5" width="19" height="14" rx="2" strokeWidth="2" />
          <path d="M2.5 10h19M7 15h3M13 15h4" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M3 7h18M3 12h18M3 17h18" strokeWidth="2" />
        </svg>
      );
  }
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const storedTheme = window.localStorage.getItem("dc-admin-theme");
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const activeTab = searchParams.get("tab") || "overview";
  const navItems = [
    { href: "/admin?tab=overview", tab: "overview", label: "Overview", icon: "overview" as const },
    { href: "/admin?tab=pickups", tab: "pickups", label: "Pickups", icon: "pickups" as const },
    { href: "/admin?tab=logistics", tab: "logistics", label: "Logistics", icon: "logistics" as const },
    { href: "/admin?tab=people", tab: "people", label: "People", icon: "people" as const },
    { href: "/admin?tab=zones", tab: "zones", label: "Zones", icon: "zones" as const },
    { href: "/admin?tab=billing", tab: "billing", label: "Billing", icon: "billing" as const },
    { href: "/admin?tab=growth", tab: "growth", label: "Growth", icon: "growth" as const },
    { href: "/admin?tab=communication", tab: "communication", label: "Communication", icon: "communication" as const },
  ];

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    window.localStorage.setItem("dc-admin-theme", theme);
  }, [theme]);

  return (
    <div
      className={`min-h-screen overflow-x-clip ${theme === "light" ? "admin-theme-light" : "admin-theme-dark"}`}
      style={{
        background: "var(--admin-bg)",
        color: "var(--admin-text)",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
        <div
          className="fixed inset-x-0 top-0 z-40 border-b px-4 py-3 backdrop-blur md:hidden"
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-topbar)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">DonateCrate</p>
              <p className="text-base font-bold">Operations Admin</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                className="rounded-full border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
              >
                {theme === "dark" ? "Day" : "Night"}
              </button>
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="rounded-md border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? "Close" : "Menu"}
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu overlay"
          />
        ) : null}
        <aside
          className={`fixed left-0 top-0 z-40 h-screen w-[86vw] max-w-[340px] overflow-y-auto border-r backdrop-blur transition-all duration-200 md:sticky md:z-auto md:w-[300px] md:max-w-none ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${collapsed ? "md:w-[84px]" : ""
          }`}
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-sidebar)", color: "var(--admin-sidebar-text)" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: "var(--admin-border)" }}>
            <div className={collapsed ? "hidden" : "block"}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">DonateCrate</p>
              <p className="font-bold">Operations Admin</p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                  className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
                >
                  {theme === "dark" ? "Day mode" : "Night mode"}
                </button>
              ) : null}
              <button
                onClick={() => setCollapsed((prev) => !prev)}
                className="hidden rounded-md border px-2 py-1 text-xs font-semibold md:inline-flex"
                style={{ borderColor: "var(--admin-border-strong)" }}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? ">" : "<"}
              </button>
            </div>
          </div>

          <nav className="space-y-2 px-3 py-4">
            {navItems.map((item) => {
              const isActive = pathname === "/admin" && activeTab === item.tab;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-[var(--dc-orange)] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
                      : "border hover:bg-white/10"
                  }`}
                  style={
                    isActive
                      ? undefined
                      : { borderColor: "var(--admin-border)", color: "var(--admin-sidebar-text)" }
                  }
                  aria-label={item.label}
                  title={item.label}
                >
                  <NavIcon kind={item.icon} />
                  {!collapsed ? item.label : null}
                </Link>
              );
            })}
            <Link
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-white/10"
              style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
              aria-label="Customer View"
              title="Customer View"
            >
              <NavIcon kind="customer" />
              {!collapsed ? "Customer View" : null}
            </Link>
          </nav>

          {!collapsed ? (
            <div className="px-3">
              <details className="rounded-xl border p-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} open>
                <summary className="cursor-pointer text-sm font-semibold">How to run ops here</summary>
                <ul className="mt-2 space-y-2 text-xs" style={{ color: "var(--admin-muted)" }}>
                  <li>1. People: view all users, filter by zone, and assign roles.</li>
                  <li>2. Zones: manage one zone at a time and inspect zone members.</li>
                  <li>3. Pickups: schedule one-time or recurring cycles, then dispatch routes.</li>
                </ul>
              </details>
            </div>
          ) : null}

          <div className="mt-4 px-3">
            <SignOutButton tone={theme === "dark" ? "dark" : "light"} />
          </div>
        </aside>

        <main className="flex-1 overflow-x-clip px-4 pb-6 pt-20 md:px-6 md:pt-6">{children}</main>
      </div>
    </div>
  );
}
