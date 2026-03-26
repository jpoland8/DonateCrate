import type { SupabaseClient } from "@supabase/supabase-js";

type AdminSupabaseClient = SupabaseClient;

function buildPartnerDriverEmployeeId(userId: string) {
  return `PTNR-${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function ensurePartnerDriverProfile(params: {
  supabase: AdminSupabaseClient;
  userId: string;
  role: string;
}) {
  return syncPartnerDriverProfile(params);
}

export async function syncPartnerDriverProfile(params: {
  supabase: AdminSupabaseClient;
  userId: string;
}) {
  const { supabase, userId } = params;
  const employeeId = buildPartnerDriverEmployeeId(userId);
  const { data: activeMemberships, error: membershipError } = await supabase
    .from("partner_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("active", true);

  if (membershipError) {
    return { error: membershipError };
  }

  const shouldHaveDriverProfile = (activeMemberships ?? []).some(
    (membership) => membership.role === "partner_coordinator" || membership.role === "partner_driver",
  );
  const { data: existingDriver, error: existingDriverError } = await supabase
    .from("drivers")
    .select("id,employee_id,active")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingDriverError) {
    return { error: existingDriverError };
  }

  const ownsPartnerDriverProfile = existingDriver?.employee_id === employeeId;

  if (!shouldHaveDriverProfile) {
    if (!ownsPartnerDriverProfile) {
      return { error: null };
    }

    const { error } = await supabase.from("drivers").delete().eq("id", existingDriver.id);
    return { error: error ?? null };
  }

  if (existingDriver && !ownsPartnerDriverProfile) {
    return { error: null };
  }

  const { error } = await supabase.from("drivers").upsert(
    {
      user_id: userId,
      employee_id: employeeId,
      active: true,
    },
    { onConflict: "user_id" },
  );

  return { error: error ?? null };
}
