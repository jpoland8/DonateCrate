"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";

type PartnerShellProps = {
  children: React.ReactNode;
};

export function PartnerShell({ children }: PartnerShellProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "home";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navItems = [
    { href: "/partner?tab=home", tab: "home", label: "Home" },
    { href: "/partner?tab=pickups", tab: "pickups", label: "Pickups" },
    { href: "/partner?tab=service-areas", tab: "service-areas", label: "Service Areas" },
    { href: "/partner?tab=team", tab: "team", label: "Team" },
    { href: "/partner?tab=organization", tab: "organization", label: "Organization" },
  ];

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,106,0,0.14)_0%,transparent_24%),radial-gradient(circle_at_bottom_left,rgba(15,118,110,0.12)_0%,transparent_24%),linear-gradient(180deg,#f4efe8_0%,#ece4da_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-[300px] border-r border-black/10 bg-[rgba(248,245,240,0.92)] p-4 backdrop-blur md:block">
          <div className="rounded-[1.9rem] border border-black/10 bg-white/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">DonateCrate</p>
            <h1 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">Partner Portal</h1>
            <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
              Keep pickups moving, keep service areas healthy, and keep your donor-facing details current.
            </p>
          </div>

          <nav className="mt-4 space-y-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15 text-[var(--dc-gray-900)]"
                      : "border-black/10 bg-white/70 text-[var(--dc-gray-800)] hover:bg-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 rounded-[1.5rem] border border-black/10 bg-white/75 p-4 text-xs text-[var(--dc-gray-700)] shadow-sm">
            <p className="font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-900)]">How To Use This</p>
            <p className="mt-2">`Home` tells your team what needs attention now.</p>
            <p className="mt-1">`Pickups` is where route-day work and pickup scheduling happen.</p>
            <p className="mt-1">`Service Areas`, `Team`, and `Organization` cover the rest.</p>
          </div>

          <div className="mt-4">
            <SignOutButton />
          </div>
        </aside>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="sticky top-0 z-30 mb-4 md:hidden">
            <div className="rounded-[1.5rem] border border-black/10 bg-white/92 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">DonateCrate</p>
                  <p className="mt-1 text-lg font-bold text-[var(--dc-gray-900)]">Partner Portal</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[var(--dc-gray-100)] px-4 py-2 text-sm font-semibold text-[var(--dc-gray-900)]"
                >
                  <span>Menu</span>
                  <span className="text-base leading-none">+</span>
                </button>
              </div>
              <p className="mt-3 text-sm text-[var(--dc-gray-700)]">
                Open the sidebar to move between pickups, service areas, team, and organization settings.
              </p>
            </div>
          </div>
          {children}
        </main>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-[rgba(18,25,38,0.42)] transition-opacity duration-200 md:hidden ${
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col border-r border-black/10 bg-[rgba(248,245,240,0.98)] p-4 shadow-2xl backdrop-blur transition-transform duration-200 md:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileNavOpen}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-[1.9rem] border border-black/10 bg-white/85 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">DonateCrate</p>
            <h1 className="mt-2 text-2xl font-bold text-[var(--dc-gray-900)]">Partner Portal</h1>
            <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
              Keep pickups moving, keep service areas healthy, and keep your donor-facing details current.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="mt-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-lg font-semibold text-[var(--dc-gray-900)]"
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <nav className="mt-4 space-y-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15 text-[var(--dc-gray-900)]"
                    : "border-black/10 bg-white/80 text-[var(--dc-gray-800)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-[1.5rem] border border-black/10 bg-white/80 p-4 text-xs text-[var(--dc-gray-700)] shadow-sm">
          <p className="font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-900)]">How To Use This</p>
          <p className="mt-2">Home tells your team what needs attention now.</p>
          <p className="mt-1">Pickups is where route-day work and pickup scheduling happen.</p>
          <p className="mt-1">Service Areas, Team, and Organization cover the rest.</p>
        </div>

        <div className="mt-auto pt-4">
          <SignOutButton />
        </div>
      </aside>
    </div>
  );
}
