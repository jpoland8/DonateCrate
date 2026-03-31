"use client";

import type { GlobalAppRole } from "@/lib/access";
import type { AdminUser, AdminZone, PeopleSubtab } from "../admin-types";

export type AdminPeopleTabProps = {
  peopleSubtab: PeopleSubtab;
  userSearch: string;
  setUserSearch: (value: string) => void;
  roleFilter: "all" | GlobalAppRole;
  setRoleFilter: (value: "all" | GlobalAppRole) => void;
  userZoneFilter: string;
  setUserZoneFilter: (value: string) => void;
  filteredCustomerUsers: AdminUser[];
  filteredStaffUsers: AdminUser[];
  zones: AdminZone[];
  updateUserRole: (userId: string, role: GlobalAppRole) => void;
};

export function AdminPeopleTab({
  peopleSubtab,
  userSearch,
  setUserSearch,
  roleFilter,
  setRoleFilter,
  userZoneFilter,
  setUserZoneFilter,
  filteredCustomerUsers,
  filteredStaffUsers,
  zones,
  updateUserRole,
}: AdminPeopleTabProps) {
  return (
    <section className="rounded-3xl border border-admin bg-admin-surface p-6">
      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href="/admin?tab=people&sub=customers"
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
            peopleSubtab === "customers"
              ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
              : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
          }`}
        >
          Customers
        </a>
        <a
          href="/admin?tab=people&sub=staff"
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
            peopleSubtab === "staff"
              ? "border-[var(--dc-orange)] bg-[var(--dc-orange)]/15"
              : "border-admin-strong bg-admin-panel hover:bg-admin-surface-strong"
          }`}
        >
          Staff
        </a>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{peopleSubtab === "customers" ? "Donor Directory" : "Team Directory"}</p>
          <p className="text-xs text-admin-soft">
            {peopleSubtab === "customers"
              ? "Search donor accounts by name, email, or ZIP and check where they are assigned."
              : "Review DonateCrate staff and organization team roles without donor records mixed in."}
          </p>
        </div>
        <input
          value={userSearch}
          onChange={(event) => setUserSearch(event.target.value)}
          placeholder="Search users"
          className="dc-input-admin w-full sm:min-w-[220px] sm:w-auto"
        />
        {peopleSubtab === "staff" ? (
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "all" | GlobalAppRole)}
            className="dc-input-admin w-full sm:w-auto"
          >
            <option value="all">All team roles</option>
            <option value="customer">Donor accounts</option>
            <option value="driver">Driver</option>
            <option value="admin">DonateCrate Admin</option>
          </select>
        ) : (
          <div className="h-10 rounded-xl border border-admin bg-admin-panel px-3 text-sm flex items-center text-admin-soft">
            Showing donor accounts
          </div>
        )}
        <select
          value={userZoneFilter}
          onChange={(event) => setUserZoneFilter(event.target.value)}
          className="dc-input-admin w-full sm:w-auto"
        >
          <option value="all">All zones</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>{zone.name}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2">
        {(peopleSubtab === "customers" ? filteredCustomerUsers : filteredStaffUsers).map((user) => (
          <article key={user.id} className="rounded-2xl border border-admin bg-admin-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{user.full_name || "No name set"}</p>
                <p className="text-xs text-admin-muted">{user.email}</p>
              </div>
              {peopleSubtab === "staff" ? (
                <select
                  value={user.role}
                  onChange={(event) => updateUserRole(user.id, event.target.value as GlobalAppRole)}
                  className="dc-input-admin !h-9 text-xs"
                >
                  <option value="customer">Donor</option>
                  <option value="driver">Driver</option>
                  <option value="admin">DonateCrate Admin</option>
                </select>
              ) : (
                <span className="rounded-full border border-admin px-3 py-1 text-xs font-semibold text-admin-muted">Donor</span>
              )}
            </div>
            <div className="mt-3 grid gap-2 text-xs text-admin-muted md:grid-cols-3">
              <p>Phone: {user.phone || "Not set"}</p>
              <p>
                Address:{" "}
                {user.primary_address
                  ? `${user.primary_address.address_line1}, ${user.primary_address.city}, ${user.primary_address.state} ${user.primary_address.postal_code}`
                  : "Not set"}
              </p>
              <p>
                Service areas:{" "}
                {user.zones.length > 0
                  ? user.zones.map((zone) => `${zone.name} (${zone.membershipStatus})`).join(" | ")
                  : "Unassigned"}
              </p>
            </div>
          </article>
        ))}
        {(peopleSubtab === "customers" ? filteredCustomerUsers : filteredStaffUsers).length === 0 ? (
          <p className="text-sm text-admin-soft">No users match the current filters.</p>
        ) : null}
      </div>

      <section className="mt-6 rounded-2xl border border-admin bg-admin-panel p-4">
        <p className="text-sm font-semibold">{peopleSubtab === "customers" ? "Donors And Billing" : "Team And Network"}</p>
        <p className="mt-2 text-sm text-admin-muted">
          {peopleSubtab === "customers"
            ? "Use this view for donor contact details and service area placement. Use Billing for cancellations, renewals, payment status, and Stripe-backed subscription actions."
            : "Use this view for DonateCrate and organization team roles. Use Network for service area ownership and organization account management."}
        </p>
      </section>
    </section>
  );
}
