import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/access";

export async function getActivePartnerMemberships(params: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { supabase, userId } = params;
  const { data, error } = await supabase
    .from("partner_memberships")
    .select("partner_id,role")
    .eq("user_id", userId)
    .eq("active", true);

  if (error) {
    return { memberships: [], error };
  }

  return {
    memberships: (data ?? []).map((row) => ({
      partnerId: row.partner_id,
      role: row.role,
    })),
    error: null,
  };
}

export function getHighestPartnerRole(
  roles: Array<string | null | undefined>,
): Extract<AppRole, "partner_admin" | "partner_coordinator" | "partner_driver"> | null {
  if (roles.some((role) => role === "partner_admin")) return "partner_admin";
  if (roles.some((role) => role === "partner_coordinator")) return "partner_coordinator";
  if (roles.some((role) => role === "partner_driver")) return "partner_driver";
  return null;
}

export async function getCurrentPartnerRole(params: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { memberships, error } = await getActivePartnerMemberships(params);
  return {
    partnerRole: getHighestPartnerRole(memberships.map((membership) => membership.role)),
    memberships,
    error,
  };
}

export async function userCanAccessPartner(params: {
  supabase: SupabaseClient;
  userId: string;
  partnerId: string | null | undefined;
}) {
  if (!params.partnerId) return false;
  const { memberships } = await getActivePartnerMemberships({ supabase: params.supabase, userId: params.userId });
  return memberships.some((membership) => membership.partnerId === params.partnerId);
}
