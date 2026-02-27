"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

function NavIcon({ kind }: { kind: "overview" | "pickups" | "referrals" | "settings" | "profile" }) {
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
    case "referrals":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M7 7h6a3 3 0 0 1 0 6H7a3 3 0 1 1 0-6Zm4 4h6a3 3 0 1 1 0 6h-6" strokeWidth="2" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" strokeWidth="2" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeWidth="1.5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <circle cx="12" cy="8" r="4" strokeWidth="2" />
          <path d="M4 20a8 8 0 0 1 16 0" strokeWidth="2" />
        </svg>
      );
  }
}

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeTab = searchParams.get("tab") || "overview";
  const navItems = [
    { href: "/app?tab=overview", tab: "overview", label: "Overview", icon: "overview" as const },
    { href: "/app?tab=pickups", tab: "pickups", label: "Pickups", icon: "pickups" as const },
    { href: "/app?tab=referrals", tab: "referrals", label: "Referrals", icon: "referrals" as const },
    { href: "/app?tab=settings", tab: "settings", label: "Settings", icon: "settings" as const },
    { href: "/app/profile", label: "Profile", icon: "profile" as const },
  ];

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen overflow-x-clip bg-[linear-gradient(160deg,#f5f5f6_0%,#ececee_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
        <div className="fixed inset-x-0 top-0 z-40 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">DonateCrate</p>
              <p className="text-base font-bold">Customer Portal</p>
            </div>
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="rounded-md border border-black/20 px-3 py-2 text-xs font-semibold"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {mobileMenuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu overlay"
          />
        ) : null}
        <aside
          className={`fixed left-0 top-0 z-40 h-screen w-[86vw] max-w-[320px] overflow-y-auto border-r border-black/10 bg-white/95 backdrop-blur transition-all duration-200 md:sticky md:z-auto md:w-[280px] md:max-w-none ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${collapsed ? "md:w-[84px]" : ""}`}
        >
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
            <div className={collapsed ? "hidden" : "block"}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">DonateCrate</p>
              <p className="font-bold">Customer Portal</p>
            </div>
            <button
              onClick={() => setCollapsed((prev) => !prev)}
              className="hidden rounded-md border border-black/20 px-2 py-1 text-xs font-semibold hover:bg-[var(--dc-gray-100)] md:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? ">" : "<"}
            </button>
          </div>
          <nav className="space-y-2 px-3 py-4">
            {navItems.map((item) => {
              const isActive =
                item.href === "/app/profile"
                  ? pathname === "/app/profile"
                  : pathname === "/app" && activeTab === item.tab;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-[var(--dc-orange)] text-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
                      : "border border-black/15 text-[var(--dc-gray-900)] hover:bg-[var(--dc-gray-100)]"
                  }`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <NavIcon kind={item.icon} />
                  {!collapsed ? item.label : null}
                </Link>
              );
            })}
          </nav>
          {!collapsed ? (
            <div className="px-3">
              <details className="rounded-xl border border-black/10 bg-[var(--dc-gray-100)] p-3" open>
                <summary className="cursor-pointer text-sm font-semibold">How to use your account</summary>
                <ul className="mt-2 space-y-2 text-xs text-[var(--dc-gray-700)]">
                  <li>1. Activate billing to unlock all account tools.</li>
                  <li>2. Set pickup readiness each month from the Pickups tab.</li>
                  <li>3. Manage profile, notifications, and referrals in one place.</li>
                </ul>
              </details>
            </div>
          ) : null}
          <div className="mt-4 px-3">
            <SignOutButton />
          </div>
        </aside>

        <main className="flex-1 overflow-x-clip px-4 pb-6 pt-20 md:px-6 md:pt-6">{children}</main>
      </div>
    </div>
  );
}
