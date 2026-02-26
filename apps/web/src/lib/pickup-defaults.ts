import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureDefaultPickupRequestForUser(params: {
  supabase: SupabaseClient;
  userId: string;
  today?: string;
}) {
  const { supabase, userId } = params;
  const today = params.today ?? new Date().toISOString().slice(0, 10);

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription || subscription.status === "canceled") return null;

  const { data: cycle } = await supabase
    .from("pickup_cycles")
    .select("id,pickup_date,request_cutoff_at")
    .gte("pickup_date", today)
    .order("pickup_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!cycle) return null;

  const { data: existing } = await supabase
    .from("pickup_requests")
    .select("id,status,pickup_cycle_id,updated_at")
    .eq("user_id", userId)
    .eq("pickup_cycle_id", cycle.id)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await supabase
    .from("pickup_requests")
    .insert({
      user_id: userId,
      pickup_cycle_id: cycle.id,
      status: "requested",
      updated_at: new Date().toISOString(),
      note: "Auto-created by default monthly pickup policy",
    })
    .select("id,status,pickup_cycle_id,updated_at")
    .single();

  return created ?? null;
}
