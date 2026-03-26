export const PARTNER_TEAM_ROLES = ["partner_admin", "partner_coordinator", "partner_driver"] as const;
export const GLOBAL_APP_ROLES = ["customer", "admin", "driver"] as const;
export const APP_ROLES = [...GLOBAL_APP_ROLES, ...PARTNER_TEAM_ROLES] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type GlobalAppRole = (typeof GLOBAL_APP_ROLES)[number];

export function isAdminRole(role: string | null | undefined): role is Extract<AppRole, "admin"> {
  return role === "admin";
}

export function isDriverRole(role: string | null | undefined): role is Extract<AppRole, "driver"> {
  return role === "driver";
}

export function isPartnerRole(
  role: string | null | undefined,
): role is Extract<AppRole, (typeof PARTNER_TEAM_ROLES)[number]> {
  return role === "partner_admin" || role === "partner_coordinator" || role === "partner_driver";
}

export function isPartnerAdminRole(role: string | null | undefined): role is Extract<AppRole, "partner_admin"> {
  return role === "partner_admin";
}

export function canManagePartnerSchedule(role: string | null | undefined) {
  return role === "partner_admin" || role === "partner_coordinator";
}

export function hasOperationsConsoleAccess(role: string | null | undefined) {
  return isAdminRole(role) || isDriverRole(role);
}

export function getDefaultHomePath(
  role: string | null | undefined,
  options?: { hasActivePartnerMembership?: boolean },
) {
  if (hasOperationsConsoleAccess(role)) return "/admin";
  if (options?.hasActivePartnerMembership) return "/partner";
  return "/app";
}
