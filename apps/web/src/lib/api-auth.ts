import { createClient } from "@/lib/supabase/server";
import { getCurrentPartnerRole } from "@/lib/partner-access";

export function createCorrelationId(prefix = "dc") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function getAuthenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id,email,full_name,phone,role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const { partnerRole } = await getCurrentPartnerRole({
    supabase,
    userId: profile.id,
  });

  return {
    supabase,
    user,
    profile,
    partnerRole,
  };
}
