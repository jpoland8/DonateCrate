"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ToastProvider } from "@/components/ui/toast";

function NavIcon({
  kind,
}: {
  kind: "overview" | "pickups" | "logistics" | "people" | "network" | "growth" | "communication" | "billing" | "customer";
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
    case "network":
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

const NAV_GROUPS = [
  {
    id: "operations",
    label: "Operations",
    icon: "overview" as const,
    defaultHref: "/admin?tab=overview",
    items: [
      { href: "/admin?tab=overview",      tab: "overview",      sub: null,        label: "Overview"  },
      { href: "/admin?tab=pickups",       tab: "pickups",       sub: null,        label: "Pickups"   },
      { href: "/admin?tab=logistics",     tab: "logistics",     sub: null,        label: "Dispatch"  },
      { href: "/admin?tab=communication", tab: "communication", sub: null,        label: "Messages"  },
    ],
  },
  {
    id: "members",
    label: "Members",
    icon: "people" as const,
    defaultHref: "/admin?tab=people&sub=customers",
    items: [
      { href: "/admin?tab=people&sub=customers", tab: "people",  sub: "customers", label: "Customers" },
      { href: "/admin?tab=people&sub=staff",     tab: "people",  sub: "staff",     label: "Staff"     },
      { href: "/admin?tab=billing",              tab: "billing", sub: null,        label: "Billing"   },
    ],
  },
  {
    id: "network",
    label: "Network",
    icon: "network" as const,
    defaultHref: "/admin?tab=network&sub=zones",
    items: [
      { href: "/admin?tab=network&sub=zones",    tab: "network", sub: "zones",    label: "Zones"    },
      { href: "/admin?tab=network&sub=partners", tab: "network", sub: "partners", label: "Partners" },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    icon: "growth" as const,
    defaultHref: "/admin?tab=growth",
    items: [
      { href: "/admin?tab=growth", tab: "growth", sub: null, label: "Waitlist & Referrals" },
    ],
  },
];

function getActiveGroup(tab: string): string {
  if (["overview", "pickups", "logistics", "communication"].includes(tab)) return "operations";
  if (tab === "people" || tab === "billing") return "members";
  if (tab === "network") return "network";
  if (tab === "growth") return "growth";
  return "operations";
}

type PortalLink = { label: string; href: string };

export function AdminShell({ children, portalLinks = [] }: { children: React.ReactNode; portalLinks?: PortalLink[] }) {
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
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const activeTab = searchParams.get("tab") || "overview";
  const activeSub = searchParams.get("sub");
  const activeGroup = getActiveGroup(activeTab);

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
        {/* Mobile topbar */}
        <div
          className="fixed inset-x-0 top-0 z-40 border-b px-4 py-3 backdrop-blur md:hidden"
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-topbar)", paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="dc-eyebrow">DonateCrate</p>
              <p className="text-base font-bold">Operations Admin</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-150"
                style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
              >
                {theme === "dark" ? (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <circle cx="8" cy="8" r="3" strokeWidth="1.5" />
                    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path d="M13.5 8.5a5.5 5.5 0 0 1-7-7A6 6 0 1 0 13.5 8.5Z" strokeWidth="1.5" />
                  </svg>
                )}
                {theme === "dark" ? "Light" : "Dark"}
              </button>
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-150"
                style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path d="M4 4l8 8M12 4l-8 8" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path d="M2 4h12M2 8h12M2 12h12" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {mobileMenuOpen ? "Close" : "Menu"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile overlay */}
        {mobileMenuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu overlay"
          />
        ) : null}

        {/* Sidebar */}
        <aside
          className={`fixed left-0 top-0 z-40 h-screen w-[86vw] max-w-[340px] overflow-y-auto border-r backdrop-blur transition-all duration-200 md:sticky md:z-auto md:max-w-none ${
            collapsed ? "md:w-[72px]" : "md:w-[272px]"
          } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-sidebar)", color: "var(--admin-sidebar-text)", boxShadow: "2px 0 12px rgba(0,0,0,0.06)" }}
        >
          {collapsed ? (
            /* Collapsed header — just the expand button, no wasted space */
            <div className="flex justify-center border-b px-2 py-3" style={{ borderColor: "var(--admin-border)" }}>
              <button
                onClick={() => setCollapsed(false)}
                className="inline-flex rounded-full border p-2 transition-colors duration-150 hover:bg-white/10"
                style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
                aria-label="Expand sidebar"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : (
            /* Expanded header — full title + theme toggle + collapse button */
            <div className="flex items-center justify-between border-b px-4 py-5" style={{ borderColor: "var(--admin-border)" }}>
              <div>
                <p className="dc-eyebrow">DonateCrate</p>
                <p className="mt-1 text-[1.05rem] font-bold" style={{ color: "var(--admin-text)" }}>Operations Admin</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--admin-muted)" }}>Dispatch, people, growth, and communications.</p>
              </div>
              <div className="hidden shrink-0 items-center gap-2 md:flex">
                <button
                  type="button"
                  onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150"
                  style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
                >
                  {theme === "dark" ? (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                      <circle cx="8" cy="8" r="3" strokeWidth="1.5" />
                      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M13.5 8.5a5.5 5.5 0 0 1-7-7A6 6 0 1 0 13.5 8.5Z" strokeWidth="1.5" />
                    </svg>
                  )}
                  {theme === "dark" ? "Light" : "Dark"}
                </button>
                <button
                  onClick={() => setCollapsed(true)}
                  className="inline-flex rounded-full border p-2 transition-colors duration-150 hover:bg-white/10"
                  style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
                  aria-label="Collapse sidebar"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path d="M10 3l-5 5 5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <nav className={`space-y-1.5 py-4 ${collapsed ? "px-2" : "px-3"}`}>
            {NAV_GROUPS.map((group) => {
              const isActiveGroup = group.id === activeGroup;
              const isOpen = isActiveGroup || openGroups.has(group.id);

              return (
                <div key={group.id}>
                  {/* Group parent row */}
                  {collapsed ? (
                    /* Collapsed: icon only, no label, no chevron */
                    <Link
                      href={group.defaultHref}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex justify-center rounded-xl py-1.5 cursor-pointer"
                      aria-label={group.label}
                      title={group.label}
                    >
                      <span
                        className="inline-flex items-center justify-center rounded-lg transition-all duration-150"
                        style={{
                          width: "2.5rem",
                          height: "2.5rem",
                          background: isActiveGroup ? "var(--dc-orange)" : "var(--admin-icon-inactive)",
                          color: isActiveGroup ? "white" : "var(--admin-sidebar-text)",
                          boxShadow: isActiveGroup ? "0 4px 14px rgba(255,106,0,0.32)" : undefined,
                        }}
                      >
                        <NavIcon kind={group.icon} />
                      </span>
                    </Link>
                  ) : (
                    /* Expanded: Link (icon+label → navigate) + chevron button (toggle only) */
                    <div
                      className={`flex w-full items-center rounded-xl text-sm font-semibold transition-all duration-150 ${
                        isActiveGroup
                          ? "bg-[var(--dc-orange)] text-white shadow-[0_4px_12px_rgba(255,106,0,0.28)]"
                          : "border"
                      }`}
                      style={
                        !isActiveGroup
                          ? { borderColor: "var(--admin-border)", color: "var(--admin-sidebar-text)" }
                          : undefined
                      }
                    >
                      <Link
                        href={group.defaultHref}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex flex-1 items-center gap-3 px-3 py-2.5 cursor-pointer"
                        aria-label={group.label}
                      >
                        <span
                          className="inline-flex shrink-0 items-center justify-center rounded-lg transition-all duration-150"
                          style={{
                            width: "2rem",
                            height: "2rem",
                            background: isActiveGroup ? "var(--admin-icon-active)" : "var(--admin-icon-inactive)",
                            color: isActiveGroup ? "white" : "var(--admin-sidebar-text)",
                          }}
                        >
                          <NavIcon kind={group.icon} />
                        </span>
                        <span className="flex-1 text-left">{group.label}</span>
                      </Link>
                      {/* Chevron — toggle expand/collapse only */}
                      <button
                        type="button"
                        onClick={() => {
                          setOpenGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(group.id)) next.delete(group.id);
                            else next.add(group.id);
                            return next;
                          });
                        }}
                        className="group flex items-center justify-center px-3 py-2.5 cursor-pointer"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${group.label}`}
                      >
                        <span className="inline-flex items-center justify-center rounded-md w-6 h-6 transition-colors duration-150 group-hover:bg-white/15">
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          className="h-3.5 w-3.5 shrink-0 transition-transform duration-150"
                          style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                          aria-hidden
                        >
                          <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Sub-items (expanded sidebar only) */}
                  {!collapsed && isOpen ? (
                    <div className="mt-1 pl-4 ml-3 border-l" style={{ borderColor: "var(--admin-border)" }}>
                      {group.items.map((item) => {
                        const isActiveSub =
                          pathname === "/admin" &&
                          activeTab === item.tab &&
                          (item.sub === null || activeSub === item.sub);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`block rounded-lg px-3 py-1.5 text-sm transition-all duration-150 cursor-pointer ${
                              isActiveSub ? "font-semibold" : "font-medium"
                            }`}
                            style={
                              isActiveSub
                                ? { background: "color-mix(in srgb, var(--dc-orange) 15%, transparent)", color: "var(--dc-orange)" }
                                : { color: "var(--admin-muted)" }
                            }
                            onMouseEnter={!isActiveSub ? (e) => { (e.currentTarget as HTMLElement).style.background = "var(--admin-nav-hover)"; } : undefined}
                            onMouseLeave={!isActiveSub ? (e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; } : undefined}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          {!collapsed ? (
            <div className="space-y-2.5 px-3">
              <div
                className="rounded-xl border p-3.5"
                style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-strong)" }}
              >
                <p className="dc-eyebrow">Daily ops</p>
                <p className="mt-2 text-sm font-semibold" style={{ color: "var(--admin-text)" }}>One clean pickup day at a time.</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--admin-muted)" }}>
                  Overview → Calendar → Dispatch → Messages. Watch exceptions last.
                </p>
              </div>
              <details className="rounded-xl border p-3.5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} open>
                <summary className="cursor-pointer text-sm font-semibold select-none" style={{ color: "var(--admin-text)" }}>How to run ops</summary>
                <ol className="mt-2.5 space-y-1.5 text-xs" style={{ color: "var(--admin-muted)" }}>
                  <li className="flex gap-2"><span className="font-bold" style={{ color: "var(--dc-orange)" }}>1.</span> Overview + Pickups: what's ready this cycle.</li>
                  <li className="flex gap-2"><span className="font-bold" style={{ color: "var(--dc-orange)" }}>2.</span> Zones + People: keep coverage and roles accurate.</li>
                  <li className="flex gap-2"><span className="font-bold" style={{ color: "var(--dc-orange)" }}>3.</span> Logistics: build, review, and assign routes.</li>
                </ol>
              </details>
              {portalLinks.length > 0 ? (
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
                  <p className="dc-eyebrow mb-2">Switch portal</p>
                  {portalLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150 hover:bg-white/10"
                      style={{ color: "var(--admin-sidebar-text)" }}
                    >
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "var(--admin-icon-inactive)" }}
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                          <path d="M11 2l3 3-3 3M5 14l-3-3 3-3M2 5h12M2 11h12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="flex-1">{link.label}</span>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3 w-3 shrink-0 opacity-40" aria-hidden>
                        <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {collapsed && portalLinks.length > 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-2 pb-2">
              {portalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex rounded-full border p-2 transition-colors duration-150 hover:bg-white/10"
                  style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-sidebar-text)" }}
                  title={link.label}
                  aria-label={`Switch to ${link.label}`}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path d="M11 2l3 3-3 3M5 14l-3-3 3-3M2 5h12M2 11h12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ))}
            </div>
          ) : null}

          <div className={`mt-4 pb-4 dc-safe-bottom ${collapsed ? "flex justify-center px-2" : "px-3"}`}>
            <SignOutButton tone={theme === "dark" ? "dark" : "light"} collapsed={collapsed} />
          </div>
        </aside>

        <main className="flex-1 overflow-x-clip px-4 pb-6 pt-20 md:px-6 md:pt-6">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
