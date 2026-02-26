"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const activeTab = searchParams.get("tab") || "overview";
  const navItems = [
    { href: "/app?tab=overview", tab: "overview", label: "Overview", short: "Ovr" },
    { href: "/app?tab=pickups", tab: "pickups", label: "Pickups", short: "Pup" },
    { href: "/app?tab=referrals", tab: "referrals", label: "Referrals", short: "Ref" },
    { href: "/app?tab=settings", tab: "settings", label: "Settings", short: "Set" },
    { href: "/app/profile", label: "Profile", short: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-[var(--dc-gray-100)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
        <aside
          className={`sticky top-0 h-screen border-r border-black/10 bg-white transition-all duration-200 ${
            collapsed ? "w-[84px]" : "w-[280px]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
            <div className={collapsed ? "hidden" : "block"}>
              <p className="text-sm font-semibold text-[var(--dc-gray-700)]">DonateCrate</p>
              <p className="font-bold">Customer Portal</p>
            </div>
            <button
              onClick={() => setCollapsed((prev) => !prev)}
              className="rounded-md border border-black/20 px-2 py-1 text-xs font-semibold hover:bg-[var(--dc-gray-100)]"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? ">>" : "<<"}
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
                  className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-[var(--dc-orange)] text-white"
                      : "border border-black/20 text-[var(--dc-gray-900)] hover:bg-[var(--dc-gray-100)]"
                  }`}
                >
                  {collapsed ? item.short : item.label}
                </Link>
              );
            })}
          </nav>
          {!collapsed ? (
            <div className="px-3">
              <details className="rounded-lg border border-black/10 bg-[var(--dc-gray-100)] p-3" open>
                <summary className="cursor-pointer text-sm font-semibold">How this portal works</summary>
                <ul className="mt-2 space-y-2 text-xs text-[var(--dc-gray-700)]">
                  <li>1. Keep your profile and pickup address updated in Profile.</li>
                  <li>2. Submit your monthly pickup status from Dashboard.</li>
                  <li>3. Manage billing, referrals, and notifications in one place.</li>
                </ul>
              </details>
            </div>
          ) : null}
          <div className="mt-4 px-3">
            <SignOutButton />
          </div>
        </aside>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
