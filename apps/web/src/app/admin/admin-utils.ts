/**
 * Shared admin formatting and display utilities.
 *
 * Extracted from admin-workspace.tsx to be reusable across
 * individual tab components as the admin workspace is split up.
 */

export function localDateISO(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function localDateTimeISO(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

export function formatCurrency(amountCents: number | null, currency = "usd") {
  if (amountCents == null) return "Plan not linked";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (!isValidDate(parsed)) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function formatDate(value: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!isValidDate(parsed)) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatCardExpiry(month: number | null, year: number | null) {
  if (!month || !year) return "Not available";
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

export function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function formatRouteStatusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Draft route";
    case "assigned":
      return "Driver assigned";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    default:
      return formatStatusLabel(status);
  }
}

export function formatPartnerTeamRole(role: string) {
  switch (role) {
    case "partner_admin":
      return "Organization Admin";
    case "partner_coordinator":
      return "Coordinator";
    case "partner_driver":
      return "Driver";
    default:
      return formatStatusLabel(role);
  }
}

export function formatRoleLabel(role: string) {
  switch (role) {
    case "customer":
      return "Donor";
    case "admin":
      return "DonateCrate Admin";
    case "driver":
      return "Driver";
    case "partner_admin":
    case "partner_coordinator":
    case "partner_driver":
      return formatPartnerTeamRole(role);
    default:
      return formatStatusLabel(role);
  }
}

export function formatZoneStatusLabel(status: "pending" | "launching" | "active" | "paused") {
  switch (status) {
    case "pending":
      return "Planning";
    case "launching":
      return "Opening Soon";
    case "active":
      return "Active";
    case "paused":
      return "Paused";
  }
}

export function formatPickupRequestLabel(status: string) {
  switch (status) {
    case "requested":
      return "Ready for pickup";
    case "skipped":
      return "Skipped this month";
    case "confirmed":
      return "Confirmed by ops";
    case "picked_up":
      return "Collected";
    case "not_ready":
      return "Not ready";
    case "missed":
      return "Missed";
    default:
      return formatStatusLabel(status);
  }
}
