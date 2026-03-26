import type { SupabaseClient } from "@supabase/supabase-js";
import { isPartnerRole } from "@/lib/access";

type AdminSupabaseClient = SupabaseClient;

export async function syncUserPartnerRole(params: {
  supabase: AdminSupabaseClient;
  userId: string;
}) {
  const { supabase, userId } = params;

  const { data: user, error: userError } = await supabase.from("users").select("id,role").eq("id", userId).maybeSingle();

  if (userError) return { error: userError };
  if (!user) return { error: new Error("User not found") };

  if (!isPartnerRole(user.role)) {
    return { error: null, role: user.role };
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ role: "customer", updated_at: new Date().toISOString() })
    .eq("id", userId);

  return {
    error: updateError ?? null,
    role: updateError ? user.role : "customer",
  };
}
