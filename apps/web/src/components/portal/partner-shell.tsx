"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";

type PartnerShellProps = {
  children: React.ReactNode;
};

function NavIcon({ kind }: { kind: "home" | "pickups" | "service-areas" | "team" | "organization" }) {
  const base = "h-4 w-4";
  switch (kind) {
    case "home":
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
    case "service-areas":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M12 22s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.5" strokeWidth="2" />
        </svg>
      );
    case "team":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeWidth="2" />
          <circle cx="9" cy="7" r="4" strokeWidth="2" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" />
        </svg>
      );
    case "organization":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={base} aria-hidden>
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" strokeWidth="2" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeWidth="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function PartnerShell({ children }: PartnerShellProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "home";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navItems = [
    { href: "/partner?tab=home", tab: "home", label: "Home", icon: "home" as const },
    { href: "/partner?tab=pickups", tab: "pickups", label: "Pickups", icon: "pickups" as const },
    { href: "/partner?tab=service-areas", tab: "service-areas", label: "Service Areas", icon: "service-areas" as const },
    { href: "/partner?tab=team", tab: "team", label: "Team", icon: "team" as const },
    { href: "/partner?tab=organization", tab: "organization", label: "Organization", icon: "organization" as const },
  ];

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  const renderNav = (onClickNav?: () => void) => (
    <nav className={`space-y-1.5 py-4 ${collapsed ? "px-2" : "px-3"}`}>
      {!collapsed ? (
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--dc-gray-500)]">
          Your workspace
        </p>
      ) : null}
      {navItems.map((item) => {
        const isActive = activeTab === item.tab;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClickNav}
            className={`dc-nav-item ${
              isActive
                ? "dc-nav-item-active"
                : "dc-nav-item-inactive"
            } ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-3"}`}
            aria-label={item.label}
            title={item.label}
          >
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                isActive ? "bg-white/10 text-white" : "bg-[var(--dc-gray-100)] text-[var(--dc-gray-900)]"
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
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,106,0,0.14)_0%,transparent_24%),radial-gradient(circle_at_bottom_left,rgba(15,118,110,0.12)_0%,transparent_24%),linear-gradient(180deg,#f4efe8_0%,#ece4da_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside
          className={`sticky top-0 hidden h-screen overflow-y-auto border-r border-black/8 bg-[rgba(248,245,240,0.92)] backdrop-blur md:block transition-all duration-200 ${
            collapsed ? "w-[72px]" : "w-[280px]"
          }`}
        >
          <div className={`border-b border-black/8 py-5 ${collapsed ? "px-2" : "px-4"}`}>
            <div className={`flex ${collapsed ? "justify-center" : "items-center justify-between"}`}>
              <div className={collapsed ? "hidden" : "block"}>
                <p className="dc-eyebrow">DonateCrate</p>
                <p className="mt-1 font-bold text-[1.05rem] text-[var(--dc-gray-900)]">Partner Portal</p>
                <p className="mt-1 max-w-[220px] text-xs leading-5 text-[var(--dc-gray-500)]">
                  Keep pickups moving, service areas healthy, and donor details current.
                </p>
              </div>
              <button
                onClick={() => setCollapsed((prev) => !prev)}
                className="hidden rounded-full border border-black/10 bg-white p-2 text-[var(--dc-gray-500)] shadow-sm hover:bg-[var(--dc-gray-50)] hover:text-[var(--dc-gray-900)] md:inline-flex transition-colors duration-150"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  {collapsed ? (
                    <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M10 3l-5 5 5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {renderNav()}

          {!collapsed ? (
            <div className="space-y-3 px-3">
              <div className="dc-card p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dc-orange)]">How To Use This</p>
                <p className="mt-2 text-xs leading-5 text-[var(--dc-gray-600)]">
                  <span className="font-semibold text-[var(--dc-gray-900)]">Home</span> tells your team what needs attention.{" "}
                  <span className="font-semibold text-[var(--dc-gray-900)]">Pickups</span> is where route-day work happens.
                </p>
              </div>
            </div>
          ) : null}

          <div className={`mt-4 pb-4 ${collapsed ? "px-2" : "px-3"}`}>
            <SignOutButton />
          </div>
        </aside>

        <main className="flex-1 px-4 py-6 pb-8 md:px-8 md:py-8">
          {/* Mobile header */}
          <div className="sticky top-0 z-30 mb-4 md:hidden">
            <div className="dc-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="dc-eyebrow">DonateCrate</p>
                  <p className="mt-1 text-lg font-bold text-[var(--dc-gray-900)]">Partner Portal</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="dc-btn-secondary !min-h-[44px] !py-2 !px-4"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden>
                    <path d="M3 5h14M3 10h14M3 15h14" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Menu
                </button>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-[rgba(18,25,38,0.42)] transition-opacity duration-200 md:hidden ${
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileNavOpen(false)}
      />
      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col border-r border-black/8 bg-[rgba(248,245,240,0.98)] shadow-2xl backdrop-blur transition-transform duration-200 md:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileNavOpen}
      >
        <div className="flex items-start justify-between gap-3 p-4">
          <div>
            <p className="dc-eyebrow">DonateCrate</p>
            <h1 className="mt-1 text-xl font-bold text-[var(--dc-gray-900)]">Partner Portal</h1>
            <p className="mt-1 text-xs leading-5 text-[var(--dc-gray-500)]">
              Keep pickups moving, service areas healthy, and donor details current.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--dc-gray-700)] shadow-sm transition-colors duration-150 hover:bg-[var(--dc-gray-50)]"
            aria-label="Close navigation"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {renderNav(() => setMobileNavOpen(false))}

        <div className="px-3">
          <div className="dc-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dc-orange)]">How To Use This</p>
            <p className="mt-2 text-xs leading-5 text-[var(--dc-gray-600)]">
              Home tells your team what needs attention. Pickups is where route-day work happens.
            </p>
          </div>
        </div>

        <div className="mt-auto p-4 dc-safe-bottom">
          <SignOutButton />
        </div>
      </aside>
    </div>
  );
}
