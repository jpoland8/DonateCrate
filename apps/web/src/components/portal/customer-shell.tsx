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
  const rawTab = searchParams.get("tab") || "home";
  const activeTab =
    rawTab === "overview"
      ? "home"
      : rawTab === "pickups"
        ? "pickup"
        : rawTab === "referrals"
          ? "rewards"
          : rawTab === "settings"
            ? "account"
            : rawTab;
  const navItems = [
    { href: "/app?tab=home", tab: "home", label: "Home", icon: "overview" as const },
    { href: "/app?tab=pickup", tab: "pickup", label: "Pickup", icon: "pickups" as const },
    { href: "/app?tab=rewards", tab: "rewards", label: "Rewards", icon: "referrals" as const },
    { href: "/app?tab=account", tab: "account", label: "Account", icon: "settings" as const },
    { href: "/app/profile", label: "Profile", icon: "profile" as const },
  ];
  const activeLabel = navItems.find((item) =>
    item.href === "/app/profile" ? pathname === "/app/profile" : pathname === "/app" && activeTab === item.tab,
  )?.label ?? "Overview";
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top_left,rgba(255,106,0,0.18)_0%,transparent_24%),radial-gradient(circle_at_bottom_right,rgba(17,24,39,0.08)_0%,transparent_26%),linear-gradient(160deg,#f6f3ef_0%,#ebe6df_48%,#e6e0d8_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
        {/* Mobile topbar */}
        <div className="fixed inset-x-0 top-0 z-40 border-b border-black/[0.08] bg-[rgba(252,249,246,0.97)] px-4 py-3 backdrop-blur md:hidden" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="dc-eyebrow">DonateCrate</p>
              <p className="text-sm font-semibold text-[var(--dc-gray-900)]">{activeLabel}</p>
            </div>
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="dc-btn-secondary !py-2 !px-3"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M2 4h12M2 8h12M2 12h12" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
              {mobileMenuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {/* Mobile overlay */}
        {mobileMenuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu overlay"
          />
        ) : null}

        {/* Sidebar */}
        <aside
          className={`fixed left-0 top-0 z-40 h-screen w-[86vw] max-w-[320px] overflow-y-auto border-r border-black/[0.08] bg-[rgba(252,249,246,0.97)] backdrop-blur transition-all duration-200 md:sticky md:z-auto md:max-w-none ${
            collapsed ? "md:w-[72px]" : "md:w-[272px]"
          } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
          style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.04)" }}
        >
          {collapsed ? (
            <div className="flex justify-center border-b border-black/[0.08] px-2 py-3">
              <button
                onClick={() => setCollapsed(false)}
                className="inline-flex rounded-full border border-black/10 bg-white p-2 text-[var(--dc-gray-500)] shadow-sm hover:bg-[var(--dc-gray-50)] hover:text-[var(--dc-gray-900)] transition-colors duration-150"
                aria-label="Expand sidebar"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-5">
              <div>
                <p className="dc-eyebrow">DonateCrate</p>
                <p className="font-bold text-[1.05rem] text-[var(--dc-gray-900)]">Customer Portal</p>
                <p className="mt-1 max-w-[220px] text-xs leading-5 text-[var(--dc-gray-500)]">
                  Your monthly donation routine, reminders, and referral rewards.
                </p>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="hidden shrink-0 rounded-full border border-black/10 bg-white p-2 text-[var(--dc-gray-500)] shadow-sm hover:bg-[var(--dc-gray-50)] hover:text-[var(--dc-gray-900)] transition-colors duration-150 md:inline-flex"
                aria-label="Collapse sidebar"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M10 3l-5 5 5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
          <nav className={`space-y-1.5 py-4 ${collapsed ? "px-2" : "px-3"}`}>
            {!collapsed ? (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--dc-gray-500)]">
                Your account
              </p>
            ) : null}
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
                  className={`dc-nav-item ${
                    collapsed
                      ? "justify-center border-none bg-transparent px-0 py-1.5 hover:bg-transparent"
                      : isActive
                        ? "dc-nav-item-active"
                        : "dc-nav-item-inactive"
                  } ${!collapsed ? "gap-3 px-3 py-3" : ""}`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <span
                    className={`inline-flex items-center justify-center rounded-xl transition-all duration-150 ${
                      collapsed ? "h-10 w-10" : "h-9 w-9"
                    } ${
                      isActive
                        ? collapsed
                          ? "bg-[var(--dc-orange)] text-white shadow-[0_4px_14px_rgba(255,106,0,0.28)]"
                          : "bg-white/10 text-white"
                        : collapsed
                          ? "bg-[var(--dc-gray-100)] text-[var(--dc-gray-600)] hover:bg-[var(--dc-gray-200)] hover:text-[var(--dc-gray-900)]"
                          : "bg-[var(--dc-gray-100)] text-[var(--dc-gray-900)]"
                    }`}
                  >
                    <NavIcon kind={item.icon} />
                  </span>
                  {!collapsed ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span>{item.label}</span>
                      {isActive ? <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Open</span> : null}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          {!collapsed ? (
            <div className="space-y-2.5 px-3">
              <div className="rounded-xl border border-black/[0.07] bg-white/80 p-3.5 backdrop-blur">
                <p className="dc-eyebrow">Start here</p>
                <p className="mt-2 text-sm font-semibold text-[var(--dc-gray-900)]">Most months only need one step.</p>
                <p className="mt-1 text-xs leading-5 text-[var(--dc-gray-500)]">
                  Open Pickups, confirm whether your bag is ready, then you're done.
                </p>
              </div>
            </div>
          ) : null}
          <div className={`mt-4 pb-4 ${collapsed ? "flex justify-center px-2" : "px-3"}`}>
            <SignOutButton collapsed={collapsed} />
          </div>
        </aside>

        <main className="flex-1 overflow-x-clip px-4 pb-24 pt-20 md:px-8 md:pb-8 md:pt-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-[rgba(252,249,246,0.98)] backdrop-blur dc-safe-bottom md:hidden" style={{ boxShadow: "0 -1px 12px rgba(0,0,0,0.05)" }}>
        <div className="flex items-stretch justify-around">
          {navItems.slice(0, 4).map((item) => {
            const isActive =
              item.href === "/app/profile"
                ? pathname === "/app/profile"
                : pathname === "/app" && activeTab === item.tab;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors duration-150 ${
                  isActive
                    ? "text-[var(--dc-orange)]"
                    : "text-[var(--dc-gray-400)] hover:text-[var(--dc-gray-700)]"
                }`}
                aria-label={item.label}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 ${isActive ? "bg-[rgba(255,106,0,0.1)]" : ""}`}>
                  <NavIcon kind={item.icon} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
